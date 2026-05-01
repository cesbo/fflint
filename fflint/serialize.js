// serialize.js
// Serialize a fflint state object into an FFmpeg command string.
//
// Usage:
//   import { serialize } from './fflint/serialize.js'
//   const cmd = serialize({ videoCodec: 'h264_nvenc', preset: 'p4', bitrateMode: 'cbr', targetBitrate: '4M', ... })
//   // → 'ffmpeg -y -hide_banner -hwaccel cuda ... -f mpegts ${o}'

/**
 * Serialize a fflint state object into an FFmpeg command string.
 *
 * Accepts the same schema that `validate()` and `parse()` use.
 * Template variables `${i}` and `${o}` are used for input/output placeholders.
 *
 * When `state._flagOrder` is present (produced by `parse()`), post-input flags
 * are emitted in the order they appeared in the original command. New flags
 * (not in `_flagOrder`) are appended at their canonical position.
 *
 * @param {object} state  fflint state object.
 * @param {object} [options]
 * @param {string} [options.inputPlaceholder='${i}']   Placeholder for the input source.
 * @param {string} [options.outputPlaceholder='${o}']  Placeholder for the output destination.
 * @param {boolean} [options.withHints=false]           Return { command, hints } instead of string.
 * @returns {string | { command: string, hints: Array<{ severity: string, flag: string, message: string }> }}
 */
export function serialize(state, options = {}) {
  const s = state || {}
  const inputPlaceholder  = options.inputPlaceholder  || '${i}'
  const outputPlaceholder = options.outputPlaceholder || '${o}'
  const withHints = !!options.withHints

  const p = ['ffmpeg', '-y', '-hide_banner']

  const isEncoding = s.videoCodec && s.videoCodec !== 'copy' && s.videoCodec !== 'disabled'
  const isGpuCodec = s.videoCodec && (s.videoCodec.includes('nvenc') || s.videoCodec.includes('vaapi') || s.videoCodec.includes('qsv'))
  const isNvenc    = s.videoCodec && s.videoCodec.includes('nvenc')

  // ── Pre-input options (must stay before -i for FFmpeg correctness) ─────────

  const PRE_INPUT_FIELDS = new Set([
    'hwaccel', 'hwaccelOutputFormat', 'nvdecDeint', 'gpuIndex',
    're', 'streamLoop', 'fflags', 'useWallclock', 'analyzeDuration',
    'probeSize', 'timeout', 'threadQueueSize', 'reconnect', 'reconnectStreamed', 'listen',
  ])

  const preInputEmitters = buildPreInputEmitters(s, isEncoding, isGpuCodec, isNvenc)
  const postInputEmitters = buildPostInputEmitters(s, isEncoding, isGpuCodec, isNvenc)

  // Emit pre-input flags: respect _flagOrder for ordering within the pre-input zone
  emitOrdered(p, preInputEmitters, PRE_INPUT_FIELDS, s._flagOrder)

  // Passthrough pre-input flags
  if (Array.isArray(s.passthroughPreInput) && s.passthroughPreInput.length)
    p.push(...s.passthroughPreInput)

  // ── Input ──────────────────────────────────────────────────────────────────

  p.push('-i', inputPlaceholder)

  // Logo overlay (second input)
  if (s.logoPath) p.push('-i', s.logoPath)

  // ── Post-input flags ───────────────────────────────────────────────────────

  const POST_INPUT_FIELDS = new Set(postInputEmitters.keys())
  emitOrdered(p, postInputEmitters, POST_INPUT_FIELDS, s._flagOrder)

  // Passthrough post-input flags
  if (Array.isArray(s.passthroughPostInput) && s.passthroughPostInput.length)
    p.push(...s.passthroughPostInput)

  p.push(outputPlaceholder)
  const command = p.join(' ')

  if (!withHints) return command

  const hints = []

  // Detect pre-input migration: flags that the user placed after -i
  // but belong in the pre-input zone
  if (Array.isArray(s._flagOrder) && s._flagOrder.length) {
    const inputIdx = s._flagOrder.indexOf('_input')
    if (inputIdx !== -1) {
      for (let k = inputIdx + 1; k < s._flagOrder.length; k++) {
        const field = s._flagOrder[k]
        if (PRE_INPUT_FIELDS.has(field)) {
          const emitter = preInputEmitters.get(field)
          const tokens = emitter ? emitter() : []
          if (tokens.length) {
            const cliFlag = tokens[0]
            hints.push({
              severity: 'info',
              flag: cliFlag,
              message: `${cliFlag} moved before -i (required by FFmpeg)`,
            })
          }
        }
      }
    }
  }

  // Warn about passthrough (unrecognized) flags
  const ptFlags = [
    ...(Array.isArray(s.passthroughPreInput) ? s.passthroughPreInput : []),
    ...(Array.isArray(s.passthroughPostInput) ? s.passthroughPostInput : []),
  ]
  for (let j = 0; j < ptFlags.length; j++) {
    const f = ptFlags[j]
    if (f.startsWith('-')) {
      hints.push({
        severity: 'warning',
        flag: f,
        message: `${f} is not recognized by fflint and was not validated`,
      })
      // Skip the value token if present
      if (j + 1 < ptFlags.length && !ptFlags[j + 1].startsWith('-')) j++
    }
  }

  return { command, hints }
}

