// layer1.js
import {
  CRF_RANGE, parseBitrate, parseFps,
  VALID_INPUT_TYPES, VALID_VIDEO_CODECS, VALID_HWACCELS, VALID_PIX_FMTS,
  DEPRECATED_PIX_FMTS,
  VALID_FIELD_ORDERS, VALID_COLOR_PRIMARIES, VALID_COLOR_TRC, VALID_COLORSPACES,
  VALID_FPS_SYNC_MODES, VALID_BSF_VIDEO, VALID_AUDIO_CODECS, VALID_SAMPLE_RATES,
  VALID_CHANNELS, VALID_BSF_AUDIO, VALID_SUBTITLE_MODES, VALID_OUTPUT_FORMATS,
  VALID_HLS_SEG_TYPES, VALID_AVOID_NEG_TS, VALID_FFLAGS, VALID_MPEGTS_FLAGS,
  VALID_HLS_FLAGS, VALID_BITRATE_MODES,
  PROFILES, PRESETS, CODEC_PRESET_FAMILY,
  VALID_LEVELS_H264, VALID_LEVELS_H265,
  VALID_CHANNEL_LAYOUTS,
  VALID_HWACCEL_OUTPUT_FORMATS, VALID_DEINTERLACE_FILTERS, VALID_SCALE_FILTERS,
  VALID_NVDEC_DEINT,
  NVENC_CODECS, VAAPI_CODECS,
} from './codec-data.js'

const BITRATE_RE   = /^\d+(\.\d+)?[kKmMgG]?$/i
const FRAMESIZE_RE = /^\d{2,5}x\d{2,5}$/
const INT32_MAX    = 2_147_483_647

export function validateLayer1(s) {
  return [
    // ── Enum validators ──────────────────────────────────────────────────────
    ...validateEnum(s, 'inputType',           'l1_input_type',          '-i',                     VALID_INPUT_TYPES,            'Input type'),
    ...validateEnum(s, 'videoCodec',          'l1_video_codec',         '-c:v',                   VALID_VIDEO_CODECS,           'Video codec'),
    ...validateEnum(s, 'hwaccel',             'l1_hwaccel',             '-hwaccel',               VALID_HWACCELS,               'HW acceleration'),
    ...validateEnum(s, 'hwaccelOutputFormat', 'l1_hwaccel_output_fmt',  '-hwaccel_output_format', VALID_HWACCEL_OUTPUT_FORMATS, 'HW accel output format'),
    ...validateEnum(s, 'colorPrimaries',      'l1_color_primaries',     '-color_primaries',       VALID_COLOR_PRIMARIES,        'Color primaries'),
    ...validateEnum(s, 'colorTrc',            'l1_color_trc',           '-color_trc',             VALID_COLOR_TRC,              'Transfer characteristics'),
    ...validateEnum(s, 'colorspace',          'l1_colorspace',          '-colorspace',            VALID_COLORSPACES,            'Color space'),
    ...validateEnum(s, 'fpsSyncMode',         'l1_fps_sync_mode',       '-fps_mode',              VALID_FPS_SYNC_MODES,         'FPS sync mode'),
    ...validateEnum(s, 'audioCodec',          'l1_audio_codec',         '-c:a',                   VALID_AUDIO_CODECS,           'Audio codec'),
    ...validateEnum(s, 'sampleRate',          'l1_sample_rate',         '-ar',                    VALID_SAMPLE_RATES,           'Sample rate'),
    ...validateEnum(s, 'channels',            'l1_channels',            '-ac',                    VALID_CHANNELS,               'Channel count'),
    ...validateEnum(s, 'bsfAudio',            'l1_bsf_audio',           '-bsf:a',                 VALID_BSF_AUDIO,              'Audio bitstream filter'),
    ...validateEnum(s, 'subtitleMode',        'l1_subtitle_mode',       '-c:s',                   VALID_SUBTITLE_MODES,         'Subtitle mode'),
    ...validateEnum(s, 'outputFormat',        'l1_output_format',       '-f',                     VALID_OUTPUT_FORMATS,         'Output format'),
    ...validateEnum(s, 'hlsSegmentType',      'l1_hls_seg_type',        '-hls_segment_type',      VALID_HLS_SEG_TYPES,          'HLS segment type'),
    ...validateEnum(s, 'avoidNegativeTs',     'l1_avoid_neg_ts',        '-avoid_negative_ts',     VALID_AVOID_NEG_TS,           'Avoid negative timestamps'),
    ...validateEnum(s, 'deinterlaceFilter',   'l1_deinterlace_filter',  '-filter:v',              VALID_DEINTERLACE_FILTERS,    'Deinterlace filter'),
    ...validateEnum(s, 'scaleFilter',         'l1_scale_filter',        '-filter:v',              VALID_SCALE_FILTERS,          'Scale filter'),
    ...validateNvdecDeint(s),
    // ── Array / multi-select enum validators ─────────────────────────────────
    ...validateArrayEnum(s, 'fflags',         'l1_fflags',              '-fflags',                VALID_FFLAGS,                 'Input flag'),
    ...validateArrayEnum(s, 'mpegtsFlags',    'l1_mpegts_flags',        '-mpegts_flags',          VALID_MPEGTS_FLAGS,           'MPEG-TS flag'),
    ...validateArrayEnum(s, 'hlsFlags',       'l1_hls_flags',           '-hls_flags',             VALID_HLS_FLAGS,              'HLS flag'),
    ...validateEnum(s,      'bitrateMode',    'l1_bitrate_mode',        '-b:v/-crf',              VALID_BITRATE_MODES,          'Bitrate mode'),
    // ── Codec-dependent field validators ───────────────────────────────────
    ...validateProfile(s),
    ...validatePreset(s),
    ...validateLevel(s),
    ...validateChannelLayout(s),
    ...validateAspect(s),
    ...validatePixFmt(s),
    ...validateBsfVideo(s),
    ...validateFieldOrder(s),
    // ── Range / format validators ─────────────────────────────────────────────
    ...validateCustomFrameSize(s),
    ...validateCustomFps(s),
    ...validateGop(s),
    ...validateKeyintMin(s),
    ...validateScThreshold(s),
    ...validateCrf(s),
    ...validateBitrates(s),
    ...validateBframes(s),
    ...validateRefs(s),
    ...validatePids(s),
    ...validateMpegtsServiceId(s),
    ...validatePcrPeriod(s),
    ...validateHlsTime(s),
    ...validateHlsListSize(s),
    ...validateMaxDelay(s),
    ...validateThreadQueueSize(s),
    ...validateMaxMuxingQueueSize(s),
    ...validateDialnorm(s),
    ...validateAudioBitrate(s),
    ...validateLoudnorm(s),
    ...validateLoudnormParams(s),
    ...validateTimeout(s),
    // ── New validators ───────────────────────────────────────────────────────
    ...validateAnalyzeDuration(s),
    ...validateProbeSize(s),
    ...validateGpuIndex(s),
    ...validateListen(s),
    ...validateStreamLoop(s),
  ]
}

