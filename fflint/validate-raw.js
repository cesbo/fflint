// validate-raw.js
// Convenience wrapper: validate a raw ffmpeg command string without a form/state.
//
// Usage:
//   import { validateRaw } from './fflint/validate-raw.js'
//   console.log(validateRaw('ffmpeg -y -i ${i} -c:v h264_nvenc -f mpegts ${o}'))
//   // → [ { severity: 'error'|'warning'|'info', message: '...', flag?, group?, layer? }, ... ]

import { validate as fflintValidate } from './fflint.js'

// ─── Known FFmpeg flags ───────────────────────────────────────────────────────
const KNOWN_FLAGS = new Set([
  'ffmpeg', '-y', '-hide_banner', '-re', '-stream_loop', '-hwaccel', '-hwaccel_output_format',
  '-fflags', '-use_wallclock_as_timestamps', '-max_delay', '-timeout', '-thread_queue_size',
  '-analyzeduration', '-probesize', '-deint', '-copyts',
  '-i', '-map', '-gpu', '-c:v', '-vn', '-preset', '-profile:v', '-s', '-r',
  '-g', '-keyint_min', '-sc_threshold', '-b:v', '-crf', '-maxrate', '-bufsize',
  '-pix_fmt', '-level:v', '-level', '-bf', '-refs', '-field_order',
  '-color_primaries', '-color_trc', '-colorspace', '-color_range',
  '-bsf:v', '-filter:v', '-filter_complex', '-forced-idr',
  '-c:a', '-an', '-ar', '-ac', '-b:a', '-dialnorm', '-bsf:a', '-af',
  '-channel_layout', '-fps_mode', '-max_muxing_queue_size',
  '-reconnect', '-reconnect_streamed', '-listen', '-aspect',
  '-f', '-hls_time', '-hls_list_size', '-hls_flags', '-hls_segment_type',
  '-avoid_negative_ts', '-mpegts_service_id', '-mpegts_pmt_start_pid',
  '-mpegts_start_pid', '-mpegts_flags', '-pcr_period',
  '-nostdin', '-loglevel', '-v',
])

// ─── Phase sets for flag ordering validation ──────────────────────────────────
const PRE_INPUT_FLAGS = new Set([
  '-hwaccel', '-hwaccel_output_format', '-fflags', '-thread_queue_size',
  '-analyzeduration', '-probesize', '-re', '-stream_loop', '-deint', '-gpu',
  '-max_delay', '-timeout', '-reconnect', '-reconnect_streamed', '-listen',
  '-use_wallclock_as_timestamps',
])

const POST_INPUT_FLAGS = new Set([
  '-preset', '-profile:v', '-b:v', '-crf', '-maxrate', '-bufsize',
  '-g', '-keyint_min', '-sc_threshold', '-bf', '-refs', '-pix_fmt',
  '-level', '-level:v', '-field_order', '-color_primaries', '-color_trc',
  '-colorspace', '-bsf:v', '-filter:v', '-b:a', '-bsf:a', '-af',
  '-f', '-hls_time', '-hls_list_size', '-hls_flags', '-hls_segment_type',
  '-mpegts_service_id', '-mpegts_pmt_start_pid', '-mpegts_start_pid',
  '-mpegts_flags', '-pcr_period', '-map', '-fps_mode',
  '-max_muxing_queue_size', '-aspect', '-avoid_negative_ts',
  '-vn', '-an', '-forced-idr', '-channel_layout',
])

const GLOBAL_FLAGS = new Set([
  '-y', '-hide_banner', '-nostdin', '-loglevel', '-v', '-copyts',
])

// Dual-use flags exempt from ordering checks
const DUAL_USE_FLAGS = new Set(['-c:v', '-c:a'])

// Flags that may appear multiple times
const REPEATABLE_FLAGS = new Set(['-map', '-i', '-filter_complex', '-filter:v', '-c:v', '-c:a'])