// ─── Emit helpers ─────────────────────────────────────────────────────────────

function emitOrdered(p, emitters, allowedFields, flagOrder) {
  const emitted = new Set()

  // Phase 1: emit in user's order (if _flagOrder present)
  if (Array.isArray(flagOrder) && flagOrder.length) {
    for (const field of flagOrder) {
      if (!allowedFields.has(field)) continue
      if (emitted.has(field)) continue
      const emitter = emitters.get(field)
      if (emitter) {
        const tokens = emitter()
        if (tokens && tokens.length) p.push(...tokens)
      }
      emitted.add(field)
    }
  }

  // Phase 2: emit remaining fields in canonical (Map insertion) order
  for (const [field, emitter] of emitters) {
    if (emitted.has(field)) continue
    const tokens = emitter()
    if (tokens && tokens.length) p.push(...tokens)
    emitted.add(field)
  }
}

// ─── Pre-input emitter map ────────────────────────────────────────────────────

function buildPreInputEmitters(s, isEncoding, isGpuCodec, isNvenc) {
  const m = new Map()

  m.set('hwaccel', () =>
    s.hwaccel && s.hwaccel !== 'none' && isGpuCodec && isEncoding
      ? ['-hwaccel', s.hwaccel] : [])
  m.set('hwaccelOutputFormat', () =>
    s.hwaccelOutputFormat && s.hwaccelOutputFormat !== 'none' && isGpuCodec && isEncoding
      ? ['-hwaccel_output_format', s.hwaccelOutputFormat] : [])
  m.set('nvdecDeint', () =>
    s.nvdecDeint !== undefined && s.nvdecDeint !== '' && isNvenc && isEncoding
      ? ['-deint', String(s.nvdecDeint)] : [])
  m.set('gpuIndex', () =>
    s.gpuIndex !== undefined && s.gpuIndex !== '' && isNvenc
      ? ['-gpu', String(s.gpuIndex)] : [])
  m.set('re', () => s.re ? ['-re'] : [])
  m.set('streamLoop', () =>
    s.streamLoop === true || (Number.isInteger(s.streamLoop) && s.streamLoop !== 0)
      ? ['-stream_loop', String(s.streamLoop === true ? -1 : s.streamLoop)] : [])
  m.set('fflags', () =>
    Array.isArray(s.fflags) && s.fflags.length ? ['-fflags', s.fflags.join('')] : [])
  m.set('useWallclock', () => s.useWallclock ? ['-use_wallclock_as_timestamps', '1'] : [])
  m.set('analyzeDuration', () =>
    s.analyzeDuration !== undefined && s.analyzeDuration !== ''
      ? ['-analyzeduration', String(s.analyzeDuration)] : [])
  m.set('probeSize', () =>
    s.probeSize !== undefined && s.probeSize !== ''
      ? ['-probesize', String(s.probeSize)] : [])
  m.set('timeout', () =>
    s.timeout !== undefined && s.timeout !== '' ? ['-timeout', String(s.timeout)] : [])
  m.set('threadQueueSize', () =>
    s.threadQueueSize !== undefined && s.threadQueueSize !== ''
      ? ['-thread_queue_size', String(s.threadQueueSize)] : [])
  m.set('reconnect', () => s.reconnect ? ['-reconnect', '1'] : [])
  m.set('reconnectStreamed', () => s.reconnectStreamed ? ['-reconnect_streamed', '1'] : [])
  m.set('listen', () =>
    s.listen !== undefined && s.listen !== '' ? ['-listen', String(s.listen)] : [])

  return m
}

