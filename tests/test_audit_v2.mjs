// test_audit_v2.mjs — Comprehensive tests for audit v2 (all 17 cases)
import { parse, validate } from '../fflint/fflint.js'
import { validateRaw } from '../fflint/validate-raw.js'

let pass = 0, fail = 0
function assert(cond, label) {
  if (cond) { pass++; console.log(`  \u2713 ${label}`) }
  else      { fail++; console.error(`  \u2717 FAIL: ${label}`) }
}

function hasId(results, id) { return results.some(r => r.id === id) }
function hasSev(results, sev) { return results.some(r => r.severity === sev) }
function hasMsg(results, substr) { return results.some(r => r.message.includes(substr)) }

function fullValidate(cmd) {
  const raw = validateRaw(cmd)
  const state = parse(cmd)
  const sem = validate(state)
  return { raw, state, sem, all: [...raw, ...sem] }
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n═══ Case 1: ${i} → libx264 → ${o} ═══')
{
  const { all, state } = fullValidate(
    `ffmpeg -y -hide_banner -i "\${i}" -c:v libx264 -preset veryfast -profile:v high -r 25 -g 50 -b:v 3M -maxrate 3M -bufsize 6M -c:a copy -f mpegts "\${o}"`
  )
  assert(!hasId(all, 'file_input_no_re'), 'no -re false positive')
  assert(!hasId(all, 'cbr_no_maxrate'), 'no CBR false positive (maxrate == b:v)')
  assert(!hasSev(all, 'error'), 'no errors')
  assert(!hasSev(all, 'warning'), 'no warnings')
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n═══ Case 2: ${i} → copy → ${o} ═══')
{
  const { all, state, raw } = fullValidate(
    `ffmpeg -y -hide_banner -i "\${i}" -c copy -f mpegts "\${o}"`
  )
  assert(!hasMsg(raw, 'Unrecognized'), 'no unrecognized flags')
  assert(state.videoCodec === 'copy', '-c copy → videoCodec=copy')
  assert(state.audioCodec === 'copy', '-c copy → audioCodec=copy')
  assert(!hasId(all, 'file_input_no_re'), 'no -re false positive')
  assert(!hasId(all, 'h264_ts_needs_bsf'), 'no bsf hint for ${i}')
  assert(!hasSev(all, 'error'), 'no errors')
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n═══ Case 3: ${i} → h264_nvenc → HLS ═══')
{
  const { all, state } = fullValidate(
    `ffmpeg -y -hide_banner -hwaccel cuda -i "\${i}" -c:v h264_nvenc -preset p4 -profile:v high -r 30 -g 60 -b:v 5M -maxrate 5M -bufsize 10M -c:a aac -b:a 128k -hls_time 4 -hls_list_size 5 -f hls "\${o}"`
  )
  assert(!hasId(all, 'file_input_no_re'), 'no -re false positive')
  assert(!hasId(all, 'cbr_no_maxrate'), 'no CBR false positive')
  assert(state.outputFormat === 'hls', 'hls format parsed')
  assert(state.hlsTime === 4, 'hlsTime parsed')
  assert(state.hlsListSize === 5, 'hlsListSize parsed')
  assert(!hasSev(all, 'error'), 'no errors')
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n═══ Case 4: ${i} → yadif+scale → libx264 (with -vf) ═══')
{
  const { all, state, raw } = fullValidate(
    `ffmpeg -y -hide_banner -i "\${i}" -vf "yadif=1,scale=1920:1080" -c:v libx264 -preset fast -crf 18 -c:a aac -b:a 192k -f mpegts "\${o}"`
  )
  assert(!hasMsg(raw, '-vf'), '-vf not flagged as unrecognized')
  assert(state.deinterlaceFilter === 'yadif', 'yadif extracted from -vf')
  assert(state.bitrateMode === 'crf', 'CRF mode detected')
  assert(state.crfValue === 18, 'CRF value parsed')
  assert(!hasId(all, 'file_input_no_re'), 'no -re false positive')
  assert(!hasSev(all, 'error'), 'no errors')
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n═══ Case 5: ${i} → libx264 → tee muxer ═══')
{
  const { all, state } = fullValidate(
    `ffmpeg -y -hide_banner -i "\${i}" -c:v libx264 -preset veryfast -b:v 2M -maxrate 2M -bufsize 4M -c:a aac -b:a 96k -f tee "[f=mpegts]\${o}|[f=hls:hls_time=4:hls_list_size=5]/var/hls/out.m3u8"`
  )
  assert(state.outputFormat === 'tee', 'tee accepted as output format')
  assert(!hasId(all, 'l1_output_format'), 'tee not rejected by L1')
  assert(!hasId(all, 'cbr_no_maxrate'), 'no CBR false positive')
  assert(!hasSev(all, 'error'), 'no errors')
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n═══ Case 6: ${i} → h264_nvenc with -map ═══')
{
  const { all, state, raw } = fullValidate(
    `ffmpeg -y -hide_banner -i "\${i}" -map 0:v:0 -map 0:a:0 -c:v h264_nvenc -preset p5 -b:v 6M -maxrate 6M -bufsize 12M -c:a aac -b:a 128k -f mpegts "\${o}"`
  )
  assert(!hasMsg(raw, 'Unrecognized'), 'no unrecognized flags')
  assert(state.maps.length === 2, 'maps parsed')
  assert(!hasId(all, 'cbr_no_maxrate'), 'no CBR false positive')
  assert(!hasId(all, 'file_input_no_re'), 'no -re false positive')
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n═══ Case 7: ${i} → libx264 ultrafast zerolatency → pipe ═══')
{
  const { all, state, raw } = fullValidate(
    `ffmpeg -y -hide_banner -i "\${i}" -an -c:v libx264 -preset ultrafast -tune zerolatency -b:v 1M -f mpegts pipe:1`
  )
  assert(!hasMsg(raw, 'Unrecognized'), '-tune not flagged as unrecognized')
  assert(state.tune === 'zerolatency', 'tune parsed')
  assert(!hasId(all, 'file_input_no_re'), 'no -re false positive')
  assert(hasMsg(all, 'Pipe output'), 'pipe output info fires')
  assert(hasId(all, 'mpegts_no_audio'), '-an + mpegts info fires')
  assert(hasId(all, 'cbr_bufsize_missing'), 'missing bufsize fires')
  // cbr_no_maxrate fires when no -maxrate — this is CORRECT professional advice
  assert(hasId(all, 'cbr_no_maxrate'), 'cbr_no_maxrate advisory fires (correct)')
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n═══ Case 8: ${i} → hevc_nvenc B-frames + lookahead ═══')
{
  const { all, state, raw } = fullValidate(
    `ffmpeg -y -hide_banner -hwaccel cuda -i "\${i}" -c:v hevc_nvenc -preset p5 -profile:v main -tier high -b:v 6M -maxrate 8M -bufsize 12M -bf 3 -lookahead 32 -c:a aac -b:a 128k -f mpegts "\${o}"`
  )
  assert(!hasMsg(raw, '-tier'), '-tier not flagged as unrecognized')
  assert(!hasMsg(raw, '-lookahead'), '-lookahead not flagged as unrecognized')
  assert(state.tier === 'high', 'tier parsed')
  assert(state.lookahead === 32, 'lookahead parsed')
  assert(state.bitrateMode === 'vbr', 'maxrate > b:v → VBR detected')
  assert(!hasId(all, 'file_input_no_re'), 'no -re false positive')
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n═══ Case 9: ${i} → libx264 with -x264opts ═══')
{
  const { all, raw } = fullValidate(
    `ffmpeg -y -hide_banner -i "\${i}" -c:v libx264 -preset veryfast -x264opts "keyint=50:min-keyint=50:no-scenecut" -b:v 4M -maxrate 4M -bufsize 8M -c:a copy -f mpegts "\${o}"`
  )
  assert(!hasMsg(raw, '-x264opts'), '-x264opts not flagged as unrecognized')
  assert(!hasId(all, 'cbr_no_maxrate'), 'no CBR false positive')
  assert(!hasSev(all, 'error'), 'no errors')
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n═══ Case 10: ${i} → libx264 multi-audio with stream specifiers ═══')
{
  const { all, state, raw } = fullValidate(
    `ffmpeg -y -hide_banner -i "\${i}" -map 0:v:0 -map 0:a:0 -map 0:a:1 -c:v libx264 -preset veryfast -b:v 3M -maxrate 3M -bufsize 6M -c:a:0 aac -b:a:0 128k -c:a:1 aac -b:a:1 128k -f mpegts "\${o}"`
  )
  assert(!hasMsg(raw, 'Unrecognized'), 'no unrecognized flags (stream specifiers)')
  assert(!hasMsg(raw, '-c:a:0'), '-c:a:0 not flagged')
  assert(!hasMsg(raw, '-b:a:0'), '-b:a:0 not flagged')
  assert(!hasMsg(raw, '-c:a:1'), '-c:a:1 not flagged')
  assert(!hasMsg(raw, '-b:a:1'), '-b:a:1 not flagged')
  assert(state.audioCodec === 'aac', 'first audio codec used for validation')
  assert(state.audioBitrate === '128k', 'first audio bitrate used')
  assert(!hasId(all, 'cbr_no_maxrate'), 'no CBR false positive')
  assert(!hasSev(all, 'error'), 'no errors')
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n═══ Case 11: ${i} → h264_vaapi (Intel GPU) ═══')
{
  const { all, state, raw } = fullValidate(
    `ffmpeg -y -hide_banner -hwaccel vaapi -hwaccel_device /dev/dri/renderD128 -hwaccel_output_format vaapi -i "\${i}" -vf "scale_vaapi=1280:720" -c:v h264_vaapi -b:v 3M -maxrate 3M -bufsize 6M -c:a copy -f mpegts "\${o}"`
  )
  assert(!hasMsg(raw, '-hwaccel_device'), '-hwaccel_device not flagged')
  assert(!hasMsg(raw, '-vf'), '-vf not flagged')
  assert(state.hwaccel === 'vaapi', 'vaapi hwaccel parsed')
  assert(state.hwaccelOutputFormat === 'vaapi', 'vaapi output format parsed')
  assert(!hasId(all, 'file_input_no_re'), 'no -re false positive')
  assert(!hasId(all, 'cbr_no_maxrate'), 'no CBR false positive')
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n═══ Case 12: ${i} → video copy + loudnorm ═══')
{
  const { all, raw } = fullValidate(
    `ffmpeg -y -hide_banner -i "\${i}" -c:v copy -af "loudnorm=I=-16:TP=-1.5:LRA=11" -c:a aac -b:a 192k -f mpegts "\${o}"`
  )
  assert(!hasId(all, 'h264_ts_needs_bsf'), 'no bsf hint for ${i}')
  assert(!hasId(all, 'file_input_no_re'), 'no -re false positive')
  assert(!hasMsg(raw, 'Unrecognized'), 'no unrecognized flags')
  assert(!hasSev(all, 'error'), 'no errors')
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n═══ Case 13: ${i} → libx264 → SRT output with params ═══')
{
  const { all } = fullValidate(
    `ffmpeg -y -hide_banner -i "\${i}" -c:v libx264 -preset veryfast -b:v 2M -maxrate 2M -bufsize 4M -c:a aac -b:a 96k -f mpegts "srt://\${o}?pkt_size=1316&latency=200000"`
  )
  assert(!hasId(all, 'file_input_no_re'), 'no -re false positive')
  assert(!hasId(all, 'cbr_no_maxrate'), 'no CBR false positive')
  assert(!hasSev(all, 'error'), 'no errors')
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n═══ Case 14: ${i} → thumbnail extraction ═══')
{
  const { all, state, raw } = fullValidate(
    `ffmpeg -y -hide_banner -i "\${i}" -vf "fps=1/60,scale=320:180" -vframes 1 -f image2 "\${o}"`
  )
  assert(!hasMsg(raw, '-vf'), '-vf not flagged')
  assert(!hasMsg(raw, '-vframes'), '-vframes not flagged')
  assert(state.outputFormat === 'image2', 'image2 format parsed')
  assert(!hasId(all, 'l1_output_format'), 'image2 not rejected by L1')
  assert(hasId(all, 'image2_not_streaming'), 'image2 non-streaming warning fires')
  assert(!hasId(all, 'file_input_no_re'), 'no -re false positive')
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n═══ Case 15: ${i} + logo overlay → filter_complex ═══')
{
  const { all, raw } = fullValidate(
    `ffmpeg -y -hide_banner -i "\${i}" -i "/var/logo.png" -filter_complex "[0:v][1:v]overlay=10:10[outv]" -map "[outv]" -map 0:a -c:v libx264 -preset veryfast -b:v 3M -maxrate 3M -bufsize 6M -c:a copy -f mpegts "\${o}"`
  )
  assert(!hasId(all, 'file_input_no_re'), 'no -re false positive')
  assert(!hasId(all, 'cbr_no_maxrate'), 'no CBR false positive')
  assert(!hasMsg(raw, 'Unrecognized'), 'no unrecognized flags')
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n═══ Case 16: ${i} → copy with MPEG-TS PID remapping ═══')
{
  const { all, state, raw } = fullValidate(
    `ffmpeg -y -hide_banner -i "\${i}" -map 0:v:0 -map 0:a:0 -c copy -mpegts_service_id 1 -mpegts_pmt_start_pid 4096 -f mpegts "\${o}"`
  )
  assert(!hasMsg(raw, 'Unrecognized'), '-c recognized')
  assert(state.videoCodec === 'copy', 'video copy')
  assert(state.audioCodec === 'copy', 'audio copy')
  assert(!hasId(all, 'h264_ts_needs_bsf'), 'no bsf hint for ${i}')
  assert(!hasId(all, 'file_input_no_re'), 'no -re false positive')
  assert(!hasSev(all, 'error'), 'no errors')
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n═══ Case 17: ${i} → full GPU pipeline yadif_cuda + scale_cuda ═══')
{
  const { all, state, raw } = fullValidate(
    `ffmpeg -y -hide_banner -hwaccel cuda -hwaccel_output_format cuda -i "\${i}" -vf "yadif_cuda=mode=0,scale_cuda=1280:720" -c:v h264_nvenc -preset p4 -b:v 4M -maxrate 4M -bufsize 8M -c:a aac -b:a 128k -f mpegts "\${o}"`
  )
  assert(!hasMsg(raw, '-vf'), '-vf not flagged')
  assert(!hasMsg(raw, 'Unrecognized'), 'no unrecognized flags')
  assert(state.deinterlaceFilter === 'yadif_cuda', 'yadif_cuda extracted from -vf')
  assert(state.hwaccelOutputFormat === 'cuda', 'hwaccel output format parsed')
  assert(!hasId(all, 'file_input_no_re'), 'no -re false positive')
  assert(!hasId(all, 'cbr_no_maxrate'), 'no CBR false positive')
  assert(!hasSev(all, 'error'), 'no errors')
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n═══ Bonus: Preset deduplication still works ═══')
{
  const results = validate({
    videoCodec: 'h264_nvenc', hwaccel: 'cuda', preset: 'fast',
    bitrateMode: 'cbr', targetBitrate: '4M', maxrate: '4M', bufsize: '8M',
    outputFormat: 'mpegts',
  })
  const presetErrors = results.filter(r => r.group === 'l1_preset')
  assert(presetErrors.length === 1, 'preset error deduplicated to one')
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n═══ Bonus: serialize() with tier + lookahead round-trip ═══')
{
  const { serialize } = await import('../fflint/serialize.js')
  const cmd = serialize({
    videoCodec: 'hevc_nvenc', hwaccel: 'cuda', preset: 'p5',
    profile: 'main', tier: 'high', lookahead: 32,
    bitrateMode: 'vbr', targetBitrate: '6M', maxrate: '8M', bufsize: '12M',
    audioCodec: 'aac', audioBitrate: '128k', outputFormat: 'mpegts',
  })
  assert(cmd.includes('-tier high'), 'serialize outputs -tier')
  assert(cmd.includes('-lookahead 32'), 'serialize outputs -lookahead')

  const parsed = parse(cmd)
  assert(parsed.tier === 'high', 'tier round-trips')
  assert(parsed.lookahead === 32, 'lookahead round-trips')
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n═══ Bonus: Per-stream specifiers with ordering check ═══')
{
  // -c:a:0 should be treated as a post-input flag (no ordering warning)
  const raw = validateRaw(
    `ffmpeg -y -hide_banner -i "\${i}" -map 0:v:0 -map 0:a:0 -map 0:a:1 -c:v libx264 -preset fast -b:v 3M -c:a:0 aac -c:a:1 ac3 -f mpegts "\${o}"`
  )
  assert(!hasMsg(raw, 'Unrecognized'), 'no unrecognized stream specifiers')
  assert(!hasMsg(raw, 'before -i'), 'no ordering warning for stream specifiers')
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log(`\n═══ Results: ${pass}/${pass + fail} passed ═══\n`)
if (fail > 0) process.exit(1)
