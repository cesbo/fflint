// test_harden.mjs — Edge case tests for all 6 Phases of validateRaw hardening
// Usage: node test_harden.mjs

import { validateRaw } from '../fflint/validate-raw.js'

let pass = 0, fail = 0

function check(label, results, predicate) {
  if (predicate(results)) {
    console.log(`  ✓ ${label}`)
    pass++
  } else {
    console.log(`  ✗ ${label}`)
    console.log(`    results:`, results.map(r => `[${r.severity}] ${r.message}`))
    fail++
  }
}

const has = (results, severity, substr) =>
  results.some(r => r.severity === severity && r.message.includes(substr))
const none = (results, severity, substr) =>
  !results.some(r => r.severity === severity && r.message.includes(substr))

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n═══ Phase 1: Flag Ordering Validation ═══')
// ═══════════════════════════════════════════════════════════════════════════════

// 1.1 POST_INPUT flag before -i → warning
check('POST flag -preset before -i',
  validateRaw('ffmpeg -preset fast -i ${i} -c:v libx264 -b:v 4M -c:a aac -f mpegts ${o}'),
  r => has(r, 'warning', '-preset is an output/encoding flag but appears before -i'))

// 1.2 PRE_INPUT flag after -i → warning
check('PRE flag -hwaccel after -i',
  validateRaw('ffmpeg -i ${i} -hwaccel cuda -c:v h264_nvenc -b:v 4M -c:a aac -f mpegts ${o}'),
  r => has(r, 'warning', '-hwaccel is an input flag but appears after -i'))

// 1.3 -c:v / -c:a are dual-use, no ordering warning
check('-c:v before -i (dual-use, no warning)',
  validateRaw('ffmpeg -c:v h264_cuvid -i ${i} -c:v h264_nvenc -preset p4 -b:v 4M -c:a aac -f mpegts ${o}'),
  r => none(r, 'warning', '-c:v is an'))

// 1.4 Global flags anywhere — no warning
check('-y after -i (global, no warning)',
  validateRaw('ffmpeg -i ${i} -y -c:v libx264 -b:v 4M -c:a aac -f mpegts ${o}'),
  r => none(r, 'warning', '-y is an'))

// 1.5 Correctly ordered command — no ordering warnings
check('Correct order: no ordering warnings',
  validateRaw('ffmpeg -re -hwaccel cuda -i ${i} -c:v h264_nvenc -preset p4 -b:v 4M -c:a aac -f mpegts ${o}'),
  r => none(r, 'warning', 'appears before -i') && none(r, 'warning', 'appears after -i'))

// 1.6 Options after output target → error
check('Flag after output target',
  validateRaw('ffmpeg -i ${i} -c:v libx264 -b:v 4M -c:a aac -f mpegts output.ts -g 50'),
  r => has(r, 'error', 'appears after the output target'))

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n═══ Phase 2: Missing Output & Extension Mismatch ═══')
// ═══════════════════════════════════════════════════════════════════════════════

// 2.1 No output file/URL
check('No output target → error',
  validateRaw('ffmpeg -i ${i} -c:v libx264 -b:v 4M -c:a aac -f mpegts'),
  r => has(r, 'error', 'No output file/URL specified'))

// 2.2 Template output ${o} — no missing output error
check('Template output ${o} — no missing output error',
  validateRaw('ffmpeg -i ${i} -c:v libx264 -b:v 4M -c:a aac -f mpegts ${o}'),
  r => none(r, 'error', 'No output file/URL specified'))

// 2.3 Format/extension mismatch
check('-f mpegts output.mp4 → extension mismatch warning',
  validateRaw('ffmpeg -i ${i} -c:v libx264 -b:v 4M -c:a aac -f mpegts output.mp4'),
  r => has(r, 'warning', '-f mpegts but output file extension is ".mp4"'))

// 2.4 Format/extension match — no warning
check('-f mpegts output.ts → no mismatch',
  validateRaw('ffmpeg -i ${i} -c:v libx264 -b:v 4M -c:a aac -f mpegts output.ts'),
  r => none(r, 'warning', 'output file extension'))