// ── New range validators ─────────────────────────────────────────────────────

export function validateKeyintMin(s) {
  if (s.keyintMin === undefined) return []
  const HINT = 'Typically GOP/2. For 25 fps + 2 s GOP: keyintMin=25. Recommended: set equal to fps to guarantee at least 1 keyframe/sec'
  if (!Number.isInteger(s.keyintMin) || s.keyintMin <= 0 || s.keyintMin > INT32_MAX)
    return [err('l1_keyint_min', 'l1_keyint_min', '-keyint_min',
      `Minimum keyframe interval must be a positive integer (1–${INT32_MAX})`, HINT)]
  if (s.keyintMin > 600)
    return [warn('l1_keyint_min', 'l1_keyint_min', '-keyint_min',
      `keyint_min ${s.keyintMin} is unusually high — most streams need a keyframe every few seconds`, HINT)]
  return []
}

export function validateScThreshold(s) {
  if (s.scThreshold === undefined) return []
  const HINT = '0 = disable scene cut detection (strongly recommended for live/IPTV to keep fixed-GOP). FFmpeg default: 40'
  if (typeof s.scThreshold === 'string' && s.scThreshold.startsWith('-'))
    return [err('l1_sc_threshold', 'l1_sc_threshold', '-sc_threshold',
      `sc_threshold value is "${s.scThreshold}" which looks like another flag — the value is missing. Provide a number (e.g. 0)`, HINT)]
  if (!Number.isInteger(s.scThreshold) || s.scThreshold < 0)
    return [err('l1_sc_threshold', 'l1_sc_threshold', '-sc_threshold',
      'Scene change threshold must be a non-negative integer (0 = disable)', HINT)]
  if (s.scThreshold > 500)
    return [warn('l1_sc_threshold', 'l1_sc_threshold', '-sc_threshold',
      `Scene change threshold ${s.scThreshold} is very high — effectively disables scene change detection. Use 0 explicitly to disable`, HINT)]
  if (s.scThreshold > 100)
    return [warn('l1_sc_threshold', 'l1_sc_threshold', '-sc_threshold',
      `Scene change threshold ${s.scThreshold} is outside the practical range (0–100, default 40) — values above 100 produce minimal I-frames and may impair error recovery`, HINT)]
  return []
}

