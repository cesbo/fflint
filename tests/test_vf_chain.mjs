// test_vf_chain.mjs — Tests for -vf parsing, vfChain/vfAtoms state,
// the s_and_vf_scale_conflict rule, and prefer_vf_scale_with_hwaccel.
//
// Usage: node tests/test_vf_chain.mjs

import { parse } from '../fflint/parse.js'
import { serialize } from '../fflint/serialize.js'
import { validate } from '../fflint/fflint.js'
import { parseFilterChain, getScaleSize, hasHwScale, findDeinterlacer } from '../fflint/vf-parse.js'

let pass = 0, fail = 0

function assert(name, condition, detail) {
  if (condition) {
    console.log(`  \x1b[32m✓\x1b[0m ${name}`)
    pass++
  } else {
    console.log(`  \x1b[31m✗\x1b[0m ${name}${detail ? ' — ' + detail : ''}`)
    fail++
  }
}

const hasId = (results, id) => results.some(r => r.id === id)

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n\x1b[1m═══ Section 1: parseFilterChain unit tests ═══\x1b[0m')
// ═══════════════════════════════════════════════════════════════════════════════

{
  const { atoms, chain } = parseFilterChain('yadif=1,scale=1920:1080,format=yuv420p')
  assert('chain preserved', chain === 'yadif=1,scale=1920:1080,format=yuv420p')
  assert('3 atoms', atoms.length === 3)
  assert('first is yadif', atoms[0].name === 'yadif')
  assert('second is scale', atoms[1].name === 'scale')
  assert('scale w/h positional → named', atoms[1].args.w === '1920' && atoms[1].args.h === '1080')
  assert('format args.pix_fmts', atoms[2].args.pix_fmts === 'yuv420p')
}

{
  const { atoms } = parseFilterChain('scale=w=1280:h=720')
  assert('named scale w', atoms[0].args.w === '1280')
  assert('named scale h', atoms[0].args.h === '720')
}

{
  const { atoms } = parseFilterChain('[0:v][1:v]overlay=10:10[outv]')
  assert('labels stripped', atoms.length === 1 && atoms[0].name === 'overlay')
  assert('overlay x', atoms[0].args.x === '10')
  assert('overlay y', atoms[0].args.y === '10')
}

{
  const { atoms } = parseFilterChain('scale_cuda=1280:720')
  assert('hw scaler recognized', atoms[0].name === 'scale_cuda')
  assert('hasHwScale true', hasHwScale(atoms) === true)
}

{
  const { atoms } = parseFilterChain('yadif_cuda=1')
  assert('findDeinterlacer cuda', findDeinterlacer(atoms) === 'yadif_cuda')
}

{
  const { atoms } = parseFilterChain('')
  assert('empty → no atoms', atoms.length === 0)
}

{
  const { atoms } = parseFilterChain('drawtext=text=hello\\,world:fontsize=20')
  // Escaped comma must NOT split the chain
  assert('escaped comma kept', atoms.length === 1)
  assert('drawtext name', atoms[0].name === 'drawtext')
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n\x1b[1m═══ Section 2: parse() populates vfChain/vfAtoms ═══\x1b[0m')
// ═══════════════════════════════════════════════════════════════════════════════

{
  const s = parse(`ffmpeg -y -i \${i} -vf "yadif=1,scale=1920:1080" -c:v libx264 -b:v 4M -f mpegts \${o}`)
  assert('vfChain set', s.vfChain === 'yadif=1,scale=1920:1080')
  assert('vfAtoms length', Array.isArray(s.vfAtoms) && s.vfAtoms.length === 2)
  assert('deinterlaceFilter still derived', s.deinterlaceFilter === 'yadif')
}

{
  const s = parse(`ffmpeg -y -i \${i} -c:v libx264 -b:v 2M -f mpegts \${o}`)
  assert('no vfChain when no -vf', !s.vfChain)
  assert('no vfAtoms when no -vf', !s.vfAtoms || s.vfAtoms.length === 0)
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n\x1b[1m═══ Section 3: round-trip with -vf ═══\x1b[0m')
// ═══════════════════════════════════════════════════════════════════════════════

{
  const cmd = `ffmpeg -y -i \${i} -vf "yadif=1,scale=1280:720,format=yuv420p" -c:v libx264 -b:v 2M -maxrate 2M -bufsize 4M -c:a aac -b:a 128k -f mpegts \${o}`
  const out = serialize(parse(cmd))
  assert('round-trip preserves yadif', out.includes('yadif'))
  assert('round-trip preserves scale=1280:720', out.includes('scale=1280:720'))
  assert('round-trip preserves format=yuv420p', out.includes('format=yuv420p'))
  assert('quoted because of comma', out.includes('"yadif=1,scale=1280:720,format=yuv420p"'))
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n\x1b[1m═══ Section 4: s_and_vf_scale_conflict rule ═══\x1b[0m')
// ═══════════════════════════════════════════════════════════════════════════════

{
  // Same size on both → warning (redundant)
  const errs = validate(parse(
    `ffmpeg -y -i \${i} -s 1920x1080 -vf "scale=1920:1080" -c:v libx264 -b:v 4M -f mpegts \${o}`
  ))
  const r = errs.find(e => e.group === 's_and_vf_scale_conflict')
  assert('redundant fires', !!r)
  assert('redundant severity=warning', r && r.severity === 'warning')
}

{
  // Different sizes → error (conflict)
  const errs = validate(parse(
    `ffmpeg -y -i \${i} -s 1920x1080 -vf "scale=1280:720" -c:v libx264 -b:v 4M -f mpegts \${o}`
  ))
  const r = errs.find(e => e.group === 's_and_vf_scale_conflict')
  assert('conflict fires', !!r)
  assert('conflict severity=error', r && r.severity === 'error')
  assert('conflict message mentions both', r && /1920x1080/.test(r.message) && /1280:720/.test(r.message))
}

{
  // Only -vf scale, no -s → no rule
  const errs = validate(parse(
    `ffmpeg -y -i \${i} -vf "scale=1280:720" -c:v libx264 -b:v 2M -f mpegts \${o}`
  ))
  assert('no rule when only -vf scale', !hasId(errs, 's_and_vf_scale_diff') && !hasId(errs, 's_and_vf_scale_redundant'))
}

{
  // Only -s, no -vf → no rule
  const errs = validate(parse(
    `ffmpeg -y -i \${i} -s 1280x720 -c:v libx264 -b:v 2M -f mpegts \${o}`
  ))
  assert('no rule when only -s', !hasId(errs, 's_and_vf_scale_diff') && !hasId(errs, 's_and_vf_scale_redundant'))
}

{
  // Auto-height with -1: cannot be compared statically → no rule
  const errs = validate(parse(
    `ffmpeg -y -i \${i} -s 1920x1080 -vf "scale=1920:-1" -c:v libx264 -b:v 4M -f mpegts \${o}`
  ))
  assert('no diff/redundant when scale h=-1 (auto)',
    !hasId(errs, 's_and_vf_scale_diff') && !hasId(errs, 's_and_vf_scale_redundant'))
  const r = errs.find(e => e.id === 's_and_vf_scale_present')
  assert('catch-all info fires for auto case', !!r && r.severity === 'info')
}

{
  // Expression for width → no diff/redundant; catch-all info fires
  const errs = validate(parse(
    `ffmpeg -y -i \${i} -s 1920x1080 -vf "scale=iw/2:-2" -c:v libx264 -b:v 4M -f mpegts \${o}`
  ))
  assert('no diff/redundant when scale uses iw expr',
    !hasId(errs, 's_and_vf_scale_diff') && !hasId(errs, 's_and_vf_scale_redundant'))
  assert('catch-all info fires for expr case',
    !!errs.find(e => e.id === 's_and_vf_scale_present'))
}

{
  // When concrete and equal, redundant (warning) wins over the info catch-all
  // due to per-group deduplication.
  const errs = validate(parse(
    `ffmpeg -y -i \${i} -s 1920x1080 -vf "scale=1920:1080" -c:v libx264 -b:v 4M -f mpegts \${o}`
  ))
  const r = errs.find(e => e.group === 's_and_vf_scale_conflict')
  assert('redundant wins over info', r && r.severity === 'warning' && r.id === 's_and_vf_scale_redundant')
}

{
  // When concrete and differ, diff (error) wins.
  const errs = validate(parse(
    `ffmpeg -y -i \${i} -s 1920x1080 -vf "scale=1280:720" -c:v libx264 -b:v 4M -f mpegts \${o}`
  ))
  const r = errs.find(e => e.group === 's_and_vf_scale_conflict')
  assert('diff wins over info', r && r.severity === 'error' && r.id === 's_and_vf_scale_diff')
}

{
  // Long-form named width=/height= still works for the conflict rule
  const errs = validate(parse(
    `ffmpeg -y -i \${i} -s 1920x1080 -vf "scale=width=1280:height=720" -c:v libx264 -b:v 4M -f mpegts \${o}`
  ))
  const r = errs.find(e => e.group === 's_and_vf_scale_conflict')
  assert('long-form width=/height= still detected', !!r && r.severity === 'error')
}

{
  // scale with extra options (flags=, force_original_aspect_ratio=) still detected
  const errs = validate(parse(
    `ffmpeg -y -i \${i} -s 1920x1080 -vf "scale=1280:720:flags=lanczos:force_original_aspect_ratio=decrease" -c:v libx264 -b:v 4M -f mpegts \${o}`
  ))
  const r = errs.find(e => e.group === 's_and_vf_scale_conflict')
  assert('scale with extra opts still detected', !!r && r.severity === 'error')
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n\x1b[1m═══ Section 5: prefer_vf_scale_with_hwaccel rule ═══\x1b[0m')
// ═══════════════════════════════════════════════════════════════════════════════

{
  // hwaccel + -s, no hw scaler → fires
  const errs = validate(parse(
    `ffmpeg -y -hwaccel cuda -i \${i} -s 1280x720 -c:v h264_nvenc -b:v 4M -f mpegts \${o}`
  ))
  const r = errs.find(e => e.id === 'prefer_vf_scale_with_hwaccel')
  assert('cuda hwaccel + -s → fires', !!r)
  assert('mentions scale_cuda', r && /scale_cuda/.test(r.message))
}

{
  // hwaccel + -vf scale_cuda → does NOT fire
  const errs = validate(parse(
    `ffmpeg -y -hwaccel cuda -i \${i} -vf "scale_cuda=1280:720" -c:v h264_nvenc -b:v 4M -f mpegts \${o}`
  ))
  assert('hw scaler present → does not fire', !hasId(errs, 'prefer_vf_scale_with_hwaccel'))
}

{
  // No hwaccel + -s → does NOT fire
  const errs = validate(parse(
    `ffmpeg -y -i \${i} -s 1280x720 -c:v libx264 -b:v 2M -f mpegts \${o}`
  ))
  assert('no hwaccel → does not fire', !hasId(errs, 'prefer_vf_scale_with_hwaccel'))
}

{
  // vaapi hwaccel → suggests scale_vaapi
  const errs = validate(parse(
    `ffmpeg -y -hwaccel vaapi -i \${i} -s 1280x720 -c:v h264_vaapi -b:v 4M -f mpegts \${o}`
  ))
  const r = errs.find(e => e.id === 'prefer_vf_scale_with_hwaccel')
  assert('vaapi hwaccel + -s → fires', !!r)
  assert('vaapi mentions scale_vaapi', r && /scale_vaapi/.test(r.message))
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log(`\n\x1b[1m═══ Results: ${pass}/${pass + fail} passed ═══\x1b[0m`)
if (fail > 0) {
  console.log(`\x1b[31m${fail} test(s) FAILED\x1b[0m`)
  process.exit(1)
}
