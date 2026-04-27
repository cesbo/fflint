// parse.js
// Parse a raw FFmpeg command string into a fflint state object.
//
// Usage:
//   import { parse } from './fflint/parse.js'
//   const state = parse('ffmpeg -y -i ${i} -c:v h264_nvenc -preset p4 -b:v 4M -c:a aac -f mpegts ${o}')
//   // → { videoCodec: 'h264_nvenc', preset: 'p4', bitrateMode: 'cbr', targetBitrate: '4M', ... }

// ─── Tokenize ─────────────────────────────────────────────────────────────────

function tokenize(str) {
  return str.trim().match(/"[^"]*"|\S+/g) || []
}

// ─── Flags that take no value (boolean / standalone) ──────────────────────────

const NO_VALUE_FLAGS = new Set([
  'ffmpeg', '-y', '-hide_banner', '-re', '-copyts', '-vn', '-an', '-nostdin',
])

// ─── All recognized flags ─────────────────────────────────────────────────────

const KNOWN_FLAGS = new Set([
  'ffmpeg', '-y', '-hide_banner', '-re', '-stream_loop', '-hwaccel', '-hwaccel_output_format',
  '-fflags', '-use_wallclock_as_timestamps', '-max_delay', '-timeout', '-thread_queue_size',
  '-analyzeduration', '-probesize', '-deint', '-copyts',
  '-i', '-map', '-gpu', '-c', '-c:v', '-vn', '-preset', '-tune', '-profile:v', '-tier', '-s', '-r',
  '-g', '-keyint_min', '-sc_threshold', '-b:v', '-crf', '-maxrate', '-bufsize',
  '-pix_fmt', '-level:v', '-level', '-bf', '-refs', '-field_order',
  '-color_primaries', '-color_trc', '-colorspace', '-color_range',
  '-bsf:v', '-vf', '-filter:v', '-filter_complex', '-forced-idr',
  '-x264opts', '-x265-params', '-lookahead', '-vframes',
  '-c:a', '-an', '-ar', '-ac', '-b:a', '-dialnorm', '-bsf:a', '-af',
  '-channel_layout', '-fps_mode', '-max_muxing_queue_size',
  '-reconnect', '-reconnect_streamed', '-listen', '-aspect',
  '-hwaccel_device',
  '-f', '-hls_time', '-hls_list_size', '-hls_flags', '-hls_segment_type', '-hls_segment_filename',
  '-avoid_negative_ts', '-mpegts_service_id', '-mpegts_pmt_start_pid',
  '-mpegts_start_pid', '-mpegts_flags', '-pcr_period',
  '-nostdin', '-loglevel', '-v',
])

const VALUE_FLAGS = new Set([...KNOWN_FLAGS].filter(f => !NO_VALUE_FLAGS.has(f)))

// ─── Parse raw ffmpeg command string → intermediate form ─────────────────────