export function validateBframes(s) {
  if (s.bframes === undefined) return []
  const HINT = '0 for live/low-latency (no delay). 2–3 for VOD H.264 quality. HEVC supports up to 8. Recommended: 0 for live, 2 for VOD'
  if (typeof s.bframes === 'string' && s.bframes.startsWith('-'))
    return [err('l1_bframes', 'l1_bframes', '-bf',
      `B-frames value is "${s.bframes}" which looks like another flag — the value is missing. Provide a number (e.g. 2)`, HINT)]
  if (!Number.isInteger(s.bframes) || s.bframes < 0 || s.bframes > 16)
    return [err('l1_bframes', 'l1_bframes', '-bf', 'B-frames must be an integer between 0 and 16', HINT)]
  if (s.bframes > 3)
    return [warn('l1_bframes', 'l1_bframes', '-bf',
        `B-frame count ${s.bframes} exceeds the common range (0–3) — higher values increase encoding delay and memory with diminishing compression gains. Use 0 for live/low-latency (no delay), 2–3 for VOD H.264 quality. HEVC supports up to 8.`, HINT)]
  return []
}

export function validateRefs(s) {
  if (s.refs === undefined) return []
  const HINT = '1 = fastest decode/lowest latency. 3–5 = typical quality/speed balance. Higher values improve compression but increase decoder memory. Recommended: 3'
  if (typeof s.refs === 'string' && s.refs.startsWith('-'))
    return [err('l1_refs', 'l1_refs', '-refs',
      `Reference frames value is "${s.refs}" which looks like another flag — the value is missing. Provide a number (e.g. 3)`, HINT)]
  if (!Number.isInteger(s.refs) || s.refs < 1 || s.refs > 16)
    return [err('l1_refs', 'l1_refs', '-refs', 'Reference frames must be an integer between 1 and 16', HINT)]
  if (s.refs > 4)
    return [warn('l1_refs', 'l1_refs', '-refs',
      `Reference frames ${s.refs} exceeds the typical range (1–4) — adds little quality benefit but increases memory and CPU usage`, HINT)]
  return []
}

export function validateMpegtsServiceId(s) {
  if (s.mpegtsServiceId === undefined) return []
  const HINT = 'Must be unique per multiplex. Typical: 1. Range 1–65535 (16-bit). Matches the SID in SDT/PAT tables'
  if (!Number.isInteger(s.mpegtsServiceId) || s.mpegtsServiceId < 1 || s.mpegtsServiceId > 65535)
    return [err('l1_service_id', 'l1_service_id', '-mpegts_service_id',
      'MPEG-TS Service ID must be an integer between 1 and 65535', HINT)]
  return []
}

export function validateHlsTime(s) {
  if (s.hlsTime === undefined) return []
  const HINT = '2–4 s for low-latency HLS (LL-HLS). 6 s is the common default. 10 s for stable VOD. Recommended: 6'
  if (!Number.isInteger(s.hlsTime) || s.hlsTime <= 0 || s.hlsTime > 3600)
    return [err('l1_hls_time', 'l1_hls_time', '-hls_time',
      'HLS segment duration must be an integer between 1 and 3600 seconds', HINT)]
  if (s.hlsTime > 30)
    return [warn('l1_hls_time', 'l1_hls_time', '-hls_time',
      `HLS segment duration ${s.hlsTime}s is very long — increases seek latency and startup delay`, HINT)]
  return []
}

export function validateHlsListSize(s) {
  if (s.hlsListSize === undefined) return []
  const HINT = '0 = keep all segments (VOD). 3–5 = live rolling window. Recommended live: 5 (covers ~30 s at 6 s segments)'
  if (!Number.isInteger(s.hlsListSize) || s.hlsListSize < 0 || s.hlsListSize > INT32_MAX)
    return [err('l1_hls_list_size', 'l1_hls_list_size', '-hls_list_size',
      `HLS playlist size must be an integer between 0 and ${INT32_MAX} (0 = unlimited)`, HINT)]
  if (s.hlsListSize > 100)
    return [warn('l1_hls_list_size', 'l1_hls_list_size', '-hls_list_size',
      `HLS playlist with ${s.hlsListSize} segments is unusually large — consider 0 for VOD or 3–10 for live`, HINT)]
  return []
}

export function validateMaxDelay(s) {
  if (s.maxDelay === undefined) return []
  const HINT = 'FFmpeg default: 700 000 µs (0.7 s). Live streaming: 200 000–500 000 µs. 0 = no buffering (may drop packets). Recommended live: 500 000'
  if (!Number.isInteger(s.maxDelay) || s.maxDelay < 0 || s.maxDelay > INT32_MAX)
    return [err('l1_max_delay', 'l1_max_delay', '-max_delay',
      `Max input delay must be an integer between 0 and ${INT32_MAX} microseconds`, HINT)]
  if (s.maxDelay > 10_000_000)
    return [warn('l1_max_delay', 'l1_max_delay', '-max_delay',
      `Max delay ${(s.maxDelay / 1_000_000).toFixed(1)}s is very high — may cause excessive buffering`, HINT)]
  return []
}

