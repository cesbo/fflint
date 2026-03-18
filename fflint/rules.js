// rules.js
import {
  NVENC_CODECS, VAAPI_CODECS, CPU_CODECS, HEVC_CODECS,
  DOLBY_CODECS, LIVE_INPUTS, HTTP_INPUTS, MP2_CODECS,
  parseBitrate, parseFrameSize, parseFps, BITRATE_FLOOR, PRESETS,
  LEVEL_LIMITS, H264_LEVEL_CODECS,
  CHANNEL_LAYOUT_CHANNELS, AUDIO_BITRATE_FLOOR,
} from './codec-data.js'

// Helper: true when the state requests any kind of looping.
// Accepts both legacy boolean (true) and integer (-1 or N>0) models.
const isLooping = s => s.streamLoop === true || (Number.isInteger(s.streamLoop) && s.streamLoop !== 0)

export const rules = [

  // ── Layer 2: Copy conflicts ───────────────────────────────────────────────

  {
    id: 'copy_deinterlace', group: 'copy_video_filter', layer: 2,
    severity: 'error', flag: '-filter:v',
    check: (s) => s.videoCodec === 'copy' && !!s.deinterlaceFilter,
    message: 'Deinterlace filter cannot be applied when video codec is Copy',
  },
  {
    id: 'copy_logo', group: 'copy_video_filter', layer: 2,
    severity: 'error', flag: '-filter_complex',
    check: (s) => s.videoCodec === 'copy' && !!s.logoPath,
    message: 'Logo overlay cannot be applied when video codec is Copy',
  },
  {
    id: 'copy_rescale', group: 'copy_video_filter', layer: 2,
    severity: 'error', flag: '-s',
    check: (s) => s.videoCodec === 'copy' && s.frameSize && s.frameSize !== 'original',
    message: 'Frame size cannot be changed when video codec is Copy',
  },
  {
    id: 'copy_fps', group: 'copy_video_filter', layer: 2,
    severity: 'error', flag: '-r',
    check: (s) => s.videoCodec === 'copy' && s.fps && s.fps !== 'original',
    message: 'Frame rate cannot be changed when video codec is Copy',
  },
  {
    id: 'copy_pixfmt', group: 'copy_video_pixfmt', layer: 2,
    severity: 'warning', flag: '-pix_fmt',
    check: (s) => s.videoCodec === 'copy' && s.pixFmt && s.pixFmt !== 'yuv420p',
    message: 'Pixel format is ignored when video codec is Copy',
  },
  {
    id: 'copy_audio_resample', group: 'copy_audio_filter', layer: 2,
    severity: 'error', flag: '-ar',
    check: (s) => s.audioCodec === 'copy' && s.sampleRate && s.sampleRate !== 'original',
    message: 'Sample rate cannot be changed when audio codec is Copy',
  },
  {
    id: 'copy_audio_channels', group: 'copy_audio_filter', layer: 2,
    severity: 'error', flag: '-ac',
    check: (s) => s.audioCodec === 'copy' && s.channels && s.channels !== 'original',
    message: 'Channel count cannot be changed when audio codec is Copy',
  },
  {
    id: 'copy_audio_loudnorm', group: 'copy_audio_filter', layer: 2,
    severity: 'error', flag: '-af',
    check: (s) => s.audioCodec === 'copy' && s.loudnorm === true,
    message: 'EBU R128 loudness filter cannot be applied when audio codec is Copy',
  },

  // ── Layer 2: Codec / hwaccel ──────────────────────────────────────────────

  {
    id: 'nvenc_no_hwaccel', group: 'hwaccel_mismatch', layer: 2,
    severity: 'error', flag: '-hwaccel',
    check: (s) => NVENC_CODECS.includes(s.videoCodec) && s.hwaccel !== 'cuda',
    message: 'NVENC codec requires -hwaccel cuda — without it the decode pipeline runs on CPU, negating the GPU advantage. Set HW Accel to "cuda"',
  },
  {
    id: 'vaapi_wrong_hwaccel', group: 'hwaccel_mismatch', layer: 2,
    severity: 'warning', flag: '-hwaccel',
    check: (s) => VAAPI_CODECS.includes(s.videoCodec) && s.hwaccel !== 'vaapi',
    message: 'VAAPI codec requires -hwaccel vaapi',
  },
  {
    id: 'nvenc_cpu_preset', group: 'codec_preset_mismatch', layer: 2,
    severity: 'error', flag: '-preset',
    check: (s) => NVENC_CODECS.includes(s.videoCodec) && PRESETS.cpu.includes(s.preset) && !PRESETS.nvenc.includes(s.preset),
    message: (s) => `Preset "${s.preset}" is a libx264/libx265 CPU preset — FFmpeg will reject it with NVENC. Use an NVENC preset instead: ${PRESETS.nvenc.join(', ')}`,
  },
  {
    id: 'vaapi_preset', group: 'codec_preset_mismatch', layer: 2,
    severity: 'error', flag: '-preset',
    check: (s) => VAAPI_CODECS.includes(s.videoCodec) && !!s.preset,
    message: (s) => `Preset "${s.preset}" has no effect on VAAPI encoders — h264_vaapi does not support presets. Remove the Preset selection (set to "— None —")`,
  },
  {
    id: 'cpu_hwaccel_set', group: 'hwaccel_mismatch', layer: 2,
    severity: 'warning', flag: '-hwaccel',
    check: (s) => CPU_CODECS.includes(s.videoCodec) && s.hwaccel && s.hwaccel !== 'none',
    message: 'Hardware acceleration has no effect on CPU codecs',
  },
  {
    id: 'nvenc_yuv422', group: 'codec_pixfmt', layer: 2,
    severity: 'error', flag: '-pix_fmt',
    check: (s) => s.videoCodec === 'h264_nvenc' && s.pixFmt === 'yuv422p',
    message: 'NVENC H.264 does not support 4:2:2 (yuv422p) pixel format',
  },
  {
    id: 'x264_10bit_no_high10', group: 'codec_pixfmt', layer: 2,
    severity: 'warning', flag: '-profile:v',
    check: (s) => s.videoCodec === 'libx264' && s.pixFmt === 'yuv420p10le' && s.profile !== 'high10',
    message: '10-bit encoding with libx264 requires -profile:v high10',
  },

  // ── Layer 2: Bitrate mode ─────────────────────────────────────────────────

  {
    id: 'crf_and_bitrate', group: 'bitrate_mode', layer: 2,
    severity: 'error', flag: '-crf',
    check: (s) => s.bitrateMode === 'crf' && !!s.targetBitrate,
    message: 'CRF and target bitrate (-b:v) are mutually exclusive',
  },
  {
    id: 'vbr_no_maxrate', group: 'vbr_limits', layer: 2,
    severity: 'warning', flag: '-maxrate',
    check: (s) => s.bitrateMode === 'vbr' && !s.maxrate,
    message: 'VBR mode without -maxrate has no peak bitrate cap',
  },
  {
    id: 'maxrate_no_bufsize', group: 'vbr_limits', layer: 2,
    severity: 'warning', flag: '-bufsize',
    check: (s) => !!s.maxrate && !s.bufsize,
    message: '-maxrate without -bufsize leaves the HRD buffer undefined',
  },

  // ── Layer 2: HDR / color metadata ─────────────────────────────────────────

  {
    id: 'hdr_8bit', group: 'hdr_consistency', layer: 2,
    severity: 'error', flag: '-pix_fmt',
    check: (s) => s.colorTrc === 'smpte2084' && s.pixFmt && !s.pixFmt.includes('10'),
    message: 'HDR10 (PQ / smpte2084) requires a 10-bit pixel format such as yuv420p10le',
  },
  {
    id: 'hdr_wrong_matrix', group: 'hdr_consistency', layer: 2,
    severity: 'warning', flag: '-colorspace',
    check: (s) => s.colorTrc === 'smpte2084' && s.colorspace === 'bt709',
    message: 'PQ transfer characteristic with BT.709 matrix is inconsistent HDR metadata',
  },
  {
    id: 'bt2020_wrong_matrix', group: 'hdr_consistency', layer: 2,
    severity: 'warning', flag: '-colorspace',
    check: (s) => s.colorPrimaries === 'bt2020' && s.colorspace && !s.colorspace.startsWith('bt2020'),
    message: 'BT.2020 primaries should pair with bt2020nc color space matrix',
  },

  // ── Layer 2: Interlace / field order ──────────────────────────────────────

  {
    id: 'nvdec_deint_with_filter', group: 'interlace', layer: 2,
    severity: 'error', flag: '-deint',
    check: (s) => s.nvdecDeint !== undefined && s.nvdecDeint > 0 && !!s.deinterlaceFilter,
    message: (s) => `-deint ${s.nvdecDeint} (NVDEC hardware deinterlace) and -filter:v ${s.deinterlaceFilter} are both active — the stream will be deinterlaced twice. Use one or the other: either NVDEC decoder deinterlace (-deint) for zero-copy GPU pipeline, or a filter (${s.deinterlaceFilter}) for more control. Remove one to fix the conflict`,
  },
  {
    id: 'nvdec_deint_no_hwaccel', group: 'nvdec_deint', layer: 2,
    severity: 'error', flag: '-deint',
    check: (s) => s.nvdecDeint !== undefined && s.nvdecDeint > 0 && s.hwaccel !== 'cuda',
    message: '-deint requires -hwaccel cuda (NVDEC cuvid decoder pipeline) — without it the flag is ignored or causes an error',
  },
  {
    id: 'nvdec_deint_no_output_fmt', group: 'nvdec_deint', layer: 2,
    severity: 'warning', flag: '-deint',
    check: (s) => s.nvdecDeint !== undefined && s.nvdecDeint > 0 && s.hwaccel === 'cuda' && s.hwaccelOutputFormat !== 'cuda',
    message: '-deint with -hwaccel cuda but without -hwaccel_output_format cuda — decoded frames will be downloaded to system RAM after NVDEC deinterlacing. Set HW Accel Output to "cuda" to keep the full pipeline on the GPU',
  },
  {
    id: 'nvdec_deint_zero_redundant', group: 'nvdec_deint', layer: 2,
    severity: 'info', flag: '-deint',
    check: (s) => s.nvdecDeint === 0,
    message: '-deint 0 (weave) is the default — this flag is redundant and can be removed',
  },

  {
    id: 'field_order_while_deinterlacing', group: 'interlace', layer: 2,
    severity: 'warning', flag: '-field_order',
    check: (s) => (!!s.deinterlaceFilter || (s.nvdecDeint !== undefined && s.nvdecDeint > 0)) && s.fieldOrder && s.fieldOrder !== 'progressive',
    message: 'Deinterlace removes interlacing — a non-progressive field order tag is contradictory',
  },
  {
    id: 'yadif_field_fps_mismatch', group: 'interlace', layer: 2,
    severity: 'warning', flag: '-r',
    check: (s) => {
      if (s.deinterlaceMode !== 'field') return false
      const fps = parseFps(s.fps ?? '')
      return !isNaN(fps) && fps <= 30
    },
    message: 'Field-rate deinterlace (mode=1) doubles frame rate — output FPS should be 50 or 60, not ≤30',
  },

  // ── Layer 2: DVB / MPEG-TS ────────────────────────────────────────────────

  {
    id: 'pid_collision', group: 'pid_range', layer: 2,
    severity: 'error', flag: '-mpegts_start_pid',
    check: (s) => {
      if (!s.mpegtsPmtStartPid || !s.mpegtsStartPid) return false
      return Math.abs(s.mpegtsPmtStartPid - s.mpegtsStartPid) < 16
    },
    message: 'PMT PID and ES start PID ranges overlap — this will corrupt the transport stream',
  },
  {
    id: 'ts_flags_on_non_ts', group: 'container_flag_mismatch', layer: 2,
    severity: 'warning',
    check: (s) => s.outputFormat !== 'mpegts' && !!(s.mpegtsServiceId ?? s.mpegtsPmtStartPid ?? s.pcrPeriod),
    message: 'MPEG-TS flags have no effect on non-MPEG-TS output formats',
  },
  {
    id: 'hls_flags_on_non_hls', group: 'container_flag_mismatch', layer: 2,
    severity: 'warning',
    check: (s) => s.outputFormat !== 'hls' && !!(s.hlsTime ?? s.hlsListSize ?? s.hlsFlags?.length),
    message: 'HLS flags have no effect on non-HLS output formats',
  },
  {
    id: 'fmp4_mpeg2', group: 'container_codec_compat', layer: 2,
    severity: 'error', flag: '-hls_segment_type',
    check: (s) => s.hlsSegmentType === 'fmp4' && s.videoCodec === 'mpeg2video',
    message: 'fMP4 HLS container does not support MPEG-2 video',
  },
  {
    id: 'copyts_avoid_negative', group: 'timestamp_handling', layer: 2,
    severity: 'warning',
    check: (s) => s.copyts === true && s.avoidNegativeTs === 'make_zero',
    message: '-copyts preserves original timestamps while -avoid_negative_ts make_zero resets them — these conflict',
  },

  // ── Layer 2: Fault tolerance ──────────────────────────────────────────────

  {
    id: 'reconnect_non_http', group: 'reconnect', layer: 2,
    severity: 'warning', flag: '-reconnect',
    check: (s) => s.reconnect === true && !HTTP_INPUTS.includes(s.inputType),
    message: '-reconnect flags are only effective for HTTP/HLS inputs',
  },
  {
    id: 'timeout_too_low', group: 'timeout', layer: 2,
    severity: 'warning', flag: '-timeout',
    check: (s) => !!s.timeout && s.timeout > 0 && s.timeout < 1_000_000,
    message: 'Timeout below 1 s (1 000 000 µs) may cause spurious disconnects on congested links',
  },

  // ── Layer 2: Audio ────────────────────────────────────────────────────────

  {
    id: 'dialnorm_non_dolby', group: 'dialnorm', layer: 2,
    severity: 'warning', flag: '-dialnorm',
    check: (s) => s.dialnorm !== undefined && !DOLBY_CODECS.includes(s.audioCodec),
    message: '-dialnorm is embedded in AC3/EAC3 bitstreams only — no effect on other codecs',
  },

  // ── Layer 2: Container / codec compatibility ──────────────────────────────

  {
    id: 'hevc_hls_needs_fmp4', group: 'hls_hevc_compat', layer: 2,
    severity: 'error', flag: '-hls_segment_type',
    check: (s) => HEVC_CODECS.includes(s.videoCodec) && s.outputFormat === 'hls' && s.hlsSegmentType !== 'fmp4',
    message: 'HEVC video in HLS requires -hls_segment_type fmp4 (Apple mandate) — mpegts segments will be rejected by iOS/Safari',
  },
  {
    id: 'aac_fmp4_needs_bsf', group: 'aac_bsf', layer: 2,
    severity: 'warning', flag: '-bsf:a',
    check: (s) => {
      if (s.audioCodec !== 'aac') return false
      const needsBsf = s.outputFormat === 'mp4' ||
        (s.outputFormat === 'hls' && s.hlsSegmentType === 'fmp4')
      return needsBsf && s.bsfAudio !== 'aac_adtstoasc'
    },
    message: 'AAC in MP4/fMP4 container requires -bsf:a aac_adtstoasc to strip ADTS headers',
  },
  {
    id: 'h264_ts_needs_bsf', group: 'h264_bsf', layer: 2,
    severity: 'info', flag: '-bsf:v',
    check: (s) => s.videoCodec === 'copy' && s.outputFormat === 'mpegts' && s.inputType === 'file' && (!s.bsfVideo || s.bsfVideo === 'none'),
    message: 'When remuxing H.264 from MP4 sources to MPEG-TS, use -bsf:v h264_mp4toannexb to convert Annex B framing',
  },
  {
    id: 'flv_hevc', group: 'container_codec_compat', layer: 2,
    severity: 'error', flag: '-c:v',
    check: (s) => s.outputFormat === 'flv' && HEVC_CODECS.includes(s.videoCodec),
    message: 'FLV container does not support HEVC video — FFmpeg will abort. Use H.264 for RTMP/FLV or switch to HLS for HEVC',
  },
  {
    id: 'flv_mpeg2', group: 'container_codec_compat', layer: 2,
    severity: 'error', flag: '-c:v',
    check: (s) => s.outputFormat === 'flv' && s.videoCodec === 'mpeg2video',
    message: 'FLV container does not support MPEG-2 video — only H.264 is valid for FLV/RTMP output',
  },
  {
    id: 'flv_audio_compat', group: 'container_codec_compat', layer: 2,
    severity: 'error', flag: '-c:a',
    check: (s) => {
      if (s.outputFormat !== 'flv') return false
      if (!s.audioCodec || s.audioCodec === 'disabled' || s.audioCodec === 'copy') return false
      return !['aac', 'libmp3lame'].includes(s.audioCodec)
    },
    message: 'FLV container only supports AAC and MP3 audio — AC3/EAC3/Opus are not muxable into FLV',
  },
  {
    id: 'mp4_mpeg2', group: 'container_codec_compat', layer: 2,
    severity: 'error', flag: '-c:v',
    check: (s) => s.outputFormat === 'mp4' && s.videoCodec === 'mpeg2video',
    message: 'MP4 container does not support MPEG-2 video — use mpegts for MPEG-2 or switch to H.264/H.265 for MP4',
  },
  {
    id: 'mpegts_opus', group: 'container_codec_compat', layer: 2,
    severity: 'error', flag: '-c:a',
    check: (s) => s.outputFormat === 'mpegts' && s.audioCodec === 'libopus',
    message: 'libopus is not multiplexable into MPEG-TS — use AAC, MP2, or AC3 for DVB/IPTV output',
  },
  {
    id: 'mp2_hls', group: 'container_codec_compat', layer: 2,
    severity: 'error', flag: '-c:a',
    check: (s) => s.outputFormat === 'hls' && MP2_CODECS.includes(s.audioCodec),
    message: 'HLS requires AAC audio (Apple mandate) — MP2/libtwolame is not supported in HLS segments',
  },
  {
    id: 'mp2_mp4', group: 'container_codec_compat', layer: 2,
    severity: 'error', flag: '-c:a',
    check: (s) => s.outputFormat === 'mp4' && MP2_CODECS.includes(s.audioCodec),
    message: 'MP4 container does not support MP2 audio — use AAC or AC3 for MP4 output',
  },
  {
    id: 'matroska_dialnorm', group: 'container_codec_compat', layer: 2,
    severity: 'warning', flag: '-dialnorm',
    check: (s) => s.outputFormat === 'matroska' && s.dialnorm !== undefined,
    message: 'Matroska container ignores dialnorm metadata — only relevant for MPEG-TS/MP4 output with Dolby audio',
  },

  // ── Layer 2: CBR/VBR bitrate completeness ──────────────────────────────────

  {
    id: 'cbr_no_bitrate', group: 'bitrate_completeness', layer: 2,
    severity: 'error', flag: '-b:v',
    check: (s) => {
      if (s.bitrateMode !== 'cbr') return false
      if (!s.videoCodec || s.videoCodec === 'copy' || s.videoCodec === 'disabled') return false
      return !s.targetBitrate
    },
    message: 'CBR mode requires a target bitrate (-b:v) — encoder has no bitrate target to maintain',
  },
  {
    id: 'vbr_no_bitrate', group: 'bitrate_completeness', layer: 2,
    severity: 'warning', flag: '-b:v',
    check: (s) => {
      if (s.bitrateMode !== 'vbr') return false
      if (!s.videoCodec || s.videoCodec === 'copy' || s.videoCodec === 'disabled') return false
      return !s.targetBitrate
    },
    message: 'VBR mode without -b:v uses codec defaults which vary wildly — set a target bitrate for predictable output',
  },
  {
    id: 'maxrate_lt_bitrate', group: 'bitrate_math', layer: 2,
    severity: 'error', flag: '-maxrate',
    check: (s) => {
      if (!s.maxrate || !s.targetBitrate) return false
      const mr = parseBitrate(s.maxrate)
      const br = parseBitrate(s.targetBitrate)
      return mr !== null && br !== null && mr < br
    },
    message: '-maxrate below -b:v is a hard HRD violation — encoder can never reach target bitrate',
  },
  {
    id: 'bufsize_too_small', group: 'bitrate_math', layer: 2,
    severity: 'warning', flag: '-bufsize',
    check: (s) => {
      if (!s.bufsize || !s.targetBitrate) return false
      const buf = parseBitrate(s.bufsize)
      const br  = parseBitrate(s.targetBitrate)
      return buf !== null && br !== null && buf < br
    },
    message: '-bufsize smaller than target bitrate means the buffer fills in under one second — use at minimum 1× and ideally 2× -b:v',
  },

  // ── Layer 2: Copy codec side-effects ──────────────────────────────────────

  {
    id: 'copy_video_preset', group: 'copy_preset', layer: 2,
    severity: 'warning', flag: '-preset',
    check: (s) => s.videoCodec === 'copy' && !!s.preset,
    message: '-preset is ignored when video codec is Copy — remove to avoid confusion',
  },
  {
    id: 'copy_video_bframes', group: 'copy_bframes', layer: 2,
    severity: 'warning', flag: '-bf',
    check: (s) => s.videoCodec === 'copy' && s.bframes !== undefined,
    message: '-bf (B-frames) is ignored when video codec is Copy — remove to avoid confusion',
  },
  {
    id: 'copy_video_refs', group: 'copy_refs', layer: 2,
    severity: 'warning', flag: '-refs',
    check: (s) => s.videoCodec === 'copy' && s.refs !== undefined,
    message: '-refs is ignored when video codec is Copy — remove to avoid confusion',
  },
  {
    id: 'copy_video_color_meta', group: 'copy_color', layer: 2,
    severity: 'warning', flag: '-color_primaries',
    check: (s) => s.videoCodec === 'copy' && !!(s.colorPrimaries || s.colorTrc || s.colorspace),
    message: 'Color metadata flags are ignored when video codec is Copy — the original stream metadata is preserved as-is',
  },
  {
    id: 'copy_video_profile', group: 'copy_profile', layer: 2,
    severity: 'warning', flag: '-profile:v',
    check: (s) => s.videoCodec === 'copy' && !!s.profile,
    message: '-profile:v is ignored when video codec is Copy — the original stream profile is preserved',
  },
  {
    id: 'copy_video_level', group: 'copy_level', layer: 2,
    severity: 'warning', flag: '-level',
    check: (s) => s.videoCodec === 'copy' && !!s.level,
    message: '-level is ignored when video codec is Copy — the original stream level is preserved',
  },
  {
    id: 'copy_video_gop', group: 'copy_gop', layer: 2,
    severity: 'warning', flag: '-g',
    check: (s) => s.videoCodec === 'copy' && s.gop !== undefined,
    message: '-g (GOP) is ignored when video codec is Copy — the original keyframe structure is preserved',
  },
  {
    id: 'copy_audio_bitrate', group: 'copy_audio_ignored', layer: 2,
    severity: 'warning', flag: '-b:a',
    check: (s) => s.audioCodec === 'copy' && !!s.audioBitrate,
    message: '-b:a is ignored when audio codec is Copy — the original audio bitrate is preserved',
  },

  // ── Layer 2: Channel / layout consistency ──────────────────────────────────

  {
    id: 'channels_layout_mismatch', group: 'channel_consistency', layer: 2,
    severity: 'error', flag: '-channel_layout',
    check: (s) => {
      if (!s.channels || s.channels === 'original') return false
      if (!s.channelLayout) return false
      const expected = CHANNEL_LAYOUT_CHANNELS[s.channelLayout]
      return expected !== undefined && expected !== parseInt(s.channels, 10)
    },
    message: (s) => `Channel count ${s.channels} and channel layout "${s.channelLayout}" are inconsistent (layout expects ${CHANNEL_LAYOUT_CHANNELS[s.channelLayout]} channels) — FFmpeg will error or produce silence`,
  },
  {
    id: 'ac3_mono', group: 'channel_consistency', layer: 2,
    severity: 'warning', flag: '-ac',
    check: (s) => DOLBY_CODECS.includes(s.audioCodec) && s.channels === '1',
    message: 'Mono AC3/EAC3 is technically valid but extremely uncommon — most decoders expect 2ch or 5.1. Verify receiver compatibility',
  },

  // ── Layer 2: Input flags consistency ───────────────────────────────────────

  {
    id: 'capture_stream_loop', group: 'input_flags', layer: 2,
    severity: 'error', flag: '-stream_loop',
    check: (s) => s.inputType === 'capture' && isLooping(s),
    message: 'A capture device cannot be looped — -stream_loop has no meaning on a hardware input',
  },
  {
    id: 'nobuffer_file_input', group: 'input_flags', layer: 2,
    severity: 'warning', flag: '-fflags',
    check: (s) => s.inputType === 'file' && Array.isArray(s.fflags) && s.fflags.includes('+nobuffer'),
    message: '+nobuffer is designed for real-time streams — on file input it may cause read stalls and timing issues',
  },
  {
    id: 'reconnect_streamed_no_reconnect', group: 'reconnect', layer: 2,
    severity: 'warning', flag: '-reconnect_streamed',
    check: (s) => s.reconnectStreamed === true && s.reconnect !== true,
    message: '-reconnect_streamed has no effect without -reconnect enabled first',
  },
  // ── Layer 2: HW accel output format ─────────────────────────────────────────────────

  {
    id: 'hwaccel_output_fmt_no_hwaccel', group: 'hwaccel_output_fmt', layer: 2,
    severity: 'error', flag: '-hwaccel_output_format',
    check: (s) => !!s.hwaccelOutputFormat && s.hwaccelOutputFormat !== 'none' && !s.hwaccel,
    message: '-hwaccel_output_format requires -hwaccel to be set — frames cannot stay on the GPU without a hardware decoder',
  },
  {
    id: 'hwaccel_output_fmt_mismatch', group: 'hwaccel_output_fmt', layer: 2,
    severity: 'error', flag: '-hwaccel_output_format',
    check: (s) => {
      if (!s.hwaccelOutputFormat || s.hwaccelOutputFormat === 'none') return false
      if (!s.hwaccel || s.hwaccel === 'none') return false
      const expected = { cuda: 'cuda', vaapi: 'vaapi', qsv: 'qsv' }
      const exp = expected[s.hwaccel]
      return !!exp && s.hwaccelOutputFormat !== exp
    },
    message: (s) => `-hwaccel_output_format "${s.hwaccelOutputFormat}" does not match -hwaccel "${s.hwaccel}" — decoded frames will be silently downloaded to system RAM and re-uploaded, negating the GPU pipeline`,
  },
  {
    id: 'nvenc_cuda_missing_output_fmt', group: 'hwaccel_output_fmt', layer: 2,
    severity: 'info', flag: '-hwaccel_output_format',
    check: (s) => NVENC_CODECS.includes(s.videoCodec) && s.hwaccel === 'cuda' && !s.hwaccelOutputFormat,
    message: (s) => {
      const isCpuFilter = (v) => v && !v.endsWith('_cuda') && !v.endsWith('_vaapi') && !v.endsWith('_qsv');
      const hasCpuDeinterlace = isCpuFilter(s.deinterlaceFilter);
      const hasCpuScale = isCpuFilter(s.scaleFilter);
      if (hasCpuDeinterlace || hasCpuScale) {
        const filters = [];
        if (hasCpuDeinterlace) filters.push(s.deinterlaceFilter);
        if (hasCpuScale) filters.push(s.scaleFilter);
        const names = filters.join(', ');
        const gpuAlts = filters.map(f => f + '_cuda').join(', ');
        return `The RAM round-trip between -hwaccel cuda and NVENC is expected here — the CPU filter "${names}" requires frames in system memory. This pipeline is valid. To keep frames on the GPU throughout, switch Deinterlace to "${gpuAlts}" and set HW Accel Output Format to cuda`;
      }
      return 'NVENC with -hwaccel cuda but without -hwaccel_output_format cuda — decoded frames will pass through system RAM before re-upload to GPU. Set HW Accel Output Format to cuda to keep the full decode→encode pipeline on the GPU';
    },
  },

  // ── Layer 2: GPU index ──────────────────────────────────────────────────────────────────

  {
    id: 'gpu_index_non_nvenc', group: 'gpu_index', layer: 2,
    severity: 'warning', flag: '-gpu',
    check: (s) => s.gpuIndex !== undefined && !NVENC_CODECS.includes(s.videoCodec),
    message: (s) => `-gpu ${s.gpuIndex} only affects NVENC/NVDEC — it has no effect on ${s.videoCodec ?? 'the selected codec'}. Use -init_hw_device or -filter_hw_device for VAAPI/QSV device selection`,
  },
  {
    id: 'gpu_index_no_hwaccel', group: 'gpu_index', layer: 2,
    severity: 'warning', flag: '-gpu',
    check: (s) => s.gpuIndex !== undefined && s.gpuIndex >= 0 && (!s.hwaccel || s.hwaccel === 'none'),
    message: (s) => `-gpu ${s.gpuIndex} selects the NVENC encode device but -hwaccel is not set — the decoder will still use CPU. Add -hwaccel cuda to route the full pipeline through GPU ${s.gpuIndex}`,
  },

  // ── Layer 2: Listen mode ──────────────────────────────────────────────────────────────────

  {
    id: 'listen_non_streaming_format', group: 'listen_mode', layer: 2,
    severity: 'warning', flag: '-listen',
    check: (s) => s.listen === 1 && s.outputFormat !== 'mpegts' && s.outputFormat !== 'flv',
    message: (s) => `-listen 1 (TCP server mode) is primarily used with MPEG-TS or FLV output — "${s.outputFormat}" over a raw TCP socket is uncommon and may not be usable by standard players`,
  },
  {
    id: 'listen_zero_redundant', group: 'listen_mode', layer: 2,
    severity: 'info', flag: '-listen',
    check: (s) => s.listen === 0,
    message: '-listen 0 is the default (client mode) — this flag is redundant and can be removed',
  },

  // ── Layer 2: CUDA / VAAPI filter requirements ──────────────────────────────────

  {
    id: 'yadif_cuda_no_hwaccel', group: 'cuda_filter_hwaccel', layer: 2,
    severity: 'error', flag: '-filter:v',
    check: (s) => s.deinterlaceFilter === 'yadif_cuda' && s.hwaccel !== 'cuda',
    message: 'yadif_cuda requires the decode pipeline on CUDA — set HW Accel to "cuda" and HW Accel Output to "cuda", otherwise FFmpeg cannot pass GPU frames to this filter',
  },
  {
    id: 'bwdif_cuda_no_hwaccel', group: 'cuda_filter_hwaccel', layer: 2,
    severity: 'error', flag: '-filter:v',
    check: (s) => s.deinterlaceFilter === 'bwdif_cuda' && s.hwaccel !== 'cuda',
    message: 'bwdif_cuda requires the decode pipeline on CUDA — set HW Accel to "cuda" and HW Accel Output to "cuda", otherwise FFmpeg cannot pass GPU frames to this filter',
  },
  {
    id: 'scale_cuda_no_hwaccel', group: 'cuda_filter_hwaccel', layer: 2,
    severity: 'error', flag: '-filter:v',
    check: (s) => s.scaleFilter === 'scale_cuda' && s.hwaccel !== 'cuda',
    message: 'scale_cuda requires the decode pipeline on CUDA — set HW Accel to "cuda" and HW Accel Output to "cuda", otherwise the filter will receive CPU frames and FFmpeg will error',
  },
  {
    id: 'cpu_deinterlace_with_hwaccel_output', group: 'cuda_filter_hwaccel', layer: 2,
    severity: 'error', flag: '-filter:v',
    check: (s) => {
      const isCpuFilter = s.deinterlaceFilter === 'yadif' || s.deinterlaceFilter === 'bwdif';
      return isCpuFilter && s.hwaccelOutputFormat && s.hwaccelOutputFormat !== 'none';
    },
    message: (s) => `CPU deinterlace filter "${s.deinterlaceFilter}" cannot process GPU frames — HW Accel Output is set to "${s.hwaccelOutputFormat}", which keeps decoded frames on the GPU. Either switch Deinterlace to "${s.deinterlaceFilter}_cuda" (GPU filter) or set HW Accel Output to "— None —" to route frames through system RAM`,
  },
  {
    id: 'cuda_filter_no_output_fmt', group: 'cuda_filter_hwaccel', layer: 2,
    severity: 'warning', flag: '-hwaccel_output_format',
    check: (s) => {
      const hasCudaFilter = s.deinterlaceFilter === 'yadif_cuda' || s.deinterlaceFilter === 'bwdif_cuda' || s.scaleFilter === 'scale_cuda'
      return hasCudaFilter && s.hwaccel === 'cuda' && s.hwaccelOutputFormat !== 'cuda'
    },
    message: (s) => `Using CUDA filter "${s.deinterlaceFilter || s.scaleFilter}" with HW Accel "cuda" but HW Accel Output is not set to "cuda" — decoded frames will move to RAM before the filter. Set HW Accel Output to "cuda" to keep frames on GPU throughout the pipeline`,
  },
  {
    id: 'cuda_filter_cpu_encoder', group: 'cuda_filter_hwaccel', layer: 2,
    severity: 'warning', flag: '-filter:v',
    check: (s) => {
      const hasCudaFilter = s.deinterlaceFilter === 'yadif_cuda' || s.deinterlaceFilter === 'bwdif_cuda' || s.scaleFilter === 'scale_cuda'
      return hasCudaFilter && !!s.videoCodec && !NVENC_CODECS.includes(s.videoCodec) && s.videoCodec !== 'copy' && s.videoCodec !== 'disabled'
    },
    message: (s) => `Using a CUDA filter with CPU encoder ${s.videoCodec} — GPU frames will be downloaded to RAM for encoding. This negates the GPU pipeline benefit; switch to h264_nvenc or hevc_nvenc, or use CPU-based filters (yadif, scale) instead`,
  },
  {
    id: 'vaapi_filter_no_hwaccel', group: 'vaapi_filter_hwaccel', layer: 2,
    severity: 'error', flag: '-filter:v',
    check: (s) => s.scaleFilter === 'scale_vaapi' && s.hwaccel !== 'vaapi',
    message: 'scale_vaapi requires -hwaccel vaapi — without it FFmpeg cannot pass GPU surfaces to the filter and will error',
  },
  {
    id: 'vaapi_cpu_deinterlace', group: 'vaapi_filter_hwaccel', layer: 2,
    severity: 'info', flag: '-filter:v',
    check: (s) => {
      const isCpuFilter = s.deinterlaceFilter === 'yadif' || s.deinterlaceFilter === 'bwdif';
      return isCpuFilter && VAAPI_CODECS.includes(s.videoCodec) && s.hwaccel === 'vaapi';
    },
    message: (s) => `CPU deinterlace filter "${s.deinterlaceFilter}" with VAAPI encoder — frames will be downloaded to RAM for filtering, then re-uploaded to GPU for encoding. This works but adds latency. For a full GPU pipeline, use "deinterlace_vaapi" filter and set HW Accel Output to "vaapi"`,
  },
  // ── Layer 2: H.264 level vs resolution/fps ────────────────────────────────

  {
    id: 'h264_level_exceeded', group: 'level_limits', layer: 2,
    severity: 'error', flag: '-level',
    check: (s) => {
      if (!s.level || !H264_LEVEL_CODECS.includes(s.videoCodec)) return false
      const limits = LEVEL_LIMITS[s.level]
      if (!limits) return false
      // Resolve actual frame size
      const sizeStr = s.frameSize === 'custom' ? s.customFrameSize : s.frameSize
      if (!sizeStr || sizeStr === 'original') return false
      const size = parseFrameSize(sizeStr)
      if (!size) return false
      // Resolve actual fps
      const fpsStr = s.fps === 'custom' ? s.customFps : s.fps
      const fps = parseFps(fpsStr)
      // Check limits
      if (size.w > limits.w || size.h > limits.h) return true
      if (!isNaN(fps) && fps > limits.fps) return true
      return false
    },
    message: (s) => {
      const sizeStr = s.frameSize === 'custom' ? s.customFrameSize : s.frameSize
      const fpsStr = s.fps === 'custom' ? s.customFps : s.fps
      const limits = LEVEL_LIMITS[s.level]
      return `Resolution ${sizeStr} @ ${fpsStr ?? '?'}fps exceeds H.264 Level ${s.level} limits (${limits.w}×${limits.h} @ ${limits.fps}fps max) — encoder will fail or produce non-compliant output`
    },
  },

  // ── Layer 2: Pixel format / codec constraints ─────────────────────────────

  {
    id: 'vaapi_10bit_pixfmt', group: 'codec_pixfmt', layer: 2,
    severity: 'error', flag: '-pix_fmt',
    check: (s) => VAAPI_CODECS.includes(s.videoCodec) && s.pixFmt && !['nv12', 'p010le', 'yuv420p'].includes(s.pixFmt),
    message: (s) => `VAAPI encoder only supports nv12 (8-bit) and p010le (10-bit) pixel formats — ${s.pixFmt} is not a valid VAAPI surface format`,
  },
  {
    id: 'nvenc_nv12_required', group: 'codec_pixfmt', layer: 2,
    severity: 'info', flag: '-pix_fmt',
    check: (s) => NVENC_CODECS.includes(s.videoCodec) && s.pixFmt && !['yuv420p', 'nv12', 'p010le', 'yuv444p'].includes(s.pixFmt),
    message: (s) => `NVENC natively supports nv12/p010le/yuv444p — ${s.pixFmt} will require an implicit conversion that may reduce performance`,
  },
  {
    id: 'hevc_baseline_profile', group: 'codec_profile_compat', layer: 2,
    severity: 'error', flag: '-profile:v',
    check: (s) => HEVC_CODECS.includes(s.videoCodec) && s.profile === 'baseline',
    message: 'HEVC does not have a "baseline" profile — use "main" or "main10" instead',
  },
  {
    id: 'mpeg2_crf', group: 'bitrate_mode', layer: 2,
    severity: 'error', flag: '-crf',
    check: (s) => s.videoCodec === 'mpeg2video' && s.bitrateMode === 'crf',
    message: 'MPEG-2 does not support CRF rate control — use CBR or VBR instead',
  },
  {
    id: 'disabled_video_with_settings', group: 'disabled_codec', layer: 2,
    severity: 'warning', flag: '-c:v',
    check: (s) => s.videoCodec === 'disabled' && !!(s.preset || s.profile || s.level || s.bitrateMode || s.targetBitrate || s.crfValue !== undefined),
    message: 'Video encoding settings have no effect when video is disabled — clean up unused parameters',
  },
  {
    id: 'disabled_audio_with_settings', group: 'disabled_codec', layer: 2,
    severity: 'warning', flag: '-c:a',
    check: (s) => s.audioCodec === 'disabled' && !!(s.audioBitrate || s.sampleRate || s.channels || s.channelLayout || s.loudnorm),
    message: 'Audio encoding settings have no effect when audio is disabled — clean up unused parameters',
  },
  {
    id: 'no_media_streams', group: 'no_media_streams', layer: 2,
    severity: 'warning',
    check: (s) => s.videoCodec === 'disabled' && s.audioCodec === 'disabled',
    message: 'Both video and audio are disabled — the output will contain no media streams and cannot be played',
  },

  // ── Layer 3: Broadcast semantic rules ─────────────────────────────────────

  {
    id: 'sc_threshold_cbr', group: 'cbr_integrity', layer: 3,
    severity: 'warning', flag: '-sc_threshold',
    check: (s) => s.bitrateMode === 'cbr' && s.scThreshold !== undefined && s.scThreshold !== 0,
    message: 'Scene-change keyframes break CBR predictability — set -sc_threshold 0 for broadcast',
  },
  {
    id: 'gop_not_aligned', group: 'gop_integrity', layer: 3,
    severity: 'warning', flag: '-g',
    check: (s) => {
      if (!s.gop) return false
      const fps = parseFps(s.fps === 'custom' ? s.customFps : s.fps)
      if (isNaN(fps) || fps <= 0) return false
      const gopSeconds = s.gop / fps
      // Use nearness-to-integer check to handle fractional FPS like NTSC (30000/1001)
      return Math.abs(gopSeconds - Math.round(gopSeconds)) > 0.01
    },
    message: 'GOP is not a whole-second multiple of frame rate — may cause IPTV middleware and ABR alignment issues',
  },
  {
    id: 'gop_too_large', group: 'gop_integrity', layer: 3,
    severity: 'warning', flag: '-g',
    check: (s) => {
      if (!s.gop) return false
      const fps = parseFps(s.fps === 'custom' ? s.customFps : s.fps)
      return !isNaN(fps) && s.gop > fps * 10
    },
    message: 'GOP longer than 10 seconds increases zap time and reduces error recovery after packet loss',
  },
  {
    id: 'high_bframes_stb', group: 'stb_compat', layer: 3,
    severity: 'warning', flag: '-bf',
    check: (s) => s.outputFormat === 'mpegts' && s.bframes > 2,
    message: 'B-frame count above 2 may exceed hardware decoder limits on DVB STBs',
  },
  {
    id: 'high_refs_stb', group: 'stb_compat', layer: 3,
    severity: 'warning', flag: '-refs',
    check: (s) => s.outputFormat === 'mpegts' && s.refs > 4,
    message: 'Reference frame count above 4 may exceed decoder memory on DVB STBs',
  },
  {
    id: 'non420_stb', group: 'stb_compat', layer: 3,
    severity: 'warning', flag: '-pix_fmt',
    check: (s) => s.outputFormat === 'mpegts' && (s.pixFmt === 'yuv422p' || s.pixFmt === 'yuv444p'),
    message: 'Most IPTV STBs only decode yuv420p — verify receiver compatibility before using 4:2:2 or 4:4:4',
  },
  {
    id: 'broadcast_sample_rate', group: 'audio_broadcast', layer: 3,
    severity: 'warning', flag: '-ar',
    check: (s) => {
      if (!s.audioCodec || s.audioCodec === 'copy' || s.audioCodec === 'disabled') return false
      if (!s.sampleRate || s.sampleRate === 'original') return false
      return s.sampleRate !== '48000' && [...DOLBY_CODECS, ...MP2_CODECS, 'aac'].includes(s.audioCodec)
    },
    message: '48 kHz is the DVB broadcast standard — 44.1 kHz may cause issues on STBs',
  },
  {
    id: 'bitrate_too_low', group: 'bitrate_floor', layer: 3,
    severity: 'warning', flag: '-b:v',
    check: (s) => {
      if (!s.targetBitrate) return false
      const size = s.frameSize !== 'custom' ? s.frameSize : s.customFrameSize
      if (!size || size === 'original') return false
      const floor = BITRATE_FLOOR[size]
      if (!floor) return false
      const bps = parseBitrate(s.targetBitrate)
      return bps !== null && bps < floor
    },
    message: 'Target bitrate appears too low for this resolution — expect visible blocking artifacts',
  },
  {
    id: 'stream_loop_no_re', group: 'file_playout', layer: 3,
    severity: 'warning', flag: '-stream_loop',
    check: (s) => isLooping(s) && s.re !== true,
    message: 'File loop without -re will consume the file faster than real-time, flooding the output',
  },
  {
    id: 'stream_loop_finite', group: 'file_playout', layer: 3,
    severity: 'info', flag: '-stream_loop',
    check: (s) => Number.isInteger(s.streamLoop) && s.streamLoop > 0,
    message: (s) => `-stream_loop ${s.streamLoop} will repeat the file ${s.streamLoop} time(s) and then stop. Use -stream_loop -1 for continuous broadcast playout`,
  },
  {
    id: 're_on_live_input', group: 'file_playout', layer: 3,
    severity: 'warning', flag: '-re',
    check: (s) => s.re === true && LIVE_INPUTS.includes(s.inputType),
    message: '-re has no meaningful effect on live network inputs and may cause stream drift',
  },
  {
    id: 'loudnorm_wrong_rate', group: 'loudnorm', layer: 3,
    severity: 'warning', flag: '-af',
    check: (s) => s.loudnorm === true && s.sampleRate && s.sampleRate !== 'original' && s.sampleRate !== '48000',
    message: 'EBU R128 loudness measurement is defined at 48 kHz — resample to 48000 before applying loudnorm',
  },
  {
    id: 'no_fault_tolerance_live', group: 'fault_tolerance', layer: 3,
    severity: 'info',
    check: (s) => LIVE_INPUTS.includes(s.inputType) && !s.timeout && !s.threadQueueSize,
    message: 'No fault tolerance flags set for a live input — consider -timeout and -thread_queue_size for unattended operation',
  },
  {
    id: 'file_input_no_re', group: 'file_playout', layer: 3,
    severity: 'warning', flag: '-re',
    check: (s) => s.inputType === 'file' && s.re !== true,
    message: 'File input without -re will be read faster than real-time, flooding the output buffer — enable -re for broadcast playout',
  },
  {
    id: 'wallclock_non_capture', group: 'wallclock', layer: 3,
    severity: 'info', flag: '-use_wallclock_as_timestamps',
    check: (s) => s.useWallclock === true && s.inputType !== 'capture',
    message: '-use_wallclock_as_timestamps is intended for capture devices with corrupt DTS/PTS — may distort timing on other input types',
  },
  {
    id: 'max_delay_non_udp_rtp', group: 'max_delay', layer: 3,
    severity: 'info', flag: '-max_delay',
    check: (s) => s.maxDelay !== undefined && s.inputType !== 'udp' && s.inputType !== 'rtp',
    message: '-max_delay is primarily effective on UDP/RTP inputs for jitter buffering — has limited effect on other input types',
  },
  {
    id: 'keyint_min_gt_gop', group: 'gop_integrity', layer: 2,
    severity: 'error', flag: '-keyint_min',
    check: (s) => s.keyintMin !== undefined && s.gop !== undefined && s.keyintMin > s.gop,
    message: '-keyint_min cannot be greater than GOP size (-g) — this will cause encoder errors',
  },
  {
    id: 'cbr_keyint_min_not_gop', group: 'cbr_integrity', layer: 3,
    severity: 'warning', flag: '-keyint_min',
    check: (s) => s.bitrateMode === 'cbr' && s.gop !== undefined && s.keyintMin !== undefined && s.keyintMin !== s.gop,
    message: 'For strict CBR broadcast set -keyint_min equal to GOP size to prevent scene-change keyframes breaking bitrate predictability',
  },

  // ── Layer 3: HLS / GOP segment alignment ──────────────────────────────────

  {
    id: 'hls_gop_segment_mismatch', group: 'hls_gop_align', layer: 3,
    severity: 'warning', flag: '-hls_time',
    check: (s) => {
      if (s.outputFormat !== 'hls' || !s.hlsTime || !s.gop) return false
      const fpsStr = s.fps === 'custom' ? s.customFps : s.fps
      const fps = parseFps(fpsStr)
      if (isNaN(fps) || fps <= 0) return false
      const gopSeconds = s.gop / fps
      // Use nearness-to-integer check to handle fractional FPS like NTSC (30000/1001)
      const ratio = s.hlsTime / gopSeconds
      return gopSeconds > 0 && Math.abs(ratio - Math.round(ratio)) > 0.01
    },
    message: (s) => {
      const fps = parseFps(s.fps === 'custom' ? s.customFps : s.fps)
      const gopSec = (s.gop / fps).toFixed(2)
      return `HLS segment duration (${s.hlsTime}s) is not a whole multiple of GOP duration (${gopSec}s) — segments will not start on keyframes, causing playback glitches in ABR players`
    },
  },

  // ── Layer 3: CBR bufsize ratio ────────────────────────────────────────────

  {
    id: 'cbr_bufsize_missing', group: 'cbr_bufsize', layer: 3,
    severity: 'warning', flag: '-bufsize',
    check: (s) => {
      if (s.bitrateMode !== 'cbr') return false
      if (!s.videoCodec || s.videoCodec === 'copy' || s.videoCodec === 'disabled') return false
      return !!s.targetBitrate && !s.bufsize
    },
    message: 'CBR mode without -bufsize has no HRD buffer constraint — set -bufsize to 1×–2× target bitrate for broadcast compliance',
  },
  {
    id: 'cbr_bufsize_ratio', group: 'cbr_bufsize', layer: 3,
    severity: 'info', flag: '-bufsize',
    check: (s) => {
      if (s.bitrateMode !== 'cbr' || !s.targetBitrate || !s.bufsize) return false
      const buf = parseBitrate(s.bufsize)
      const br  = parseBitrate(s.targetBitrate)
      if (buf === null || br === null || br === 0) return false
      const ratio = buf / br
      return ratio < 1.5 || ratio > 3
    },
    message: (s) => {
      const buf = parseBitrate(s.bufsize)
      const br  = parseBitrate(s.targetBitrate)
      const ratio = (buf / br).toFixed(1)
      return `CBR bufsize/bitrate ratio is ${ratio}× — broadcast recommendation is 1.5×–3×. Too low risks encoder undershooting, too high relaxes HRD constraints`
    },
  },

  // ── Layer 3: SRT fault tolerance ──────────────────────────────────────────

  {
    id: 'srt_fault_tolerance', group: 'fault_tolerance', layer: 3,
    severity: 'info',
    check: (s) => s.inputType === 'srt' && !s.timeout && !s.reconnect,
    message: 'SRT input without -timeout or -reconnect — consider adding fault tolerance for unattended operation',
  },

  // ── Layer 3: MPEG-2 resolution advisory ───────────────────────────────────

  {
    id: 'mpeg2_high_res', group: 'mpeg2_limits', layer: 3,
    severity: 'warning', flag: '-s',
    check: (s) => {
      if (s.videoCodec !== 'mpeg2video') return false
      const sizeStr = s.frameSize === 'custom' ? s.customFrameSize : s.frameSize
      if (!sizeStr || sizeStr === 'original') return false
      const sdSizes = ['720x576', '720x480', '704x576', '704x480', '640x480', '352x288', '352x240']
      return !sdSizes.includes(sizeStr)
    },
    message: 'MPEG-2 at resolutions above SD (720×576) produces poor quality-per-bit and is not common in broadcast — consider H.264 for HD content',
  },

  // ── Layer 3: Audio bitrate floor ──────────────────────────────────────────

  {
    id: 'audio_bitrate_too_low', group: 'audio_bitrate_floor', layer: 3,
    severity: 'warning', flag: '-b:a',
    check: (s) => {
      if (!s.audioBitrate || !s.audioCodec || s.audioCodec === 'copy' || s.audioCodec === 'disabled') return false
      const ch = s.channels && s.channels !== 'original' ? s.channels : '2'  // default stereo assumption
      const key = `${s.audioCodec}_${ch}`
      const floor = AUDIO_BITRATE_FLOOR[key]
      if (!floor) return false
      const bps = parseBitrate(s.audioBitrate)
      return bps !== null && bps < floor
    },
    message: (s) => {
      const ch = s.channels && s.channels !== 'original' ? s.channels : '2'
      const floor = AUDIO_BITRATE_FLOOR[`${s.audioCodec}_${ch}`]
      return `Audio bitrate ${s.audioBitrate} appears too low for ${s.audioCodec} with ${ch} channel(s) — minimum recommended: ${floor >= 1000 ? (floor / 1000) + 'k' : floor}`
    },
  },

  // ── Layer 3: Forced IDR advisory ──────────────────────────────────────────

  {
    id: 'forced_idr_non_nvenc', group: 'forced_idr', layer: 2,
    severity: 'error', flag: '-forced-idr',
    check: (s) => s.forcedIdr === true && !!s.videoCodec && !NVENC_CODECS.includes(s.videoCodec) && s.videoCodec !== 'copy' && s.videoCodec !== 'disabled',
    message: (s) => `-forced-idr is an NVENC-only option — ${s.videoCodec} does not support it and FFmpeg will reject the flag. Disable Force IDR or switch to an NVENC encoder (h264_nvenc / hevc_nvenc)`,
  },
  {
    id: 'forced_idr_crf', group: 'forced_idr', layer: 3,
    severity: 'info', flag: '-forced-idr',
    check: (s) => s.forcedIdr === true && s.bitrateMode === 'crf',
    message: '-forced-idr forces IDR frames at every keyframe — in CRF mode this may cause periodic bitrate spikes at each keyframe',
  },
  // ── Layer 3: Probe / analyze duration advisories ────────────────────────────────────

  {
    id: 'high_analyzeduration_live', group: 'probe_settings', layer: 3,
    severity: 'warning', flag: '-analyzeduration',
    check: (s) => !!s.analyzeDuration && s.analyzeDuration > 10_000_000 && LIVE_INPUTS.includes(s.inputType),
    message: (s) => `analyzeduration ${(s.analyzeDuration / 1_000_000).toFixed(0)} s on a live input will delay stream startup by that duration — live sources rarely need more than 5–10 s`,
  },
  {
    id: 'probesize_without_analyzeduration', group: 'probe_settings', layer: 3,
    severity: 'info', flag: '-probesize',
    check: (s) => !!s.probeSize && !s.analyzeDuration,
    message: '-probesize is set but -analyzeduration is not — both usually need to be raised together for reliable detection of complex or delayed streams',
  },
  {
    id: 'analyzeduration_without_probesize', group: 'probe_settings', layer: 3,
    severity: 'info', flag: '-analyzeduration',
    check: (s) => !!s.analyzeDuration && !s.probeSize,
    message: '-analyzeduration is set but -probesize is not — both usually need to be raised together. If probe data is exhausted before the duration expires, detection will still fail',
  },
  // ── Layer 3: H.264 high-chroma profile advisory ───────────────────────────

  {
    id: 'h264_high_profile_missing', group: 'codec_profile_advisory', layer: 3,
    severity: 'warning', flag: '-profile:v',
    check: (s) => {
      if (!['libx264', 'h264_nvenc'].includes(s.videoCodec)) return false
      if (s.pixFmt === 'yuv422p' && s.profile !== 'high422') return true
      if (s.pixFmt === 'yuv444p' && !['high444', 'high444p'].includes(s.profile)) return true
      return false
    },
    message: (s) => {
      const need = s.pixFmt === 'yuv422p' ? 'high422' : 'high444/high444p'
      return `Pixel format ${s.pixFmt} requires -profile:v ${need} — without it, FFmpeg will silently downconvert to yuv420p`
    },
  },

  // ── Layer 3: CBR maxrate advisory ─────────────────────────────────────────

  {
    id: 'cbr_no_maxrate', group: 'cbr_maxrate', layer: 3,
    severity: 'info', flag: '-maxrate',
    check: (s) => {
      if (s.bitrateMode !== 'cbr') return false
      if (!s.videoCodec || s.videoCodec === 'copy' || s.videoCodec === 'disabled') return false
      return !!s.targetBitrate && !s.maxrate
    },
    message: 'For strict CBR compliance, set -maxrate equal to -b:v to enforce a constant bitrate ceiling. Without it, the encoder may overshoot in complex scenes',
  },

  // ── Layer 3: HLS encryption advisory ──────────────────────────────────────

  {
    id: 'hls_enc_fmp4', group: 'hls_enc', layer: 3,
    severity: 'info', flag: '-hls_enc',
    check: (s) => s.hlsEnc === true && s.hlsSegmentType !== 'fmp4',
    message: 'HLS encryption with mpegts segments uses AES-128 — fMP4 segments support SAMPLE-AES/CBCS which is more efficient and required by some DRM systems',
  },

]