// 2.5 -f hls output.m3u8 — match
check('-f hls output.m3u8 → no mismatch',
  validateRaw('ffmpeg -i ${i} -c:v libx264 -b:v 4M -c:a aac -f hls output.m3u8'),
  r => none(r, 'warning', 'output file extension'))

// 2.6 -f flv output.mkv → mismatch
check('-f flv output.mkv → mismatch warning',
  validateRaw('ffmpeg -i ${i} -c:v libx264 -b:v 4M -c:a aac -f flv output.mkv'),
  r => has(r, 'warning', '-f flv but output file extension is ".mkv"'))

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n═══ Phase 3: Duplicate Flags with Different Values ═══')
// ═══════════════════════════════════════════════════════════════════════════════

// 3.1 Same flag, same value → info redundant
check('Duplicate -g 50 -g 50 → info redundant',
  validateRaw('ffmpeg -i ${i} -c:v libx264 -g 50 -g 50 -b:v 4M -c:a aac -f mpegts ${o}'),
  r => has(r, 'info', 'redundant'))

// 3.2 Same flag, different values → warning
check('Duplicate -g 50 then -g 100 → warning last value used',
  validateRaw('ffmpeg -i ${i} -c:v libx264 -g 50 -g 100 -b:v 4M -c:a aac -f mpegts ${o}'),
  r => has(r, 'warning', 'appears twice with different values'))

// 3.3 -map is repeatable — no duplicate warning
check('-map repeatable — no duplicate warning',
  validateRaw('ffmpeg -i ${i} -map 0:v -map 0:a -c:v libx264 -b:v 4M -c:a aac -f mpegts ${o}'),
  r => none(r, 'warning', '-map appears twice') && none(r, 'info', '-map'))

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n═══ Phase 4: Multi-Input Without Map ═══')
// ═══════════════════════════════════════════════════════════════════════════════

// 4.1 Two inputs without -map → warning
check('Two -i without -map → warning',
  validateRaw('ffmpeg -i ${i} -i logo.png -c:v libx264 -b:v 4M -c:a aac -f mpegts ${o}'),
  r => has(r, 'warning', 'Multiple inputs without -map'))

// 4.2 Two inputs with -map → no warning
check('Two -i with -map → no warning',
  validateRaw('ffmpeg -i ${i} -i logo.png -map 0:v -map 0:a -c:v libx264 -b:v 4M -c:a aac -f mpegts ${o}'),
  r => none(r, 'warning', 'Multiple inputs without -map'))

// 4.3 Single input → no warning
check('Single -i → no multi-input warning',
  validateRaw('ffmpeg -i ${i} -c:v libx264 -b:v 4M -c:a aac -f mpegts ${o}'),
  r => none(r, 'warning', 'Multiple inputs'))

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n═══ Phase 5: Pipe Input/Output ═══')
// ═══════════════════════════════════════════════════════════════════════════════

// 5.1 -i - → pipe input info
check('Pipe input -i - → info',
  validateRaw('ffmpeg -i - -c:v libx264 -b:v 4M -c:a aac -f mpegts ${o}'),
  r => has(r, 'info', 'Pipe input detected'))

// 5.2 -i pipe:0 → pipe input info
check('Pipe input -i pipe:0 → info',
  validateRaw('ffmpeg -i pipe:0 -c:v libx264 -b:v 4M -c:a aac -f mpegts ${o}'),
  r => has(r, 'info', 'Pipe input detected'))

// 5.3 Pipe output - → pipe output info
check('Pipe output - → info',
  validateRaw('ffmpeg -i ${i} -c:v libx264 -b:v 4M -c:a aac -f mpegts -'),
  r => has(r, 'info', 'Pipe output detected'))

// 5.4 pipe:1 output → pipe output info
check('Pipe output pipe:1 → info',
  validateRaw('ffmpeg -i ${i} -c:v libx264 -b:v 4M -c:a aac -f mpegts pipe:1'),
  r => has(r, 'info', 'Pipe output detected'))