export function validateThreadQueueSize(s) {
  if (s.threadQueueSize === undefined) return []
  const HINT = 'FFmpeg default: 8 (too low for live, causes DTS errors). Typical live: 512–1024. High-latency/unstable sources: 4096. Recommended: 1024'
  if (!Number.isInteger(s.threadQueueSize) || s.threadQueueSize <= 0 || s.threadQueueSize > INT32_MAX)
    return [err('l1_thread_queue_size', 'l1_thread_queue_size', '-thread_queue_size',
      `Thread queue size must be a positive integer (1–${INT32_MAX})`, HINT)]
  if (s.threadQueueSize > 8192)
    return [warn('l1_thread_queue_size', 'l1_thread_queue_size', '-thread_queue_size',
      `Thread queue size ${s.threadQueueSize} is unreasonably high — may exhaust memory`, HINT)]
  return []
}

export function validateMaxMuxingQueueSize(s) {
  if (s.maxMuxingQueueSize === undefined) return []
  const HINT = 'FFmpeg default: 128. Raise to 1024–4096 if you see "Too many packets buffered for output stream" errors. Recommended: 1024'
  if (!Number.isInteger(s.maxMuxingQueueSize) || s.maxMuxingQueueSize <= 0 || s.maxMuxingQueueSize > INT32_MAX)
    return [err('l1_max_muxing_queue', 'l1_max_muxing_queue', '-max_muxing_queue_size',
      `Max muxing queue size must be a positive integer (1–${INT32_MAX})`, HINT)]
  if (s.maxMuxingQueueSize > 16384)
    return [warn('l1_max_muxing_queue', 'l1_max_muxing_queue', '-max_muxing_queue_size',
      `Max muxing queue size ${s.maxMuxingQueueSize} is very high — may waste memory. 1024–4096 covers most cases`, HINT)]
  return []
}

export function validateAudioBitrate(s) {
  if (!s.audioBitrate) return []
  const HINT = 'AAC: 128k (stereo), 192k (high quality), 320k (archival). AC3: 192k (stereo), 384k (5.1). Recommended stereo broadcast: 192k'
  if (!BITRATE_RE.test(s.audioBitrate))
    return [err('l1_audio_bitrate', 'l1_audio_bitrate', '-b:a',
      "Audio bitrate must be a number with optional suffix, e.g. '128k' or '192k'", HINT)]
  return []
}

export function validateLoudnormParams(s) {
  if (!s.loudnorm) return []
  const out = []
  const TP_HINT  = 'EBU R128 recommendation: −1 dBTP. For extra headroom: −2 dBTP. Recommended: −1'
  const LRA_HINT = 'EBU R128 max: 18 LU. Broadcast typical: 7–10 LU. Recommended: 7'
  if (s.loudnormTruePeak !== undefined) {
    if (!Number.isFinite(s.loudnormTruePeak) || s.loudnormTruePeak < -9 || s.loudnormTruePeak > 0)
      out.push(err('l1_loudnorm_tp', 'l1_loudnorm_tp', '-af loudnorm TP=',
        'Loudness true peak must be a number between -9 and 0 dBTP', TP_HINT))
  }
  if (s.loudnormLra !== undefined) {
    if (!Number.isFinite(s.loudnormLra) || s.loudnormLra < 1 || s.loudnormLra > 20)
      out.push(err('l1_loudnorm_lra', 'l1_loudnorm_lra', '-af loudnorm LRA=',
        'Loudness range (LRA) must be a number between 1 and 20 LU', LRA_HINT))
  }
  return out
}

// ── Codec-dependent field validators ───────────────────────────────────────────

const ASPECT_RE = /^\d{1,3}:\d{1,3}$/

const PROFILE_CODECS  = ['libx264','libx265','h264_nvenc','hevc_nvenc','h264_vaapi']
const NO_PRESET_CODECS = ['mpeg2video','mpeg4','disabled','copy']
const H264_LEVEL_CODECS_L1 = ['libx264','h264_nvenc','h264_vaapi']
const H265_LEVEL_CODECS_L1 = ['libx265','hevc_nvenc']

export function validateProfile(s) {
  if (!s.profile || !s.videoCodec) return []
  // Skip for copy/disabled — copy_video_preset rule handles that in L2
  if (s.videoCodec === 'copy' || s.videoCodec === 'disabled') return []
  const validProfiles = PROFILES[s.videoCodec]
  if (!validProfiles) return []
  if (validProfiles.length === 0)
    return [warn('l1_profile_ignored', 'l1_profile', '-profile:v',
      `${s.videoCodec} does not use -profile:v — this setting will be ignored`,
      'Remove the profile setting or switch to a codec that supports profiles (H.264, H.265)')]
  if (validProfiles.includes(s.profile)) return []
  return [err('l1_profile', 'l1_profile', '-profile:v',
    `Profile "${s.profile}" is not valid for ${s.videoCodec}. Valid: ${validProfiles.join(', ')}`,
    `Common choices: ${validProfiles.slice(0, 3).join(', ')}`)]
}

