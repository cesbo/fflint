// fflint_test.mjs  –  Run fflint against 10+ valid and 10+ invalid ffmpeg command
// profiles, then print a structured report.
// Usage:  node fflint_test.mjs

import { validate } from '../fflint/fflint.js'

// ── Helpers ────────────────────────────────────────────────────────────────

const BOLD   = s => `\x1b[1m${s}\x1b[0m`
const GREEN  = s => `\x1b[32m${s}\x1b[0m`
const YELLOW = s => `\x1b[33m${s}\x1b[0m`
const RED    = s => `\x1b[31m${s}\x1b[0m`
const CYAN   = s => `\x1b[36m${s}\x1b[0m`
const GRAY   = s => `\x1b[90m${s}\x1b[0m`

function severityColor(sev) {
  if (sev === 'error')   return RED(sev.toUpperCase())
  if (sev === 'warning') return YELLOW(sev.toUpperCase())
  return GRAY(sev.toUpperCase())
}

function printResults(label, state, sectionTag) {
  const results = validate(state, { broadcastRules: true })
  const errors   = results.filter(r => r.severity === 'error')
  const warnings = results.filter(r => r.severity === 'warning')
  const infos    = results.filter(r => r.severity === 'info')

  const badge = sectionTag === 'VALID'
    ? GREEN('✓ VALID')
    : RED('✗ INVALID')

  console.log()
  console.log(BOLD(`[${badge}]  ${label}`))

  if (results.length === 0) {
    console.log(GREEN('  → No issues found. fflint is happy. ✅'))
    return
  }

  for (const r of results) {
    const flag = r.flag ? CYAN(` (${r.flag})`) : ''
    console.log(`  ${severityColor(r.severity)} [${GRAY('L' + r.layer)}]${flag}  ${r.message}`)
  }

  if (sectionTag === 'VALID' && errors.length > 0)
    console.log(RED(`  ⚠  UNEXPECTED: ${errors.length} ERROR(s) on a supposedly-valid command!`))
  if (sectionTag === 'INVALID' && errors.length === 0 && warnings.length === 0)
    console.log(YELLOW(`  ⚠  MISSED: fflint produced no error/warning for a deliberately bad command!`))
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SECTION A – 10 VALID / COMMON FFMPEG COMMAND PROFILES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

console.log()
console.log(BOLD('═══════════════════════════════════════════════════════════════'))
console.log(BOLD('  SECTION A — VALID / COMMON FFMPEG COMMANDS'))
console.log(BOLD('═══════════════════════════════════════════════════════════════'))
console.log(GRAY('  Equivalent shell command shown as a comment above each test.'))

// A1 ─────────────────────────────────────────────────────────────────────────
// ffmpeg -i udp://239.0.0.1:1234 -c:v libx264 -preset medium -b:v 4000k
//        -maxrate 4000k -bufsize 8000k -c:a aac -b:a 128k
//        -f mpegts udp://239.255.0.1:5000
printResults(
  'A1 · libx264 CBR → MPEG-TS (UDP in, UDP out)',
  {
    inputType:     'udp',
    videoCodec:    'libx264',
    preset:        'medium',
    bitrateMode:   'cbr',
    targetBitrate: '4000k',
    maxrate:       '4000k',
    bufsize:       '8000k',
    fps:           '25',
    frameSize:     '1920x1080',
    gop:           50,
    scThreshold:   0,
    keyintMin:     50,
    audioCodec:    'aac',
    audioBitrate:  '128k',
    sampleRate:    '48000',
    channels:      '2',
    outputFormat:  'mpegts',
    threadQueueSize: 1024,
    timeout:       5000000,
  },
  'VALID'
)

// A2 ─────────────────────────────────────────────────────────────────────────
// ffmpeg -i udp://239.0.0.1:1234 -c:v copy -c:a copy -f mpegts udp://out:5000
printResults(
  'A2 · Stream copy (video + audio) → MPEG-TS',
  {
    inputType:    'udp',
    videoCodec:   'copy',
    audioCodec:   'copy',
    outputFormat: 'mpegts',
    timeout:      5000000,
  },
  'VALID'
)

// A3 ─────────────────────────────────────────────────────────────────────────
// ffmpeg -hwaccel cuda -hwaccel_output_format cuda -i udp://239.0.0.1:1234
//        -c:v h264_nvenc -preset p4 -b:v 5000k -maxrate 5000k -bufsize 10000k
//        -c:a aac -f mpegts udp://out:5000
printResults(
  'A3 · NVENC H.264 CBR → MPEG-TS (full CUDA pipeline)',
  {
    inputType:          'udp',
    hwaccel:            'cuda',
    hwaccelOutputFormat:'cuda',
    videoCodec:         'h264_nvenc',
    preset:             'p4',
    bitrateMode:        'cbr',
    targetBitrate:      '5000k',
    maxrate:            '5000k',
    bufsize:            '10000k',
    fps:                '25',
    frameSize:          '1920x1080',
    gop:                50,
    scThreshold:        0,
    audioCodec:         'aac',
    audioBitrate:       '128k',
    sampleRate:         '48000',
    channels:           '2',
    outputFormat:       'mpegts',
    threadQueueSize:    1024,
    timeout:            5000000,
  },
  'VALID'
)

// A4 ─────────────────────────────────────────────────────────────────────────
// ffmpeg -re -i input.mp4 -c:v libx264 -preset fast -b:v 3000k
//        -maxrate 3000k -bufsize 6000k -c:a aac -hls_time 6 -hls_list_size 5
//        -hls_segment_type mpegts -f hls playlist.m3u8
printResults(
  'A4 · libx264 CBR → HLS (file input, 6s segments)',
  {
    inputType:      'file',
    re:             true,
    videoCodec:     'libx264',
    preset:         'fast',
    bitrateMode:    'cbr',
    targetBitrate:  '3000k',
    maxrate:        '3000k',
    bufsize:        '6000k',
    fps:            '25',
    frameSize:      '1280x720',
    gop:            50,
    scThreshold:    0,
    audioCodec:     'aac',
    audioBitrate:   '128k',
    sampleRate:     '48000',
    channels:       '2',
    outputFormat:   'hls',
    hlsTime:        6,
    hlsListSize:    5,
    hlsSegmentType: 'mpegts',
  },
  'VALID'
)

// A5 ─────────────────────────────────────────────────────────────────────────
// ffmpeg -i udp://... -c:v mpeg2video -b:v 5000k -maxrate 5000k -bufsize 10000k
//        -s 720x576 -r 25 -c:a mp2 -ar 48000 -f mpegts udp://out:5000
printResults(
  'A5 · MPEG-2 + MP2 → MPEG-TS (broadcast SD)',
  {
    inputType:     'udp',
    videoCodec:    'mpeg2video',
    bitrateMode:   'cbr',
    targetBitrate: '5000k',
    maxrate:       '5000k',
    bufsize:       '10000k',
    frameSize:     '720x576',
    fps:           '25',
    gop:           50,
    audioCodec:    'mp2',
    audioBitrate:  '256k',
    sampleRate:    '48000',
    channels:      '2',
    outputFormat:  'mpegts',
    timeout:       5000000,
    threadQueueSize: 1024,
  },
  'VALID'
)

// A6 ─────────────────────────────────────────────────────────────────────────
// ffmpeg -re -i input.mkv -c:v libx265 -preset medium -crf 23
//        -c:a aac -f matroska output.mkv
printResults(
  'A6 · libx265 CRF → Matroska (VOD file encode)',
  {
    inputType:    'file',
    re:           true,
    videoCodec:   'libx265',
    preset:       'medium',
    bitrateMode:  'crf',
    crfValue:     23,
    audioCodec:   'aac',
    audioBitrate: '128k',
    sampleRate:   '48000',
    channels:     '2',
    outputFormat: 'matroska',
  },
  'VALID'
)

// A7 ─────────────────────────────────────────────────────────────────────────
// ffmpeg -hwaccel cuda -hwaccel_output_format cuda
//        -i udp://... -c:v h264_nvenc -preset hq
//        -b:v 4000k -maxrate 8000k -bufsize 16000k
//        -c:a aac -f mpegts udp://out:5000
printResults(
  'A7 · NVENC H.264 VBR → MPEG-TS',
  {
    inputType:          'udp',
    hwaccel:            'cuda',
    hwaccelOutputFormat:'cuda',
    videoCodec:         'h264_nvenc',
    preset:             'hq',
    bitrateMode:        'vbr',
    targetBitrate:      '4000k',
    maxrate:            '8000k',
    bufsize:            '16000k',
    fps:                '25',
    frameSize:          '1920x1080',
    gop:                50,
    scThreshold:        0,
    audioCodec:         'aac',
    audioBitrate:       '128k',
    sampleRate:         '48000',
    channels:           '2',
    outputFormat:       'mpegts',
    threadQueueSize:    1024,
    timeout:            5000000,
  },
  'VALID'
)

// A8 ─────────────────────────────────────────────────────────────────────────
// ffmpeg -i rtmp://live.example.com/live/key -c:v copy -c:a copy -f flv rtmp://out
printResults(
  'A8 · Stream copy → FLV/RTMP (restream)',
  {
    inputType:    'rtmp',
    videoCodec:   'copy',
    audioCodec:   'copy',
    outputFormat: 'flv',
    timeout:      5000000,
  },
  'VALID'
)

// A9 ─────────────────────────────────────────────────────────────────────────
// ffmpeg -i srt://... -c:v libx264 -preset medium -b:v 4000k
//        -maxrate 4000k -bufsize 8000k -vf yadif=mode=0 -r 25
//        -c:a aac -ar 48000 -f mpegts udp://out:5000
printResults(
  'A9 · libx264 CBR + yadif deinterlace → MPEG-TS',
  {
    inputType:        'srt',
    videoCodec:       'libx264',
    preset:           'medium',
    bitrateMode:      'cbr',
    targetBitrate:    '4000k',
    maxrate:          '4000k',
    bufsize:          '8000k',
    fps:              '25',
    frameSize:        '1920x1080',
    gop:              50,
    scThreshold:      0,
    deinterlaceFilter:'yadif',
    audioCodec:       'aac',
    audioBitrate:     '128k',
    sampleRate:       '48000',
    channels:         '2',
    outputFormat:     'mpegts',
    threadQueueSize:  1024,
    timeout:          5000000,
    reconnect:        true,
  },
  'VALID'
)

// A10 ────────────────────────────────────────────────────────────────────────
// ffmpeg -hwaccel vaapi -i udp://...
//        -c:v h264_vaapi -b:v 4000k -maxrate 4000k -bufsize 8000k
//        -c:a aac -ar 48000 -f mpegts udp://out:5000
printResults(
  'A10 · h264_vaapi CBR → MPEG-TS',
  {
    inputType:     'udp',
    hwaccel:       'vaapi',
    videoCodec:    'h264_vaapi',
    bitrateMode:   'cbr',
    targetBitrate: '4000k',
    maxrate:       '4000k',
    bufsize:       '8000k',
    fps:           '25',
    frameSize:     '1920x1080',
    gop:           50,
    scThreshold:   0,
    audioCodec:    'aac',
    audioBitrate:  '128k',
    sampleRate:    '48000',
    channels:      '2',
    outputFormat:  'mpegts',
    timeout:       5000000,
    threadQueueSize: 1024,
  },
  'VALID'
)

// A11 ────────────────────────────────────────────────────────────────────────
// ffmpeg -re -stream_loop -1 -i clip.ts -c:v libx264 -preset fast -b:v 3000k
//        -maxrate 3000k -bufsize 6000k -c:a aac -f mpegts udp://out:5000
printResults(
  'A11 · File loop broadcast with -re (continuous playout)',
  {
    inputType:     'file',
    re:            true,
    streamLoop:    -1,
    videoCodec:    'libx264',
    preset:        'fast',
    bitrateMode:   'cbr',
    targetBitrate: '3000k',
    maxrate:       '3000k',
    bufsize:       '6000k',
    fps:           '25',
    frameSize:     '1280x720',
    gop:           50,
    scThreshold:   0,
    audioCodec:    'aac',
    audioBitrate:  '128k',
    sampleRate:    '48000',
    channels:      '2',
    outputFormat:  'mpegts',
  },
  'VALID'
)

// A12 ────────────────────────────────────────────────────────────────────────
// ffmpeg -i srt://... -c:v libx265 -preset fast
//        -b:v 6000k -maxrate 6000k -bufsize 12000k
//        -c:a aac -hls_time 4 -hls_list_size 6 -hls_segment_type fmp4 -f hls out.m3u8
printResults(
  'A12 · libx265 → HLS fMP4 (HEVC web streaming)',
  {
    inputType:      'srt',
    videoCodec:     'libx265',
    preset:         'fast',
    bitrateMode:    'cbr',
    targetBitrate:  '6000k',
    maxrate:        '6000k',
    bufsize:        '12000k',
    fps:            '25',
    frameSize:      '1920x1080',
    gop:            100,
    scThreshold:    0,
    audioCodec:     'aac',
    audioBitrate:   '128k',
    sampleRate:     '48000',
    channels:       '2',
    outputFormat:   'hls',
    hlsTime:        4,
    hlsListSize:    6,
    hlsSegmentType: 'fmp4',
    timeout:        5000000,
    reconnect:      true,
  },
  'VALID'
)


// A13 ────────────────────────────────────────────────────────────────────────
// ffmpeg -i udp://... -c:v h264_nvenc -f mpegts udp://out:5000
// Simulates a "starting profile": user picked NVENC codec but hwaccel, preset,
// bitrate etc. are not entered yet. fflint must not fire false positives.
printResults(
  'A13 · Starting profile — h264_nvenc selected, hwaccel not set yet (partial state)',
  {
    inputType:    'udp',
    videoCodec:   'h264_nvenc',
    outputFormat: 'mpegts',
  },
  'VALID'
)

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SECTION B – 12 DELIBERATELY INVALID FFMPEG COMMAND PROFILES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

console.log()
console.log(BOLD('═══════════════════════════════════════════════════════════════'))
console.log(BOLD('  SECTION B — DELIBERATELY INVALID / BROKEN COMMANDS'))
console.log(BOLD('═══════════════════════════════════════════════════════════════'))

// B1 ─────────────────────────────────────────────────────────────────────────
// BUG: -crf AND -b:v set at the same time — mutually exclusive
printResults(
  'B1 · CRF + target bitrate set simultaneously (conflict)',
  {
    inputType:     'udp',
    videoCodec:    'libx264',
    bitrateMode:   'crf',
    crfValue:      23,
    targetBitrate: '4000k',   // ← WRONG: CRF and bitrate are mutually exclusive
    audioCodec:    'aac',
    outputFormat:  'mpegts',
  },
  'INVALID'
)

// B2 ─────────────────────────────────────────────────────────────────────────
// BUG: h264_nvenc with a libx264 CPU preset ("medium")
printResults(
  'B2 · NVENC codec with CPU preset "medium" (wrong preset family)',
  {
    inputType:     'udp',
    hwaccel:       'cuda',
    videoCodec:    'h264_nvenc',
    preset:        'medium',  // ← WRONG: CPU preset, not NVENC (p1-p7, hq, etc.)
    bitrateMode:   'cbr',
    targetBitrate: '4000k',
    maxrate:       '4000k',
    bufsize:       '8000k',
    audioCodec:    'aac',
    outputFormat:  'mpegts',
  },
  'INVALID'
)

// B3 ─────────────────────────────────────────────────────────────────────────
// BUG: -c:v copy combined with -vf yadif (filter on copy stream)
printResults(
  'B3 · Video copy + deinterlace filter (filter on copied stream)',
  {
    inputType:         'udp',
    videoCodec:        'copy',
    deinterlaceFilter: 'yadif',  // ← WRONG: can't filter a copy stream
    audioCodec:        'copy',
    outputFormat:      'mpegts',
  },
  'INVALID'
)

// B4 ─────────────────────────────────────────────────────────────────────────
// BUG: HEVC video in FLV container (FLV only supports H.264)
printResults(
  'B4 · HEVC (libx265) output in FLV container (incompatible)',
  {
    inputType:     'rtmp',
    videoCodec:    'libx265',  // ← WRONG: FLV doesn't support HEVC
    preset:        'fast',
    bitrateMode:   'cbr',
    targetBitrate: '4000k',
    maxrate:       '4000k',
    bufsize:       '8000k',
    audioCodec:    'aac',
    outputFormat:  'flv',      // ← incompatible with HEVC
  },
  'INVALID'
)

// B5 ─────────────────────────────────────────────────────────────────────────
// BUG: libopus audio into MPEG-TS (not muxable)
printResults(
  'B5 · Opus audio → MPEG-TS (opus cannot be muxed into MPEG-TS)',
  {
    inputType:    'udp',
    videoCodec:   'libx264',
    preset:       'fast',
    bitrateMode:  'cbr',
    targetBitrate:'3000k',
    maxrate:      '3000k',
    bufsize:      '6000k',
    audioCodec:   'libopus',  // ← WRONG: invalid for MPEG-TS
    audioBitrate: '128k',
    outputFormat: 'mpegts',
  },
  'INVALID'
)

// B6 ─────────────────────────────────────────────────────────────────────────
// BUG: MPEG-2 with CRF rate control (MPEG-2 has no CRF support)
printResults(
  'B6 · MPEG-2 video with CRF rate control (unsupported combination)',
  {
    inputType:    'udp',
    videoCodec:   'mpeg2video',
    bitrateMode:  'crf',     // ← WRONG: MPEG-2 doesn't support CRF
    crfValue:     20,
    audioCodec:   'mp2',
    outputFormat: 'mpegts',
  },
  'INVALID'
)

// B7 ─────────────────────────────────────────────────────────────────────────
// BUG: -maxrate lower than -b:v (HRD violation)
printResults(
  'B7 · maxrate (2000k) below target bitrate (5000k) — HRD violation',
  {
    inputType:     'udp',
    videoCodec:    'libx264',
    preset:        'medium',
    bitrateMode:   'cbr',
    targetBitrate: '5000k',
    maxrate:       '2000k',  // ← WRONG: maxrate must be >= bitrate
    bufsize:       '10000k',
    audioCodec:    'aac',
    outputFormat:  'mpegts',
  },
  'INVALID'
)

// B8 ─────────────────────────────────────────────────────────────────────────
// BUG: HDR10 (PQ transfer) with 8-bit pixel format
printResults(
  'B8 · HDR10 PQ transfer function with 8-bit yuv420p (wrong bit depth)',
  {
    inputType:    'udp',
    videoCodec:   'libx265',
    preset:       'medium',
    bitrateMode:  'cbr',
    targetBitrate:'8000k',
    maxrate:      '8000k',
    bufsize:      '16000k',
    colorTrc:     'smpte2084',   // ← HDR10 PQ
    pixFmt:       'yuv420p',     // ← WRONG: needs yuv420p10le
    colorPrimaries:'bt2020',
    colorspace:   'bt2020nc',
    audioCodec:   'aac',
    outputFormat: 'mpegts',
  },
  'INVALID'
)

// B9 ─────────────────────────────────────────────────────────────────────────
// BUG: h264_nvenc with no -hwaccel (no GPU decode pipeline)
printResults(
  'B9 · h264_nvenc encoder without -hwaccel (CPU decode, no GPU pipeline)',
  {
    inputType:     'udp',
    videoCodec:    'h264_nvenc',
    hwaccel:       'none',      // ← WRONG: should be 'cuda' for GPU pipeline
    preset:        'p4',
    bitrateMode:   'cbr',
    targetBitrate: '4000k',
    maxrate:       '4000k',
    bufsize:       '8000k',
    audioCodec:    'aac',
    outputFormat:  'mpegts',
  },
  'INVALID'
)

// B10 ────────────────────────────────────────────────────────────────────────
// BUG: -c:v copy + -s 1280x720 (scale on copy stream)
printResults(
  'B10 · Video copy + frame size change (cannot rescale a copied stream)',
  {
    inputType:    'udp',
    videoCodec:   'copy',
    frameSize:    '1280x720',  // ← WRONG: can't rescale when codec = copy
    audioCodec:   'copy',
    outputFormat: 'mpegts',
  },
  'INVALID'
)

// B11 ────────────────────────────────────────────────────────────────────────
// BUG: H.264 Level 3.1 with 1080p resolution (level too low)
printResults(
  'B11 · H.264 Level 3.1 with 1920×1080 @ 25fps (level too low)',
  {
    inputType:     'udp',
    videoCodec:    'libx264',
    preset:        'medium',
    profile:       'high',
    level:         '3.1',         // ← WRONG: 3.1 max is 1280×720 @ 30fps
    bitrateMode:   'cbr',
    targetBitrate: '4000k',
    maxrate:       '4000k',
    bufsize:       '8000k',
    fps:           '25',
    frameSize:     '1920x1080',   // ← too large for level 3.1
    gop:           50,
    audioCodec:    'aac',
    outputFormat:  'mpegts',
  },
  'INVALID'
)

// B12 ────────────────────────────────────────────────────────────────────────
// BUG: MP2 audio in HLS (HLS requires AAC per Apple mandate)
printResults(
  'B12 · MP2 audio → HLS output (HLS requires AAC, not MP2)',
  {
    inputType:      'file',
    re:             true,
    videoCodec:     'libx264',
    preset:         'fast',
    bitrateMode:    'cbr',
    targetBitrate:  '3000k',
    maxrate:        '3000k',
    bufsize:        '6000k',
    audioCodec:     'mp2',      // ← WRONG: HLS requires AAC
    audioBitrate:   '192k',
    sampleRate:     '48000',
    channels:       '2',
    outputFormat:   'hls',
    hlsTime:        6,
    hlsListSize:    5,
    hlsSegmentType: 'mpegts',
  },
  'INVALID'
)

// B13 ────────────────────────────────────────────────────────────────────────
// BUG: -channel_layout stereo but -ac 6 (mismatch)
printResults(
  'B13 · Channel layout "stereo" with -ac 6 (layout/count mismatch)',
  {
    inputType:     'udp',
    videoCodec:    'libx264',
    preset:        'medium',
    bitrateMode:   'cbr',
    targetBitrate: '4000k',
    maxrate:       '4000k',
    bufsize:       '8000k',
    audioCodec:    'aac',
    audioBitrate:  '192k',
    channels:      '6',            // ← 6 channels
    channelLayout: 'stereo',       // ← WRONG: stereo expects 2 channels
    outputFormat:  'mpegts',
  },
  'INVALID'
)

// B14 ────────────────────────────────────────────────────────────────────────
// BUG: VAAPI encoder with an unsupported pixel format (yuv444p)
printResults(
  'B14 · VAAPI encoder with yuv444p pixel format (unsupported surface)',
  {
    inputType:     'udp',
    hwaccel:       'vaapi',
    videoCodec:    'h264_vaapi',
    bitrateMode:   'cbr',
    targetBitrate: '4000k',
    maxrate:       '4000k',
    bufsize:       '8000k',
    pixFmt:        'yuv444p',   // ← WRONG: VAAPI only supports nv12/p010le
    audioCodec:    'aac',
    outputFormat:  'mpegts',
  },
  'INVALID'
)

// B15 ────────────────────────────────────────────────────────────────────────
// BUG: ffmpeg -y -hide_banner -i ${i} -c:v -c:a copy -g mpegts ${o}
// Two bugs: -c:v has no value (videoCodec missing); -g mpegts passes a format
// name as the GOP integer value.
printResults(
  'B15 · -c:v missing value + -g mpegts (format name used as GOP integer)',
  {
    inputType:    'udp',
    audioCodec:   'copy',
    gop:          'mpegts',   // ← WRONG: -g expects a positive integer, not a format name
    outputFormat: 'mpegts',
  },
  'INVALID'
)

console.log()
console.log(BOLD('═══════════════════════════════════════════════════════════════'))
console.log(BOLD('  TEST RUN COMPLETE'))
console.log(BOLD('═══════════════════════════════════════════════════════════════'))
console.log()
