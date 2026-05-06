// test_field_property.mjs — Verify that validation results include a `field` property
// derived from the FLAG_TO_FIELD mapping.
import { validate, FLAG_TO_FIELD } from '../fflint/fflint.js'
import { validateRaw } from '../fflint/validate-raw.js'

let pass = 0, fail = 0
function assert(cond, label) {
  if (cond) { pass++; console.log(`  \u2713 ${label}`) }
  else      { fail++; console.error(`  \u2717 FAIL: ${label}`) }
}

// ─── FLAG_TO_FIELD export ─────────────────────────────────────────────────────
console.log('\n\u2550\u2550\u2550 FLAG_TO_FIELD export \u2550\u2550\u2550')
assert(typeof FLAG_TO_FIELD === 'object' && FLAG_TO_FIELD !== null, 'FLAG_TO_FIELD is exported')
assert(FLAG_TO_FIELD['-bufsize']  === 'bufsize',      "'-bufsize' maps to 'bufsize'")
assert(FLAG_TO_FIELD['-b:v']      === 'bitrate',      "'-b:v' maps to 'bitrate'")
assert(FLAG_TO_FIELD['-maxrate']  === 'maxrate',      "'-maxrate' maps to 'maxrate'")
assert(FLAG_TO_FIELD['-r']        === 'fps',          "'-r' maps to 'fps'")
assert(FLAG_TO_FIELD['-c:v']      === 'videoCodec',   "'-c:v' maps to 'videoCodec'")
assert(FLAG_TO_FIELD['-c:a']      === 'audioCodec',   "'-c:a' maps to 'audioCodec'")
assert(FLAG_TO_FIELD['-preset']   === 'preset',       "'-preset' maps to 'preset'")
assert(FLAG_TO_FIELD['-profile:v']=== 'profile',      "'-profile:v' maps to 'profile'")
assert(FLAG_TO_FIELD['-crf']      === 'crfValue',     "'-crf' maps to 'crfValue'")
assert(FLAG_TO_FIELD['-g']        === 'gop',          "'-g' maps to 'gop'")
assert(FLAG_TO_FIELD['-bf']       === 'bframes',      "'-bf' maps to 'bframes'")
assert(FLAG_TO_FIELD['-level']    === 'level',        "'-level' maps to 'level'")
assert(FLAG_TO_FIELD['-level:v']  === 'level',        "'-level:v' maps to 'level'")
assert(FLAG_TO_FIELD['-pix_fmt']  === 'pixFmt',       "'-pix_fmt' maps to 'pixFmt'")
assert(FLAG_TO_FIELD['-f']        === 'outputFormat', "'-f' maps to 'outputFormat'")

// ─── validate() results contain field ────────────────────────────────────────
console.log('\n\u2550\u2550\u2550 validate() results contain field \u2550\u2550\u2550')
{
  // Trigger -bufsize rule: maxrate without bufsize → warning flag: -bufsize
  const results = validate({ videoCodec: 'libx264', bitrateMode: 'cbr', targetBitrate: '4M', maxrate: '5M' })
  const bufsizeResult = results.find(r => r.flag === '-bufsize')
  assert(bufsizeResult !== undefined, 'found result with flag=-bufsize')
  assert(bufsizeResult?.field === 'bufsize', 'field=bufsize on -bufsize result')
}
{
  // Trigger -r rule (layer 2 yadif field-rate FPS check)
  const results = validate({
    videoCodec: 'libx264',
    deinterlaceFilter: 'yadif',
    deinterlaceMode: 'field',
    fps: '25',
  })
  const rResult = results.find(r => r.flag === '-r')
  assert(rResult !== undefined, 'found result with flag=-r')
  assert(rResult?.field === 'fps', 'field=fps on -r result')
}
{
  // Trigger -b:v rule (L1 invalid bitrate format)
  const results = validate({ videoCodec: 'libx264', bitrateMode: 'cbr', targetBitrate: 'invalid' })
  const bvResult = results.find(r => r.flag === '-b:v')
  assert(bvResult !== undefined, 'found result with flag=-b:v')
  assert(bvResult?.field === 'bitrate', 'field=bitrate on -b:v result')
}
{
  // Trigger -maxrate rule (L1 invalid maxrate format)
  const results = validate({ videoCodec: 'libx264', bitrateMode: 'vbr', maxrate: 'bad_value' })
  const mrResult = results.find(r => r.flag === '-maxrate')
  assert(mrResult !== undefined, 'found result with flag=-maxrate')
  assert(mrResult?.field === 'maxrate', 'field=maxrate on -maxrate result')
}
{
  // Trigger -preset rule (L1 invalid preset for codec)
  const results = validate({ videoCodec: 'libx264', preset: 'ultrafast_invalid' })
  const presetResult = results.find(r => r.flag === '-preset')
  assert(presetResult !== undefined, 'found result with flag=-preset')
  assert(presetResult?.field === 'preset', 'field=preset on -preset result')
}
{
  // Trigger -c:v rule (L1 unknown video codec)
  const results = validate({ videoCodec: 'notacodec' })
  const cvResult = results.find(r => r.flag === '-c:v')
  assert(cvResult !== undefined, 'found result with flag=-c:v')
  assert(cvResult?.field === 'videoCodec', 'field=videoCodec on -c:v result')
}

// ─── validateRaw() semantic results contain field ─────────────────────────────
console.log('\n\u2550\u2550\u2550 validateRaw() semantic results contain field \u2550\u2550\u2550')
{
  const results = validateRaw('ffmpeg -i ${i} -c:v libx264 -preset medium -b:v 4M -maxrate 5M -c:a aac -f mpegts ${o}')
  const resultsWithFlag = results.filter(r => r.flag !== undefined)
  assert(resultsWithFlag.every(r => r.field !== undefined),
    'all results with a flag also have a field')
}
{
  // Structural check results (no flag) should not have a field property set to a string
  const results = validateRaw('ffmpeg -i ${i} -c:v libx264 -preset medium -b:v 4M -c:a aac -f mpegts ${o}')
  const structural = results.filter(r => r.flag === undefined)
  assert(structural.every(r => r.field === undefined), 'structural results without flag have no field')
}

// ─── field is undefined when flag is undefined ────────────────────────────────
console.log('\n\u2550\u2550\u2550 field is undefined for unknown flags \u2550\u2550\u2550')
{
  const results = validate({ videoCodec: 'libx264', bitrateMode: 'cbr', targetBitrate: '4M', maxrate: '4M', bufsize: '8M' })
  // All results should have field defined only when flag is defined
  for (const r of results) {
    if (r.flag === undefined) {
      assert(r.field === undefined, `result id=${r.id} without flag has no field`)
    }
  }
}

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n\u2550\u2550\u2550 Results: ${pass}/${pass + fail} passed \u2550\u2550\u2550`)
if (fail > 0) process.exit(1)
