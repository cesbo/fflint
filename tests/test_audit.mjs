// test_audit.mjs — Regression tests for the audit report findings
import { parse, validate } from '../fflint/fflint.js'
import { validateRaw } from '../fflint/validate-raw.js'

let pass = 0, fail = 0
function assert(cond, label) {
  if (cond) { pass++; console.log(`  \u2713 ${label}`) }
  else      { fail++; console.error(`  \u2717 FAIL: ${label}`) }
}

function ids(results) { return results.map(r => r.id) }
function hasId(results, id) { return results.some(r => r.id === id) }
function hasSev(results, sev) { return results.some(r => r.severity === sev) }
function hasMsg(results, substr) { return results.some(r => r.message.includes(substr)) }

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n═══ Case 1: ${i} → libx264 → ${o} (template input, CBR with maxrate=b:v) ═══')
{
  const cmd = `ffmpeg -y -hide_banner -i "\${i}" -c:v libx264 -preset veryfast -profile:v high -r 25 -g 50 -b:v 3M -maxrate 3M -bufsize 6M -c:a copy -f mpegts "\${o}"`
  const raw = validateRaw(cmd)
  const state = parse(cmd)
  const sem = validate(state)
  const all = [...raw, ...sem]

  // Template input should NOT be detected as file
  assert(state.inputType !== 'file', 'quoted ${i} not parsed as file input')
  // No -re warning for template/live input
  assert(!hasId(all, 'file_input_no_re'), 'no -re warning for ${i} input')
  // No cbr_no_maxrate false positive when -maxrate equals -b:v
  assert(!hasId(all, 'cbr_no_maxrate'), 'no cbr_no_maxrate when -maxrate == -b:v')
  // No errors at all for this valid command
  assert(!hasSev(all, 'error'), 'no errors for valid libx264 CBR command')
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n═══ Case 2: ${i} → copy → ${o} (passthrough with -c copy) ═══')
{
  const cmd = `ffmpeg -y -hide_banner -i "\${i}" -c copy -f mpegts "\${o}"`
  const raw = validateRaw(cmd)
  const state = parse(cmd)
  const sem = validate(state)
  const all = [...raw, ...sem]

  // -c should be recognized (not flagged as unknown)
  assert(!hasMsg(raw, 'Unrecognized flag(s): -c'), '-c not flagged as unrecognized')
  // Both video and audio should be set to copy
  assert(state.videoCodec === 'copy', '-c copy sets videoCodec to copy')
  assert(state.audioCodec === 'copy', '-c copy sets audioCodec to copy')
  // No -re warning
  assert(!hasId(all, 'file_input_no_re'), 'no -re warning for ${i} input')
  // No bsf hint for template input (not a file)
  assert(!hasId(all, 'h264_ts_needs_bsf'), 'no h264_mp4toannexb hint for ${i}')
  // No errors
  assert(!hasSev(all, 'error'), 'no errors for valid copy passthrough')
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n═══ Case 3: ${i} → h264_nvenc → HLS output ═══')
{
  const cmd = `ffmpeg -y -hide_banner -hwaccel cuda -i "\${i}" -c:v h264_nvenc -preset p4 -profile:v high -r 30 -g 60 -b:v 5M -maxrate 5M -bufsize 10M -c:a aac -b:a 128k -hls_time 4 -hls_list_size 5 -f hls "\${o}"`
  const raw = validateRaw(cmd)
  const state = parse(cmd)
  const sem = validate(state)
  const all = [...raw, ...sem]

  // No -re warning
  assert(!hasId(all, 'file_input_no_re'), 'no -re warning for ${i} input')
  // No cbr_no_maxrate false positive
  assert(!hasId(all, 'cbr_no_maxrate'), 'no cbr_no_maxrate when -maxrate == -b:v')
  // HLS flags should be parsed correctly
  assert(state.outputFormat === 'hls', 'output format is hls')
  assert(state.hlsTime === 4, 'hlsTime parsed correctly')
  assert(state.hlsListSize === 5, 'hlsListSize parsed correctly')
  // -hls_time and -hls_list_size should not be flagged as unknown
  assert(!hasMsg(raw, 'hls_time'), 'hls_time not flagged as unknown')
  assert(!hasMsg(raw, 'hls_list_size'), 'hls_list_size not flagged as unknown')
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n═══ Case 4: ${i} → yadif+scale → libx264 (with -vf) ═══')
{
  const cmd = `ffmpeg -y -hide_banner -i "\${i}" -vf "yadif=1,scale=1920:1080" -c:v libx264 -preset fast -crf 18 -c:a aac -b:a 192k -f mpegts "\${o}"`
  const raw = validateRaw(cmd)
  const state = parse(cmd)
  const sem = validate(state)
  const all = [...raw, ...sem]

  // -vf should be recognized (not flagged as unknown)
  assert(!hasMsg(raw, 'Unrecognized flag(s): -vf'), '-vf not flagged as unrecognized')
  assert(!hasMsg(raw, '-vf'), 'no mention of -vf in warnings')
  // Deinterlace filter should be extracted from -vf value
  assert(state.deinterlaceFilter === 'yadif', 'yadif extracted from -vf filter chain')
  // No -re warning
  assert(!hasId(all, 'file_input_no_re'), 'no -re warning for ${i} input')
  // CRF mode should be detected
  assert(state.bitrateMode === 'crf', 'CRF mode detected')
  assert(state.crfValue === 18, 'CRF value parsed')
  // No errors for this valid command
  assert(!hasSev(all, 'error'), 'no errors for valid CRF command')
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n═══ Case 5: ${i} → libx264 → tee muxer ═══')
{
  const cmd = `ffmpeg -y -hide_banner -i "\${i}" -c:v libx264 -preset veryfast -b:v 2M -maxrate 2M -bufsize 4M -c:a aac -b:a 96k -f tee "[f=mpegts]\${o}|[f=hls:hls_time=4:hls_list_size=5]/var/hls/out.m3u8"`
  const raw = validateRaw(cmd)
  const state = parse(cmd)
  const sem = validate(state)
  const all = [...raw, ...sem]

  // tee should be accepted as valid output format
  assert(state.outputFormat === 'tee', 'tee parsed as output format')
  assert(!hasId(all, 'l1_output_format'), 'tee not rejected by layer 1')
  // No -re warning
  assert(!hasId(all, 'file_input_no_re'), 'no -re warning for ${i} input')
  // No cbr_no_maxrate false positive
  assert(!hasId(all, 'cbr_no_maxrate'), 'no cbr_no_maxrate when -maxrate == -b:v')
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n═══ Case 6: ${i} → h264_nvenc with -map ═══')
{
  const cmd = `ffmpeg -y -hide_banner -i "\${i}" -map 0:v:0 -map 0:a:0 -c:v h264_nvenc -preset p5 -b:v 6M -maxrate 6M -bufsize 12M -c:a aac -b:a 128k -f mpegts "\${o}"`
  const raw = validateRaw(cmd)
  const state = parse(cmd)
  const sem = validate(state)
  const all = [...raw, ...sem]

  // -map should be recognized
  assert(!hasMsg(raw, 'Unrecognized'), 'no unrecognized flags')
  // Maps parsed correctly
  assert(state.maps.length === 2, 'two -map entries parsed')
  assert(state.maps[0] === '0:v:0', 'first map correct')
  assert(state.maps[1] === '0:a:0', 'second map correct')
  // No cbr_no_maxrate false positive
  assert(!hasId(all, 'cbr_no_maxrate'), 'no cbr_no_maxrate when -maxrate == -b:v')
  // No -re warning
  assert(!hasId(all, 'file_input_no_re'), 'no -re warning for ${i} input')
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n═══ Case 7: ${i} → libx264 ultrafast -tune zerolatency → pipe output ═══')
{
  const cmd = `ffmpeg -y -hide_banner -i "\${i}" -an -c:v libx264 -preset ultrafast -tune zerolatency -b:v 1M -f mpegts pipe:1`
  const raw = validateRaw(cmd)
  const state = parse(cmd)
  const sem = validate(state)
  const all = [...raw, ...sem]

  // -tune should be recognized
  assert(!hasMsg(raw, 'Unrecognized'), '-tune not flagged as unrecognized')
  // tune value should be in state
  assert(state.tune === 'zerolatency', 'tune=zerolatency parsed')
  // No -re warning (template/pipe input, not file)
  assert(!hasId(all, 'file_input_no_re'), 'no -re warning')
  // Pipe output info should fire (existing correct behavior)
  assert(hasMsg(all, 'Pipe output'), 'pipe output info detected')
  // -an + mpegts info should fire
  assert(hasId(all, 'mpegts_no_audio'), '-an with mpegts info note fires')
  // cbr_bufsize_missing should fire (no -bufsize — correct behavior)
  assert(hasId(all, 'cbr_bufsize_missing'), 'missing bufsize warning fires')
  // cbr_no_maxrate should fire (no -maxrate at all — correct advisory)
  assert(hasId(all, 'cbr_no_maxrate'), 'cbr_no_maxrate fires when no -maxrate present')
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n═══ Audit fix: Preset error deduplication ═══')
{
  const state = {
    videoCodec: 'h264_nvenc',
    hwaccel: 'cuda',
    preset: 'fast',
    bitrateMode: 'cbr',
    targetBitrate: '4M',
    maxrate: '4M',
    bufsize: '8M',
    outputFormat: 'mpegts',
  }
  const results = validate(state)

  // Should have at most ONE preset error (deduplicated by group)
  const presetErrors = results.filter(r => r.group === 'l1_preset')
  assert(presetErrors.length === 1, 'preset error deduplicated to one (was two)')
  assert(presetErrors[0].severity === 'error', 'preset error is severity error')
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n═══ Audit fix: -forced-idr true (bonus) ═══')
{
  const cmd = `ffmpeg -y -hide_banner -hwaccel cuda -i "\${i}" -c:v h264_nvenc -preset p4 -forced-idr true -b:v 4M -maxrate 4M -bufsize 8M -c:a copy -f mpegts "\${o}"`
  const state = parse(cmd)
  assert(state.forcedIdr === true, '-forced-idr true parsed correctly')
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n═══ Audit fix: -vf with various filter chains ═══')
{
  // yadif_cuda extraction
  const s1 = parse(`ffmpeg -y -i "\${i}" -vf "scale=1280:720,yadif_cuda" -c:v h264_nvenc -preset p4 -b:v 4M -f mpegts "\${o}"`)
  assert(s1.deinterlaceFilter === 'yadif_cuda', '-vf with yadif_cuda extracted')

  // bwdif extraction
  const s2 = parse(`ffmpeg -y -i "\${i}" -vf bwdif -c:v libx264 -preset fast -crf 20 -c:a aac -f mpegts "\${o}"`)
  assert(s2.deinterlaceFilter === 'bwdif', '-vf with bwdif extracted')

  // No deinterlace filter in -vf
  const s3 = parse(`ffmpeg -y -i "\${i}" -vf "scale=640:480" -c:v libx264 -preset fast -crf 20 -c:a aac -f mpegts "\${o}"`)
  assert(!s3.deinterlaceFilter, '-vf with only scale → no deinterlace')

  // -vf not flagged as unrecognized in structural checks
  const raw3 = validateRaw(`ffmpeg -y -i "\${i}" -vf "scale=640:480" -c:v libx264 -preset fast -crf 20 -c:a aac -f mpegts "\${o}"`)
  assert(!hasMsg(raw3, 'Unrecognized'), '-vf not in unrecognized flags')
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n═══ Audit fix: serialize() with tune ═══')
{
  const { serialize } = await import('../fflint/serialize.js')
  const cmd = serialize({
    videoCodec: 'libx264',
    preset: 'ultrafast',
    tune: 'zerolatency',
    bitrateMode: 'cbr',
    targetBitrate: '1M',
    bufsize: '2M',
    audioCodec: 'disabled',
    outputFormat: 'mpegts',
  })
  assert(cmd.includes('-tune zerolatency'), 'serialize outputs -tune')
  assert(cmd.indexOf('-tune') > cmd.indexOf('-preset'), '-tune after -preset in output')
  assert(cmd.indexOf('-tune') < cmd.indexOf('-b:v'), '-tune before -b:v in output')
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n═══ Audit fix: Round-trip with tune ═══')
{
  const { serialize } = await import('../fflint/serialize.js')
  const original = {
    videoCodec: 'libx264',
    preset: 'ultrafast',
    tune: 'zerolatency',
    bitrateMode: 'crf',
    crfValue: 23,
    audioCodec: 'aac',
    audioBitrate: '128k',
    outputFormat: 'mpegts',
  }
  const cmd = serialize(original)
  const parsed = parse(cmd)
  assert(parsed.tune === 'zerolatency', 'tune round-trips through serialize→parse')
  assert(parsed.preset === 'ultrafast', 'preset preserved in round-trip')
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log(`\n═══ Results: ${pass}/${pass + fail} passed ═══\n`)
if (fail > 0) process.exit(1)
