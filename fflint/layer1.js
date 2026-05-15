// layer1.js
import {
  CRF_RANGE, parseBitrate, parseFps,
  VALID_INPUT_TYPES, VALID_VIDEO_CODECS, VALID_INPUT_DECODER_CODECS,
  VALID_HWACCELS, VALID_PIX_FMTS,
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
import { t } from './i18n.js'

const BITRATE_RE   = /^\d+(\.\d+)?[kKmMgG]?$/i
// FFmpeg's av_parse_video_size accepts both 'x' and '-' as WxH separators
const FRAMESIZE_RE = /^\d{2,5}[x-]\d{2,5}$/
const INT32_MAX    = 2_147_483_647

// Returns true when v is a valid template variable reference: ${identifier}
// where identifier is Latin letters, digits, and underscores — no spaces.
// Example: ${gpu9} → true, ${g pu} → false (would be split by tokenizer anyway)
const isTemplateVar = v => typeof v === 'string' && /^\$\{[a-zA-Z0-9_]+\}$/.test(v)

export function validateLayer1(s) {
  return [
    // ── Enum validators ──────────────────────────────────────────────────────
    ...validateEnum(s, 'inputType',           'l1_input_type',          '-i',                     VALID_INPUT_TYPES,            'Input type'),
    ...validateEnum(s, 'videoCodec',          'l1_video_codec',         '-c:v',                   VALID_VIDEO_CODECS,           'Video codec'),
    ...validateEnum(s, 'inputDecoderCodec',   'l1_input_decoder_codec', '-c:v (input)',            VALID_INPUT_DECODER_CODECS,   'Input decoder codec'),
    ...validateEnum(s, 'inputHwaccel',        'l1_input_hwaccel',       '-hwaccel',               VALID_HWACCELS,               'HW acceleration'),
    ...validateEnum(s, 'inputHwaccelOutputFormat', 'l1_input_hwaccel_output_fmt', '-hwaccel_output_format', VALID_HWACCEL_OUTPUT_FORMATS, 'HW accel output format'),
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
    ...validateScaleFilter(s),
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
  if (isTemplateVar(s.keyintMin)) return []
  if (!Number.isInteger(s.keyintMin) || s.keyintMin <= 0 || s.keyintMin > INT32_MAX) {
    const { message, hint } = t('l1_keyint_min_invalid', { max: INT32_MAX })
    return [err('l1_keyint_min', 'l1_keyint_min', '-keyint_min', message, hint)]
  }
  if (s.keyintMin > 600) {
    const { message, hint } = t('l1_keyint_min_high', { value: s.keyintMin })
    return [warn('l1_keyint_min', 'l1_keyint_min', '-keyint_min', message, hint)]
  }
  return []
}

export function validateScThreshold(s) {
  if (s.scThreshold === undefined) return []
  if (isTemplateVar(s.scThreshold)) return []
  if (typeof s.scThreshold === 'string' && s.scThreshold.startsWith('-')) {
    const { message, hint } = t('l1_sc_threshold_looks_like_flag', { value: s.scThreshold })
    return [err('l1_sc_threshold', 'l1_sc_threshold', '-sc_threshold', message, hint)]
  }
  if (!Number.isInteger(s.scThreshold) || s.scThreshold < 0) {
    const { message, hint } = t('l1_sc_threshold_invalid')
    return [err('l1_sc_threshold', 'l1_sc_threshold', '-sc_threshold', message, hint)]
  }
  if (s.scThreshold > 500) {
    const { message, hint } = t('l1_sc_threshold_very_high', { value: s.scThreshold })
    return [warn('l1_sc_threshold', 'l1_sc_threshold', '-sc_threshold', message, hint)]
  }
  if (s.scThreshold > 100) {
    const { message, hint } = t('l1_sc_threshold_high', { value: s.scThreshold })
    return [warn('l1_sc_threshold', 'l1_sc_threshold', '-sc_threshold', message, hint)]
  }
  return []
}

export function validateBframes(s) {
  if (s.bframes === undefined) return []
  if (isTemplateVar(s.bframes)) return []
  if (typeof s.bframes === 'string' && s.bframes.startsWith('-')) {
    const { message, hint } = t('l1_bframes_looks_like_flag', { value: s.bframes })
    return [err('l1_bframes', 'l1_bframes', '-bf', message, hint)]
  }
  if (!Number.isInteger(s.bframes) || s.bframes < 0 || s.bframes > 16) {
    const { message, hint } = t('l1_bframes_invalid')
    return [err('l1_bframes', 'l1_bframes', '-bf', message, hint)]
  }
  if (s.bframes > 3) {
    const { message, hint } = t('l1_bframes_high', { value: s.bframes })
    return [warn('l1_bframes', 'l1_bframes', '-bf', message, hint)]
  }
  return []
}

export function validateRefs(s) {
  if (s.refs === undefined) return []
  if (isTemplateVar(s.refs)) return []
  if (typeof s.refs === 'string' && s.refs.startsWith('-')) {
    const { message, hint } = t('l1_refs_looks_like_flag', { value: s.refs })
    return [err('l1_refs', 'l1_refs', '-refs', message, hint)]
  }
  if (!Number.isInteger(s.refs) || s.refs < 1 || s.refs > 16) {
    const { message, hint } = t('l1_refs_invalid')
    return [err('l1_refs', 'l1_refs', '-refs', message, hint)]
  }
  if (s.refs > 4) {
    const { message, hint } = t('l1_refs_high', { value: s.refs })
    return [warn('l1_refs', 'l1_refs', '-refs', message, hint)]
  }
  return []
}

export function validateMpegtsServiceId(s) {
  if (s.mpegtsServiceId === undefined) return []
  if (isTemplateVar(s.mpegtsServiceId)) return []
  if (!Number.isInteger(s.mpegtsServiceId) || s.mpegtsServiceId < 1 || s.mpegtsServiceId > 65535) {
    const { message, hint } = t('l1_service_id_invalid')
    return [err('l1_service_id', 'l1_service_id', '-mpegts_service_id', message, hint)]
  }
  return []
}

export function validateHlsTime(s) {
  if (s.hlsTime === undefined) return []
  if (isTemplateVar(s.hlsTime)) return []
  if (!Number.isInteger(s.hlsTime) || s.hlsTime <= 0 || s.hlsTime > 3600) {
    const { message, hint } = t('l1_hls_time_invalid')
    return [err('l1_hls_time', 'l1_hls_time', '-hls_time', message, hint)]
  }
  if (s.hlsTime > 30) {
    const { message, hint } = t('l1_hls_time_high', { value: s.hlsTime })
    return [warn('l1_hls_time', 'l1_hls_time', '-hls_time', message, hint)]
  }
  return []
}

export function validateHlsListSize(s) {
  if (s.hlsListSize === undefined) return []
  if (isTemplateVar(s.hlsListSize)) return []
  if (!Number.isInteger(s.hlsListSize) || s.hlsListSize < 0 || s.hlsListSize > INT32_MAX) {
    const { message, hint } = t('l1_hls_list_size_invalid', { max: INT32_MAX })
    return [err('l1_hls_list_size', 'l1_hls_list_size', '-hls_list_size', message, hint)]
  }
  if (s.hlsListSize > 100) {
    const { message, hint } = t('l1_hls_list_size_high', { value: s.hlsListSize })
    return [warn('l1_hls_list_size', 'l1_hls_list_size', '-hls_list_size', message, hint)]
  }
  return []
}

export function validateMaxDelay(s) {
  if (s.maxDelay === undefined) return []
  if (isTemplateVar(s.maxDelay)) return []
  if (!Number.isInteger(s.maxDelay) || s.maxDelay < 0 || s.maxDelay > INT32_MAX) {
    const { message, hint } = t('l1_max_delay_invalid', { max: INT32_MAX })
    return [err('l1_max_delay', 'l1_max_delay', '-max_delay', message, hint)]
  }
  if (s.maxDelay > 10_000_000) {
    const { message, hint } = t('l1_max_delay_high', { seconds: (s.maxDelay / 1_000_000).toFixed(1) })
    return [warn('l1_max_delay', 'l1_max_delay', '-max_delay', message, hint)]
  }
  return []
}

export function validateThreadQueueSize(s) {
  if (s.threadQueueSize === undefined) return []
  if (isTemplateVar(s.threadQueueSize)) return []
  if (!Number.isInteger(s.threadQueueSize) || s.threadQueueSize <= 0 || s.threadQueueSize > INT32_MAX) {
    const { message, hint } = t('l1_thread_queue_size_invalid', { max: INT32_MAX })
    return [err('l1_thread_queue_size', 'l1_thread_queue_size', '-thread_queue_size', message, hint)]
  }
  if (s.threadQueueSize > 8192) {
    const { message, hint } = t('l1_thread_queue_size_high', { value: s.threadQueueSize })
    return [warn('l1_thread_queue_size', 'l1_thread_queue_size', '-thread_queue_size', message, hint)]
  }
  return []
}

export function validateMaxMuxingQueueSize(s) {
  if (s.maxMuxingQueueSize === undefined) return []
  if (isTemplateVar(s.maxMuxingQueueSize)) return []
  if (!Number.isInteger(s.maxMuxingQueueSize) || s.maxMuxingQueueSize <= 0 || s.maxMuxingQueueSize > INT32_MAX) {
    const { message, hint } = t('l1_max_muxing_queue_invalid', { max: INT32_MAX })
    return [err('l1_max_muxing_queue', 'l1_max_muxing_queue', '-max_muxing_queue_size', message, hint)]
  }
  if (s.maxMuxingQueueSize > 16384) {
    const { message, hint } = t('l1_max_muxing_queue_high', { value: s.maxMuxingQueueSize })
    return [warn('l1_max_muxing_queue', 'l1_max_muxing_queue', '-max_muxing_queue_size', message, hint)]
  }
  return []
}

export function validateAudioBitrate(s) {
  if (!s.audioBitrate) return []
  if (isTemplateVar(s.audioBitrate)) return []
  if (!BITRATE_RE.test(s.audioBitrate)) {
    const { message, hint } = t('l1_audio_bitrate_invalid')
    return [err('l1_audio_bitrate', 'l1_audio_bitrate', '-b:a', message, hint)]
  }
  return []
}

export function validateLoudnormParams(s) {
  if (!s.loudnorm) return []
  const out = []
  if (s.loudnormTruePeak !== undefined) {
    if (!Number.isFinite(s.loudnormTruePeak) || s.loudnormTruePeak < -9 || s.loudnormTruePeak > 0) {
      const { message, hint } = t('l1_loudnorm_tp_invalid')
      out.push(err('l1_loudnorm_tp', 'l1_loudnorm_tp', '-af loudnorm TP=', message, hint))
    }
  }
  if (s.loudnormLra !== undefined) {
    if (!Number.isFinite(s.loudnormLra) || s.loudnormLra < 1 || s.loudnormLra > 20) {
      const { message, hint } = t('l1_loudnorm_lra_invalid')
      out.push(err('l1_loudnorm_lra', 'l1_loudnorm_lra', '-af loudnorm LRA=', message, hint))
    }
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
  if (isTemplateVar(s.profile) || isTemplateVar(s.videoCodec)) return []
  if (s.videoCodec === 'copy' || s.videoCodec === 'disabled') return []
  const validProfiles = PROFILES[s.videoCodec]
  if (!validProfiles) return []
  if (validProfiles.length === 0) {
    const { message, hint } = t('l1_profile_ignored', { codec: s.videoCodec })
    return [warn('l1_profile_ignored', 'l1_profile', '-profile:v', message, hint)]
  }
  if (validProfiles.includes(s.profile)) return []
  const { message, hint } = t('l1_profile_invalid', { profile: s.profile, codec: s.videoCodec, valid: validProfiles.join(', '), common: validProfiles.slice(0, 3).join(', ') })
  return [err('l1_profile', 'l1_profile', '-profile:v', message, hint)]
}

export function validatePreset(s) {
  if (!s.preset || !s.videoCodec) return []
  if (isTemplateVar(s.preset) || isTemplateVar(s.videoCodec)) return []
  if (s.videoCodec === 'copy' || s.videoCodec === 'disabled') return []
  const family = CODEC_PRESET_FAMILY[s.videoCodec]
  if (family === null) {
    const { message, hint } = t('l1_preset_ignored', { codec: s.videoCodec })
    return [warn('l1_preset_ignored', 'l1_preset', '-preset', message, hint)]
  }
  if (family === undefined) return []
  const validPresets = PRESETS[family]
  if (!validPresets || validPresets.length === 0) return []
  if (validPresets.includes(s.preset)) return []
  const { message, hint } = t('l1_preset_invalid', { preset: s.preset, codec: s.videoCodec, family, valid: validPresets.join(', '), recommended: family === 'cpu' ? 'medium' : 'p4' })
  return [err('l1_preset', 'l1_preset', '-preset', message, hint)]
}

export function validateLevel(s) {
  if (!s.level || !s.videoCodec) return []
  if (isTemplateVar(s.level) || isTemplateVar(s.videoCodec)) return []
  if (s.videoCodec === 'copy' || s.videoCodec === 'disabled') return []
  if (H264_LEVEL_CODECS_L1.includes(s.videoCodec)) {
    if (!VALID_LEVELS_H264.includes(s.level)) {
      const { message, hint } = t('l1_level_invalid_h264', { level: s.level, valid: VALID_LEVELS_H264.join(', ') })
      return [err('l1_level', 'l1_level', '-level', message, hint)]
    }
    if (parseFloat(s.level) >= 5.0) {
      const { message, hint } = t('l1_level_high_h264', { level: s.level })
      return [warn('l1_level_high', 'l1_level_high', '-level', message, hint)]
    }
    return []
  }
  if (H265_LEVEL_CODECS_L1.includes(s.videoCodec)) {
    if (!VALID_LEVELS_H265.includes(s.level)) {
      const { message, hint } = t('l1_level_invalid_h265', { level: s.level, valid: VALID_LEVELS_H265.join(', ') })
      return [err('l1_level', 'l1_level', '-level', message, hint)]
    }
    if (parseFloat(s.level) >= 6.0) {
      const { message, hint } = t('l1_level_high_h265', { level: s.level })
      return [warn('l1_level_high', 'l1_level_high', '-level', message, hint)]
    }
    return []
  }
  const { message, hint } = t('l1_level_ignored', { codec: s.videoCodec })
  return [warn('l1_level_ignored', 'l1_level', '-level', message, hint)]
}

export function validateChannelLayout(s) {
  if (!s.channelLayout) return []
  if (isTemplateVar(s.channelLayout)) return []
  if (s.audioCodec === 'copy' || s.audioCodec === 'disabled') return []
  if (VALID_CHANNEL_LAYOUTS.includes(s.channelLayout)) return []
  const { message, hint } = t('l1_channel_layout_invalid', { layout: s.channelLayout, valid: VALID_CHANNEL_LAYOUTS.join(', ') })
  return [err('l1_channel_layout', 'l1_channel_layout', '-channel_layout', message, hint)]
}

export function validateAspect(s) {
  if (!s.aspect) return []
  if (isTemplateVar(s.aspect)) return []
  if (ASPECT_RE.test(s.aspect)) return []
  const { message, hint } = t('l1_aspect_invalid', { value: s.aspect })
  return [err('l1_aspect', 'l1_aspect', '-aspect', message, hint)]
}

// ── Field-specific validators with info/recommendations ─────────────────────

export function validatePixFmt(s) {
  if (!s.pixFmt) return []
  if (isTemplateVar(s.pixFmt)) return []
  if (DEPRECATED_PIX_FMTS.includes(s.pixFmt)) {
    const { message, hint } = t('l1_pix_fmt_deprecated', { value: s.pixFmt })
    return [warn('l1_pix_fmt', 'l1_pix_fmt', '-pix_fmt', message, hint)]
  }
  if (!VALID_PIX_FMTS.includes(s.pixFmt)) {
    const { message, hint } = t('l1_pix_fmt_invalid', { valid: VALID_PIX_FMTS.join(', '), val: s.pixFmt })
    return [err('l1_pix_fmt', 'l1_pix_fmt', '-pix_fmt', message, hint)]
  }
  return []
}

export function validateBsfVideo(s) {
  if (!s.bsfVideo) return []
  if (isTemplateVar(s.bsfVideo)) return []
  if (!VALID_BSF_VIDEO.includes(s.bsfVideo)) {
    const { message, hint } = t('l1_bsf_video_invalid', { valid: VALID_BSF_VIDEO.join(', '), val: s.bsfVideo })
    return [err('l1_bsf_video', 'l1_bsf_video', '-bsf:v', message, hint)]
  }
  return []
}

export function validateFieldOrder(s) {
  if (!s.fieldOrder) return []
  if (isTemplateVar(s.fieldOrder)) return []
  if (!VALID_FIELD_ORDERS.includes(s.fieldOrder)) {
    const { message, hint } = t('l1_field_order_invalid', { valid: VALID_FIELD_ORDERS.join(', '), val: s.fieldOrder })
    return [err('l1_field_order', 'l1_field_order', '-field_order', message, hint)]
  }
  return []
}

// ── Range / format validators ──────────────────────────────────────────────

export function validateCustomFrameSize(s) {
  if (s.frameSize !== 'custom' || !s.customFrameSize) return []
  if (isTemplateVar(s.customFrameSize)) return []
  const pair = String(s.customFrameSize).match(/^(-?\d+)\D(-?\d+)$/)
  if (pair) {
    const w = parseInt(pair[1], 10)
    const h = parseInt(pair[2], 10)
    if (w <= 0 || h <= 0) {
      const { message, hint } = t('l1_framesize_non_positive', { value: s.customFrameSize })
      return [err('l1_framesize', 'l1_framesize', '-s', message, hint)]
    }
  }
  if (!FRAMESIZE_RE.test(s.customFrameSize)) {
    const { message, hint } = t('l1_framesize_invalid')
    return [err('l1_framesize', 'l1_framesize', '-s', message, hint)]
  }
  return []
}

export function validateCustomFps(s) {
  if (s.fps !== 'custom' || !s.customFps) return []
  if (isTemplateVar(s.customFps)) return []
  const n = parseFps(s.customFps)
  if (isNaN(n) || n <= 0) {
    const { message, hint } = t('l1_fps_invalid', { value: s.customFps })
    return [err('l1_fps', 'l1_fps', '-r', message, hint)]
  }
  if (n > 120) {
    const { message, hint } = t('l1_fps_high', { value: s.customFps, approx: n.toFixed(3) })
    return [warn('l1_fps', 'l1_fps', '-r', message, hint)]
  }
  return []
}

// Catches `scale=1920x1080` style typos: the scale filter (and its hardware
// variants) require WIDTH and HEIGHT separated by ':' or as named args, never
// 'x'. `-s` uses 'x' but inside a filter chain it is not a valid separator
// and FFmpeg will refuse the filter graph.
export function validateScaleFilter(s) {
  if (!Array.isArray(s.vfAtoms) || s.vfAtoms.length === 0) return []
  const out = []
  for (let i = 0; i < s.vfAtoms.length; i++) {
    const a = s.vfAtoms[i]
    if (a.name !== 'scale' && !a.name.startsWith('scale_')) continue
    const w = a.args.w ?? a.args.width
    const h = a.args.h ?? a.args.height
    if (h === undefined && typeof w === 'string' && /^\d+\s*[x×]\s*\d+$/.test(w)) {
      const { message, hint } = t('l1_vf_scale_wrong_separator', { name: a.name, value: w })
      out.push(err('l1_vf_scale_syntax', 'l1_vf_scale_syntax', '-vf', message, hint))
      continue
    }
    if ((w === undefined || h === undefined) && (w !== undefined || h !== undefined)) {
      const next = s.vfAtoms[i + 1]
      if (h === undefined && typeof w === 'string' && /^\d+$/.test(w)
          && next && /^-?\d+$/.test(next.name)) {
        const { message, hint } = t('l1_vf_scale_comma_separator', { name: a.name, w, h: next.name })
        out.push(err('l1_vf_scale_syntax', 'l1_vf_scale_syntax', '-vf', message, hint))
        continue
      }
      const { message, hint } = t('l1_vf_scale_missing_dim', { name: a.name })
      out.push(err('l1_vf_scale_syntax', 'l1_vf_scale_syntax', '-vf', message, hint))
    }
  }
  return out
}

export function validateGop(s) {
  if (s.gop === undefined) return []
  if (isTemplateVar(s.gop)) return []
  if (!Number.isInteger(s.gop) || s.gop <= 0 || s.gop > INT32_MAX) {
    const { message, hint } = t('l1_gop_invalid', { max: INT32_MAX })
    return [err('l1_gop', 'l1_gop', '-g', message, hint)]
  }
  if (s.gop > 1000) {
    const { message, hint } = t('l1_gop_high', { value: s.gop })
    return [warn('l1_gop', 'l1_gop', '-g', message, hint)]
  }
  return []
}

export function validateCrf(s) {
  if (s.bitrateMode !== 'crf' || s.crfValue === undefined || !s.videoCodec) return []
  if (!Number.isFinite(s.crfValue)) {
    const { message, hint } = t('l1_crf_invalid')
    return [err('l1_crf', 'l1_crf', '-crf', message, hint)]
  }
  const range = CRF_RANGE[s.videoCodec]
  if (!range) return []
  const [min, max] = range
  if (s.crfValue < min || s.crfValue > max) {
    const { message, hint } = t('l1_crf_range', { min, max, codec: s.videoCodec })
    return [err('l1_crf', 'l1_crf', '-crf', message, hint)]
  }
  return []
}

export function validateBitrates(s) {
  const out = []
  if (s.targetBitrate && !isTemplateVar(s.targetBitrate) && !BITRATE_RE.test(s.targetBitrate)) {
    const { message, hint } = t('l1_bitrate_invalid')
    out.push(err('l1_bitrate', 'l1_bitrate', '-b:v', message, hint))
  }
  if (s.maxrate && !isTemplateVar(s.maxrate) && !BITRATE_RE.test(s.maxrate)) {
    const { message, hint } = t('l1_maxrate_invalid')
    out.push(err('l1_maxrate', 'l1_maxrate', '-maxrate', message, hint))
  }
  if (s.bufsize && !isTemplateVar(s.bufsize) && !BITRATE_RE.test(s.bufsize)) {
    const { message, hint } = t('l1_bufsize_invalid')
    out.push(err('l1_bufsize', 'l1_bufsize', '-bufsize', message, hint))
  }
  return out
}

export function validatePids(s) {
  const out = []
  const checkPid = (val, id, flag) => {
    if (val === undefined) return
    if (isTemplateVar(val)) return
    if (val >= 32 && val <= 8186) return
    const { message, hint } = t('l1_pid_invalid', { value: val })
    out.push(err(id, id, flag, message, hint))
  }
  checkPid(s.mpegtsStartPid,    'l1_pid_start', '-mpegts_start_pid')
  checkPid(s.mpegtsPmtStartPid, 'l1_pid_pmt',   '-mpegts_pmt_start_pid')
  return out
}

export function validatePcrPeriod(s) {
  if (s.pcrPeriod === undefined) return []
  if (isTemplateVar(s.pcrPeriod)) return []
  if (!Number.isInteger(s.pcrPeriod) || s.pcrPeriod <= 0 || s.pcrPeriod > 100) {
    const { message, hint } = t('l1_pcr_invalid')
    return [err('l1_pcr', 'l1_pcr', '-pcr_period', message, hint)]
  }
  return []
}

export function validateDialnorm(s) {
  if (s.dialnorm === undefined) return []
  if (isTemplateVar(s.dialnorm)) return []
  if (!Number.isInteger(s.dialnorm) || s.dialnorm < -31 || s.dialnorm > -1) {
    const { message, hint } = t('l1_dialnorm_invalid')
    return [err('l1_dialnorm', 'l1_dialnorm', '-dialnorm', message, hint)]
  }
  return []
}

export function validateLoudnorm(s) {
  if (!s.loudnorm || s.loudnormTarget === undefined) return []
  if (s.loudnormTarget < -70 || s.loudnormTarget > 0) {
    const { message, hint } = t('l1_loudnorm_target_invalid')
    return [err('l1_loudnorm_target', 'l1_loudnorm', '-af loudnorm I=', message, hint)]
  }
  return []
}

export function validateTimeout(s) {
  if (s.timeout === undefined) return []
  if (isTemplateVar(s.timeout)) return []
  if (!Number.isInteger(s.timeout) || s.timeout <= 0 || s.timeout > INT32_MAX) {
    const { message, hint } = t('l1_timeout_invalid', { max: INT32_MAX })
    return [err('l1_timeout', 'l1_timeout', '-timeout', message, hint)]
  }
  if (s.timeout > 30_000_000) {
    const { message, hint } = t('l1_timeout_high', { seconds: (s.timeout / 1_000_000).toFixed(0) })
    return [warn('l1_timeout', 'l1_timeout', '-timeout', message, hint)]
  }
  return []
}
// ── New validators ────────────────────────────────────────────────────────────────────────

export function validateAnalyzeDuration(s) {
  if (s.analyzeDuration === undefined) return []
  if (isTemplateVar(s.analyzeDuration)) return []
  if (!Number.isInteger(s.analyzeDuration) || s.analyzeDuration <= 0 || s.analyzeDuration > 120_000_000) {
    const { message, hint } = t('l1_analyze_duration_invalid', { value: s.analyzeDuration })
    return [err('l1_analyze_duration', 'l1_analyze_duration', '-analyzeduration', message, hint)]
  }
  if (s.analyzeDuration > 30_000_000) {
    const { message, hint } = t('l1_analyze_duration_high', { seconds: (s.analyzeDuration / 1_000_000).toFixed(0) })
    return [warn('l1_analyze_duration', 'l1_analyze_duration', '-analyzeduration', message, hint)]
  }
  return []
}

export function validateProbeSize(s) {
  if (s.probeSize === undefined) return []
  if (isTemplateVar(s.probeSize)) return []
  if (!Number.isInteger(s.probeSize) || s.probeSize <= 0 || s.probeSize > 1_000_000_000) {
    const { message, hint } = t('l1_probe_size_invalid', { value: s.probeSize })
    return [err('l1_probe_size', 'l1_probe_size', '-probesize', message, hint)]
  }
  if (s.probeSize > 100_000_000) {
    const { message, hint } = t('l1_probe_size_high', { mb: (s.probeSize / 1_000_000).toFixed(0) })
    return [warn('l1_probe_size', 'l1_probe_size', '-probesize', message, hint)]
  }
  return []
}

export function validateGpuIndex(s) {
  if (s.gpuIndex === undefined) return []
  if (isTemplateVar(s.gpuIndex)) return []
  if (!Number.isInteger(s.gpuIndex) || s.gpuIndex < -1 || s.gpuIndex > 15) {
    const { message, hint } = t('l1_gpu_index_invalid', { value: s.gpuIndex })
    return [err('l1_gpu_index', 'l1_gpu_index', '-gpu', message, hint)]
  }
  return []
}

export function validateListen(s) {
  if (s.listen === undefined) return []
  if (isTemplateVar(s.listen)) return []
  if (s.listen !== 0 && s.listen !== 1) {
    const { message, hint } = t('l1_listen_invalid', { value: s.listen })
    return [err('l1_listen', 'l1_listen', '-listen', message, hint)]
  }
  return []
}

export function validateStreamLoop(s) {
  if (s.streamLoop === undefined) return []
  if (s.streamLoop === true) return []
  if (isTemplateVar(s.streamLoop)) return []
  if (!Number.isInteger(s.streamLoop) || s.streamLoop < -1) {
    const { message, hint } = t('l1_stream_loop_invalid', { value: s.streamLoop })
    return [err('l1_stream_loop', 'l1_stream_loop', '-stream_loop', message, hint)]
  }
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
  if (s.inputNvdecDeint === undefined) return []
  if (isTemplateVar(s.inputNvdecDeint)) return []
  if (!VALID_NVDEC_DEINT.includes(s.inputNvdecDeint)) {
    const { message, hint } = t('l1_nvdec_deint_invalid', { valid: VALID_NVDEC_DEINT.join(', '), val: s.inputNvdecDeint })
    return [err('l1_nvdec_deint', 'l1_nvdec_deint', '-deint', message, hint)]
  }
  return []
}

/**
 * Generic enum validator for a single-value field.
 * id and group use the same value (the id param).
 */
function validateEnum(s, field, id, flag, validValues, label) {
  const val = s[field]
  if (val === undefined || val === null || val === '') return []
  if (isTemplateVar(val)) return []
  if (validValues.includes(val)) return []
  const { message, hint } = t(id, { label, valid: validValues.join(', '), val })
  return [err(id, id, flag, message, hint)]
}

/**
 * Generic enum validator for array fields (multi-select).
 * Reports the first invalid entry found.
 */
function validateArrayEnum(s, field, id, flag, validValues, label) {
  const arr = s[field]
  if (!Array.isArray(arr) || arr.length === 0) return []
  const invalid = arr.filter(v => !validValues.includes(v) && !isTemplateVar(v))
  if (invalid.length === 0) return []
  const { message, hint } = t(id, { label, invalid: invalid.join(', '), valid: validValues.join(', ') })
  return [err(id, id, flag, message, hint)]
}
