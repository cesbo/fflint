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
 * @param {object} state  fflint state object.
 * @param {object} [options]
 * @param {string} [options.inputPlaceholder='${i}']   Placeholder for the input source.
 * @param {string} [options.outputPlaceholder='${o}']  Placeholder for the output destination.
 * @returns {string} FFmpeg command string.
 */
export function serialize(state, options = {}) {
  const s = state || {}
  const inputPlaceholder  = options.inputPlaceholder  || '${i}'
  const outputPlaceholder = options.outputPlaceholder || '${o}'

  const p = ['ffmpeg', '-y', '-hide_banner']

  const isEncoding = s.videoCodec && s.videoCodec !== 'copy' && s.videoCodec !== 'disabled'
  const isGpuCodec = s.videoCodec && (s.videoCodec.includes('nvenc') || s.videoCodec.includes('vaapi') || s.videoCodec.includes('qsv'))
  const isNvenc    = s.videoCodec && s.videoCodec.includes('nvenc')

  // ── Pre-input options ──────────────────────────────────────────────────────

  if (s.hwaccel && s.hwaccel !== 'none' && isGpuCodec && isEncoding)
    p.push('-hwaccel', s.hwaccel)
  if (s.hwaccelOutputFormat && s.hwaccelOutputFormat !== 'none' && isGpuCodec && isEncoding)
    p.push('-hwaccel_output_format', s.hwaccelOutputFormat)
  if (s.nvdecDeint !== undefined && s.nvdecDeint !== '' && isNvenc && isEncoding)
    p.push('-deint', String(s.nvdecDeint))
  if (s.gpuIndex !== undefined && s.gpuIndex !== '' && isNvenc)
    p.push('-gpu', String(s.gpuIndex))
  if (s.re) p.push('-re')
  if (s.streamLoop === true || (Number.isInteger(s.streamLoop) && s.streamLoop !== 0))
    p.push('-stream_loop', String(s.streamLoop === true ? -1 : s.streamLoop))
  if (Array.isArray(s.fflags) && s.fflags.length)
    p.push('-fflags', s.fflags.join(''))
  if (s.useWallclock) p.push('-use_wallclock_as_timestamps', '1')
  if (s.analyzeDuration !== undefined && s.analyzeDuration !== '')
    p.push('-analyzeduration', String(s.analyzeDuration))
  if (s.probeSize !== undefined && s.probeSize !== '')
    p.push('-probesize', String(s.probeSize))
  if (s.timeout !== undefined && s.timeout !== '')
    p.push('-timeout', String(s.timeout))
  if (s.threadQueueSize !== undefined && s.threadQueueSize !== '')
    p.push('-thread_queue_size', String(s.threadQueueSize))
  if (s.reconnect) p.push('-reconnect', '1')
  if (s.reconnectStreamed) p.push('-reconnect_streamed', '1')
  if (s.listen !== undefined && s.listen !== '') p.push('-listen', String(s.listen))

  // Passthrough pre-input flags
  if (Array.isArray(s.passthroughPreInput) && s.passthroughPreInput.length)
    p.push(...s.passthroughPreInput)

  // ── Input ──────────────────────────────────────────────────────────────────

  p.push('-i', inputPlaceholder)

  // Logo overlay (second input)
  if (s.logoPath) p.push('-i', s.logoPath)

  // ── Stream mapping ─────────────────────────────────────────────────────────

  if (Array.isArray(s.maps) && s.maps.length) {
    for (const m of s.maps) {
      if (m.trim()) p.push('-map', m.trim())
    }
  }

  // ── Video ──────────────────────────────────────────────────────────────────

  if (s.videoCodec === 'disabled') {
    p.push('-vn')
  } else if (s.videoCodec) {
    p.push('-c:v', s.videoCodec)

    if (isEncoding) {
      if (s.preset) p.push('-preset', s.preset)
      if (s.tune) p.push('-tune', s.tune)
      if (s.profile) p.push('-profile:v', s.profile)
      if (s.tier) p.push('-tier', s.tier)
      if (s.lookahead !== undefined && s.lookahead !== '') p.push('-lookahead', String(s.lookahead))

      // Frame size
      const fs = resolveFrameSize(s)
      if (fs && fs !== 'original') p.push('-s', fs)

      // Frame rate
      const fps = resolveFps(s)
      if (fps && fps !== 'original') p.push('-r', fps)

      // GOP
      if (s.gop !== undefined && s.gop !== '') {
        p.push('-g', String(s.gop))
        if (s.keyintMin !== undefined && s.keyintMin !== '')
          p.push('-keyint_min', String(s.keyintMin))
      }

      // Filters
      const filters = []
      if (s.deinterlaceFilter) filters.push(s.deinterlaceFilter)
      if (s.logoPath) filters.push('overlay')
      if (filters.length > 0) {
        if (s.logoPath) {
          p.push('-filter_complex', filters.join(','))
        } else {
          p.push('-filter:v', filters.join(','))
        }
      }

      if (s.forcedIdr) p.push('-forced-idr', '1')

      // Bitrate
      if (s.bitrateMode === 'cbr' && s.targetBitrate) {
        p.push('-b:v', s.targetBitrate)
        p.push('-maxrate', s.targetBitrate)
        p.push('-bufsize', s.bufsize || s.targetBitrate)
      } else if (s.bitrateMode === 'vbr') {
        if (s.targetBitrate) p.push('-b:v', s.targetBitrate)
        if (s.maxrate) p.push('-maxrate', s.maxrate)
        if (s.bufsize) p.push('-bufsize', s.bufsize)
      } else if (s.bitrateMode === 'crf' && s.crfValue !== undefined && s.crfValue !== '') {
        p.push('-crf', String(s.crfValue))
      }

      if (s.pixFmt) p.push('-pix_fmt', s.pixFmt)
      if (s.level) p.push('-level:v', s.level)
      if (s.fieldOrder) p.push('-field_order', s.fieldOrder)
      if (s.colorPrimaries) p.push('-color_primaries', s.colorPrimaries)
      if (s.colorTrc) p.push('-color_trc', s.colorTrc)
      if (s.colorspace) p.push('-colorspace', s.colorspace)
      if (s.scThreshold !== undefined && s.scThreshold !== '')
        p.push('-sc_threshold', String(s.scThreshold))
      if (s.bframes !== undefined && s.bframes !== '')
        p.push('-bf', String(s.bframes))
      if (s.refs !== undefined && s.refs !== '')
        p.push('-refs', String(s.refs))
      if (s.aspect) p.push('-aspect', s.aspect)
      if (s.bsfVideo && s.bsfVideo !== 'none') p.push('-bsf:v', s.bsfVideo)
      if (s.fpsSyncMode) p.push('-fps_mode', s.fpsSyncMode)
    }
  }

  // ── Audio ──────────────────────────────────────────────────────────────────

  if (s.audioCodec === 'disabled') {
    p.push('-an')
  } else if (s.audioCodec) {
    p.push('-c:a', s.audioCodec)

    if (s.audioCodec !== 'copy') {
      if (s.sampleRate && s.sampleRate !== 'original') p.push('-ar', s.sampleRate)
      if (s.channels && s.channels !== 'original') p.push('-ac', s.channels)
      if (s.channelLayout) p.push('-channel_layout', s.channelLayout)
      if (s.audioBitrate) p.push('-b:a', s.audioBitrate)
      if (s.dialnorm !== undefined && s.dialnorm !== '')
        p.push('-dialnorm', String(s.dialnorm))
      if (s.bsfAudio && s.bsfAudio !== 'none') p.push('-bsf:a', s.bsfAudio)
    }
  }

  // ── Output format ──────────────────────────────────────────────────────────

  if (s.outputFormat) p.push('-f', s.outputFormat)

  // HLS options
  if (s.outputFormat === 'hls') {
    if (s.hlsTime !== undefined && s.hlsTime !== '')
      p.push('-hls_time', String(s.hlsTime))
    if (s.hlsListSize !== undefined && s.hlsListSize !== '')
      p.push('-hls_list_size', String(s.hlsListSize))
    if (Array.isArray(s.hlsFlags) && s.hlsFlags.length)
      p.push('-hls_flags', s.hlsFlags.join('+'))
    else if (typeof s.hlsFlags === 'string' && s.hlsFlags)
      p.push('-hls_flags', s.hlsFlags)
    if (s.hlsSegmentType && s.hlsSegmentType !== 'mpegts')
      p.push('-hls_segment_type', s.hlsSegmentType)
  }

  // MPEG-TS options
  if (s.outputFormat === 'mpegts') {
    if (s.mpegtsServiceId !== undefined && s.mpegtsServiceId !== '')
      p.push('-mpegts_service_id', String(s.mpegtsServiceId))
    if (s.mpegtsPmtStartPid !== undefined && s.mpegtsPmtStartPid !== '')
      p.push('-mpegts_pmt_start_pid', String(s.mpegtsPmtStartPid))
    if (s.mpegtsStartPid !== undefined && s.mpegtsStartPid !== '')
      p.push('-mpegts_start_pid', String(s.mpegtsStartPid))
    if (Array.isArray(s.mpegtsFlags) && s.mpegtsFlags.length)
      p.push('-mpegts_flags', s.mpegtsFlags.join('+'))
    if (s.pcrPeriod !== undefined && s.pcrPeriod !== '')
      p.push('-pcr_period', String(s.pcrPeriod))
  }

  // General output options
  if (s.maxDelay !== undefined && s.maxDelay !== '')
    p.push('-max_delay', String(s.maxDelay))
  if (s.maxMuxingQueueSize !== undefined && s.maxMuxingQueueSize !== '')
    p.push('-max_muxing_queue_size', String(s.maxMuxingQueueSize))
  if (s.copyts) p.push('-copyts')
  if (s.avoidNegativeTs) p.push('-avoid_negative_ts', s.avoidNegativeTs)

  // Passthrough post-input flags
  if (Array.isArray(s.passthroughPostInput) && s.passthroughPostInput.length)
    p.push(...s.passthroughPostInput)

  p.push(outputPlaceholder)
  return p.join(' ')
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