export function validatePreset(s) {
  if (!s.preset || !s.videoCodec) return []
  if (s.videoCodec === 'copy' || s.videoCodec === 'disabled') return []
  const family = CODEC_PRESET_FAMILY[s.videoCodec]
  if (family === null)
    return [warn('l1_preset_ignored', 'l1_preset', '-preset',
      `${s.videoCodec} does not use -preset — this setting will be ignored`,
      'Remove the preset setting or switch to a codec that supports presets')]
  if (family === undefined) return []  // unknown codec, skip
  const validPresets = PRESETS[family]
  if (!validPresets || validPresets.length === 0) return []
  if (validPresets.includes(s.preset)) return []
  return [err('l1_preset', 'l1_preset', '-preset',
    `Preset "${s.preset}" is not valid for ${s.videoCodec} (${family} family). Valid: ${validPresets.join(', ')}`,
    `Recommended: "${family === 'cpu' ? 'medium' : 'p4'}" for a good speed/quality balance`)]
}

export function validateLevel(s) {
  if (!s.level || !s.videoCodec) return []
  if (s.videoCodec === 'copy' || s.videoCodec === 'disabled') return []
  if (H264_LEVEL_CODECS_L1.includes(s.videoCodec)) {
    if (!VALID_LEVELS_H264.includes(s.level))
      return [err('l1_level', 'l1_level', '-level',
        `Level "${s.level}" is not valid for H.264. Valid: ${VALID_LEVELS_H264.join(', ')}`,
        'Common: 4.1 (1080p60/Blu-ray), 5.1 (4K60)')]
    if (parseFloat(s.level) >= 5.0)
      return [warn('l1_level_high', 'l1_level_high', '-level',
        `Level ${s.level} targets high-resolution/high-framerate content — may not play on older devices or set-top boxes`,
        'Use 4.0–4.2 for broad HD device compatibility')]
    return []
  }
  if (H265_LEVEL_CODECS_L1.includes(s.videoCodec)) {
    if (!VALID_LEVELS_H265.includes(s.level))
      return [err('l1_level', 'l1_level', '-level',
        `Level "${s.level}" is not valid for H.265. Valid: ${VALID_LEVELS_H265.join(', ')}`,
        'Common: 4.1 (1080p), 5.1 (4K)')]
    if (parseFloat(s.level) >= 6.0)
      return [warn('l1_level_high', 'l1_level_high', '-level',
        `Level ${s.level} targets 8K content — very few devices currently support this`,
        'Use 5.0–5.1 for broad 4K compatibility')]
    return []
  }
  // Other codecs: level has no meaning
  return [warn('l1_level_ignored', 'l1_level', '-level',
    `${s.videoCodec} does not use -level — this setting will be ignored`,
    'Remove the level setting or switch to H.264/H.265')]
}

export function validateChannelLayout(s) {
  if (!s.channelLayout) return []
  if (s.audioCodec === 'copy' || s.audioCodec === 'disabled') return []
  if (VALID_CHANNEL_LAYOUTS.includes(s.channelLayout)) return []
  return [err('l1_channel_layout', 'l1_channel_layout', '-channel_layout',
    `Channel layout "${s.channelLayout}" is not recognized. Valid: ${VALID_CHANNEL_LAYOUTS.join(', ')}`,
    'Common: stereo (2ch), 5.1 (6ch surround), 7.1 (8ch)')]
}

export function validateAspect(s) {
  if (!s.aspect) return []
  if (ASPECT_RE.test(s.aspect)) return []
  return [err('l1_aspect', 'l1_aspect', '-aspect',
    `Aspect ratio must be in W:H format, e.g. 16:9 or 4:3 (got "${s.aspect}")`,
    'Common: 16:9 (widescreen), 4:3 (standard), 21:9 (ultrawide)')]
}

// ── Field-specific validators with info/recommendations ─────────────────────

export function validatePixFmt(s) {
  if (!s.pixFmt) return []
  const HINT = 'yuv420p = widest compatibility (web, TV, mobile). yuv422p = broadcast/editing. 10-bit = HDR content'
  if (DEPRECATED_PIX_FMTS.includes(s.pixFmt))
    return [warn('l1_pix_fmt', 'l1_pix_fmt', '-pix_fmt',
      `"${s.pixFmt}" is a deprecated JPEG-range pixel format — use the modern equivalent (e.g. yuv420p with -color_range pc)`, HINT)]
  if (!VALID_PIX_FMTS.includes(s.pixFmt))
    return [err('l1_pix_fmt', 'l1_pix_fmt', '-pix_fmt',
      `Pixel format must be one of: ${VALID_PIX_FMTS.join(', ')} (got "${s.pixFmt}")`, HINT)]
  return []
}

