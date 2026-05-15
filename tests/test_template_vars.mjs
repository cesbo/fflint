// test_template_vars.mjs — Tests for template variable validation skip
// Valid template vars like ${bitrate} must not produce validation errors.
// Invalid variable names like "${g pu}" (space) are split by the tokenizer
// into two tokens and will not be recognized as flags or complete values.
//
// Usage: node tests/test_template_vars.mjs

import { parse, validate } from '../fflint/fflint.js'
import { validateRaw } from '../fflint/validate-raw.js'

let pass = 0, fail = 0

function assert(cond, label) {
  if (cond) { pass++; console.log(`  ✓ ${label}`) }
  else      { fail++; console.error(`  ✗ FAIL: ${label}`) }
}

function hasId(results, id)       { return results.some(r => r.id === id) }
function hasErr(results)          { return results.some(r => r.severity === 'error') }

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n═══ L1: Bitrate template variables ═══')
// ═══════════════════════════════════════════════════════════════════════════════

{
  // -b:v ${bitrate} — should not produce a bitrate format error
  const state = parse('ffmpeg -i ${i} -c:v libx264 -preset medium -b:v ${bitrate} -c:a aac -f mpegts ${o}')
  const results = validate(state)
  assert(!hasId(results, 'l1_bitrate'), '-b:v ${bitrate}: no l1_bitrate error')
}

{
  // -maxrate ${maxrate} -bufsize ${bufsize}
  const state = parse('ffmpeg -i ${i} -c:v libx264 -b:v 4M -maxrate ${maxrate} -bufsize ${bufsize} -c:a aac -f mpegts ${o}')
  const results = validate(state)
  assert(!hasId(results, 'l1_maxrate'), '-maxrate ${maxrate}: no l1_maxrate error')
  assert(!hasId(results, 'l1_bufsize'), '-bufsize ${bufsize}: no l1_bufsize error')
}

