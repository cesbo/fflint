import { validateRaw } from '../fflint/validate-raw.js'

let r, pass = 0, fail = 0

// Test 1: bitrateMode transfer (was broken - CRF rules were dead through validateRaw)
r = validateRaw('ffmpeg -i ${i} -c:v libx264 -crf 23 -b:v 4M -c:a aac -f mpegts ${o}')
const crfIssues = r.filter(x => x.message.includes('CRF') || x.message.includes('crf'))
if (crfIssues.length > 0) { console.log('T1 crf+bv: PASS'); pass++ }
else { console.log('T1 crf+bv: FAIL (no CRF error detected)'); fail++ }

// Test 2: HLS flags split (was broken - split on comma instead of +)
r = validateRaw('ffmpeg -re -i ${i} -c:v libx264 -preset fast -b:v 3M -maxrate 3M -bufsize 6M -c:a aac -hls_flags delete_segments+append_list -hls_segment_type mpegts -f hls ${o}')
const hlsFlagErrors = r.filter(x => x.id === 'l1_hls_flags')
if (hlsFlagErrors.length === 0) { console.log('T2 hls_flags: PASS (no false errors)'); pass++ }
else { console.log('T2 hls_flags: FAIL', hlsFlagErrors.map(x => x.message)); fail++ }

// Test 3: PID decimal parsing (256 should be 256, not 598)
r = validateRaw('ffmpeg -i ${i} -c:v copy -c:a copy -mpegts_pmt_start_pid 256 -mpegts_start_pid 4096 -f mpegts ${o}')
const pidIssues = r.filter(x => x.id && x.id.includes('pid'))
if (pidIssues.length === 0) { console.log('T3 pid_decimal: PASS'); pass++ }
else { console.log('T3 pid_decimal: FAIL', pidIssues.map(x => x.message)); fail++ }

// Test 4: copy codec forwarding - should warn about redundant preset on copy
r = validateRaw('ffmpeg -i ${i} -c:v copy -preset medium -c:a copy -f mpegts ${o}')
const copyPreset = r.filter(x => x.message && x.message.includes('preset') && x.message.toLowerCase().includes('copy'))
if (copyPreset.length > 0) { console.log('T4 copy_preset: PASS'); pass++ }
else { console.log('T4 copy_preset: FAIL (no copy+preset warning)'); fail++ }

// Test 5: CBR bufsize preserved (maxrate=bitrate shouldn't clear bufsize)
r = validateRaw('ffmpeg -i ${i} -c:v libx264 -preset fast -b:v 4M -maxrate 4M -bufsize 8M -c:a aac -f mpegts ${o}')
const falseBufsize = r.filter(x => x.message && x.message.includes('bufsize') && x.severity === 'warning')
if (falseBufsize.length === 0) { console.log('T5 cbr_bufsize: PASS'); pass++ }
else { console.log('T5 cbr_bufsize: FAIL', falseBufsize.map(x => x.message)); fail++ }

// Test 6: MPEG-2 CRF should be caught via bitrateMode
r = validateRaw('ffmpeg -i ${i} -c:v mpeg2video -crf 20 -c:a mp2 -f mpegts ${o}')
const mpeg2crf = r.filter(x => x.message && x.message.includes('MPEG-2') && x.message.includes('CRF'))
if (mpeg2crf.length > 0) { console.log('T6 mpeg2_crf: PASS'); pass++ }
else { console.log('T6 mpeg2_crf: FAIL (MPEG-2 CRF not detected)'); fail++ }

// Test 7: -level (without :v suffix) should be recognized
r = validateRaw('ffmpeg -i ${i} -c:v libx264 -preset medium -b:v 4M -maxrate 4M -bufsize 8M -level 4.1 -c:a aac -f mpegts ${o}')
const levelUnknown = r.filter(x => x.message && x.message.includes('Unrecognized') && x.message.includes('-level'))
if (levelUnknown.length === 0) { console.log('T7 level_alias: PASS'); pass++ }
else { console.log('T7 level_alias: FAIL', levelUnknown.map(x => x.message)); fail++ }

// Test 8: -c:v before and after -i should not be flagged as duplicate
r = validateRaw('ffmpeg -c:v h264_cuvid -i ${i} -c:v h264_nvenc -preset p4 -b:v 4M -c:a aac -f mpegts ${o}')
const dupCv = r.filter(x => x.message && x.message.includes('Duplicate') && x.message.includes('-c:v'))
if (dupCv.length === 0) { console.log('T8 dual_cv: PASS (no false duplicate)'); pass++ }
else { console.log('T8 dual_cv: FAIL', dupCv.map(x => x.message)); fail++ }

// Test 9: audio copy with sample rate should warn
r = validateRaw('ffmpeg -i ${i} -c:v libx264 -preset fast -b:v 3M -c:a copy -ar 44100 -f mpegts ${o}')
const copyAr = r.filter(x => x.message && x.message.includes('Sample rate') && x.message.toLowerCase().includes('copy'))
if (copyAr.length > 0) { console.log('T9 copy_audio_ar: PASS'); pass++ }
else { console.log('T9 copy_audio_ar: FAIL (no copy+ar warning)'); fail++ }

// Test 10: keyintMin transfer
r = validateRaw('ffmpeg -i ${i} -c:v libx264 -preset medium -b:v 4M -g 50 -keyint_min 999 -c:a aac -f mpegts ${o}')
const kimWarn = r.filter(x => x.id && x.id.includes('keyint'))
if (kimWarn.length > 0) { console.log('T10 keyintMin: PASS'); pass++ }
else { console.log('T10 keyintMin: FAIL (keyintMin not validated)'); fail++ }

console.log(`\n${pass}/${pass+fail} tests passed`)