export function validateBsfVideo(s) {
  if (!s.bsfVideo) return []
  const HINT = 'h264_mp4toannexb: H.264 in MPEG-TS. hevc_mp4toannexb: HEVC in MPEG-TS. Apply only codec-relevant filters'
  if (!VALID_BSF_VIDEO.includes(s.bsfVideo))
    return [err('l1_bsf_video', 'l1_bsf_video', '-bsf:v',
      `Video bitstream filter must be one of: ${VALID_BSF_VIDEO.join(', ')} (got "${s.bsfVideo}")`, HINT)]
  return []
}

export function validateFieldOrder(s) {
  if (!s.fieldOrder) return []
  const HINT = 'tt = top-field-first (most common). bb = bottom-field-first (PAL DV). progressive = no interlacing'
  if (!VALID_FIELD_ORDERS.includes(s.fieldOrder))
    return [err('l1_field_order', 'l1_field_order', '-field_order',
      `Field order must be one of: ${VALID_FIELD_ORDERS.join(', ')} (got "${s.fieldOrder}")`, HINT)]
  return []
}

// ── Range / format validators ──────────────────────────────────────────────

export function validateCustomFrameSize(s) {
  if (s.frameSize !== 'custom' || !s.customFrameSize) return []
  const HINT = 'Common: 1920x1080 (Full HD), 1280x720 (HD), 3840x2160 (4K UHD), 720x576 (SD PAL), 720x480 (SD NTSC)'
  if (!FRAMESIZE_RE.test(s.customFrameSize))
    return [err('l1_framesize', 'l1_framesize', '-s',
      'Frame size must be in WxH format, e.g. 1920x1080', HINT)]
  return []
}

export function validateCustomFps(s) {
  if (s.fps !== 'custom' || !s.customFps) return []
  const HINT = 'Common: 23.976 (film), 25 (PAL/EU), 29.97 or 30000/1001 (NTSC), 30, 50, 59.94, 60. Fractional notation (e.g. 30000/1001) is supported'
  const n = parseFps(s.customFps)
  if (isNaN(n) || n <= 0)
    return [err('l1_fps', 'l1_fps', '-r',
      `Custom FPS "${s.customFps}" is not a valid frame rate — use a decimal (29.97) or fractional notation (30000/1001)`, HINT)]
  if (n > 120)
    return [warn('l1_fps', 'l1_fps', '-r',
      `FPS ${s.customFps} (≈${n.toFixed(3)}) is unusually high — most displays and encoders max out at 60`, HINT)]
  return []
}

export function validateGop(s) {
  if (s.gop === undefined) return []
  const HINT = 'Formula: fps × keyframe_interval_seconds. E.g. 25 fps × 4 s = 100. Typical live: 50–250. Recommended: match segment duration'
  if (!Number.isInteger(s.gop) || s.gop <= 0 || s.gop > INT32_MAX)
    return [err('l1_gop', 'l1_gop', '-g', `GOP must be a positive integer (1–${INT32_MAX})`, HINT)]
  if (s.gop > 1000)
    return [warn('l1_gop', 'l1_gop', '-g',
      `GOP ${s.gop} is very large — may cause long seek times and poor error recovery`, HINT)]
  return []
}

export function validateCrf(s) {
  if (s.bitrateMode !== 'crf' || s.crfValue === undefined || !s.videoCodec) return []
  const HINT = 'Lower = better quality, larger file. H.264 typical: 18–28, recommended: 23. HEVC typical: 22–32, recommended: 28. AV1 typical: 20–40, recommended: 30'
  if (!Number.isFinite(s.crfValue))
    return [err('l1_crf', 'l1_crf', '-crf',
      'CRF value must be a valid number', HINT)]
  const range = CRF_RANGE[s.videoCodec]
  if (!range) return []
  const [min, max] = range
  if (s.crfValue < min || s.crfValue > max)
    return [err('l1_crf', 'l1_crf', '-crf',
      `CRF value must be ${min}–${max} for ${s.videoCodec}`, HINT)]
  return []
}

export function validateBitrates(s) {
  const out = []
  const BR_HINT  = 'Typical: 500k (SD), 2M (720p), 4–8M (1080p), 15–25M (4K). Use k/M suffix'
  const MR_HINT  = 'Typically 10–20% above target bitrate. Must be paired with -bufsize. Example: target=4M → maxrate=5M'
  const BUF_HINT = '2× maxrate for broadcast VBR, 1× maxrate for streaming. Example: maxrate=5M → bufsize=10M'
  if (s.targetBitrate && !BITRATE_RE.test(s.targetBitrate))
    out.push(err('l1_bitrate', 'l1_bitrate', '-b:v',
      "Bitrate must be a number with optional suffix, e.g. '4M' or '500k'", BR_HINT))
  if (s.maxrate && !BITRATE_RE.test(s.maxrate))
    out.push(err('l1_maxrate', 'l1_maxrate', '-maxrate',
      'Max rate must be a number with optional suffix', MR_HINT))
  if (s.bufsize && !BITRATE_RE.test(s.bufsize))
    out.push(err('l1_bufsize', 'l1_bufsize', '-bufsize',
      'Buffer size must be a number with optional suffix', BUF_HINT))
  return out
}