// Format → expected extensions mapping
const FORMAT_EXTENSIONS = {
  mpegts:   ['.ts'],
  mp4:      ['.mp4'],
  flv:      ['.flv'],
  hls:      ['.m3u8'],
  matroska: ['.mkv'],
}

// ─── Parse raw ffmpeg command string → constructor state ──────────────────────
function parseFFmpegCommand(str) {
  const result = {
    inputType: 'udp', logoPath: '',
    re: false, loop: false, wallclock: false, fflags: [], maxDelay: '', timeout: '', threadQueueSize: '',
    analyzeduration: '', probesize: '', copyts: false,
    videoEnabled: true, videoCodec: 'copy', hwaccel: 'none', hwaccelOutputFormat: 'none', inputDecoderCodec: '', gpuIndex: '',
    preset: '', vprofile: '', frameSize: 'original', customFrameSize: '',
    fps: 'original', customFps: '',
    gop: '', bitrateMode: '', bitrate: '', maxrate: '', bufsize: '',
    deinterlaceFilter: '', nvdecDeint: '', forcedIdr: false,
    pixFmt: '', level: '', scThreshold: '', bframes: '', refs: '', bsfVideo: 'none',
    fieldOrder: '', colorPrimaries: '', colorTrc: '', colorspace: '',
    audioEnabled: true, audioCodec: 'copy',
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
    passthroughPreInput: [], passthroughPostInput: [],
  }

  const tokens = str.trim().match(/"[^"]*"|\S+/g) || []
  let i = 0
  let passedInput = false
  let inputCount = 0

  while (i < tokens.length) {
    const t = tokens[i]
    switch (t) {
      case 'ffmpeg': break
      case '-y': break
      case '-hide_banner': break
      case '-re': result.re = true; break
      case '-stream_loop': i++; result.loop = true; break
      case '-hwaccel': i++; result.hwaccel = tokens[i] || 'none'; break
      case '-hwaccel_output_format': i++; result.hwaccelOutputFormat = tokens[i] || 'none'; break
      case '-deint': i++; result.nvdecDeint = tokens[i] || ''; break
      case '-gpu': i++; result.gpuIndex = tokens[i] || ''; break
      case '-i': i++; {
        const inp = tokens[i] || ''
        inputCount++
        if (inp === '-' || inp === 'pipe:0') result.inputType = 'pipe'
        else if (!passedInput) {
          if (inp !== '${i}') {
            if      (inp.startsWith('udp://'))  result.inputType = 'udp'
            else if (inp.startsWith('rtp://'))  result.inputType = 'rtp'
            else if (inp.startsWith('rtmp://')) result.inputType = 'rtmp'
            else if (inp.startsWith('http://') || inp.startsWith('https://')) result.inputType = 'http'
            else if (inp.startsWith('srt://'))  result.inputType = 'srt'
            else result.inputType = 'file'
          }
        } else {
          result.logoPath = inp
        }
        passedInput = true
        break
      }
      case '-c:v': i++; if (!passedInput) { result.inputDecoderCodec = tokens[i] || '' } else { result.videoCodec = tokens[i] || 'copy' }; break
      case '-vn': result.videoEnabled = false; result.videoCodec = 'disabled'; break
      case '-preset': i++; result.preset = tokens[i] || ''; break
      case '-profile:v': i++; result.vprofile = tokens[i] || ''; break
      case '-s': {
        i++
        const size = tokens[i] || ''
        const known = ['1920x1080', '1280x720', '720x576', '720x480']
        if (known.includes(size)) result.frameSize = size
        else { result.frameSize = 'custom'; result.customFrameSize = size }
        break
      }
      case '-r': {
        i++
        const fps = tokens[i] || ''
        const known = ['25', '29.97', '30', '50', '59.94', '60']
        if (known.includes(fps)) result.fps = fps
        else { result.fps = 'custom'; result.customFps = fps }
        break
      }
      case '-g': i++; result.gop = tokens[i] || ''; break
      case '-keyint_min': i++; result.keyintMin = tokens[i] || ''; break
      case '-b:v': i++; result.bitrate = tokens[i] || ''; break
      case '-crf': i++; result.bitrateMode = 'crf'; result.bitrate = tokens[i] || ''; break
      case '-maxrate': i++; result.maxrate = tokens[i] || ''; break
      case '-bufsize': i++; result.bufsize = tokens[i] || ''; break
      case '-filter:v': i++; { const _fv = tokens[i] || ''; const _m = _fv.match(/\b(yadif_cuda|bwdif_cuda|yadif|bwdif)\b/); if (_m) result.deinterlaceFilter = _m[1]; break }
      case '-filter_complex': i++; { const _fv = tokens[i] || ''; const _m = _fv.match(/\b(yadif_cuda|bwdif_cuda|yadif|bwdif)\b/); if (_m) result.deinterlaceFilter = _m[1]; break }
      case '-forced-idr': i++; result.forcedIdr = tokens[i] === '1'; break
      case '-c:a': i++; result.audioCodec = tokens[i] || 'copy'; break
      case '-an': result.audioEnabled = false; result.audioCodec = 'disabled'; break
      case '-ar': i++; result.sampleRate = tokens[i] || 'original'; break
      case '-ac': {
        i++
        const ch = tokens[i] || ''
        if      (ch === '1') result.channels = 'mono'
        else if (ch === '2') result.channels = 'stereo'
        else if (ch === '6') result.channels = '5.1'
        break
      }
      case '-b:a': i++; result.audioBitrate = tokens[i] || 'default'; break
      case '-f': i++; result.outputFormat = tokens[i] || 'mpegts'; break
      case '-hls_time': i++; result.hlsTime = tokens[i] || '4'; break
      case '-hls_list_size': i++; result.hlsListSize = tokens[i] || '5'; break
      case '-hls_flags': i++; result.hlsFlags = tokens[i] || ''; break
      case '-hls_segment_type': i++; result.hlsSegmentType = tokens[i] || 'mpegts'; break
      case '-fflags': i++; result.fflags = (tokens[i] || '').split('+').filter(Boolean).map(f => '+' + f); break
      case '-use_wallclock_as_timestamps': i++; result.wallclock = tokens[i] === '1'; break
      case '-max_delay': i++; result.maxDelay = tokens[i] || ''; break
      case '-timeout': i++; result.timeout = tokens[i] || ''; break
      case '-thread_queue_size': i++; result.threadQueueSize = tokens[i] || ''; break
      case '-analyzeduration': i++; result.analyzeduration = tokens[i] || ''; break
      case '-probesize': i++; result.probesize = tokens[i] || ''; break
      case '-copyts': result.copyts = true; break
      case '-map': i++; result.maps.push(tokens[i] || ''); break
      case '-pix_fmt': i++; result.pixFmt = tokens[i] || ''; break
      case '-level:v': i++; result.level = tokens[i] || ''; break
      case '-sc_threshold': i++; result.scThreshold = tokens[i] || ''; break
      case '-bf': i++; result.bframes = tokens[i] || ''; break
      case '-refs': i++; result.refs = tokens[i] || ''; break
      case '-bsf:v': i++; result.bsfVideo = tokens[i] || 'none'; break
      case '-field_order': i++; result.fieldOrder = tokens[i] || ''; break
      case '-color_primaries': i++; result.colorPrimaries = tokens[i] || ''; break
      case '-color_trc': i++; result.colorTrc = tokens[i] || ''; break
      case '-colorspace': i++; result.colorspace = tokens[i] || ''; break
      case '-dialnorm': i++; result.dialnorm = tokens[i] || ''; break
      case '-bsf:a': i++; result.bsfAudio = tokens[i] || 'none'; break
      case '-avoid_negative_ts': i++; result.avoidNegativeTs = tokens[i] || ''; break
      case '-mpegts_service_id': i++; result.mpegtsServiceId = tokens[i] || ''; break
      case '-mpegts_pmt_start_pid': i++; result.mpegtsPmtStartPid = tokens[i] || ''; break
      case '-mpegts_start_pid': i++; result.mpegtsStartPid = tokens[i] || ''; break
      case '-mpegts_flags': i++; result.mpegtsFlags = (tokens[i] || '').split('+').filter(Boolean); break
      case '-pcr_period': i++; result.pcrPeriod = tokens[i] || ''; break
      case '-level': i++; result.level = tokens[i] || ''; break
      case '-reconnect': i++; result.reconnect = tokens[i] === '1'; break
      case '-reconnect_streamed': i++; result.reconnectStreamed = tokens[i] === '1'; break
      case '-channel_layout': i++; result.channelLayout = tokens[i] || ''; break
      case '-listen': i++; result.listen = tokens[i] || ''; break
      case '-aspect': i++; result.aspect = tokens[i] || ''; break
      case '-fps_mode': i++; result.fpsMode = tokens[i] || ''; break
      case '-max_muxing_queue_size': i++; result.maxMuxingQueueSize = tokens[i] || ''; break
      case '-af': i++; break
      case '-nostdin': break
      case '-loglevel': case '-v': i++; break
      case '-color_range': i++; break
      default: {
        if (t.startsWith('-')) {
          const bucket = passedInput ? result.passthroughPostInput : result.passthroughPreInput
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

  if (result.bitrateMode !== 'crf') {
    if (result.bitrate || result.maxrate) {
      if (result.maxrate && result.maxrate !== result.bitrate) {
        result.bitrateMode = 'vbr'
      } else {
        result.bitrateMode = 'cbr'
        if (result.maxrate === result.bitrate) { result.maxrate = '' }
      }
    }
  }

  // Phase 2: Parse output target (last non-flag, non-template token)
  result.outputTarget = ''
  for (let j = tokens.length - 1; j >= 0; j--) {
    const tok = tokens[j]
    if (tok.startsWith('-') || tok.startsWith('${')) continue
    // Skip values that belong to the preceding flag
    if (j > 0 && tokens[j - 1].startsWith('-') && VALUE_FLAGS.has(tokens[j - 1])) continue
    result.outputTarget = tok
    break
  }
  // Pipe output
  if (result.outputTarget === '-' || result.outputTarget === 'pipe:1') {
    result.outputType = 'pipe'
  }

  result.inputCount = inputCount

  return result
}

// ─── Map constructor state → fflint state ────────────────────────────────────
function buildFflintState(s) {
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
      if (s.hwaccel && s.hwaccel !== 'none') f.hwaccel = s.hwaccel
      if (s.hwaccelOutputFormat && s.hwaccelOutputFormat !== 'none') f.hwaccelOutputFormat = s.hwaccelOutputFormat
      if (s.gpuIndex !== '' && s.gpuIndex !== undefined) { const n = parseInt(s.gpuIndex, 10); f.gpuIndex = isNaN(n) ? s.gpuIndex : n }
      if (s.preset)   f.preset  = s.preset
      if (s.vprofile) f.profile = s.vprofile
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
      if (s.bitrateMode === 'vbr' && s.maxrate) f.maxrate = s.maxrate
      if (s.bufsize) f.bufsize = s.bufsize
      if (s.pixFmt)         f.pixFmt         = s.pixFmt
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

  return f
}

// ─── Text-level structural checks (duplicate/conflicting flags) ───────────────

// Flags that take no value (boolean / standalone)
const NO_VALUE_FLAGS = new Set([
  'ffmpeg', '-y', '-hide_banner', '-re', '-copyts', '-vn', '-an', '-nostdin',
])

// Flags that expect a value (next token)
const VALUE_FLAGS = new Set([...KNOWN_FLAGS].filter(f => !NO_VALUE_FLAGS.has(f)))

// Bare flag names (without leading dash) for detecting missing-dash typos
// Only include names ≥ 3 chars to avoid false positives on short values
const BARE_FLAG_NAMES = new Set(
  [...KNOWN_FLAGS]
    .map(f => f.replace(/^-/, ''))
    .filter(f => f.length >= 3 && f !== 'ffmpeg')
)

function structuralChecks(rawText) {
  const results = []
  const tokens = rawText.match(/"[^"]*"|\S+/g) || []
  const seen = {}
  const flagValues = {}
  const unknownFlags = []
  let hasInput = false
  let firstInputIdx = -1

  // Find the first -i index for ordering checks
  for (let j = 0; j < tokens.length; j++) {
    if (tokens[j] === '-i') { firstInputIdx = j; break }
  }

  // Find output target index (last non-flag, non-template token that is not a flag value)
  let outputTargetIdx = -1
  let outputTarget = ''
  for (let j = tokens.length - 1; j >= 0; j--) {
    const tok = tokens[j]
    // Skip template variables
    if (tok.startsWith('${')) break
    // "-" and "pipe:N" are valid output targets
    if (tok === '-' || /^pipe:\d+$/.test(tok)) {
      outputTarget = tok
      outputTargetIdx = j
      break
    }
    if (tok.startsWith('-')) continue
    // Skip values that belong to the preceding flag
    if (j > 0 && tokens[j - 1].startsWith('-') && !tokens[j - 1].startsWith('${') && VALUE_FLAGS.has(tokens[j - 1])) continue
    // Skip 'ffmpeg' at position 0
    if (tok === 'ffmpeg') continue
    outputTarget = tok
    outputTargetIdx = j
    break
  }

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]

    if (t === '-i') hasInput = true

    // Detect tokens that look like flags missing their leading dash
    if (!t.startsWith('-') && !t.startsWith('${') && BARE_FLAG_NAMES.has(t)) {
      // Only warn if this token is not a value for the preceding flag
      if (i === 0 || !tokens[i - 1].startsWith('-') || !VALUE_FLAGS.has(tokens[i - 1])) {
        results.push({ severity: 'warning', message: `"${t}" looks like a flag missing its dash — did you mean "-${t}"?` })
      }
    }

    if (!t.startsWith('-') || t.startsWith('${')) continue
    if (/^-\d+(\.\d+)?$/.test(t)) continue
    if (!KNOWN_FLAGS.has(t)) { unknownFlags.push(t); continue }

    // Phase 3: Track flag values for duplicate detection
    if (!REPEATABLE_FLAGS.has(t)) {
      const val = VALUE_FLAGS.has(t) ? (tokens[i + 1] || '') : ''
      if (seen[t]) {
        if (flagValues[t] === val) {
          results.push({ severity: 'info', message: `${t} appears more than once with the same value — redundant` })
        } else {
          results.push({ severity: 'warning', message: `${t} appears twice with different values — only the last value is used` })
        }
      }
      flagValues[t] = val
    }
    seen[t] = true

    // Phase 1: Flag ordering validation
    if (!DUAL_USE_FLAGS.has(t) && !GLOBAL_FLAGS.has(t) && firstInputIdx >= 0) {
      if (POST_INPUT_FLAGS.has(t) && i < firstInputIdx) {
        results.push({ severity: 'warning', message: `${t} is an output/encoding flag but appears before -i — it should be placed after the input` })
      }
      if (PRE_INPUT_FLAGS.has(t) && i > firstInputIdx) {
        results.push({ severity: 'warning', message: `${t} is an input flag but appears after -i — it should be placed before the input` })
      }
    }

    // Phase 1.3: Detect options after the output target
    if (outputTargetIdx >= 0 && i > outputTargetIdx) {
      results.push({ severity: 'error', message: `${t} appears after the output target — options after output are not applied by FFmpeg` })
    }

    // Check for missing value: flag expects a value but next token is missing or is another known flag
    if (VALUE_FLAGS.has(t)) {
      const next = tokens[i + 1]
      if (next === undefined) {
        results.push({ severity: 'error', message: `${t} at end of command is missing its value` })
      } else if (next.startsWith('-') && !next.startsWith('${') && !/^-\d+(\.\d+)?$/.test(next) && KNOWN_FLAGS.has(next)) {
        results.push({ severity: 'error', message: `${t} is followed by ${next} — the value for ${t} appears to be missing` })
      }
    }
  }

  if (!hasInput && tokens.length > 1)
    results.push({ severity: 'error', message: 'No -i (input) flag found — FFmpeg requires at least one input' })

  // Phase 2: Missing output
  if (hasInput && !outputTarget && tokens.length > 1) {
    // Check if there's a template variable as output (last token is ${...})
    const lastToken = tokens[tokens.length - 1]
    const lastNonFlagIsTemplate = lastToken.startsWith('${')
    if (!lastNonFlagIsTemplate)
      results.push({ severity: 'error', message: 'No output file/URL specified' })
  }

  // Phase 2.3: Format/extension mismatch
  if (outputTarget && seen['-f']) {
    const fmtValue = flagValues['-f']
    const extMatch = outputTarget.match(/(\.[a-z0-9]+)$/i)
    if (fmtValue && extMatch) {
      const ext = extMatch[1].toLowerCase()
      const expectedExts = FORMAT_EXTENSIONS[fmtValue]
      if (expectedExts && !expectedExts.includes(ext)) {
        results.push({ severity: 'warning', message: `-f ${fmtValue} but output file extension is "${ext}" — expected ${expectedExts.join(' or ')}` })
      }
    }
  }

  if (seen['-vn'] && seen['-c:v']) results.push({ severity: 'error', message: '-vn and -c:v are both present.' })
  if (seen['-an'] && seen['-c:a']) results.push({ severity: 'error', message: '-an and -c:a are both present.' })
  if (seen['-crf'] && seen['-b:v']) results.push({ severity: 'error', message: '-crf and -b:v should not both be present.' })

  // Phase 4: Multi-input without -map
  let inputCount = 0
  for (const tok of tokens) { if (tok === '-i') inputCount++ }
  if (inputCount > 1 && !seen['-map'])
    results.push({ severity: 'warning', message: 'Multiple inputs without -map — FFmpeg will auto-select streams, which may not be what you want' })

  // Phase 5: Pipe I/O advisory
  for (let j = 0; j < tokens.length; j++) {
    if (tokens[j] === '-i') {
      const inp = tokens[j + 1] || ''
      if (inp === '-' || inp === 'pipe:0')
        results.push({ severity: 'info', message: 'Pipe input detected (-i - / pipe:0) — ensure the feeding process writes a supported container format' })
    }
  }
  if (outputTarget === '-' || outputTarget === 'pipe:1')
    results.push({ severity: 'info', message: 'Pipe output detected (- / pipe:1) — ensure the receiving process can consume the output format' })

  if (unknownFlags.length) results.push({ severity: 'warning', message: 'Unrecognized flag(s): ' + unknownFlags.join(', ') })

  return results
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Validate a raw ffmpeg command string.
 * Returns an array of result objects: { severity, message, flag?, group?, layer? }
 *
 * @param {string} rawText  Full ffmpeg command string.
 * @param {object} [options]
 * @param {boolean} [options.broadcastRules=true]  Include Layer 3 DVB/IPTV rules.
 * @returns {Array}
 */
export function validateRaw(rawText, options = {}) {
  if (!rawText || !rawText.trim()) {
    return [{ severity: 'error', message: 'Command is empty.' }]
  }

  const structural = structuralChecks(rawText)
  const parsed     = parseFFmpegCommand(rawText)
  const state      = buildFflintState(parsed)
  const semantic   = fflintValidate(state, options)

  return [...structural, ...semantic]
}