// 5.5 Regular input/output → no pipe info
check('Regular I/O → no pipe info',
  validateRaw('ffmpeg -i ${i} -c:v libx264 -b:v 4M -c:a aac -f mpegts ${o}'),
  r => none(r, 'info', 'Pipe'))

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n═══ Phase 6: Invalid Numeric Token Preservation ═══')
// ═══════════════════════════════════════════════════════════════════════════════

// 6.1 Non-numeric -g value: should produce L1 error instead of being silently dropped
check('Non-numeric -g "abc" → L1 gop error',
  validateRaw('ffmpeg -i ${i} -c:v libx264 -g abc -b:v 4M -c:a aac -f mpegts ${o}'),
  r => has(r, 'error', 'GOP'))

// 6.2 Non-numeric -timeout → L1 timeout error
check('Non-numeric -timeout "xyz" → L1 timeout error',
  validateRaw('ffmpeg -timeout xyz -i ${i} -c:v libx264 -b:v 4M -c:a aac -f mpegts ${o}'),
  r => has(r, 'error', 'Timeout') || has(r, 'error', 'timeout'))

// 6.3 Non-numeric -thread_queue_size → L1 error
check('Non-numeric -thread_queue_size "abc" → L1 error',
  validateRaw('ffmpeg -thread_queue_size abc -i ${i} -c:v libx264 -b:v 4M -c:a aac -f mpegts ${o}'),
  r => has(r, 'error', 'Thread queue size') || has(r, 'error', 'thread'))

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n═══ Bonus: Missing-dash flag detection ═══')
// ═══════════════════════════════════════════════════════════════════════════════

// B1: c:a without dash → warning
check('"c:a" without dash → warning',
  validateRaw('ffmpeg -y -hide_banner -i ${i} -c:v h264_nvenc c:a copy -f mpegts ${o}'),
  r => has(r, 'warning', '"c:a" looks like a flag missing its dash'))

// B2: preset without dash → warning
check('"preset" without dash → warning',
  validateRaw('ffmpeg -i ${i} -c:v libx264 preset fast -b:v 4M -c:a aac -f mpegts ${o}'),
  r => has(r, 'warning', '"preset" looks like a flag missing its dash'))

// B3: Legitimate value "copy" after -c:a → no false positive
check('"copy" after -c:a → no false positive',
  validateRaw('ffmpeg -i ${i} -c:v libx264 -b:v 4M -c:a copy -f mpegts ${o}'),
  r => none(r, 'warning', 'looks like a flag missing its dash'))

// B4: Legitimate value "aac" after -c:a → no false positive
check('"aac" after -c:a → no false positive',
  validateRaw('ffmpeg -i ${i} -c:v libx264 -b:v 4M -c:a aac -f mpegts ${o}'),
  r => none(r, 'warning', 'looks like a flag missing its dash'))

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n═══ Regression: Existing tests still pass ═══')
// ═══════════════════════════════════════════════════════════════════════════════

// R1: Normal valid command — no errors
check('Valid libx264 CBR command — no errors',
  validateRaw('ffmpeg -re -thread_queue_size 1024 -i ${i} -c:v libx264 -preset medium -b:v 4M -maxrate 4M -bufsize 8M -g 50 -sc_threshold 0 -c:a aac -b:a 128k -f mpegts ${o}'),
  r => !r.some(x => x.severity === 'error'))

// R2: Copy codec with preset → still warns
check('Copy codec + preset → warning',
  validateRaw('ffmpeg -i ${i} -c:v copy -preset medium -c:a copy -f mpegts ${o}'),
  r => r.some(x => x.message && x.message.includes('preset') && x.message.toLowerCase().includes('copy')))

// R3: -crf + -b:v still caught
check('-crf + -b:v still caught',
  validateRaw('ffmpeg -i ${i} -c:v libx264 -crf 23 -b:v 4M -c:a aac -f mpegts ${o}'),
  r => has(r, 'error', '-crf and -b:v'))

// ═══════════════════════════════════════════════════════════════════════════════
console.log(`\n═══ Results: ${pass}/${pass + fail} passed ═══\n`)
if (fail > 0) process.exit(1)