export function validatePids(s) {
  const out = []
  const HINT = 'Convention: PMT at 256, video at 257, audio at 258. Avoid 0–31 (reserved) and 8191 (null packet)'
  const checkPid = (val, id, flag) => {
    if (val === undefined) return
    if (val >= 32 && val <= 8186) return
    out.push(err(id, id, flag, `PID must be between 32 and 8186 (got ${val})`, HINT))
  }
  checkPid(s.mpegtsStartPid,    'l1_pid_start', '-mpegts_start_pid')
  checkPid(s.mpegtsPmtStartPid, 'l1_pid_pmt',   '-mpegts_pmt_start_pid')
  return out
}

export function validatePcrPeriod(s) {
  if (s.pcrPeriod === undefined) return []
  const HINT = 'DVB spec max: 100 ms. FFmpeg default: 20 ms. Recommended: 40 ms for broadcast, 20 ms for IPTV'
  if (!Number.isInteger(s.pcrPeriod) || s.pcrPeriod <= 0 || s.pcrPeriod > 100)
    return [err('l1_pcr', 'l1_pcr', '-pcr_period',
      'PCR period must be an integer between 1 and 100 ms (DVB spec max)', HINT)]
  return []
}

export function validateDialnorm(s) {
  if (s.dialnorm === undefined) return []
  const HINT = 'Dolby standard: −27 for film, −24 for TV. EBU R128 (−23 LUFS) maps to −23. Recommended broadcast: −27'
  if (!Number.isInteger(s.dialnorm) || s.dialnorm < -31 || s.dialnorm > -1)
    return [err('l1_dialnorm', 'l1_dialnorm', '-dialnorm',
      'Dialogue normalization must be an integer between -31 and -1 dBFS', HINT)]
  return []
}

export function validateLoudnorm(s) {
  if (!s.loudnorm || s.loudnormTarget === undefined) return []
  const HINT = 'EBU R128: −23 LUFS. Netflix: −27 LUFS. YouTube normalises to −14 LUFS. Podcast: −16 LUFS. Recommended broadcast: −23'
  if (s.loudnormTarget < -70 || s.loudnormTarget > 0)
    return [err('l1_loudnorm_target', 'l1_loudnorm', '-af loudnorm I=',
      'Loudness target must be between -70 and 0 LUFS', HINT)]
  return []
}

export function validateTimeout(s) {
  if (s.timeout === undefined) return []
  const HINT = 'SRT/RTSP on stable network: 5 000 000 µs (5 s). Unstable/satellite links: 10 000 000 µs (10 s). Recommended: 5 000 000'
  if (!Number.isInteger(s.timeout) || s.timeout <= 0 || s.timeout > INT32_MAX)
    return [err('l1_timeout', 'l1_timeout', '-timeout',
      `Timeout must be a positive integer in microseconds (1–${INT32_MAX})`, HINT)]
  if (s.timeout > 30_000_000)
    return [warn('l1_timeout', 'l1_timeout', '-timeout',
      `Timeout ${(s.timeout / 1_000_000).toFixed(0)}s is very high — may delay failure detection on dead sources`, HINT)]
  return []
}
// ── New validators ────────────────────────────────────────────────────────────────────────

export function validateAnalyzeDuration(s) {
  if (s.analyzeDuration === undefined) return []
  const HINT = 'Unit: microseconds. Common: 5 000 000 (5 s), 10 000 000 (10 s). ' +
    'Higher values delay stream start but improve codec detection on complex inputs. ' +
    'FFmpeg default: 5 000 000. For reliable live IPTV sources 5 000 000 is usually sufficient'
  if (!Number.isInteger(s.analyzeDuration) || s.analyzeDuration <= 0 || s.analyzeDuration > 120_000_000)
    return [err('l1_analyze_duration', 'l1_analyze_duration', '-analyzeduration',
      `Analyze duration must be a positive integer in microseconds, max 120 000 000 (2 min) (got ${s.analyzeDuration})`, HINT)]
  if (s.analyzeDuration > 30_000_000)
    return [warn('l1_analyze_duration', 'l1_analyze_duration', '-analyzeduration',
      `Analyze duration ${(s.analyzeDuration / 1_000_000).toFixed(0)} s is very high — causes a long startup delay before the stream begins`, HINT)]
  return []
}