// ─── Post-input emitter map ───────────────────────────────────────────────────

function buildPostInputEmitters(s, isEncoding, isGpuCodec, isNvenc) {
  const m = new Map()

  // Stream mapping
  m.set('maps', () => {
    if (!Array.isArray(s.maps) || !s.maps.length) return []
    const r = []
    for (const map of s.maps) { if (map.trim()) r.push('-map', map.trim()) }
    return r
  })

  // Video codec
  m.set('videoCodec', () => {
    if (s.videoCodec === 'disabled') return ['-vn']
    if (s.videoCodec) return ['-c:v', s.videoCodec]
    return []
  })

  // Video encoding options
  m.set('preset', () => isEncoding && s.preset ? ['-preset', s.preset] : [])
  m.set('tune', () => isEncoding && s.tune ? ['-tune', s.tune] : [])
  m.set('profile', () => isEncoding && s.profile ? ['-profile:v', s.profile] : [])
  m.set('tier', () => isEncoding && s.tier ? ['-tier', s.tier] : [])
  m.set('lookahead', () =>
    isEncoding && s.lookahead !== undefined && s.lookahead !== ''
      ? ['-lookahead', String(s.lookahead)] : [])

  m.set('frameSize', () => {
    if (!isEncoding) return []
    const fs = resolveFrameSize(s)
    return fs && fs !== 'original' ? ['-s', fs] : []
  })

  m.set('fps', () => {
    if (!isEncoding) return []
    const fps = resolveFps(s)
    return fps && fps !== 'original' ? ['-r', fps] : []
  })

  m.set('gop', () => {
    if (!isEncoding) return []
    if (s.gop === undefined || s.gop === '') return []
    const r = ['-g', String(s.gop)]
    if (s.keyintMin !== undefined && s.keyintMin !== '')
      r.push('-keyint_min', String(s.keyintMin))
    return r
  })
  // keyintMin is emitted together with gop, but we register it for ordering
  m.set('keyintMin', () => [])

  m.set('vfChain', () => {
    if (!isEncoding) return []
    if (s.vfChain) {
      const needsQuotes = /[ ,;]/.test(s.vfChain)
      const r = ['-filter:v', needsQuotes ? `"${s.vfChain}"` : s.vfChain]
      if (s.logoPath) r.push('-filter_complex', 'overlay')
      return r
    }
    const filters = []
    if (s.deinterlaceFilter) filters.push(s.deinterlaceFilter)
    if (s.logoPath) filters.push('overlay')
    if (filters.length > 0) {
      if (s.logoPath) return ['-filter_complex', filters.join(',')]
      return ['-filter:v', filters.join(',')]
    }
    return []
  })
  m.set('filterComplex', () => [])

  m.set('forcedIdr', () => isEncoding && s.forcedIdr ? ['-forced-idr', '1'] : [])

  m.set('targetBitrate', () => {
    if (!isEncoding) return []
    if (s.bitrateMode === 'cbr' && s.targetBitrate) {
      return ['-b:v', s.targetBitrate, '-maxrate', s.targetBitrate, '-bufsize', s.bufsize || s.targetBitrate]
    }
    if (s.bitrateMode === 'vbr' && s.targetBitrate) return ['-b:v', s.targetBitrate]
    if (s.bitrateMode === 'crf' && s.crfValue !== undefined && s.crfValue !== '')
      return ['-crf', String(s.crfValue)]
    return []
  })
  m.set('maxrate', () => {
    if (!isEncoding) return []
    // For CBR, maxrate is emitted with targetBitrate; for VBR emit separately
    if (s.bitrateMode === 'vbr' && s.maxrate) return ['-maxrate', s.maxrate]
    return []
  })
  m.set('bufsize', () => {
    if (!isEncoding) return []
    // For CBR, bufsize is emitted with targetBitrate; for VBR emit separately
    if (s.bitrateMode === 'vbr' && s.bufsize) return ['-bufsize', s.bufsize]
    return []
  })

  m.set('pixFmt', () => isEncoding && s.pixFmt ? ['-pix_fmt', s.pixFmt] : [])
  m.set('level', () => isEncoding && s.level ? ['-level:v', s.level] : [])
  m.set('fieldOrder', () => isEncoding && s.fieldOrder ? ['-field_order', s.fieldOrder] : [])
  m.set('colorPrimaries', () => isEncoding && s.colorPrimaries ? ['-color_primaries', s.colorPrimaries] : [])
  m.set('colorTrc', () => isEncoding && s.colorTrc ? ['-color_trc', s.colorTrc] : [])
  m.set('colorspace', () => isEncoding && s.colorspace ? ['-colorspace', s.colorspace] : [])
  m.set('scThreshold', () =>
    isEncoding && s.scThreshold !== undefined && s.scThreshold !== ''
      ? ['-sc_threshold', String(s.scThreshold)] : [])
  m.set('bframes', () =>
    isEncoding && s.bframes !== undefined && s.bframes !== ''
      ? ['-bf', String(s.bframes)] : [])
  m.set('refs', () =>
    isEncoding && s.refs !== undefined && s.refs !== ''
      ? ['-refs', String(s.refs)] : [])
  m.set('aspect', () => isEncoding && s.aspect ? ['-aspect', s.aspect] : [])
  m.set('bsfVideo', () =>
    isEncoding && s.bsfVideo && s.bsfVideo !== 'none' ? ['-bsf:v', s.bsfVideo] : [])
  m.set('fpsSyncMode', () => isEncoding && s.fpsSyncMode ? ['-fps_mode', s.fpsSyncMode] : [])

  // Audio
  m.set('audioCodec', () => {
    if (s.audioCodec === 'disabled') return ['-an']
    if (s.audioCodec) return ['-c:a', s.audioCodec]
    return []
  })
  m.set('sampleRate', () =>
    s.audioCodec && s.audioCodec !== 'copy' && s.audioCodec !== 'disabled' &&
    s.sampleRate && s.sampleRate !== 'original' ? ['-ar', s.sampleRate] : [])
  m.set('channels', () =>
    s.audioCodec && s.audioCodec !== 'copy' && s.audioCodec !== 'disabled' &&
    s.channels && s.channels !== 'original' ? ['-ac', s.channels] : [])
  m.set('channelLayout', () =>
    s.audioCodec && s.audioCodec !== 'copy' && s.audioCodec !== 'disabled' &&
    s.channelLayout ? ['-channel_layout', s.channelLayout] : [])
  m.set('audioBitrate', () =>
    s.audioCodec && s.audioCodec !== 'copy' && s.audioCodec !== 'disabled' &&
    s.audioBitrate ? ['-b:a', s.audioBitrate] : [])
  m.set('dialnorm', () =>
    s.audioCodec && s.audioCodec !== 'copy' && s.audioCodec !== 'disabled' &&
    s.dialnorm !== undefined && s.dialnorm !== '' ? ['-dialnorm', String(s.dialnorm)] : [])
  m.set('bsfAudio', () =>
    s.audioCodec && s.audioCodec !== 'copy' && s.audioCodec !== 'disabled' &&
    s.bsfAudio && s.bsfAudio !== 'none' ? ['-bsf:a', s.bsfAudio] : [])

  // Subtitles
  m.set('subtitleMode', () => {
    if (s.subtitleMode === 'disable') return ['-sn']
    if (s.subtitleMode === 'copy') return ['-c:s', 'copy']
    return []
  })

  // Output format
  m.set('outputFormat', () => s.outputFormat ? ['-f', s.outputFormat] : [])

  // HLS options
  m.set('hlsTime', () =>
    s.outputFormat === 'hls' && s.hlsTime !== undefined && s.hlsTime !== ''
      ? ['-hls_time', String(s.hlsTime)] : [])
  m.set('hlsListSize', () =>
    s.outputFormat === 'hls' && s.hlsListSize !== undefined && s.hlsListSize !== ''
      ? ['-hls_list_size', String(s.hlsListSize)] : [])
  m.set('hlsFlags', () => {
    if (s.outputFormat !== 'hls') return []
    if (Array.isArray(s.hlsFlags) && s.hlsFlags.length) return ['-hls_flags', s.hlsFlags.join('+')]
    if (typeof s.hlsFlags === 'string' && s.hlsFlags) return ['-hls_flags', s.hlsFlags]
    return []
  })
  m.set('hlsSegmentType', () =>
    s.outputFormat === 'hls' && s.hlsSegmentType && s.hlsSegmentType !== 'mpegts'
      ? ['-hls_segment_type', s.hlsSegmentType] : [])

  // MPEG-TS options
  m.set('mpegtsServiceId', () =>
    s.outputFormat === 'mpegts' && s.mpegtsServiceId !== undefined && s.mpegtsServiceId !== ''
      ? ['-mpegts_service_id', String(s.mpegtsServiceId)] : [])
  m.set('mpegtsPmtStartPid', () =>
    s.outputFormat === 'mpegts' && s.mpegtsPmtStartPid !== undefined && s.mpegtsPmtStartPid !== ''
      ? ['-mpegts_pmt_start_pid', String(s.mpegtsPmtStartPid)] : [])
  m.set('mpegtsStartPid', () =>
    s.outputFormat === 'mpegts' && s.mpegtsStartPid !== undefined && s.mpegtsStartPid !== ''
      ? ['-mpegts_start_pid', String(s.mpegtsStartPid)] : [])
  m.set('mpegtsFlags', () =>
    s.outputFormat === 'mpegts' && Array.isArray(s.mpegtsFlags) && s.mpegtsFlags.length
      ? ['-mpegts_flags', s.mpegtsFlags.join('+')] : [])
  m.set('pcrPeriod', () =>
    s.outputFormat === 'mpegts' && s.pcrPeriod !== undefined && s.pcrPeriod !== ''
      ? ['-pcr_period', String(s.pcrPeriod)] : [])

  // General output options
  m.set('maxDelay', () =>
    s.maxDelay !== undefined && s.maxDelay !== '' ? ['-max_delay', String(s.maxDelay)] : [])
  m.set('maxMuxingQueueSize', () =>
    s.maxMuxingQueueSize !== undefined && s.maxMuxingQueueSize !== ''
      ? ['-max_muxing_queue_size', String(s.maxMuxingQueueSize)] : [])
  m.set('copyts', () => s.copyts ? ['-copyts'] : [])
  m.set('avoidNegativeTs', () => s.avoidNegativeTs ? ['-avoid_negative_ts', s.avoidNegativeTs] : [])

  return m
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveFrameSize(s) {
  if (s.frameSize === 'custom') return s.customFrameSize || ''
  return s.frameSize || ''
}

function resolveFps(s) {
  if (s.fps === 'custom') return s.customFps || ''
  return s.fps || ''
}
