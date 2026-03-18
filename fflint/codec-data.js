// codec-data.js
// No imports. Pure data and two small utility functions.

export const PRESETS = {
  cpu:   ['ultrafast','superfast','veryfast','faster','fast',
          'medium','slow','slower','veryslow'],
  nvenc: ['p1','p2','p3','p4','p5','p6','p7',
          'hp','hq','bd',
          'll','llhq','llhp','lossless','losslesshp'],
  vaapi: [],
}

export const PROFILES = {
  libx264:    ['baseline','main','high','high10','high422','high444'],
  libx265:    ['main','main10','main12','mainstillpicture'],
  h264_nvenc: ['baseline','main','high','high444p'],
  hevc_nvenc: ['main','main10','rext'],
  h264_vaapi: ['constrained_baseline','main','high'],
  mpeg2video: [],
  mpeg4:      [],
}

// CRF valid range per codec: [min, max]
export const CRF_RANGE = {
  libx264:    [0, 51],
  libx265:    [0, 51],
  h264_nvenc: [0, 51],
  hevc_nvenc: [0, 51],
  h264_vaapi: [0, 52],
}

// Maximum resolution / fps per H.264 level
export const LEVEL_LIMITS = {
  '3.0': { w: 720,  h: 480,  fps: 30 },
  '3.1': { w: 1280, h: 720,  fps: 30 },
  '4.0': { w: 1920, h: 1080, fps: 30 },
  '4.1': { w: 1920, h: 1080, fps: 60 },
  '4.2': { w: 1920, h: 1080, fps: 60 },
  '5.0': { w: 4096, h: 2304, fps: 30 },
  '5.1': { w: 4096, h: 2304, fps: 60 },
}

// Minimum recommended bitrate (bps) per resolution — used by Layer 3
export const BITRATE_FLOOR = {
  '426x240':   500_000,
  '640x360':   800_000,
  '352x240':   400_000,   // SIF / NTSC quarter-SD
  '352x288':   400_000,   // CIF / PAL quarter-SD
  '640x480':   800_000,   // SD VGA
  '704x480':   1_000_000, // NTSC SD (slightly cropped)
  '704x576':   1_000_000, // PAL SD (slightly cropped)
  '720x480':   1_000_000, // NTSC SD
  '720x576':   1_000_000, // PAL SD (DVB broadcast standard)
  '1280x720':  1_500_000,
  '1920x1080': 3_000_000,
  '3840x2160': 8_000_000,
}

// Codec group lists — used by rules to check codec families
export const NVENC_CODECS  = ['h264_nvenc', 'hevc_nvenc']
export const VAAPI_CODECS  = ['h264_vaapi']
export const CPU_CODECS    = ['libx264', 'libx265', 'mpeg2video', 'mpeg4']
export const HEVC_CODECS   = ['libx265', 'hevc_nvenc']
export const DOLBY_CODECS  = ['ac3', 'eac3']
export const LIVE_INPUTS   = ['udp', 'rtp', 'srt', 'rtmp']
export const HTTP_INPUTS   = ['http', 'hls']

// ── H.264 / H.265 valid level values ─────────────────────────────────────────

export const VALID_LEVELS_H264 = ['3.0','3.1','4.0','4.1','4.2','5.0','5.1']
export const VALID_LEVELS_H265 = ['2.0','2.1','3.0','3.1','4.0','4.1','5.0','5.1','6.0','6.1','6.2']

// Maps each codec to its preset family key in PRESETS
export const CODEC_PRESET_FAMILY = {
  libx264:    'cpu',
  libx265:    'cpu',
  h264_nvenc: 'nvenc',
  hevc_nvenc: 'nvenc',
  h264_vaapi: 'vaapi',
  mpeg2video: null,   // no preset support
  mpeg4:      null,   // no preset support
}

// ── Channel layout data ───────────────────────────────────────────────────────

export const VALID_CHANNEL_LAYOUTS = ['mono','stereo','2.1','3.0','4.0','4.1','5.0','5.1','6.0','6.1','7.0','7.1']

// Maps layout name → expected numeric channel count
export const CHANNEL_LAYOUT_CHANNELS = {
  'mono':   1,
  'stereo': 2,
  '2.1':    3,
  '3.0':    3,
  '4.0':    4,
  '4.1':    5,
  '5.0':    5,
  '5.1':    6,
  '6.0':    6,
  '6.1':    7,
  '7.0':    7,
  '7.1':    8,
}

// Minimum recommended audio bitrate (bps) per codec + channel count key
export const AUDIO_BITRATE_FLOOR = {
  'aac_1':       64_000,
  'aac_2':       96_000,
  'aac_6':      256_000,
  'ac3_2':      128_000,
  'ac3_6':      384_000,
  'eac3_2':      96_000,
  'eac3_6':     256_000,
  'libmp3lame_1': 64_000,
  'libmp3lame_2': 128_000,
  'libopus_1':    48_000,
  'libopus_2':    96_000,
  'libopus_6':   192_000,
  'mp2_1':        64_000,
  'mp2_2':       192_000,
  'libtwolame_1': 64_000,
  'libtwolame_2': 192_000,
}