function parseTokens(str) {
  const raw = {
    re: false, loop: false, wallclock: false, fflags: [], maxDelay: '', timeout: '', threadQueueSize: '',
    analyzeduration: '', probesize: '', copyts: false,
    videoEnabled: true, videoCodec: undefined, hwaccel: '', hwaccelOutputFormat: '',
    inputDecoderCodec: '', gpuIndex: '',
    preset: '', vprofile: '', frameSize: 'original', customFrameSize: '',
    fps: 'original', customFps: '',
    gop: '', bitrateMode: '', bitrate: '', maxrate: '', bufsize: '',
    deinterlaceFilter: '', nvdecDeint: '', forcedIdr: false,
    pixFmt: '', level: '', scThreshold: '', bframes: '', refs: '', bsfVideo: 'none',
    fieldOrder: '', colorPrimaries: '', colorTrc: '', colorspace: '',
    audioEnabled: true, audioCodec: undefined,
    sampleRate: 'original', channels: 'original', audioBitrate: 'default',
    dialnorm: '', bsfAudio: 'none',
    outputFormat: 'mpegts',
    hlsTime: '4', hlsListSize: '5', hlsFlags: '', hlsSegmentType: 'mpegts',
    avoidNegativeTs: '',
    mpegtsServiceId: '', mpegtsPmtStartPid: '', mpegtsStartPid: '',
    mpegtsFlags: [], pcrPeriod: '',
    maps: [], keyintMin: '',
    reconnect: false, reconnectStreamed: false,
    channelLayout: '', listen: '', aspect: '', fpsMode: '', maxMuxingQueueSize: '',
    inputType: 'udp', logoPath: '',
    passthroughPreInput: [], passthroughPostInput: [],
    tune: '', tier: '', lookahead: '',
  }

  const tokens = tokenize(str)
  let i = 0
  let passedInput = false
  let inputCount = 0

  while (i < tokens.length) {
    const t = tokens[i]
    switch (t) {
      case 'ffmpeg': break
      case '-y': break
      case '-hide_banner': break
      case '-re': raw.re = true; break
      case '-stream_loop': i++; raw.loop = true; break
      case '-hwaccel': i++; raw.hwaccel = tokens[i] || ''; break
      case '-hwaccel_output_format': i++; raw.hwaccelOutputFormat = tokens[i] || ''; break
      case '-deint': i++; raw.nvdecDeint = tokens[i] || ''; break
      case '-gpu': i++; raw.gpuIndex = tokens[i] || ''; break
      case '-i': i++; {
        let inp = tokens[i] || ''
        // Strip surrounding quotes so "\"${i}\"" becomes "${i}"
        if ((inp.startsWith('"') && inp.endsWith('"')) || (inp.startsWith("'") && inp.endsWith("'")))
          inp = inp.slice(1, -1)
        inputCount++
        if (inp === '-' || inp === 'pipe:0') raw.inputType = 'pipe'
        else if (!passedInput) {
          if (inp !== '${i}') {
            if      (inp.startsWith('udp://'))  raw.inputType = 'udp'
            else if (inp.startsWith('rtp://'))  raw.inputType = 'rtp'
            else if (inp.startsWith('rtmp://')) raw.inputType = 'rtmp'
            else if (inp.startsWith('http://') || inp.startsWith('https://')) raw.inputType = 'http'
            else if (inp.startsWith('srt://'))  raw.inputType = 'srt'
            else raw.inputType = 'file'
          }
        } else {
          raw.logoPath = inp
        }
        passedInput = true
        break
      }
      case '-c': i++; { const val = tokens[i] || 'copy'; if (passedInput) { raw.videoCodec = val; raw.audioCodec = val } }; break
      case '-c:v': i++; if (!passedInput) { raw.inputDecoderCodec = tokens[i] || '' } else { raw.videoCodec = tokens[i] || 'copy' }; break
      case '-vn': raw.videoEnabled = false; raw.videoCodec = 'disabled'; break
      case '-preset': i++; raw.preset = tokens[i] || ''; break
      case '-tune': i++; raw.tune = tokens[i] || ''; break
      case '-profile:v': i++; raw.vprofile = tokens[i] || ''; break
      case '-s': {
        i++
        const size = tokens[i] || ''
        const known = ['1920x1080', '1280x720', '720x576', '720x480']
        if (known.includes(size)) raw.frameSize = size
        else { raw.frameSize = 'custom'; raw.customFrameSize = size }
        break
      }
      case '-r': {
        i++
        const fps = tokens[i] || ''
        const known = ['25', '29.97', '30', '50', '59.94', '60']
        if (known.includes(fps)) raw.fps = fps
        else { raw.fps = 'custom'; raw.customFps = fps }
        break
      }
      case '-g': i++; raw.gop = tokens[i] || ''; break
      case '-keyint_min': i++; raw.keyintMin = tokens[i] || ''; break
      case '-b:v': i++; raw.bitrate = tokens[i] || ''; break
      case '-crf': i++; raw.bitrateMode = 'crf'; raw.bitrate = tokens[i] || ''; break
      case '-maxrate': i++; raw.maxrate = tokens[i] || ''; break
      case '-bufsize': i++; raw.bufsize = tokens[i] || ''; break
      case '-vf': case '-filter:v': i++; {
        const _fv = tokens[i] || ''
        const _m = _fv.match(/\b(yadif_cuda|bwdif_cuda|yadif|bwdif)\b/)
        if (_m) raw.deinterlaceFilter = _m[1]
        const _scale = _fv.match(/\bscale=(-?\d+):(-?\d+)\b/)
        if (_scale) {
          raw.frameSize = 'custom'
          raw.customFrameSize = `${_scale[1]}x${_scale[2]}`
        }
        break
      }
      case '-filter_complex': i++; {
        const _fv = tokens[i] || ''
        const _m = _fv.match(/\b(yadif_cuda|bwdif_cuda|yadif|bwdif)\b/)
        if (_m) raw.deinterlaceFilter = _m[1]
        const _scale = _fv.match(/\bscale=(-?\d+):(-?\d+)\b/)
        if (_scale) {
          raw.frameSize = 'custom'
          raw.customFrameSize = `${_scale[1]}x${_scale[2]}`
        }
        break
      }
      case '-forced-idr': i++; raw.forcedIdr = tokens[i] === '1' || tokens[i] === 'true'; break
      case '-c:a': i++; raw.audioCodec = tokens[i] || 'copy'; break
      case '-an': raw.audioEnabled = false; raw.audioCodec = 'disabled'; break
      case '-ar': i++; raw.sampleRate = tokens[i] || 'original'; break
      case '-ac': {
        i++
        const ch = tokens[i] || ''
        if      (ch === '1') raw.channels = 'mono'
        else if (ch === '2') raw.channels = 'stereo'
        else if (ch === '6') raw.channels = '5.1'
        break
      }
      case '-b:a': i++; raw.audioBitrate = tokens[i] || 'default'; break
      case '-f': i++; raw.outputFormat = tokens[i] || 'mpegts'; break
      case '-hls_time': i++; raw.hlsTime = tokens[i] || '4'; break
      case '-hls_list_size': i++; raw.hlsListSize = tokens[i] || '5'; break
      case '-hls_flags': i++; raw.hlsFlags = tokens[i] || ''; break
      case '-hls_segment_type': i++; raw.hlsSegmentType = tokens[i] || 'mpegts'; break
      case '-fflags': i++; raw.fflags = (tokens[i] || '').split('+').filter(Boolean).map(f => '+' + f); break
      case '-use_wallclock_as_timestamps': i++; raw.wallclock = tokens[i] === '1'; break
      case '-max_delay': i++; raw.maxDelay = tokens[i] || ''; break
      case '-timeout': i++; raw.timeout = tokens[i] || ''; break
      case '-thread_queue_size': i++; raw.threadQueueSize = tokens[i] || ''; break
      case '-analyzeduration': i++; raw.analyzeduration = tokens[i] || ''; break
      case '-probesize': i++; raw.probesize = tokens[i] || ''; break
      case '-copyts': raw.copyts = true; break
      case '-map': i++; raw.maps.push(tokens[i] || ''); break
      case '-pix_fmt': i++; raw.pixFmt = tokens[i] || ''; break
      case '-level:v': i++; raw.level = tokens[i] || ''; break
      case '-sc_threshold': i++; raw.scThreshold = tokens[i] || ''; break
      case '-bf': i++; raw.bframes = tokens[i] || ''; break
      case '-refs': i++; raw.refs = tokens[i] || ''; break
      case '-bsf:v': i++; raw.bsfVideo = tokens[i] || 'none'; break
      case '-field_order': i++; raw.fieldOrder = tokens[i] || ''; break
      case '-color_primaries': i++; raw.colorPrimaries = tokens[i] || ''; break
      case '-color_trc': i++; raw.colorTrc = tokens[i] || ''; break
      case '-colorspace': i++; raw.colorspace = tokens[i] || ''; break
      case '-dialnorm': i++; raw.dialnorm = tokens[i] || ''; break
      case '-bsf:a': i++; raw.bsfAudio = tokens[i] || 'none'; break
      case '-avoid_negative_ts': i++; raw.avoidNegativeTs = tokens[i] || ''; break
      case '-mpegts_service_id': i++; raw.mpegtsServiceId = tokens[i] || ''; break
      case '-mpegts_pmt_start_pid': i++; raw.mpegtsPmtStartPid = tokens[i] || ''; break
      case '-mpegts_start_pid': i++; raw.mpegtsStartPid = tokens[i] || ''; break
      case '-mpegts_flags': i++; raw.mpegtsFlags = (tokens[i] || '').split('+').filter(Boolean); break
      case '-pcr_period': i++; raw.pcrPeriod = tokens[i] || ''; break
      case '-level': i++; raw.level = tokens[i] || ''; break
      case '-reconnect': i++; raw.reconnect = tokens[i] === '1'; break
      case '-reconnect_streamed': i++; raw.reconnectStreamed = tokens[i] === '1'; break
      case '-channel_layout': i++; raw.channelLayout = tokens[i] || ''; break
      case '-listen': i++; raw.listen = tokens[i] || ''; break
      case '-aspect': i++; raw.aspect = tokens[i] || ''; break
      case '-fps_mode': i++; raw.fpsMode = tokens[i] || ''; break
      case '-max_muxing_queue_size': i++; raw.maxMuxingQueueSize = tokens[i] || ''; break
      case '-af': i++; break
      case '-nostdin': break
      case '-loglevel': case '-v': i++; break
      case '-color_range': i++; break
      case '-x264opts': case '-x265-params': i++; break
      case '-tier': i++; raw.tier = tokens[i] || ''; break
      case '-lookahead': i++; raw.lookahead = tokens[i] || ''; break
      case '-hwaccel_device': i++; break
      case '-vframes': i++; break
      case '-hls_segment_filename': i++; break
      default: {
        if (t.startsWith('-')) {
          // Per-stream index specifiers: -c:a:0, -b:a:0, -c:v:0, etc.
          const streamIdx = t.match(/^(-(?:c|b):[vas]):\d+$/)
          if (streamIdx) {
            i++
            const base = streamIdx[1]
            const val = tokens[i] || ''
            if (base === '-c:v' && passedInput && (raw.videoCodec === undefined || raw.videoCodec === 'copy')) raw.videoCodec = val || 'copy'
            else if (base === '-c:a' && (raw.audioCodec === undefined || raw.audioCodec === 'copy')) raw.audioCodec = val || 'copy'
            else if (base === '-b:v' && !raw.bitrate) raw.bitrate = val
            else if (base === '-b:a' && raw.audioBitrate === 'default') raw.audioBitrate = val
            break
          }
          // Other indexed specifiers: -profile:v:0, -bsf:a:0, etc.
          if (/^-[a-z_]+:[vas]:\d+$/i.test(t)) {
            if (i + 1 < tokens.length) {
              const next = tokens[i + 1]
              if (!next.startsWith('-') && !next.startsWith('${')) i++
            }
            break
          }
          const bucket = passedInput ? raw.passthroughPostInput : raw.passthroughPreInput
          bucket.push(t)
          if (i + 1 < tokens.length) {
            const next = tokens[i + 1]
            if (!next.startsWith('-') && !next.startsWith('${')) { i++; bucket.push(tokens[i]) }
          }
        }
        break
      }
    }
    i++
  }

  // Determine bitrate mode from parsed flags
  if (raw.bitrateMode !== 'crf') {
    if (raw.bitrate || raw.maxrate) {
      if (raw.maxrate && raw.maxrate !== raw.bitrate) {
        raw.bitrateMode = 'vbr'
      } else {
        raw.bitrateMode = 'cbr'
      }
    }
  }

  raw.inputCount = inputCount
  return raw
}

