import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parse } from '../fflint/parse.js'
import { serialize } from '../fflint/serialize.js'

let passed = 0, total = 0
function check(label, actual, expected) {
  total++
  if (actual === expected) { passed++; console.log(`  \x1b[32m✔\x1b[0m ${label}`) }
  else { console.log(`  \x1b[31m✗\x1b[0m ${label}\n    expected: ${JSON.stringify(expected)}\n    actual:   ${JSON.stringify(actual)}`); process.exitCode = 1 }
}

console.log('\n═══ Order preservation: roundtrip parse→serialize ═══')

// User's original command — flags in non-canonical order
const cmd1 = 'ffmpeg -re -y -hide_banner -i ${i} -map 0:0 -map 0:1 -c:v h264_nvenc -gpu 0 -preset fast -profile:v main -filter:v yadif -forced-idr 1 -b:v 1M -c:a aac -b:a 128k -r 25 -g 8 -keyint_min 13 -f mpegts ${o}'
const out1 = serialize(parse(cmd1))

check(
  'post-input flag order preserved',
  out1,
  'ffmpeg -y -hide_banner -re -gpu 0 -i ${i} -map 0:0 -map 0:1 -c:v h264_nvenc -preset fast -profile:v main -filter:v yadif -forced-idr 1 -b:v 1M -maxrate 1M -bufsize 1M -c:a aac -b:a 128k -r 25 -g 8 -keyint_min 13 -f mpegts ${o}'
)

// -r and -g BEFORE -filter:v
const cmd2 = 'ffmpeg -y -hide_banner -i ${i} -c:v libx264 -r 30 -g 60 -filter:v yadif -b:v 2M -c:a aac -f mpegts ${o}'
const out2 = serialize(parse(cmd2))

check(
  '-r/-g before -filter:v stays before',
  out2,
  'ffmpeg -y -hide_banner -i ${i} -c:v libx264 -r 30 -g 60 -filter:v yadif -b:v 2M -maxrate 2M -bufsize 2M -c:a aac -f mpegts ${o}'
)

// canonical order when no _flagOrder (form-created state)
const out3 = serialize({
  videoCodec: 'h264_nvenc', preset: 'fast', profile: 'main',
  bitrateMode: 'cbr', targetBitrate: '1M',
  audioCodec: 'aac', audioBitrate: '128k',
  outputFormat: 'mpegts', maps: ['0:0', '0:1'], re: true, gpuIndex: 0,
})

check(
  'canonical order without _flagOrder',
  out3,
  'ffmpeg -y -hide_banner -gpu 0 -re -i ${i} -map 0:0 -map 0:1 -c:v h264_nvenc -preset fast -profile:v main -b:v 1M -maxrate 1M -bufsize 1M -c:a aac -b:a 128k -f mpegts ${o}'
)

// Pre-input flags that user placed after -i get migrated before -i
const cmd4 = 'ffmpeg -y -hide_banner -i ${i} -c:v h264_nvenc -gpu 0 -hwaccel cuda -preset fast -f mpegts ${o}'
const state4 = parse(cmd4)
const out4 = serialize(state4)

check(
  '-gpu and -hwaccel migrate to pre-input zone',
  out4.includes('-gpu 0 -i') || out4.indexOf('-gpu') < out4.indexOf('-i'),
  true
)
check(
  '-hwaccel migrates to pre-input zone',
  out4.indexOf('-hwaccel') < out4.indexOf('-i'),
  true
)

// VBR with explicit maxrate/bufsize order preserved
const cmd5 = 'ffmpeg -y -hide_banner -i ${i} -c:v libx264 -b:v 4M -bufsize 8M -maxrate 6M -c:a aac -f mpegts ${o}'
const out5 = serialize(parse(cmd5))

check(
  'VBR bufsize before maxrate preserved',
  out5,
  'ffmpeg -y -hide_banner -i ${i} -c:v libx264 -b:v 4M -bufsize 8M -maxrate 6M -c:a aac -f mpegts ${o}'
)

console.log('\n═══ Hints: pre-input migration ═══')

// -gpu after -i → hint about migration
const h1 = serialize(parse(cmd1), { withHints: true })
check('withHints returns object with command', typeof h1.command, 'string')
check('withHints returns hints array', Array.isArray(h1.hints), true)

const gpuHint = h1.hints.find(h => h.flag === '-gpu')
check('-gpu migration hint present', !!gpuHint, true)
check('-gpu hint severity is info', gpuHint?.severity, 'info')
check('-gpu hint message mentions -i', gpuHint?.message.includes('-i'), true)

// -re was BEFORE -i in cmd1, so no migration hint for it
const reHint = h1.hints.find(h => h.flag === '-re')
check('no -re migration hint (was already pre-input)', !reHint, true)

// cmd4 has both -gpu and -hwaccel after -i
const h4 = serialize(parse(cmd4), { withHints: true })
const gpuHint4 = h4.hints.find(h => h.flag === '-gpu')
const hwHint4 = h4.hints.find(h => h.flag === '-hwaccel')
check('-gpu migration hint for cmd4', !!gpuHint4, true)
check('-hwaccel migration hint for cmd4', !!hwHint4, true)

console.log('\n═══ Hints: passthrough (unknown) flags ═══')

// Command with unknown flags
const cmd6 = 'ffmpeg -y -hide_banner -i ${i} -c:v libx264 -b:v 2M -custom_flag foo -c:a aac -f mpegts ${o}'
const h6 = serialize(parse(cmd6), { withHints: true })
const customHint = h6.hints.find(h => h.flag === '-custom_flag')
check('unknown flag hint present', !!customHint, true)
check('unknown flag severity is warning', customHint?.severity, 'warning')
check('unknown flag message mentions not validated', customHint?.message.includes('not validated'), true)

// No hints when withHints is false (default)
const out6 = serialize(parse(cmd6))
check('default returns string, not object', typeof out6, 'string')

console.log(`\n═══ Results: ${passed}/${total} passed ═══\n`)