// H.264 codecs that use LEVEL_LIMITS for resolution/fps cross-check
export const H264_LEVEL_CODECS = ['libx264', 'h264_nvenc', 'h264_vaapi']

// ── Valid value enums — single source of truth for UI dropdowns + Layer 1 ────

export const VALID_INPUT_TYPES    = ['udp','rtp','rtmp','http','file','srt','capture']
export const VALID_VIDEO_CODECS   = ['disabled','copy','libx264','libx265','mpeg2video','mpeg4','h264_nvenc','hevc_nvenc','h264_vaapi']
export const VALID_HWACCELS       = ['none','cuda','vaapi','qsv']
export const VALID_PIX_FMTS       = ['yuv420p','yuv422p','yuv444p','yuv420p10le','yuv422p10le','nv12','p010le']
export const DEPRECATED_PIX_FMTS  = ['yuvj420p','yuvj422p','yuvj444p']
export const VALID_FIELD_ORDERS   = ['tt','bb','tb','bt','progressive']
export const VALID_COLOR_PRIMARIES= ['bt709','bt2020','smpte170m','smpte432','film']
export const VALID_COLOR_TRC      = ['bt709','smpte2084','arib-std-b67','linear','iec61966-2-1']
export const VALID_COLORSPACES    = ['bt709','bt2020nc','bt2020c','smpte170m','smpte240m']
export const VALID_FPS_SYNC_MODES = ['passthrough','cfr','vfr']
export const VALID_BSF_VIDEO      = ['none','h264_mp4toannexb','hevc_mp4toannexb','mpeg4_unpack_bframes']
export const VALID_AUDIO_CODECS   = ['disabled','copy','aac','libmp3lame','mp2','libtwolame','ac3','eac3','libopus']
export const MP2_CODECS           = ['mp2', 'libtwolame']
export const VALID_SAMPLE_RATES   = ['original','44100','48000','96000']
export const VALID_CHANNELS       = ['original','1','2','6']
export const VALID_BSF_AUDIO      = ['none','aac_adtstoasc']
export const VALID_SUBTITLE_MODES = ['disable','copy']
export const VALID_OUTPUT_FORMATS = ['mpegts','flv','hls','mp4','matroska','null']
export const VALID_HLS_SEG_TYPES  = ['mpegts','fmp4']
export const VALID_AVOID_NEG_TS   = ['make_zero','make_non_negative','disabled','auto']
export const VALID_FFLAGS         = ['+genpts','+igndts','+discardcorrupt','+nobuffer','+fastseek']
export const VALID_MPEGTS_FLAGS   = ['system_b','initial_discontinuity','pat_pmt_at_frames','nit','latm']
export const VALID_HLS_FLAGS      = ['delete_segments','append_list','round_durations','omit_endlist','split_by_time','program_date_time']
export const VALID_BITRATE_MODES  = ['cbr','vbr','crf']

export const VALID_HWACCEL_OUTPUT_FORMATS = ['none','cuda','vaapi','qsv','d3d11va','opencl','vulkan']
export const VALID_DEINTERLACE_FILTERS    = ['yadif','yadif_cuda','bwdif','bwdif_cuda']
export const VALID_SCALE_FILTERS          = ['scale','scale_cuda','scale_vaapi','scale_qsv']
export const VALID_NVDEC_DEINT            = [0, 1, 2]  // 0=weave (off), 1=bob, 2=adaptive

// ── Utility functions ─────────────────────────────────────────────────────────

/**
 * Parse a bitrate string like '4M', '500k', '1.5M' into bits per second.
 * Uses SI (decimal) multipliers — k=1 000, M=1 000 000, G=1 000 000 000.
 * This is the standard for network/video bitrates (not storage, where k=1 024).
 * Returns null if the input is null, undefined, or does not match the pattern.
 */
export function parseBitrate(s) {
  if (s === undefined || s === null) return null
  const m = String(s).match(/^(\d+(?:\.\d+)?)([kKmMgG]?)$/)
  if (!m) return null
  const n = parseFloat(m[1])
  const suffix = m[2].toLowerCase()
  if (suffix === 'k') return n * 1_000
  if (suffix === 'm') return n * 1_000_000
  if (suffix === 'g') return n * 1_000_000_000
  return n
}

/**
 * Parse a frame size string like '1920x1080' into { w, h }.
 * Returns null if the string is not a valid frame size.
 */
export function parseFrameSize(s) {
  const m = s.match(/^(\d{2,5})x(\d{2,5})$/)
  if (!m) return null
  return { w: parseInt(m[1], 10), h: parseInt(m[2], 10) }
}

/**
 * Parse an FPS string that may be a decimal ('29.97'), integer ('25'),
 * or fractional notation ('30000/1001'). Returns NaN for invalid input.
 */
export function parseFps(str) {
  if (str === undefined || str === null) return NaN
  const s = String(str).trim()
  const frac = s.match(/^(\d+)\/(\d+)$/)
  if (frac) {
    const den = parseInt(frac[2], 10)
    return den === 0 ? NaN : parseInt(frac[1], 10) / den
  }
  return parseFloat(s)
}