// ─── Convert intermediate form → fflint state object ─────────────────────────

function toFflintState(s) {
  const f = { inputType: s.inputType, outputFormat: s.outputFormat }
  if (s.bitrateMode) f.bitrateMode = s.bitrateMode

  if (s.re)   f.re = true
  if (s.loop) f.streamLoop = true
  if (Array.isArray(s.fflags) && s.fflags.length) f.fflags = s.fflags
  if (s.wallclock) f.useWallclock = true
  if (s.maxDelay)        { const n = parseInt(s.maxDelay, 10);        f.maxDelay       = isNaN(n) ? s.maxDelay       : n }
  if (s.timeout)         { const n = parseInt(s.timeout, 10);         f.timeout        = isNaN(n) ? s.timeout        : n }
  if (s.threadQueueSize) { const n = parseInt(s.threadQueueSize, 10); f.threadQueueSize= isNaN(n) ? s.threadQueueSize: n }
  if (s.maxMuxingQueueSize) { const n = parseInt(s.maxMuxingQueueSize, 10); f.maxMuxingQueueSize = isNaN(n) ? s.maxMuxingQueueSize : n }
  if (s.analyzeduration) { const n = parseInt(s.analyzeduration, 10); f.analyzeDuration= isNaN(n) ? s.analyzeduration: n }
  if (s.probesize)       { const n = parseInt(s.probesize, 10);       f.probeSize      = isNaN(n) ? s.probesize      : n }
  if (s.copyts) f.copyts = true
  if (s.reconnect) f.reconnect = true
  if (s.reconnectStreamed) f.reconnectStreamed = true
  if (Array.isArray(s.maps) && s.maps.length) f.maps = s.maps

  if (!s.videoEnabled) {
    f.videoCodec = 'disabled'
  } else {
    f.videoCodec = s.videoCodec
    if (s.videoCodec !== 'copy' && s.videoCodec !== 'disabled') {
      if (s.hwaccel) f.hwaccel = s.hwaccel
      if (s.hwaccelOutputFormat) f.hwaccelOutputFormat = s.hwaccelOutputFormat
      if (s.gpuIndex !== '' && s.gpuIndex !== undefined) { const n = parseInt(s.gpuIndex, 10); f.gpuIndex = isNaN(n) ? s.gpuIndex : n }
      if (s.preset)   f.preset  = s.preset
      if (s.tune)     f.tune    = s.tune
      if (s.vprofile) f.profile = s.vprofile
      if (s.tier)     f.tier    = s.tier
      if (s.lookahead) { const n = parseInt(s.lookahead, 10); f.lookahead = isNaN(n) ? s.lookahead : n }
      if (s.frameSize !== 'original') f.frameSize = s.frameSize
      if (s.frameSize === 'custom' && s.customFrameSize) f.customFrameSize = s.customFrameSize
      if (s.fps !== 'original') f.fps = s.fps
      if (s.fps === 'custom' && s.customFps) f.customFps = s.customFps
      if (s.gop) { const n = parseInt(s.gop, 10); f.gop = isNaN(n) ? s.gop : n }
      if (s.keyintMin) { const n = parseInt(s.keyintMin, 10); f.keyintMin = isNaN(n) ? s.keyintMin : n }
      if (s.deinterlaceFilter) f.deinterlaceFilter = s.deinterlaceFilter
      if (s.nvdecDeint !== '' && s.nvdecDeint !== undefined) { const n = parseInt(s.nvdecDeint, 10); f.nvdecDeint = isNaN(n) ? s.nvdecDeint : n }
      if (s.bitrateMode === 'crf') { const crf = parseFloat(s.bitrate); if (!isNaN(crf)) f.crfValue = crf }
      else { if (s.bitrate) f.targetBitrate = s.bitrate }
      if (s.maxrate) f.maxrate = s.maxrate
      if (s.bufsize) f.bufsize = s.bufsize
      if (s.pixFmt)         f.pixFmt         = s.pixFmt
      if (s.level)          f.level          = s.level
      if (s.fieldOrder)     f.fieldOrder     = s.fieldOrder
      if (s.colorPrimaries) f.colorPrimaries = s.colorPrimaries
      if (s.colorTrc)       f.colorTrc       = s.colorTrc
      if (s.colorspace)     f.colorspace     = s.colorspace
      if (s.scThreshold !== '' && s.scThreshold !== undefined) { const n = parseInt(s.scThreshold, 10); f.scThreshold = isNaN(n) ? s.scThreshold : n }
      if (s.bframes !== '' && s.bframes !== undefined)         { const n = parseInt(s.bframes, 10);     f.bframes     = isNaN(n) ? s.bframes     : n }
      if (s.refs    !== '' && s.refs    !== undefined)         { const n = parseInt(s.refs, 10);        f.refs        = isNaN(n) ? s.refs        : n }
      if (s.bsfVideo && s.bsfVideo !== 'none') f.bsfVideo = s.bsfVideo
      if (s.forcedIdr) f.forcedIdr = true
      if (s.aspect) f.aspect = s.aspect
    }
  }

  // Forward video fields for copy/disabled so L2 copy_* rules detect redundant settings
  if (s.videoCodec === 'copy' || s.videoCodec === 'disabled') {
    if (s.preset)   f.preset   = s.preset
    if (s.vprofile) f.profile  = s.vprofile
    if (s.level)    f.level    = s.level
    if (s.gop)            { const n = parseInt(s.gop, 10);            f.gop            = isNaN(n) ? s.gop : n }
    if (s.deinterlaceFilter) f.deinterlaceFilter = s.deinterlaceFilter
    if (s.frameSize !== 'original') f.frameSize = s.frameSize
    if (s.fps !== 'original') f.fps = s.fps
    if (s.pixFmt)         f.pixFmt         = s.pixFmt
    if (s.colorPrimaries) f.colorPrimaries = s.colorPrimaries
    if (s.colorTrc)       f.colorTrc       = s.colorTrc
    if (s.colorspace)     f.colorspace     = s.colorspace
    if (s.bframes !== '' && s.bframes !== undefined) { const n = parseInt(s.bframes, 10); f.bframes = isNaN(n) ? s.bframes : n }
    if (s.refs    !== '' && s.refs    !== undefined) { const n = parseInt(s.refs, 10);    f.refs    = isNaN(n) ? s.refs    : n }
  }

  if (s.logoPath) f.logoPath = s.logoPath

  if (!s.audioEnabled) {
    f.audioCodec = 'disabled'
  } else {
    f.audioCodec = s.audioCodec
    if (s.audioCodec !== 'copy' && s.audioCodec !== 'disabled') {
      if (s.sampleRate !== 'original') f.sampleRate = s.sampleRate
      if (s.channels !== 'original') {
        const chMap = { mono: '1', stereo: '2', '5.1': '6' }
        f.channels = chMap[s.channels] || s.channels
      }
      if (s.audioBitrate && s.audioBitrate !== 'default') f.audioBitrate = s.audioBitrate
      if (s.dialnorm !== '' && s.dialnorm !== undefined) { const n = parseInt(s.dialnorm, 10); f.dialnorm = isNaN(n) ? s.dialnorm : n }
      if (s.bsfAudio && s.bsfAudio !== 'none') f.bsfAudio = s.bsfAudio
      if (s.channelLayout) f.channelLayout = s.channelLayout
    }
  }

  // Forward audio fields for copy so L2 copy_audio_* rules detect redundant settings
  if (s.audioCodec === 'copy') {
    if (s.sampleRate !== 'original') f.sampleRate = s.sampleRate
    if (s.channels !== 'original') {
      const chMap = { mono: '1', stereo: '2', '5.1': '6' }
      f.channels = chMap[s.channels] || s.channels
    }
    if (s.audioBitrate && s.audioBitrate !== 'default') f.audioBitrate = s.audioBitrate
  }

  if (s.outputFormat === 'hls') {
    if (s.hlsTime)     { const n = parseInt(s.hlsTime, 10);     f.hlsTime     = isNaN(n) ? s.hlsTime : n }
    if (s.hlsListSize) { const n = parseInt(s.hlsListSize, 10); f.hlsListSize = isNaN(n) ? s.hlsListSize : n }
    if (s.hlsFlags)    f.hlsFlags = s.hlsFlags.split(/[+,]/).map(x => x.trim()).filter(Boolean)
  }
  if (s.hlsSegmentType)  f.hlsSegmentType  = s.hlsSegmentType
  if (s.avoidNegativeTs) f.avoidNegativeTs = s.avoidNegativeTs

  if (s.outputFormat === 'mpegts') {
    if (s.mpegtsServiceId)   { const n = parseInt(s.mpegtsServiceId, 10);                                       f.mpegtsServiceId   = isNaN(n) ? s.mpegtsServiceId : n }
    if (s.mpegtsPmtStartPid) { const v = s.mpegtsPmtStartPid; const n = v.startsWith('0x') ? parseInt(v, 16) : parseInt(v, 10); f.mpegtsPmtStartPid = isNaN(n) ? s.mpegtsPmtStartPid : n }
    if (s.mpegtsStartPid)    { const v = s.mpegtsStartPid;     const n = v.startsWith('0x') ? parseInt(v, 16) : parseInt(v, 10); f.mpegtsStartPid    = isNaN(n) ? s.mpegtsStartPid : n }
    if (Array.isArray(s.mpegtsFlags) && s.mpegtsFlags.length) f.mpegtsFlags = s.mpegtsFlags
    if (s.pcrPeriod)         { const n = parseInt(s.pcrPeriod, 10); f.pcrPeriod = isNaN(n) ? s.pcrPeriod : n }
  }

  if (s.listen) { const n = parseInt(s.listen, 10); f.listen = isNaN(n) ? s.listen : n }
  if (s.fpsMode) f.fpsSyncMode = s.fpsMode

  // Passthrough flags preserved for round-trip
  if (s.passthroughPreInput && s.passthroughPreInput.length)
    f.passthroughPreInput = s.passthroughPreInput
  if (s.passthroughPostInput && s.passthroughPostInput.length)
    f.passthroughPostInput = s.passthroughPostInput

  return f
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Parse a raw FFmpeg command string into a fflint state object.
 *
 * The returned object uses the same schema as `validate()` accepts:
 * field names like `videoCodec`, `targetBitrate`, `profile`, `streamLoop`, etc.
 *
 * @param {string} rawText  Full FFmpeg command string.
 * @returns {object} fflint state object ready for `validate()` or UI binding.
 */
export function parse(rawText) {
  if (!rawText || !rawText.trim()) return {}
  const intermediate = parseTokens(rawText)
  return toFflintState(intermediate)
}

// Also export the intermediate parser for validate-raw.js (structural checks
// need the intermediate form with passedInput tracking, inputCount, etc.)
export { parseTokens as _parseTokens, toFflintState as _toFflintState, VALUE_FLAGS, KNOWN_FLAGS, NO_VALUE_FLAGS }