export function validateProbeSize(s) {
  if (s.probeSize === undefined) return []
  const HINT = 'Unit: bytes. Common: 5 000 000 (5 MB), 10 000 000 (10 MB). ' +
    'Higher values improve format/codec detection but use more memory. ' +
    'FFmpeg default: 5 000 000. Pair with -analyzeduration for hard-to-detect streams'
  if (!Number.isInteger(s.probeSize) || s.probeSize <= 0 || s.probeSize > 1_000_000_000)
    return [err('l1_probe_size', 'l1_probe_size', '-probesize',
      `Probe size must be a positive integer in bytes, max 1 000 000 000 (1 GB) (got ${s.probeSize})`, HINT)]
  if (s.probeSize > 100_000_000)
    return [warn('l1_probe_size', 'l1_probe_size', '-probesize',
      `Probe size ${(s.probeSize / 1_000_000).toFixed(0)} MB is very high — may cause significant memory usage and startup latency`, HINT)]
  return []
}

export function validateGpuIndex(s) {
  if (s.gpuIndex === undefined) return []
  const HINT = '-1 = FFmpeg auto-selects any available GPU. 0 = first GPU, 1 = second GPU, etc. ' +
    'Only affects NVENC/NVDEC. Recommended: -1 (auto) unless you specifically need a particular device'
  if (!Number.isInteger(s.gpuIndex) || s.gpuIndex < -1 || s.gpuIndex > 15)
    return [err('l1_gpu_index', 'l1_gpu_index', '-gpu',
      `GPU index must be an integer from -1 (auto) to 15 (got ${s.gpuIndex})`, HINT)]
  return []
}

export function validateListen(s) {
  if (s.listen === undefined) return []
  const HINT = '0 = client mode (default, connect to URL). 1 = server mode (bind and wait for incoming connection). ' +
    'Use listen=1 on the output URL for TCP/MPEG-TS push receivers. ' +
    'The output URL must use the tcp:// scheme or a host:port address'
  if (s.listen !== 0 && s.listen !== 1)
    return [err('l1_listen', 'l1_listen', '-listen',
      `Listen mode must be 0 (client) or 1 (server) (got ${s.listen})`, HINT)]
  return []
}

export function validateStreamLoop(s) {
  if (s.streamLoop === undefined) return []
  // Accept boolean true for backward compatibility (treated as infinite loop = -1)
  if (s.streamLoop === true) return []
  const HINT = '-1 = loop indefinitely, 0 = play once (no loop), N > 0 = repeat N additional times. ' +
    'Always pair with -re to avoid flooding the output. Recommended: -stream_loop -1 -re for broadcast playout'
  if (!Number.isInteger(s.streamLoop) || s.streamLoop < -1)
    return [err('l1_stream_loop', 'l1_stream_loop', '-stream_loop',
      `Stream loop must be -1 (infinite), 0 (no loop), or a positive integer count (got ${s.streamLoop})`, HINT)]
  return []
}
// ── Helper ────────────────────────────────────────────────────────────────────

function err(id, group, flag, message, hint) {
  const e = { id, group, severity: 'error', message, flag, layer: 1 }
  if (hint !== undefined) e.hint = hint
  return e
}

function warn(id, group, flag, message, hint) {
  const e = { id, group, severity: 'warning', message, flag, layer: 1 }
  if (hint !== undefined) e.hint = hint
  return e
}

function info(id, group, flag, message, hint) {
  const e = { id, group, severity: 'info', message, flag, layer: 1 }
  if (hint !== undefined) e.hint = hint
  return e
}

/**
 * Validate NVDEC hardware deinterlace (-deint) value.
 * Valid values: 0 (weave/off), 1 (bob), 2 (adaptive).
 */
export function validateNvdecDeint(s) {
  if (s.nvdecDeint === undefined) return []
  const HINT = '0 = weave (no deinterlace). 1 = bob (frame-rate deinterlace). 2 = adaptive. Only effective with NVDEC cuvid decoders (-hwaccel cuda)'
  if (!VALID_NVDEC_DEINT.includes(s.nvdecDeint))
    return [err('l1_nvdec_deint', 'l1_nvdec_deint', '-deint',
      `NVDEC deinterlace mode must be one of: ${VALID_NVDEC_DEINT.join(', ')} (got "${s.nvdecDeint}")`, HINT)]
  return []
}

/**
 * Generic enum validator for a single-value field.
 * id and group use the same value (the id param).
 */
function validateEnum(s, field, id, flag, validValues, label) {
  const val = s[field]
  if (val === undefined || val === null) return []
  if (validValues.includes(val)) return []
  return [err(id, id, flag,
    `${label} must be one of: ${validValues.join(', ')} (got "${val}")`)]
}

/**
 * Generic enum validator for array fields (multi-select).
 * Reports the first invalid entry found.
 */
function validateArrayEnum(s, field, id, flag, validValues, label) {
  const arr = s[field]
  if (!Array.isArray(arr) || arr.length === 0) return []
  const invalid = arr.filter(v => !validValues.includes(v))
  if (invalid.length === 0) return []
  return [err(id, id, flag,
    `Unknown ${label} value(s): ${invalid.join(', ')}. Valid: ${validValues.join(', ')}`)]
}