{
  // -b:a ${aBitrate}
  const state = parse('ffmpeg -i ${i} -c:v copy -c:a aac -b:a ${aBitrate} -f mpegts ${o}')
  const results = validate(state)
  assert(!hasId(results, 'l1_audio_bitrate'), '-b:a ${aBitrate}: no l1_audio_bitrate error')
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n═══ L1: Numeric parameter template variables ═══')
// ═══════════════════════════════════════════════════════════════════════════════

{
  // -g ${gop}
  const state = parse('ffmpeg -i ${i} -c:v libx264 -preset medium -b:v 4M -g ${gop} -c:a aac -f mpegts ${o}')
  const results = validate(state)
  assert(!hasId(results, 'l1_gop'), '-g ${gop}: no l1_gop error')
}

{
  // -sc_threshold ${sc}
  const state = parse('ffmpeg -i ${i} -c:v libx264 -preset medium -b:v 4M -sc_threshold ${sc} -c:a aac -f mpegts ${o}')
  const results = validate(state)
  assert(!hasId(results, 'l1_sc_threshold'), '-sc_threshold ${sc}: no l1_sc_threshold error')
}

{
  // -bf ${bf}
  const state = parse('ffmpeg -i ${i} -c:v libx264 -preset medium -b:v 4M -bf ${bf} -c:a aac -f mpegts ${o}')
  const results = validate(state)
  assert(!hasId(results, 'l1_bframes'), '-bf ${bf}: no l1_bframes error')
}

{
  // -refs ${refs}
  const state = parse('ffmpeg -i ${i} -c:v libx264 -preset medium -b:v 4M -refs ${refs} -c:a aac -f mpegts ${o}')
  const results = validate(state)
  assert(!hasId(results, 'l1_refs'), '-refs ${refs}: no l1_refs error')
}

{
  // -keyint_min ${kmin}
  const state = parse('ffmpeg -i ${i} -c:v libx264 -preset medium -b:v 4M -g 50 -keyint_min ${kmin} -c:a aac -f mpegts ${o}')
  const results = validate(state)
  assert(!hasId(results, 'l1_keyint_min'), '-keyint_min ${kmin}: no l1_keyint_min error')
}

{
  // -thread_queue_size ${tqs}
  const state = parse('ffmpeg -thread_queue_size ${tqs} -i ${i} -c:v libx264 -preset medium -b:v 4M -c:a aac -f mpegts ${o}')
  const results = validate(state)
  assert(!hasId(results, 'l1_thread_queue_size'), '-thread_queue_size ${tqs}: no l1_thread_queue_size error')
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n═══ L1: Enum template variables ═══')
// ═══════════════════════════════════════════════════════════════════════════════

{
  // -c:v ${codec} — videoCodec is a template var
  const state = parse('ffmpeg -i ${i} -c:v ${codec} -b:v 4M -c:a aac -f mpegts ${o}')
  const results = validate(state)
  assert(!hasId(results, 'l1_video_codec'), '-c:v ${codec}: no l1_video_codec error')
}

{
  // -preset ${preset}
  const state = parse('ffmpeg -i ${i} -c:v libx264 -preset ${preset} -b:v 4M -c:a aac -f mpegts ${o}')
  const results = validate(state)
  assert(!hasId(results, 'l1_preset'), '-preset ${preset}: no l1_preset error')
}

{
  // -profile:v ${prof}
  const state = parse('ffmpeg -i ${i} -c:v libx264 -preset medium -profile:v ${prof} -b:v 4M -c:a aac -f mpegts ${o}')
  const results = validate(state)
  assert(!hasId(results, 'l1_profile'), '-profile:v ${prof}: no l1_profile error')
}

{
  // -pix_fmt ${pix}
  const state = parse('ffmpeg -i ${i} -c:v libx264 -preset medium -b:v 4M -pix_fmt ${pix} -c:a aac -f mpegts ${o}')
  const results = validate(state)
  assert(!hasId(results, 'l1_pix_fmt'), '-pix_fmt ${pix}: no l1_pix_fmt error')
}

{
  // -c:a ${acodec}
  const state = parse('ffmpeg -i ${i} -c:v libx264 -preset medium -b:v 4M -c:a ${acodec} -f mpegts ${o}')
  const results = validate(state)
  assert(!hasId(results, 'l1_audio_codec'), '-c:a ${acodec}: no l1_audio_codec error')
}

{
  // -hwaccel ${hw}
  const state = parse('ffmpeg -hwaccel ${hw} -i ${i} -c:v h264_nvenc -preset p4 -b:v 4M -c:a aac -f mpegts ${o}')
  const results = validate(state)
  assert(!hasId(results, 'l1_hwaccel'), '-hwaccel ${hw}: no l1_hwaccel error')
  // Also must not trigger nvenc_no_hwaccel false positive
  assert(!hasId(results, 'nvenc_no_hwaccel'), '-hwaccel ${hw} with nvenc: no nvenc_no_hwaccel error')
}

{
  // -f ${fmt}
  const state = parse('ffmpeg -i ${i} -c:v libx264 -preset medium -b:v 4M -c:a aac -f ${fmt} ${o}')
  const results = validate(state)
  assert(!hasId(results, 'l1_output_format'), '-f ${fmt}: no l1_output_format error')
}

{
  // -ar ${ar}
  const state = parse('ffmpeg -i ${i} -c:v copy -c:a aac -ar ${ar} -f mpegts ${o}')
  const results = validate(state)
  assert(!hasId(results, 'l1_sample_rate'), '-ar ${ar}: no l1_sample_rate error')
  // Must not trigger broadcast_sample_rate false positive
  assert(!hasId(results, 'broadcast_sample_rate'), '-ar ${ar}: no broadcast_sample_rate warning')
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n═══ L1: Frame size and FPS template variables ═══')
// ═══════════════════════════════════════════════════════════════════════════════

{
  // -s ${size}
  const state = parse('ffmpeg -i ${i} -c:v libx264 -preset medium -b:v 4M -s ${size} -c:a aac -f mpegts ${o}')
  const results = validate(state)
  assert(!hasId(results, 'l1_framesize'), '-s ${size}: no l1_framesize error')
}

{
  // -r ${fps}
  const state = parse('ffmpeg -i ${i} -c:v libx264 -preset medium -b:v 4M -r ${fps} -c:a aac -f mpegts ${o}')
  const results = validate(state)
  assert(!hasId(results, 'l1_fps'), '-r ${fps}: no l1_fps error')
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n═══ L2: Hardware acceleration template variables ═══')
// ═══════════════════════════════════════════════════════════════════════════════

{
  // CPU codec + template var hwaccel — must not trigger cpu_hwaccel_set
  const state = { videoCodec: 'libx264', inputHwaccel: '${hw}', bitrateMode: 'cbr', targetBitrate: '4M' }
  const results = validate(state)
  assert(!hasId(results, 'cpu_hwaccel_set'), 'libx264 + ${hw}: no cpu_hwaccel_set warning')
}

{
  // VAAPI codec + template var hwaccel — must not trigger vaapi_wrong_hwaccel
  const state = { videoCodec: 'h264_vaapi', inputHwaccel: '${hw}', bitrateMode: 'cbr', targetBitrate: '4M' }
  const results = validate(state)
  assert(!hasId(results, 'vaapi_wrong_hwaccel'), 'h264_vaapi + ${hw}: no vaapi_wrong_hwaccel')
}

{
  // yadif_cuda filter + template var hwaccel — must not trigger yadif_cuda_no_hwaccel
  const state = { videoCodec: 'h264_nvenc', inputHwaccel: '${hw}', deinterlaceFilter: 'yadif_cuda' }
  const results = validate(state)
  assert(!hasId(results, 'yadif_cuda_no_hwaccel'), 'yadif_cuda + ${hw}: no yadif_cuda_no_hwaccel')
}

{
  // cpu filter + template var hwaccelOutputFormat — must not trigger cpu_deinterlace_with_hwaccel_output
  const state = { videoCodec: 'libx264', deinterlaceFilter: 'yadif', inputHwaccelOutputFormat: '${fmt}' }
  const results = validate(state)
  assert(!hasId(results, 'cpu_deinterlace_with_hwaccel_output'), 'yadif + ${hwaccelOutputFormat}: no cpu_deinterlace_with_hwaccel_output')
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n═══ L2/L3: Misc template variable scenarios ═══')
// ═══════════════════════════════════════════════════════════════════════════════

{
  // -sc_threshold ${sc} with cbr — must not trigger sc_threshold_cbr
  const state = { videoCodec: 'libx264', bitrateMode: 'cbr', targetBitrate: '4M', scThreshold: '${sc}' }
  const results = validate(state)
  assert(!hasId(results, 'sc_threshold_cbr'), 'cbr + sc_threshold ${sc}: no sc_threshold_cbr')
}

{
  // -dialnorm ${dn} with non-Dolby codec — must not trigger dialnorm_non_dolby
  const state = { videoCodec: 'libx264', audioCodec: 'aac', dialnorm: '${dn}' }
  const results = validate(state)
  assert(!hasId(results, 'dialnorm_non_dolby'), 'aac + dialnorm ${dn}: no dialnorm_non_dolby')
}

{
  // MPEGTS PID as template var — must not trigger pid validation errors
  const state = parse('ffmpeg -i ${i} -c:v libx264 -preset medium -b:v 4M -c:a aac -f mpegts -mpegts_start_pid ${pid} ${o}')
  const results = validate(state)
  assert(!hasId(results, 'l1_pid_start'), '-mpegts_start_pid ${pid}: no l1_pid_start error')
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n═══ validateRaw: Template variable in command strings ═══')
// ═══════════════════════════════════════════════════════════════════════════════

{
  // Full command with many template vars — no errors expected
  const cmd = 'ffmpeg -i ${i} -c:v libx264 -preset ${preset} -b:v ${bitrate} -maxrate ${maxrate} -bufsize ${bufsize} -c:a aac -b:a ${aBitrate} -f mpegts ${o}'
  const raw = validateRaw(cmd)
  const errors = raw.filter(r => r.severity === 'error')
  assert(errors.length === 0, 'full template command: no errors from validateRaw')
}

{
  // Template variable for GPU index — must not produce error
  const cmd = 'ffmpeg -gpu ${gpuIdx} -hwaccel cuda -i ${i} -c:v h264_nvenc -preset p4 -b:v 4M -c:a aac -f mpegts ${o}'
  const raw = validateRaw(cmd)
  const state = parse(cmd)
  const sem = validate(state)
  const all = [...raw, ...sem]
  assert(!all.some(r => r.severity === 'error' && r.id === 'l1_gpu_index'), '-gpu ${gpuIdx}: no l1_gpu_index error')
}

{
  // validateRaw: template var as value does not trigger "missing value" error
  const cmd = 'ffmpeg -i ${i} -c:v libx264 -preset ${p} -b:v 4M -c:a aac -f mpegts ${o}'
  const raw = validateRaw(cmd)
  assert(!raw.some(r => r.message.includes('missing its value')), 'template var as value: no missing-value error')
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log(`\n═══ Results: ${pass}/${pass + fail} passed ═══\n`)
if (fail > 0) process.exit(1)
