// locales/en.js — English message catalog for fflint validators
import {
  PRESETS, LEVEL_LIMITS, CHANNEL_LAYOUT_CHANNELS, AUDIO_BITRATE_FLOOR,
  parseBitrate, parseFps, parseFrameSize,
} from '../codec-data.js'
import { getScaleSize } from '../vf-parse.js'

// Helper for repeated enum patterns
const enumMsg = () => ({
  message: ({ label, valid, val }) => `${label} must be one of: ${valid} (got "${val}")`,
})

const arrayEnumMsg = () => ({
  message: ({ label, invalid, valid }) => `Unknown ${label} value(s): ${invalid}. Valid: ${valid}`,
})

export default {
  // ── Layer 1: Enum validators ─────────────────────────────────────────────

  l1_input_type:          enumMsg(),
  l1_video_codec:         enumMsg(),
  l1_hwaccel:             enumMsg(),
  l1_hwaccel_output_fmt:  enumMsg(),
  l1_color_primaries:     enumMsg(),
  l1_color_trc:           enumMsg(),
  l1_colorspace:          enumMsg(),
  l1_fps_sync_mode:       enumMsg(),
  l1_audio_codec:         enumMsg(),
  l1_sample_rate:         enumMsg(),
  l1_channels:            enumMsg(),
  l1_bsf_audio:           enumMsg(),
  l1_subtitle_mode:       enumMsg(),
  l1_output_format:       enumMsg(),
  l1_hls_seg_type:        enumMsg(),
  l1_avoid_neg_ts:        enumMsg(),
  l1_deinterlace_filter:  enumMsg(),
  l1_scale_filter:        enumMsg(),
  l1_bitrate_mode:        enumMsg(),

  // ── Layer 1: Array enum validators ───────────────────────────────────────

  l1_fflags:        arrayEnumMsg(),
  l1_mpegts_flags:  arrayEnumMsg(),
  l1_hls_flags:     arrayEnumMsg(),

  // ── Layer 1: NVDEC deinterlace ───────────────────────────────────────────

  l1_nvdec_deint_invalid: {
    message: ({ valid, val }) => `NVDEC deinterlace mode must be one of: ${valid} (got "${val}")`,
    hint: '0 = weave (no deinterlace). 1 = bob (frame-rate deinterlace). 2 = adaptive. Only effective with NVDEC cuvid decoders (-hwaccel cuda)',
  },

  // ── Layer 1: keyint_min ──────────────────────────────────────────────────

  l1_keyint_min_invalid: {
    message: ({ max }) => `Minimum keyframe interval must be a positive integer (1–${max})`,
    hint: 'Typically GOP/2. For 25 fps + 2 s GOP: keyintMin=25. Recommended: set equal to fps to guarantee at least 1 keyframe/sec',
  },
  l1_keyint_min_high: {
    message: ({ value }) => `keyint_min ${value} is unusually high — most streams need a keyframe every few seconds`,
    hint: 'Typically GOP/2. For 25 fps + 2 s GOP: keyintMin=25. Recommended: set equal to fps to guarantee at least 1 keyframe/sec',
  },

  // ── Layer 1: sc_threshold ────────────────────────────────────────────────

  l1_sc_threshold_looks_like_flag: {
    message: ({ value }) => `sc_threshold value is "${value}" which looks like another flag — the value is missing. Provide a number (e.g. 0)`,
    hint: '0 = disable scene cut detection (strongly recommended for live/IPTV to keep fixed-GOP). FFmpeg default: 40',
  },
  l1_sc_threshold_invalid: {
    message: 'Scene change threshold must be a non-negative integer (0 = disable)',
    hint: '0 = disable scene cut detection (strongly recommended for live/IPTV to keep fixed-GOP). FFmpeg default: 40',
  },
  l1_sc_threshold_very_high: {
    message: ({ value }) => `Scene change threshold ${value} is very high — effectively disables scene change detection. Use 0 explicitly to disable`,
    hint: '0 = disable scene cut detection (strongly recommended for live/IPTV to keep fixed-GOP). FFmpeg default: 40',
  },
  l1_sc_threshold_high: {
    message: ({ value }) => `Scene change threshold ${value} is outside the practical range (0–100, default 40) — values above 100 produce minimal I-frames and may impair error recovery`,
    hint: '0 = disable scene cut detection (strongly recommended for live/IPTV to keep fixed-GOP). FFmpeg default: 40',
  },

  // ── Layer 1: bframes ─────────────────────────────────────────────────────

  l1_bframes_looks_like_flag: {
    message: ({ value }) => `B-frames value is "${value}" which looks like another flag — the value is missing. Provide a number (e.g. 2)`,
    hint: '0 for live/low-latency (no delay). 2–3 for VOD H.264 quality. HEVC supports up to 8. Recommended: 0 for live, 2 for VOD',
  },
  l1_bframes_invalid: {
    message: 'B-frames must be an integer between 0 and 16',
    hint: '0 for live/low-latency (no delay). 2–3 for VOD H.264 quality. HEVC supports up to 8. Recommended: 0 for live, 2 for VOD',
  },
  l1_bframes_high: {
    message: ({ value }) => `B-frame count ${value} exceeds the common range (0–3) — higher values increase encoding delay and memory with diminishing compression gains. Use 0 for live/low-latency (no delay), 2–3 for VOD H.264 quality. HEVC supports up to 8.`,
    hint: '0 for live/low-latency (no delay). 2–3 for VOD H.264 quality. HEVC supports up to 8. Recommended: 0 for live, 2 for VOD',
  },

  // ── Layer 1: refs ─────────────────────────────────────────────────────────

  l1_refs_looks_like_flag: {
    message: ({ value }) => `Reference frames value is "${value}" which looks like another flag — the value is missing. Provide a number (e.g. 3)`,
    hint: '1 = fastest decode/lowest latency. 3–5 = typical quality/speed balance. Higher values improve compression but increase decoder memory. Recommended: 3',
  },
  l1_refs_invalid: {
    message: 'Reference frames must be an integer between 1 and 16',
    hint: '1 = fastest decode/lowest latency. 3–5 = typical quality/speed balance. Higher values improve compression but increase decoder memory. Recommended: 3',
  },
  l1_refs_high: {
    message: ({ value }) => `Reference frames ${value} exceeds the typical range (1–4) — adds little quality benefit but increases memory and CPU usage`,
    hint: '1 = fastest decode/lowest latency. 3–5 = typical quality/speed balance. Higher values improve compression but increase decoder memory. Recommended: 3',
  },

  // ── Layer 1: MPEG-TS Service ID ──────────────────────────────────────────

  l1_service_id_invalid: {
    message: 'MPEG-TS Service ID must be an integer between 1 and 65535',
    hint: 'Must be unique per multiplex. Typical: 1. Range 1–65535 (16-bit). Matches the SID in SDT/PAT tables',
  },

  // ── Layer 1: HLS time ────────────────────────────────────────────────────

  l1_hls_time_invalid: {
    message: 'HLS segment duration must be an integer between 1 and 3600 seconds',
    hint: '2–4 s for low-latency HLS (LL-HLS). 6 s is the common default. 10 s for stable VOD. Recommended: 6',
  },
  l1_hls_time_high: {
    message: ({ value }) => `HLS segment duration ${value}s is very long — increases seek latency and startup delay`,
    hint: '2–4 s for low-latency HLS (LL-HLS). 6 s is the common default. 10 s for stable VOD. Recommended: 6',
  },

  // ── Layer 1: HLS list size ───────────────────────────────────────────────

  l1_hls_list_size_invalid: {
    message: ({ max }) => `HLS playlist size must be an integer between 0 and ${max} (0 = unlimited)`,
    hint: '0 = keep all segments (VOD). 3–5 = live rolling window. Recommended live: 5 (covers ~30 s at 6 s segments)',
  },
  l1_hls_list_size_high: {
    message: ({ value }) => `HLS playlist with ${value} segments is unusually large — consider 0 for VOD or 3–10 for live`,
    hint: '0 = keep all segments (VOD). 3–5 = live rolling window. Recommended live: 5 (covers ~30 s at 6 s segments)',
  },

  // ── Layer 1: max delay ───────────────────────────────────────────────────

  l1_max_delay_invalid: {
    message: ({ max }) => `Max input delay must be an integer between 0 and ${max} microseconds`,
    hint: 'FFmpeg default: 700 000 µs (0.7 s). Live streaming: 200 000–500 000 µs. 0 = no buffering (may drop packets). Recommended live: 500 000',
  },
  l1_max_delay_high: {
    message: ({ seconds }) => `Max delay ${seconds}s is very high — may cause excessive buffering`,
    hint: 'FFmpeg default: 700 000 µs (0.7 s). Live streaming: 200 000–500 000 µs. 0 = no buffering (may drop packets). Recommended live: 500 000',
  },

  // ── Layer 1: thread queue size ───────────────────────────────────────────

  l1_thread_queue_size_invalid: {
    message: ({ max }) => `Thread queue size must be a positive integer (1–${max})`,
    hint: 'FFmpeg default: 8 (too low for live, causes DTS errors). Typical live: 512–1024. High-latency/unstable sources: 4096. Recommended: 1024',
  },
  l1_thread_queue_size_high: {
    message: ({ value }) => `Thread queue size ${value} is unreasonably high — may exhaust memory`,
    hint: 'FFmpeg default: 8 (too low for live, causes DTS errors). Typical live: 512–1024. High-latency/unstable sources: 4096. Recommended: 1024',
  },

  // ── Layer 1: max muxing queue size ───────────────────────────────────────

  l1_max_muxing_queue_invalid: {
    message: ({ max }) => `Max muxing queue size must be a positive integer (1–${max})`,
    hint: 'FFmpeg default: 128. Raise to 1024–4096 if you see "Too many packets buffered for output stream" errors. Recommended: 1024',
  },
  l1_max_muxing_queue_high: {
    message: ({ value }) => `Max muxing queue size ${value} is very high — may waste memory. 1024–4096 covers most cases`,
    hint: 'FFmpeg default: 128. Raise to 1024–4096 if you see "Too many packets buffered for output stream" errors. Recommended: 1024',
  },

  // ── Layer 1: audio bitrate ───────────────────────────────────────────────

  l1_audio_bitrate_invalid: {
    message: "Audio bitrate must be a number with optional suffix, e.g. '128k' or '192k'",
    hint: 'AAC: 128k (stereo), 192k (high quality), 320k (archival). AC3: 192k (stereo), 384k (5.1). Recommended stereo broadcast: 192k',
  },

  // ── Layer 1: loudnorm params ─────────────────────────────────────────────

  l1_loudnorm_tp_invalid: {
    message: 'Loudness true peak must be a number between -9 and 0 dBTP',
    hint: 'EBU R128 recommendation: −1 dBTP. For extra headroom: −2 dBTP. Recommended: −1',
  },
  l1_loudnorm_lra_invalid: {
    message: 'Loudness range (LRA) must be a number between 1 and 20 LU',
    hint: 'EBU R128 max: 18 LU. Broadcast typical: 7–10 LU. Recommended: 7',
  },

  // ── Layer 1: profile ─────────────────────────────────────────────────────

  l1_profile_ignored: {
    message: ({ codec }) => `${codec} does not use -profile:v — this setting will be ignored`,
    hint: 'Remove the profile setting or switch to a codec that supports profiles (H.264, H.265)',
  },
  l1_profile_invalid: {
    message: ({ profile, codec, valid }) => `Profile "${profile}" is not valid for ${codec}. Valid: ${valid}`,
    hint: ({ common }) => `Common choices: ${common}`,
  },

  // ── Layer 1: preset ──────────────────────────────────────────────────────

  l1_preset_ignored: {
    message: ({ codec }) => `${codec} does not use -preset — this setting will be ignored`,
    hint: 'Remove the preset setting or switch to a codec that supports presets',
  },
  l1_preset_invalid: {
    message: ({ preset, codec, family, valid }) => `Preset "${preset}" is not valid for ${codec} (${family} family). Valid: ${valid}`,
    hint: ({ recommended }) => `Recommended: "${recommended}" for a good speed/quality balance`,
  },

  // ── Layer 1: level ───────────────────────────────────────────────────────

  l1_level_invalid_h264: {
    message: ({ level, valid }) => `Level "${level}" is not valid for H.264. Valid: ${valid}`,
    hint: 'Common: 4.1 (1080p60/Blu-ray), 5.1 (4K60)',
  },
  l1_level_high_h264: {
    message: ({ level }) => `Level ${level} targets high-resolution/high-framerate content — may not play on older devices or set-top boxes`,
    hint: 'Use 4.0–4.2 for broad HD device compatibility',
  },
  l1_level_invalid_h265: {
    message: ({ level, valid }) => `Level "${level}" is not valid for H.265. Valid: ${valid}`,
    hint: 'Common: 4.1 (1080p), 5.1 (4K)',
  },
  l1_level_high_h265: {
    message: ({ level }) => `Level ${level} targets 8K content — very few devices currently support this`,
    hint: 'Use 5.0–5.1 for broad 4K compatibility',
  },
  l1_level_ignored: {
    message: ({ codec }) => `${codec} does not use -level — this setting will be ignored`,
    hint: 'Remove the level setting or switch to H.264/H.265',
  },

  // ── Layer 1: channel layout ──────────────────────────────────────────────

  l1_channel_layout_invalid: {
    message: ({ layout, valid }) => `Channel layout "${layout}" is not recognized. Valid: ${valid}`,
    hint: 'Common: stereo (2ch), 5.1 (6ch surround), 7.1 (8ch)',
  },

  // ── Layer 1: aspect ──────────────────────────────────────────────────────

  l1_aspect_invalid: {
    message: ({ value }) => `Aspect ratio must be in W:H format, e.g. 16:9 or 4:3 (got "${value}")`,
    hint: 'Common: 16:9 (widescreen), 4:3 (standard), 21:9 (ultrawide)',
  },

  // ── Layer 1: pix_fmt ─────────────────────────────────────────────────────

  l1_pix_fmt_deprecated: {
    message: ({ value }) => `"${value}" is a deprecated JPEG-range pixel format — use the modern equivalent (e.g. yuv420p with -color_range pc)`,
    hint: 'yuv420p = widest compatibility (web, TV, mobile). yuv422p = broadcast/editing. 10-bit = HDR content',
  },
  l1_pix_fmt_invalid: {
    message: ({ valid, val }) => `Pixel format must be one of: ${valid} (got "${val}")`,
    hint: 'yuv420p = widest compatibility (web, TV, mobile). yuv422p = broadcast/editing. 10-bit = HDR content',
  },

  // ── Layer 1: bsf video ──────────────────────────────────────────────────

  l1_bsf_video_invalid: {
    message: ({ valid, val }) => `Video bitstream filter must be one of: ${valid} (got "${val}")`,
    hint: 'h264_mp4toannexb: H.264 in MPEG-TS. hevc_mp4toannexb: HEVC in MPEG-TS. Apply only codec-relevant filters',
  },

  // ── Layer 1: field order ─────────────────────────────────────────────────

  l1_field_order_invalid: {
    message: ({ valid, val }) => `Field order must be one of: ${valid} (got "${val}")`,
    hint: 'tt = top-field-first (most common). bb = bottom-field-first (PAL DV). progressive = no interlacing',
  },

  // ── Layer 1: frame size ──────────────────────────────────────────────────

  l1_framesize_non_positive: {
    message: ({ value }) => `Frame size "${value}" has a non-positive dimension — width and height must both be positive integers. The "-1"/"-2" auto-derive shorthand is filter-only and not valid for -s`,
    hint: 'Common: 1920x1080 (Full HD), 1280x720 (HD), 3840x2160 (4K UHD), 720x576 (SD PAL), 720x480 (SD NTSC)',
  },
  l1_framesize_invalid: {
    message: 'Frame size must be in WxH format, e.g. 1920x1080 (separator "x" or "-")',
    hint: 'Common: 1920x1080 (Full HD), 1280x720 (HD), 3840x2160 (4K UHD), 720x576 (SD PAL), 720x480 (SD NTSC)',
  },

  // ── Layer 1: FPS ─────────────────────────────────────────────────────────

  l1_fps_invalid: {
    message: ({ value }) => `Custom FPS "${value}" is not a valid frame rate — use a decimal (29.97) or fractional notation (30000/1001)`,
    hint: 'Common: 23.976 (film), 25 (PAL/EU), 29.97 or 30000/1001 (NTSC), 30, 50, 59.94, 60. Fractional notation (e.g. 30000/1001) is supported',
  },
  l1_fps_high: {
    message: ({ value, approx }) => `FPS ${value} (≈${approx}) is unusually high — most displays and encoders max out at 60`,
    hint: 'Common: 23.976 (film), 25 (PAL/EU), 29.97 or 30000/1001 (NTSC), 30, 50, 59.94, 60. Fractional notation (e.g. 30000/1001) is supported',
  },

  // ── Layer 1: scale filter syntax ─────────────────────────────────────────

  l1_vf_scale_wrong_separator: {
    message: ({ name, value }) => `${name} value "${value}" uses the wrong separator — the scale filter requires "W:H", not "WxH"`,
    hint: 'Inside the scale filter use ":", e.g. scale=1920:1080 or scale=w=1920:h=1080. The "x" separator is only valid for -s',
  },
  l1_vf_scale_comma_separator: {
    message: ({ name, w, h }) => `${name}=${w},${h} uses "," between width and height — comma separates filters in the chain, use ":" instead (${name}=${w}:${h})`,
    hint: 'Inside a filter, separate width and height with ":" — comma "," separates filters in the chain. Use scale=W:H, not scale=W,H',
  },
  l1_vf_scale_missing_dim: {
    message: ({ name }) => `${name} requires both width and height — use ${name}=W:H or ${name}=w=W:h=H`,
    hint: 'Inside the scale filter use ":", e.g. scale=1920:1080 or scale=w=1920:h=1080. The "x" separator is only valid for -s',
  },

  // ── Layer 1: GOP ─────────────────────────────────────────────────────────

  l1_gop_invalid: {
    message: ({ max }) => `GOP must be a positive integer (1–${max})`,
    hint: 'Formula: fps × keyframe_interval_seconds. E.g. 25 fps × 4 s = 100. Typical live: 50–250. Recommended: match segment duration',
  },
  l1_gop_high: {
    message: ({ value }) => `GOP ${value} is very large — may cause long seek times and poor error recovery`,
    hint: 'Formula: fps × keyframe_interval_seconds. E.g. 25 fps × 4 s = 100. Typical live: 50–250. Recommended: match segment duration',
  },

  // ── Layer 1: CRF ─────────────────────────────────────────────────────────

  l1_crf_invalid: {
    message: 'CRF value must be a valid number',
    hint: 'Lower = better quality, larger file. H.264 typical: 18–28, recommended: 23. HEVC typical: 22–32, recommended: 28. AV1 typical: 20–40, recommended: 30',
  },
  l1_crf_range: {
    message: ({ min, max, codec }) => `CRF value must be ${min}–${max} for ${codec}`,
    hint: 'Lower = better quality, larger file. H.264 typical: 18–28, recommended: 23. HEVC typical: 22–32, recommended: 28. AV1 typical: 20–40, recommended: 30',
  },

  // ── Layer 1: bitrates ────────────────────────────────────────────────────

  l1_bitrate_invalid: {
    message: "Bitrate must be a number with optional suffix, e.g. '4M' or '500k'",
    hint: 'Typical: 500k (SD), 2M (720p), 4–8M (1080p), 15–25M (4K). Use k/M suffix',
  },
  l1_maxrate_invalid: {
    message: 'Max rate must be a number with optional suffix',
    hint: 'Typically 10–20% above target bitrate. Must be paired with -bufsize. Example: target=4M → maxrate=5M',
  },
  l1_bufsize_invalid: {
    message: 'Buffer size must be a number with optional suffix',
    hint: '2× maxrate for broadcast VBR, 1× maxrate for streaming. Example: maxrate=5M → bufsize=10M',
  },

  // ── Layer 1: PIDs ────────────────────────────────────────────────────────

  l1_pid_invalid: {
    message: ({ value }) => `PID must be between 32 and 8186 (got ${value})`,
    hint: 'Convention: PMT at 256, video at 257, audio at 258. Avoid 0–31 (reserved) and 8191 (null packet)',
  },

  // ── Layer 1: PCR period ──────────────────────────────────────────────────

  l1_pcr_invalid: {
    message: 'PCR period must be an integer between 1 and 100 ms (DVB spec max)',
    hint: 'DVB spec max: 100 ms. FFmpeg default: 20 ms. Recommended: 40 ms for broadcast, 20 ms for IPTV',
  },

  // ── Layer 1: dialnorm ────────────────────────────────────────────────────

  l1_dialnorm_invalid: {
    message: 'Dialogue normalization must be an integer between -31 and -1 dBFS',
    hint: 'Dolby standard: −27 for film, −24 for TV. EBU R128 (−23 LUFS) maps to −23. Recommended broadcast: −27',
  },

  // ── Layer 1: loudnorm target ─────────────────────────────────────────────

  l1_loudnorm_target_invalid: {
    message: 'Loudness target must be between -70 and 0 LUFS',
    hint: 'EBU R128: −23 LUFS. Netflix: −27 LUFS. YouTube normalises to −14 LUFS. Podcast: −16 LUFS. Recommended broadcast: −23',
  },

  // ── Layer 1: timeout ─────────────────────────────────────────────────────

  l1_timeout_invalid: {
    message: ({ max }) => `Timeout must be a positive integer in microseconds (1–${max})`,
    hint: 'SRT/RTSP on stable network: 5 000 000 µs (5 s). Unstable/satellite links: 10 000 000 µs (10 s). Recommended: 5 000 000',
  },
  l1_timeout_high: {
    message: ({ seconds }) => `Timeout ${seconds}s is very high — may delay failure detection on dead sources`,
    hint: 'SRT/RTSP on stable network: 5 000 000 µs (5 s). Unstable/satellite links: 10 000 000 µs (10 s). Recommended: 5 000 000',
  },

  // ── Layer 1: analyze duration ────────────────────────────────────────────

  l1_analyze_duration_invalid: {
    message: ({ value }) => `Analyze duration must be a positive integer in microseconds, max 120 000 000 (2 min) (got ${value})`,
    hint: 'Unit: microseconds. Common: 5 000 000 (5 s), 10 000 000 (10 s). Higher values delay stream start but improve codec detection on complex inputs. FFmpeg default: 5 000 000. For reliable live IPTV sources 5 000 000 is usually sufficient',
  },
  l1_analyze_duration_high: {
    message: ({ seconds }) => `Analyze duration ${seconds} s is very high — causes a long startup delay before the stream begins`,
    hint: 'Unit: microseconds. Common: 5 000 000 (5 s), 10 000 000 (10 s). Higher values delay stream start but improve codec detection on complex inputs. FFmpeg default: 5 000 000. For reliable live IPTV sources 5 000 000 is usually sufficient',
  },

  // ── Layer 1: probe size ──────────────────────────────────────────────────

  l1_probe_size_invalid: {
    message: ({ value }) => `Probe size must be a positive integer in bytes, max 1 000 000 000 (1 GB) (got ${value})`,
    hint: 'Unit: bytes. Common: 5 000 000 (5 MB), 10 000 000 (10 MB). Higher values improve format/codec detection but use more memory. FFmpeg default: 5 000 000. Pair with -analyzeduration for hard-to-detect streams',
  },
  l1_probe_size_high: {
    message: ({ mb }) => `Probe size ${mb} MB is very high — may cause significant memory usage and startup latency`,
    hint: 'Unit: bytes. Common: 5 000 000 (5 MB), 10 000 000 (10 MB). Higher values improve format/codec detection but use more memory. FFmpeg default: 5 000 000. Pair with -analyzeduration for hard-to-detect streams',
  },

  // ── Layer 1: GPU index ───────────────────────────────────────────────────

  l1_gpu_index_invalid: {
    message: ({ value }) => `GPU index must be an integer from -1 (auto) to 15 (got ${value})`,
    hint: '-1 = FFmpeg auto-selects any available GPU. 0 = first GPU, 1 = second GPU, etc. Only affects NVENC/NVDEC. Recommended: -1 (auto) unless you specifically need a particular device',
  },

  // ── Layer 1: listen ──────────────────────────────────────────────────────

  l1_listen_invalid: {
    message: ({ value }) => `Listen mode must be 0 (client) or 1 (server) (got ${value})`,
    hint: '0 = client mode (default, connect to URL). 1 = server mode (bind and wait for incoming connection). Use listen=1 on the output URL for TCP/MPEG-TS push receivers. The output URL must use the tcp:// scheme or a host:port address',
  },

  // ── Layer 1: stream_loop ─────────────────────────────────────────────────

  l1_stream_loop_invalid: {
    message: ({ value }) => `Stream loop must be -1 (infinite), 0 (no loop), or a positive integer count (got ${value})`,
    hint: '-1 = loop indefinitely, 0 = play once (no loop), N > 0 = repeat N additional times. Always pair with -re to avoid flooding the output. Recommended: -stream_loop -1 -re for broadcast playout',
  },

  // ── Layer 2/3: Rules ─────────────────────────────────────────────────────

  // Copy conflicts
  copy_deinterlace:      { message: 'Deinterlace filter cannot be applied when video codec is Copy' },
  copy_logo:             { message: 'Logo overlay cannot be applied when video codec is Copy' },
  copy_rescale:          { message: 'Frame size cannot be changed when video codec is Copy' },
  copy_fps:              { message: 'Frame rate cannot be changed when video codec is Copy' },
  copy_pixfmt:           { message: 'Pixel format is ignored when video codec is Copy' },
  copy_audio_resample:   { message: 'Sample rate cannot be changed when audio codec is Copy' },
  copy_audio_channels:   { message: 'Channel count cannot be changed when audio codec is Copy' },
  copy_audio_loudnorm:   { message: 'EBU R128 loudness filter cannot be applied when audio codec is Copy' },

  // Codec / hwaccel
  nvenc_no_hwaccel:      { message: 'NVENC codec requires -hwaccel cuda — without it the decode pipeline runs on CPU, negating the GPU advantage. Set HW Accel to "cuda"' },
  vaapi_wrong_hwaccel:   { message: 'VAAPI codec requires -hwaccel vaapi' },
  nvenc_cpu_preset:      { message: ({ s }) => `Preset "${s.preset}" is a libx264/libx265 CPU preset — FFmpeg will reject it with NVENC. Use an NVENC preset instead: ${PRESETS.nvenc.join(', ')}` },
  vaapi_preset:          { message: ({ s }) => `Preset "${s.preset}" has no effect on VAAPI encoders — h264_vaapi does not support presets. Remove the Preset selection (set to "— None —")` },
  cpu_hwaccel_set:       { message: 'Hardware acceleration has no effect on CPU codecs' },
  nvenc_yuv422:          { message: 'NVENC H.264 does not support 4:2:2 (yuv422p) pixel format' },
  x264_10bit_no_high10: { message: '10-bit encoding with libx264 requires -profile:v high10' },

  // Bitrate mode
  crf_and_bitrate:       { message: 'CRF and target bitrate (-b:v) are mutually exclusive' },
  vbr_no_maxrate:        { message: 'VBR mode without -maxrate has no peak bitrate cap' },
  maxrate_no_bufsize:    { message: '-maxrate without -bufsize leaves the HRD buffer undefined' },

  // HDR / color metadata
  hdr_8bit:              { message: 'HDR10 (PQ / smpte2084) requires a 10-bit pixel format such as yuv420p10le' },
  hdr_wrong_matrix:      { message: 'PQ transfer characteristic with BT.709 matrix is inconsistent HDR metadata' },
  bt2020_wrong_matrix:   { message: 'BT.2020 primaries should pair with bt2020nc color space matrix' },

  // Interlace / field order
  nvdec_deint_with_filter: {
    message: ({ s }) => `-deint ${s.nvdecDeint} (NVDEC hardware deinterlace) and -filter:v ${s.deinterlaceFilter} are both active — the stream will be deinterlaced twice. Use one or the other: either NVDEC decoder deinterlace (-deint) for zero-copy GPU pipeline, or a filter (${s.deinterlaceFilter}) for more control. Remove one to fix the conflict`,
  },
  nvdec_deint_no_hwaccel:      { message: '-deint requires -hwaccel cuda (NVDEC cuvid decoder pipeline) — without it the flag is ignored or causes an error' },
  nvdec_deint_no_output_fmt:   { message: '-deint with -hwaccel cuda but without -hwaccel_output_format cuda — decoded frames will be downloaded to system RAM after NVDEC deinterlacing. Set HW Accel Output to "cuda" to keep the full pipeline on the GPU' },
  nvdec_deint_zero_redundant:  { message: '-deint 0 (weave) is the default — this flag is redundant and can be removed' },
  field_order_while_deinterlacing: { message: 'Deinterlace removes interlacing — a non-progressive field order tag is contradictory' },
  yadif_field_fps_mismatch:    { message: 'Field-rate deinterlace (mode=1) doubles frame rate — output FPS should be 50 or 60, not ≤30' },

  // DVB / MPEG-TS
  pid_collision:         { message: 'PMT PID and ES start PID ranges overlap — this will corrupt the transport stream' },
  ts_flags_on_non_ts:    { message: 'MPEG-TS flags have no effect on non-MPEG-TS output formats' },
  hls_flags_on_non_hls:  { message: 'HLS flags have no effect on non-HLS output formats' },
  fmp4_mpeg2:            { message: 'fMP4 HLS container does not support MPEG-2 video' },
  copyts_avoid_negative: { message: '-copyts preserves original timestamps while -avoid_negative_ts make_zero resets them — these conflict' },

  // Fault tolerance
  reconnect_non_http:    { message: '-reconnect flags are only effective for HTTP/HLS inputs' },
  timeout_too_low:       { message: 'Timeout below 1 s (1 000 000 µs) may cause spurious disconnects on congested links' },

  // Audio
  dialnorm_non_dolby:    { message: '-dialnorm is embedded in AC3/EAC3 bitstreams only — no effect on other codecs' },

  // Container / codec compatibility
  hevc_hls_needs_fmp4:   { message: 'HEVC video in HLS requires -hls_segment_type fmp4 (Apple mandate) — mpegts segments will be rejected by iOS/Safari' },
  aac_fmp4_needs_bsf:    { message: 'AAC in MP4/fMP4 container requires -bsf:a aac_adtstoasc to strip ADTS headers' },
  h264_ts_needs_bsf:     { message: 'When remuxing H.264 from MP4 sources to MPEG-TS, use -bsf:v h264_mp4toannexb to convert Annex B framing' },
  flv_hevc:              { message: 'FLV container does not support HEVC video — FFmpeg will abort. Use H.264 for RTMP/FLV or switch to HLS for HEVC' },
  flv_mpeg2:             { message: 'FLV container does not support MPEG-2 video — only H.264 is valid for FLV/RTMP output' },
  flv_audio_compat:      { message: 'FLV container only supports AAC and MP3 audio — AC3/EAC3/Opus are not muxable into FLV' },
  mp4_mpeg2:             { message: 'MP4 container does not support MPEG-2 video — use mpegts for MPEG-2 or switch to H.264/H.265 for MP4' },
  mpegts_opus:           { message: 'libopus is not multiplexable into MPEG-TS — use AAC, MP2, or AC3 for DVB/IPTV output' },
  mp2_hls:               { message: 'HLS requires AAC audio (Apple mandate) — MP2/libtwolame is not supported in HLS segments' },
  mp2_mp4:               { message: 'MP4 container does not support MP2 audio — use AAC or AC3 for MP4 output' },
  matroska_dialnorm:     { message: 'Matroska container ignores dialnorm metadata — only relevant for MPEG-TS/MP4 output with Dolby audio' },

  // CBR/VBR bitrate completeness
  no_rate_control:       { message: 'No rate control specified — encoder will use internal defaults, which may produce unpredictable bitrate. Set -b:v (CBR/VBR) or -crf (quality-based) for reliable output' },
  cbr_no_bitrate:        { message: 'CBR mode requires a target bitrate (-b:v) — encoder has no bitrate target to maintain' },
  vbr_no_bitrate:        { message: 'VBR mode without -b:v uses codec defaults which vary wildly — set a target bitrate for predictable output' },
  maxrate_lt_bitrate:    { message: '-maxrate below -b:v is a hard HRD violation — encoder can never reach target bitrate' },
  bufsize_too_small:     { message: '-bufsize smaller than target bitrate means the buffer fills in under one second — use at minimum 1× and ideally 2× -b:v' },

  // Copy codec side-effects
  copy_video_preset:     { message: '-preset is ignored when video codec is Copy — remove to avoid confusion' },
  copy_video_bframes:    { message: '-bf (B-frames) is ignored when video codec is Copy — remove to avoid confusion' },
  copy_video_refs:       { message: '-refs is ignored when video codec is Copy — remove to avoid confusion' },
  copy_video_color_meta: { message: 'Color metadata flags are ignored when video codec is Copy — the original stream metadata is preserved as-is' },
  copy_video_profile:    { message: '-profile:v is ignored when video codec is Copy — the original stream profile is preserved' },
  copy_video_level:      { message: '-level is ignored when video codec is Copy — the original stream level is preserved' },
  copy_video_gop:        { message: '-g (GOP) is ignored when video codec is Copy — the original keyframe structure is preserved' },
  copy_audio_bitrate:    { message: '-b:a is ignored when audio codec is Copy — the original audio bitrate is preserved' },

  // Channel / layout consistency
  channels_layout_mismatch: {
    message: ({ s }) => `Channel count ${s.channels} and channel layout "${s.channelLayout}" are inconsistent (layout expects ${CHANNEL_LAYOUT_CHANNELS[s.channelLayout]} channels) — FFmpeg will error or produce silence`,
  },
  ac3_mono:              { message: 'Mono AC3/EAC3 is technically valid but extremely uncommon — most decoders expect 2ch or 5.1. Verify receiver compatibility' },

  // Input flags consistency
  capture_stream_loop:   { message: 'A capture device cannot be looped — -stream_loop has no meaning on a hardware input' },
  nobuffer_file_input:   { message: '+nobuffer is designed for real-time streams — on file input it may cause read stalls and timing issues' },
  reconnect_streamed_no_reconnect: { message: '-reconnect_streamed has no effect without -reconnect enabled first' },

  // HW accel output format
  hwaccel_output_fmt_no_hwaccel:  { message: '-hwaccel_output_format requires -hwaccel to be set — frames cannot stay on the GPU without a hardware decoder' },
  hwaccel_output_fmt_mismatch: {
    message: ({ s }) => `-hwaccel_output_format "${s.hwaccelOutputFormat}" does not match -hwaccel "${s.hwaccel}" — decoded frames will be silently downloaded to system RAM and re-uploaded, negating the GPU pipeline`,
  },
  nvenc_cuda_missing_output_fmt: {
    message: ({ s }) => {
      const isCpuFilter = (v) => v && !v.endsWith('_cuda') && !v.endsWith('_vaapi') && !v.endsWith('_qsv')
      const hasCpuDeinterlace = isCpuFilter(s.deinterlaceFilter)
      const hasCpuScale = isCpuFilter(s.scaleFilter)
      if (hasCpuDeinterlace || hasCpuScale) {
        const filters = []
        if (hasCpuDeinterlace) filters.push(s.deinterlaceFilter)
        if (hasCpuScale) filters.push(s.scaleFilter)
        const names = filters.join(', ')
        const gpuAlts = filters.map(f => f + '_cuda').join(', ')
        return `The RAM round-trip between -hwaccel cuda and NVENC is expected here — the CPU filter "${names}" requires frames in system memory. This pipeline is valid. To keep frames on the GPU throughout, switch Deinterlace to "${gpuAlts}" and set HW Accel Output Format to cuda`
      }
      return 'NVENC with -hwaccel cuda but without -hwaccel_output_format cuda — decoded frames will pass through system RAM before re-upload to GPU. Set HW Accel Output Format to cuda to keep the full decode→encode pipeline on the GPU'
    },
  },

  // GPU index
  gpu_index_non_nvenc: {
    message: ({ s }) => `-gpu ${s.gpuIndex} only affects NVENC/NVDEC — it has no effect on ${s.videoCodec ?? 'the selected codec'}. Use -init_hw_device or -filter_hw_device for VAAPI/QSV device selection`,
  },
  gpu_index_no_hwaccel: {
    message: ({ s }) => `-gpu ${s.gpuIndex} selects the NVENC encode device but -hwaccel is not set — the decoder will still use CPU. Add -hwaccel cuda to route the full pipeline through GPU ${s.gpuIndex}`,
  },

  // Listen mode
  listen_non_streaming_format: {
    message: ({ s }) => `-listen 1 (TCP server mode) is primarily used with MPEG-TS or FLV output — "${s.outputFormat}" over a raw TCP socket is uncommon and may not be usable by standard players`,
  },
  listen_zero_redundant: { message: '-listen 0 is the default (client mode) — this flag is redundant and can be removed' },

  // CUDA / VAAPI filter requirements
  yadif_cuda_no_hwaccel:  { message: 'yadif_cuda requires the decode pipeline on CUDA — set HW Accel to "cuda" and HW Accel Output to "cuda", otherwise FFmpeg cannot pass GPU frames to this filter' },
  bwdif_cuda_no_hwaccel:  { message: 'bwdif_cuda requires the decode pipeline on CUDA — set HW Accel to "cuda" and HW Accel Output to "cuda", otherwise FFmpeg cannot pass GPU frames to this filter' },
  scale_cuda_no_hwaccel:  { message: 'scale_cuda requires the decode pipeline on CUDA — set HW Accel to "cuda" and HW Accel Output to "cuda", otherwise the filter will receive CPU frames and FFmpeg will error' },
  cpu_deinterlace_with_hwaccel_output: {
    message: ({ s }) => `CPU deinterlace filter "${s.deinterlaceFilter}" cannot process GPU frames — HW Accel Output is set to "${s.hwaccelOutputFormat}", which keeps decoded frames on the GPU. Either switch Deinterlace to "${s.deinterlaceFilter}_cuda" (GPU filter) or set HW Accel Output to "— None —" to route frames through system RAM`,
  },
  cuda_filter_no_output_fmt: {
    message: ({ s }) => `Using CUDA filter "${s.deinterlaceFilter || s.scaleFilter}" with HW Accel "cuda" but HW Accel Output is not set to "cuda" — decoded frames will move to RAM before the filter. Set HW Accel Output to "cuda" to keep frames on GPU throughout the pipeline`,
  },
  cuda_filter_cpu_encoder: {
    message: ({ s }) => `Using a CUDA filter with CPU encoder ${s.videoCodec} — GPU frames will be downloaded to RAM for encoding. This negates the GPU pipeline benefit; switch to h264_nvenc or hevc_nvenc, or use CPU-based filters (yadif, scale) instead`,
  },
  vaapi_filter_no_hwaccel: { message: 'scale_vaapi requires -hwaccel vaapi — without it FFmpeg cannot pass GPU surfaces to the filter and will error' },
  vaapi_cpu_deinterlace: {
    message: ({ s }) => `CPU deinterlace filter "${s.deinterlaceFilter}" with VAAPI encoder — frames will be downloaded to RAM for filtering, then re-uploaded to GPU for encoding. This works but adds latency. For a full GPU pipeline, use "deinterlace_vaapi" filter and set HW Accel Output to "vaapi"`,
  },

  // H.264 level vs resolution/fps
  h264_level_exceeded: {
    message: ({ s }) => {
      const sizeStr = s.frameSize === 'custom' ? s.customFrameSize : s.frameSize
      const fpsStr = s.fps === 'custom' ? s.customFps : s.fps
      const limits = LEVEL_LIMITS[s.level]
      return `Resolution ${sizeStr} @ ${fpsStr ?? '?'}fps exceeds H.264 Level ${s.level} limits (${limits.w}×${limits.h} @ ${limits.fps}fps max) — encoder will fail or produce non-compliant output`
    },
  },

  // Pixel format / codec constraints
  vaapi_10bit_pixfmt: {
    message: ({ s }) => `VAAPI encoder only supports nv12 (8-bit) and p010le (10-bit) pixel formats — ${s.pixFmt} is not a valid VAAPI surface format`,
  },
  nvenc_nv12_required: {
    message: ({ s }) => `NVENC natively supports nv12/p010le/yuv444p — ${s.pixFmt} will require an implicit conversion that may reduce performance`,
  },
  hevc_baseline_profile: { message: 'HEVC does not have a "baseline" profile — use "main" or "main10" instead' },
  mpeg2_crf:             { message: 'MPEG-2 does not support CRF rate control — use CBR or VBR instead' },
  disabled_video_with_settings: { message: 'Video encoding settings have no effect when video is disabled — clean up unused parameters' },
  disabled_audio_with_settings: { message: 'Audio encoding settings have no effect when audio is disabled — clean up unused parameters' },
  no_media_streams:      { message: 'Both video and audio are disabled — the output will contain no media streams and cannot be played' },
  mpegts_no_audio:       { message: 'Audio is disabled (-an) on an MPEG-TS output — the stream will have no audio track, which may cause player issues or operator confusion. Verify this is intentional' },
  image2_not_streaming:  { message: 'image2 format is not a streaming output — it writes individual image files. If this is a thumbnail extraction job, this warning can be ignored' },

  // Broadcast semantic rules (Layer 3)
  sc_threshold_cbr:      { message: 'Scene-change keyframes break CBR predictability — set -sc_threshold 0 for broadcast' },
  gop_not_aligned:       { message: 'GOP is not a whole-second multiple of frame rate — may cause IPTV middleware and ABR alignment issues' },
  gop_too_large:         { message: 'GOP longer than 10 seconds increases zap time and reduces error recovery after packet loss' },
  high_bframes_stb:      { message: 'B-frame count above 2 may exceed hardware decoder limits on DVB STBs' },
  high_refs_stb:         { message: 'Reference frame count above 4 may exceed decoder memory on DVB STBs' },
  non420_stb:            { message: 'Most IPTV STBs only decode yuv420p — verify receiver compatibility before using 4:2:2 or 4:4:4' },
  broadcast_sample_rate: { message: '48 kHz is the DVB broadcast standard — 44.1 kHz may cause issues on STBs' },
  bitrate_too_low:       { message: 'Target bitrate appears too low for this resolution — expect visible blocking artifacts' },
  stream_loop_no_re:     { message: 'File loop without -re will consume the file faster than real-time, flooding the output' },
  stream_loop_finite: {
    message: ({ s }) => `-stream_loop ${s.streamLoop} will repeat the file ${s.streamLoop} time(s) and then stop. Use -stream_loop -1 for continuous broadcast playout`,
  },
  re_on_live_input:      { message: '-re has no meaningful effect on live network inputs and may cause stream drift' },
  loudnorm_wrong_rate:   { message: 'EBU R128 loudness measurement is defined at 48 kHz — resample to 48000 before applying loudnorm' },
  no_fault_tolerance_live: { message: 'No fault tolerance flags set for a live input — consider -timeout and -thread_queue_size for unattended operation' },
  file_input_no_re:      { message: 'File input without -re will be read faster than real-time, flooding the output buffer — enable -re for broadcast playout' },
  wallclock_non_capture: { message: '-use_wallclock_as_timestamps is intended for capture devices with corrupt DTS/PTS — may distort timing on other input types' },
  max_delay_non_udp_rtp: { message: '-max_delay is primarily effective on UDP/RTP inputs for jitter buffering — has limited effect on other input types' },
  keyint_min_gt_gop:     { message: '-keyint_min cannot be greater than GOP size (-g) — this will cause encoder errors' },
  cbr_keyint_min_not_gop: { message: 'For strict CBR broadcast set -keyint_min equal to GOP size to prevent scene-change keyframes breaking bitrate predictability' },

  // HLS / GOP segment alignment
  hls_gop_segment_mismatch: {
    message: ({ s }) => {
      const fps = parseFps(s.fps === 'custom' ? s.customFps : s.fps)
      const gopSec = (s.gop / fps).toFixed(2)
      return `HLS segment duration (${s.hlsTime}s) is not a whole multiple of GOP duration (${gopSec}s) — segments will not start on keyframes, causing playback glitches in ABR players`
    },
  },

  // CBR bufsize
  cbr_bufsize_missing:   { message: 'CBR mode without -bufsize has no HRD buffer constraint — set -bufsize to 1×–2× target bitrate for broadcast compliance' },
  cbr_bufsize_ratio: {
    message: ({ s }) => {
      const buf = parseBitrate(s.bufsize)
      const br  = parseBitrate(s.targetBitrate)
      const ratio = (buf / br).toFixed(1)
      return `CBR bufsize/bitrate ratio is ${ratio}× — broadcast recommendation is 1.5×–3×. Too low risks encoder undershooting, too high relaxes HRD constraints`
    },
  },

  // SRT fault tolerance
  srt_fault_tolerance:   { message: 'SRT input without -timeout or -reconnect — consider adding fault tolerance for unattended operation' },

  // MPEG-2 resolution advisory
  mpeg2_high_res:        { message: 'MPEG-2 at resolutions above SD (720×576) produces poor quality-per-bit and is not common in broadcast — consider H.264 for HD content' },

  // Audio bitrate floor
  audio_bitrate_too_low: {
    message: ({ s }) => {
      const ch = s.channels && s.channels !== 'original' ? s.channels : '2'
      const floor = AUDIO_BITRATE_FLOOR[`${s.audioCodec}_${ch}`]
      return `Audio bitrate ${s.audioBitrate} appears too low for ${s.audioCodec} with ${ch} channel(s) — minimum recommended: ${floor >= 1000 ? (floor / 1000) + 'k' : floor}`
    },
  },

  // Forced IDR advisory
  forced_idr_non_nvenc: {
    message: ({ s }) => `-forced-idr is an NVENC-only option — ${s.videoCodec} does not support it and FFmpeg will reject the flag. Disable Force IDR or switch to an NVENC encoder (h264_nvenc / hevc_nvenc)`,
  },
  forced_idr_crf:        { message: '-forced-idr forces IDR frames at every keyframe — in CRF mode this may cause periodic bitrate spikes at each keyframe' },

  // Probe / analyze duration advisories
  high_analyzeduration_live: {
    message: ({ s }) => `analyzeduration ${(s.analyzeDuration / 1_000_000).toFixed(0)} s on a live input will delay stream startup by that duration — live sources rarely need more than 5–10 s`,
  },
  probesize_without_analyzeduration: { message: '-probesize is set but -analyzeduration is not — both usually need to be raised together for reliable detection of complex or delayed streams' },
  analyzeduration_without_probesize: { message: '-analyzeduration is set but -probesize is not — both usually need to be raised together. If probe data is exhausted before the duration expires, detection will still fail' },

  // H.264 high-chroma profile advisory
  h264_high_profile_missing: {
    message: ({ s }) => {
      const need = s.pixFmt === 'yuv422p' ? 'high422' : 'high444/high444p'
      return `Pixel format ${s.pixFmt} requires -profile:v ${need} — without it, FFmpeg will silently downconvert to yuv420p`
    },
  },

  // CBR maxrate advisory
  cbr_no_maxrate:        { message: 'For strict CBR compliance, set -maxrate equal to -b:v to enforce a constant bitrate ceiling. Without it, the encoder may overshoot in complex scenes' },

  // HLS encryption advisory
  hls_enc_fmp4:          { message: 'HLS encryption with mpegts segments uses AES-128 — fMP4 segments support SAMPLE-AES/CBCS which is more efficient and required by some DRM systems' },

  // -s vs -vf scale= conflict
  s_and_vf_scale_diff: {
    message: ({ s }) => {
      const sfs = (() => {
        if (!s.frameSize || s.frameSize === 'original') return null
        const raw = s.frameSize === 'custom' ? s.customFrameSize : s.frameSize
        if (!raw) return null
        const m = String(raw).match(/^(\d+)[x-](\d+)$/)
        return m ? { w: m[1], h: m[2] } : null
      })()
      const vfs = getScaleSize(s.vfAtoms)
      return `-s ${sfs.w}x${sfs.h} conflicts with -vf scale=${vfs.w}:${vfs.h} — only one will take effect (the filter chain wins). Pick one.`
    },
  },
  s_and_vf_scale_redundant: { message: 'Both -s and -vf scale= specify the same size — redundant. Prefer using only -vf scale=W:H' },
  s_and_vf_scale_present:   { message: '-s and -vf scale= are both set — the filter chain wins and -s is ignored. Keep only one to avoid confusion' },

  // Scale filter no-op
  vf_scale_noop:           { message: 'scale filter resolves to input dimensions (no-op) — it can be removed' },

  // Prefer hardware scaler
  prefer_vf_scale_with_hwaccel: {
    message: ({ s }) => {
      const map = { cuda: 'scale_cuda', vaapi: 'scale_vaapi', qsv: 'scale_qsv' }
      const suggested = map[s.hwaccel] || `scale_${s.hwaccel}`
      return `Using -s with -hwaccel ${s.hwaccel} forces a CPU rescale (frames are downloaded from GPU). Prefer -vf ${suggested}=W:H to keep the frame on the GPU`
    },
  },

  // ── validate-raw: Structural checks ──────────────────────────────────────

  raw_empty:                 { message: 'Command is empty.' },
  raw_missing_dash:          { message: ({ flag }) => `"${flag}" looks like a flag missing its dash — did you mean "-${flag}"?` },
  raw_duplicate_same:        { message: ({ flag }) => `${flag} appears more than once with the same value — redundant` },
  raw_duplicate_diff:        { message: ({ flag }) => `${flag} appears twice with different values — only the last value is used` },
  raw_flag_before_input:     { message: ({ flag }) => `${flag} is an output/encoding flag but appears before -i — it should be placed after the input` },
  raw_flag_after_input:      { message: ({ flag }) => `${flag} is an input flag but appears after -i — it should be placed before the input` },
  raw_flag_after_output:     { message: ({ flag }) => `${flag} appears after the output target — options after output are not applied by FFmpeg` },
  raw_missing_value_eof:     { message: ({ flag }) => `${flag} at end of command is missing its value` },
  raw_missing_value_next:    { message: ({ flag, next }) => `${flag} is followed by ${next} — the value for ${flag} appears to be missing` },
  raw_no_input:              { message: 'No -i (input) flag found — FFmpeg requires at least one input' },
  raw_no_output:             { message: 'No output file/URL specified' },
  raw_format_ext_mismatch:   { message: ({ fmt, ext, expected }) => `-f ${fmt} but output file extension is "${ext}" — expected ${expected}` },
  raw_vn_cv_conflict:        { message: '-vn and -c:v are both present.' },
  raw_an_ca_conflict:        { message: '-an and -c:a are both present.' },
  raw_crf_bv_conflict:       { message: '-crf and -b:v should not both be present.' },
  raw_multi_input_no_map:    { message: 'Multiple inputs without -map — FFmpeg will auto-select streams, which may not be what you want' },
  raw_pipe_input:            { message: 'Pipe input detected (-i - / pipe:0) — ensure the feeding process writes a supported container format' },
  raw_pipe_output:           { message: 'Pipe output detected (- / pipe:1) — ensure the receiving process can consume the output format' },
  raw_unknown_flags:         { message: ({ flags }) => `Unrecognized flag(s): ${flags}` },

  // ── serialize: Hints ─────────────────────────────────────────────────────

  serialize_flag_moved:      { message: ({ flag }) => `${flag} moved before -i (required by FFmpeg)` },
  serialize_unknown_flag:    { message: ({ flag }) => `${flag} is not recognized by fflint and was not validated` },
}
