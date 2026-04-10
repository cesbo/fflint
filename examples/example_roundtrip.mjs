// example_roundtrip.mjs — Full round-trip: parse → validate → edit → serialize
// Usage: node examples/example_roundtrip.mjs

import { parse, validate, serialize } from '../fflint/fflint.js'

// ── Step 1: Parse an existing command (e.g. loaded from a database) ──────────
const stored = 'ffmpeg -y -hide_banner -i ${i} -c:v h264_nvenc -preset p4 -b:v 4M -maxrate 4M -bufsize 4M -c:a aac -b:a 128k -f mpegts ${o}'
console.log('Stored command:')
console.log(stored)
console.log()

const state = parse(stored)
console.log('Parsed state:')
console.log(JSON.stringify(state, null, 2))
console.log()

// ── Step 2: Validate ─────────────────────────────────────────────────────────
const results = validate(state)
console.log(`Validation: ${results.length} issue(s) found`)
for (const r of results) {
  console.log(`  [${r.severity}] ${r.message}`)
}
console.log()

// ── Step 3: Fix issues (e.g. add missing hwaccel for NVENC) ──────────────────
state.hwaccel = 'cuda'
state.hwaccelOutputFormat = 'cuda'

// ── Step 4: Re-validate ──────────────────────────────────────────────────────
const fixed = validate(state)
const errors = fixed.filter(r => r.severity === 'error')
console.log(`After fix: ${fixed.length} issue(s), ${errors.length} error(s)`)
console.log()

// ── Step 5: Serialize back to command string ─────────────────────────────────
const command = serialize(state)
console.log('Fixed command:')
console.log(command)
