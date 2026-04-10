// test_parse_serialize.mjs — Tests for parse() and serialize() round-trip
// Usage: node tests/test_parse_serialize.mjs

import { parse } from '../fflint/parse.js'
import { serialize } from '../fflint/serialize.js'
import { validate } from '../fflint/fflint.js'

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

function eq(a, b) {
  if (a === b) return true
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    return a.every((v, i) => eq(v, b[i]))
  }
  return false
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n\x1b[1m═══ Section 1: parse() — Basic Parsing ═══\x1b[0m')
// ═══════════════════════════════════════════════════════════════════════════════

{
  const s = parse('ffmpeg -y -hide_banner -i ${i} -c:v libx264 -preset medium -b:v 4M -c:a aac -b:a 128k -f mpegts ${o}')
  assert('videoCodec', s.videoCodec === 'libx264')
  assert('preset', s.preset === 'medium')
  assert('bitrateMode is cbr', s.bitrateMode === 'cbr')
  assert('targetBitrate', s.targetBitrate === '4M')
  assert('audioCodec', s.audioCodec === 'aac')
  assert('audioBitrate', s.audioBitrate === '128k')
  assert('outputFormat', s.outputFormat === 'mpegts')
}

{
  const s = parse('ffmpeg -y -i ${i} -c:v copy -c:a copy -f mpegts ${o}')
  assert('copy video', s.videoCodec === 'copy')
  assert('copy audio', s.audioCodec === 'copy')
}

{
  const s = parse('ffmpeg -i ${i} -vn -c:a aac -b:a 128k -f mpegts ${o}')
  assert('video disabled', s.videoCodec === 'disabled')
  assert('audio aac', s.audioCodec === 'aac')
}

{
  const s = parse('ffmpeg -i ${i} -c:v libx264 -an -f mpegts ${o}')
  assert('audio disabled', s.audioCodec === 'disabled')
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n\x1b[1m═══ Section 2: parse() — Pre-input flags ═══\x1b[0m')
// ═══════════════════════════════════════════════════════════════════════════════

{
  const s = parse('ffmpeg -hwaccel cuda -hwaccel_output_format cuda -gpu 0 -deint 2 -re -stream_loop -1 -fflags +genpts+igndts -use_wallclock_as_timestamps 1 -analyzeduration 5000000 -probesize 10000000 -timeout 5000000 -thread_queue_size 1024 -i ${i} -c:v h264_nvenc -preset p4 -b:v 4M -c:a aac -f mpegts ${o}')
  assert('hwaccel', s.hwaccel === 'cuda')
  assert('hwaccelOutputFormat', s.hwaccelOutputFormat === 'cuda')
  assert('gpuIndex', s.gpuIndex === 0)
  assert('nvdecDeint', s.nvdecDeint === 2)
  assert('re', s.re === true)
  assert('streamLoop', s.streamLoop === true)
  assert('fflags', eq(s.fflags, ['+genpts', '+igndts']))
  assert('useWallclock', s.useWallclock === true)
  assert('analyzeDuration', s.analyzeDuration === 5000000)
  assert('probeSize', s.probeSize === 10000000)
  assert('timeout', s.timeout === 5000000)
  assert('threadQueueSize', s.threadQueueSize === 1024)
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n\x1b[1m═══ Section 3: parse() — Video encoding options ═══\x1b[0m')
// ═══════════════════════════════════════════════════════════════════════════════

{
  const s = parse('ffmpeg -i ${i} -c:v libx264 -preset fast -profile:v main -s 1280x720 -r 25 -g 50 -keyint_min 25 -sc_threshold 0 -bf 2 -refs 3 -pix_fmt yuv420p -level:v 4.1 -field_order progressive -color_primaries bt709 -color_trc bt709 -colorspace bt709 -bsf:v h264_mp4toannexb -forced-idr 1 -aspect 16:9 -b:v 4M -maxrate 4M -bufsize 8M -fps_mode cfr -c:a copy -f mpegts ${o}')
  assert('profile', s.profile === 'main')
  assert('frameSize', s.frameSize === '1280x720')
  assert('fps', s.fps === '25')
  assert('gop', s.gop === 50)
  assert('keyintMin', s.keyintMin === 25)
  assert('scThreshold', s.scThreshold === 0)
  assert('bframes', s.bframes === 2)
  assert('refs', s.refs === 3)
  assert('pixFmt', s.pixFmt === 'yuv420p')
  assert('level', s.level === '4.1')
  assert('fieldOrder', s.fieldOrder === 'progressive')
  assert('colorPrimaries', s.colorPrimaries === 'bt709')
  assert('colorTrc', s.colorTrc === 'bt709')
  assert('colorspace', s.colorspace === 'bt709')
  assert('bsfVideo', s.bsfVideo === 'h264_mp4toannexb')
  assert('forcedIdr', s.forcedIdr === true)
  assert('aspect', s.aspect === '16:9')
  assert('fpsSyncMode', s.fpsSyncMode === 'cfr')
}

{
  const s = parse('ffmpeg -i ${i} -c:v libx264 -crf 23 -c:a aac -f mpegts ${o}')
  assert('crf bitrateMode', s.bitrateMode === 'crf')
  assert('crfValue', s.crfValue === 23)
  assert('no targetBitrate with crf', s.targetBitrate === undefined)
}

{
  const s = parse('ffmpeg -i ${i} -c:v libx264 -b:v 3M -maxrate 5M -bufsize 8M -c:a copy -f mpegts ${o}')
  assert('vbr bitrateMode', s.bitrateMode === 'vbr')
  assert('vbr targetBitrate', s.targetBitrate === '3M')
  assert('vbr maxrate', s.maxrate === '5M')
  assert('vbr bufsize', s.bufsize === '8M')
}

{
  const s = parse('ffmpeg -i ${i} -c:v libx264 -s 1440x900 -r 23.976 -c:a copy -f mpegts ${o}')
  assert('custom frameSize', s.frameSize === 'custom')
  assert('customFrameSize', s.customFrameSize === '1440x900')
  assert('custom fps', s.fps === 'custom')
  assert('customFps', s.customFps === '23.976')
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n\x1b[1m═══ Section 4: parse() — Audio options ═══\x1b[0m')
// ═══════════════════════════════════════════════════════════════════════════════

{
  const s = parse('ffmpeg -i ${i} -c:v copy -c:a aac -ar 48000 -ac 2 -b:a 192k -dialnorm -27 -bsf:a aac_adtstoasc -channel_layout stereo -f mp4 ${o}')
  assert('sampleRate', s.sampleRate === '48000')
  assert('channels', s.channels === '2')
  assert('audioBitrate', s.audioBitrate === '192k')
  assert('dialnorm', s.dialnorm === -27)
  assert('bsfAudio', s.bsfAudio === 'aac_adtstoasc')
  assert('channelLayout', s.channelLayout === 'stereo')
}

{
  const s = parse('ffmpeg -i ${i} -c:v copy -c:a aac -ac 6 -f mpegts ${o}')
  assert('channels 6', s.channels === '6')
}

{
  const s = parse('ffmpeg -i ${i} -c:v copy -c:a aac -ac 1 -f mpegts ${o}')
  assert('channels 1', s.channels === '1')
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n\x1b[1m═══ Section 5: parse() — Output / container options ═══\x1b[0m')
// ═══════════════════════════════════════════════════════════════════════════════

{
  const s = parse('ffmpeg -i ${i} -c:v libx264 -preset fast -b:v 3M -c:a aac -f hls -hls_time 6 -hls_list_size 10 -hls_flags delete_segments+append_list -hls_segment_type fmp4 ${o}')
  assert('outputFormat hls', s.outputFormat === 'hls')
  assert('hlsTime', s.hlsTime === 6)
  assert('hlsListSize', s.hlsListSize === 10)
  assert('hlsFlags', eq(s.hlsFlags, ['delete_segments', 'append_list']))
  assert('hlsSegmentType', s.hlsSegmentType === 'fmp4')
}

{
  const s = parse('ffmpeg -i ${i} -c:v copy -c:a copy -f mpegts -mpegts_service_id 1 -mpegts_pmt_start_pid 256 -mpegts_start_pid 4096 -mpegts_flags system_b+pat_pmt_at_frames -pcr_period 40 ${o}')
  assert('mpegtsServiceId', s.mpegtsServiceId === 1)
  assert('mpegtsPmtStartPid', s.mpegtsPmtStartPid === 256)
  assert('mpegtsStartPid', s.mpegtsStartPid === 4096)
  assert('mpegtsFlags', eq(s.mpegtsFlags, ['system_b', 'pat_pmt_at_frames']))
  assert('pcrPeriod', s.pcrPeriod === 40)
}

{
  const s = parse('ffmpeg -i ${i} -c:v copy -c:a copy -copyts -avoid_negative_ts make_zero -max_delay 500000 -max_muxing_queue_size 1024 -f mpegts ${o}')
  assert('copyts', s.copyts === true)
  assert('avoidNegativeTs', s.avoidNegativeTs === 'make_zero')
  assert('maxDelay', s.maxDelay === 500000)
  assert('maxMuxingQueueSize', s.maxMuxingQueueSize === 1024)
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n\x1b[1m═══ Section 6: parse() — Maps, logo, reconnect ═══\x1b[0m')
// ═══════════════════════════════════════════════════════════════════════════════

{
  const s = parse('ffmpeg -i ${i} -i /path/logo.png -map 0:v -map 0:a:0 -c:v libx264 -b:v 4M -filter_complex overlay -c:a aac -f mpegts ${o}')
  assert('logoPath', s.logoPath === '/path/logo.png')
  assert('maps', eq(s.maps, ['0:v', '0:a:0']))
}

{
  const s = parse('ffmpeg -reconnect 1 -reconnect_streamed 1 -listen 1 -i ${i} -c:v copy -c:a copy -f mpegts ${o}')
  assert('reconnect', s.reconnect === true)
  assert('reconnectStreamed', s.reconnectStreamed === true)
  assert('listen', s.listen === 1)
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n\x1b[1m═══ Section 7: parse() — Input type detection ═══\x1b[0m')
// ═══════════════════════════════════════════════════════════════════════════════

{
  assert('udp', parse('ffmpeg -i udp://239.0.0.1:1234 -c:v copy -c:a copy -f mpegts ${o}').inputType === 'udp')
  assert('rtp', parse('ffmpeg -i rtp://239.0.0.1:1234 -c:v copy -c:a copy -f mpegts ${o}').inputType === 'rtp')
  assert('rtmp', parse('ffmpeg -i rtmp://server/live -c:v copy -c:a copy -f flv ${o}').inputType === 'rtmp')
  assert('http', parse('ffmpeg -i http://server/stream -c:v copy -c:a copy -f mpegts ${o}').inputType === 'http')
  assert('https', parse('ffmpeg -i https://server/stream -c:v copy -c:a copy -f mpegts ${o}').inputType === 'http')
  assert('srt', parse('ffmpeg -i srt://server:1234 -c:v copy -c:a copy -f mpegts ${o}').inputType === 'srt')
  assert('file', parse('ffmpeg -i /path/to/file.ts -c:v copy -c:a copy -f mpegts ${o}').inputType === 'file')
  assert('template ${i}', parse('ffmpeg -i ${i} -c:v copy -c:a copy -f mpegts ${o}').inputType === 'udp')
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n\x1b[1m═══ Section 8: parse() — Passthrough flags ═══\x1b[0m')
// ═══════════════════════════════════════════════════════════════════════════════

{
  const s = parse('ffmpeg -custom_pre foo -i ${i} -c:v copy -c:a copy -custom_post bar -f mpegts ${o}')
  assert('passthroughPreInput', eq(s.passthroughPreInput, ['-custom_pre', 'foo']))
  assert('passthroughPostInput', eq(s.passthroughPostInput, ['-custom_post', 'bar']))
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n\x1b[1m═══ Section 9: parse() — Empty / edge cases ═══\x1b[0m')
// ═══════════════════════════════════════════════════════════════════════════════

{
  const s = parse('')
  assert('empty string', Object.keys(s).length === 0)
}
{
  const s = parse('  ')
  assert('whitespace only', Object.keys(s).length === 0)
}
{
  const s = parse(null)
  assert('null input', Object.keys(s).length === 0)
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n\x1b[1m═══ Section 10: serialize() — Basic serialization ═══\x1b[0m')
// ═══════════════════════════════════════════════════════════════════════════════

{
  const cmd = serialize({
    videoCodec: 'libx264',
    preset: 'medium',
    bitrateMode: 'cbr',
    targetBitrate: '4M',
    audioCodec: 'aac',
    audioBitrate: '128k',
    outputFormat: 'mpegts',
  })
  assert('contains -c:v libx264', cmd.includes('-c:v libx264'))
  assert('contains -preset medium', cmd.includes('-preset medium'))
  assert('contains -b:v 4M', cmd.includes('-b:v 4M'))
  assert('contains -maxrate 4M (CBR)', cmd.includes('-maxrate 4M'))
  assert('contains -c:a aac', cmd.includes('-c:a aac'))
  assert('contains -b:a 128k', cmd.includes('-b:a 128k'))
  assert('contains -f mpegts', cmd.includes('-f mpegts'))
  assert('starts with ffmpeg', cmd.startsWith('ffmpeg'))
  assert('ends with ${o}', cmd.endsWith('${o}'))
  assert('contains ${i}', cmd.includes('-i ${i}'))
}

{
  const cmd = serialize({ videoCodec: 'disabled', audioCodec: 'copy', outputFormat: 'mpegts' })
  assert('video disabled → -vn', cmd.includes('-vn'))
  assert('no -c:v when disabled', !cmd.includes('-c:v'))
}

{
  const cmd = serialize({ videoCodec: 'copy', audioCodec: 'disabled', outputFormat: 'mpegts' })
  assert('audio disabled → -an', cmd.includes('-an'))
  assert('no -c:a when disabled', !cmd.includes('-c:a'))
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n\x1b[1m═══ Section 11: serialize() — CRF and VBR modes ═══\x1b[0m')
// ═══════════════════════════════════════════════════════════════════════════════

{
  const cmd = serialize({ videoCodec: 'libx264', bitrateMode: 'crf', crfValue: 23, audioCodec: 'copy', outputFormat: 'mpegts' })
  assert('CRF → -crf 23', cmd.includes('-crf 23'))
  assert('no -b:v in CRF mode', !cmd.includes('-b:v'))
}

{
  const cmd = serialize({ videoCodec: 'libx264', bitrateMode: 'vbr', targetBitrate: '3M', maxrate: '5M', bufsize: '8M', audioCodec: 'copy', outputFormat: 'mpegts' })
  assert('VBR → -b:v 3M', cmd.includes('-b:v 3M'))
  assert('VBR → -maxrate 5M', cmd.includes('-maxrate 5M'))
  assert('VBR → -bufsize 8M', cmd.includes('-bufsize 8M'))
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n\x1b[1m═══ Section 12: serialize() — Pre-input flags ═══\x1b[0m')
// ═══════════════════════════════════════════════════════════════════════════════

{
  const cmd = serialize({
    hwaccel: 'cuda', hwaccelOutputFormat: 'cuda', gpuIndex: 0, nvdecDeint: 2,
    re: true, streamLoop: true, fflags: ['+genpts', '+igndts'],
    useWallclock: true, analyzeDuration: 5000000, probeSize: 10000000,
    timeout: 5000000, threadQueueSize: 1024,
    reconnect: true, reconnectStreamed: true, listen: 1,
    videoCodec: 'h264_nvenc', preset: 'p4', bitrateMode: 'cbr', targetBitrate: '4M',
    audioCodec: 'aac', outputFormat: 'mpegts',
  })
  assert('-hwaccel cuda', cmd.includes('-hwaccel cuda'))
  assert('-hwaccel_output_format cuda', cmd.includes('-hwaccel_output_format cuda'))
  assert('-gpu 0', cmd.includes('-gpu 0'))
  assert('-deint 2', cmd.includes('-deint 2'))
  assert('-re', cmd.includes(' -re '))
  assert('-stream_loop -1', cmd.includes('-stream_loop -1'))
  assert('-fflags +genpts+igndts', cmd.includes('-fflags +genpts+igndts'))
  assert('-use_wallclock_as_timestamps 1', cmd.includes('-use_wallclock_as_timestamps 1'))
  assert('-analyzeduration 5000000', cmd.includes('-analyzeduration 5000000'))
  assert('-probesize 10000000', cmd.includes('-probesize 10000000'))
  assert('-timeout 5000000', cmd.includes('-timeout 5000000'))
  assert('-thread_queue_size 1024', cmd.includes('-thread_queue_size 1024'))
  assert('-reconnect 1', cmd.includes('-reconnect 1'))
  assert('-reconnect_streamed 1', cmd.includes('-reconnect_streamed 1'))
  assert('-listen 1', cmd.includes('-listen 1'))
  // Pre-input flags must come before -i
  const idxHwaccel = cmd.indexOf('-hwaccel')
  const idxI = cmd.indexOf('-i ')
  assert('hwaccel before -i', idxHwaccel < idxI)
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n\x1b[1m═══ Section 13: serialize() — Output options ═══\x1b[0m')
// ═══════════════════════════════════════════════════════════════════════════════

{
  const cmd = serialize({
    videoCodec: 'libx264', bitrateMode: 'cbr', targetBitrate: '3M',
    audioCodec: 'aac',
    outputFormat: 'hls', hlsTime: 6, hlsListSize: 10,
    hlsFlags: ['delete_segments', 'append_list'], hlsSegmentType: 'fmp4',
  })
  assert('hls_time', cmd.includes('-hls_time 6'))
  assert('hls_list_size', cmd.includes('-hls_list_size 10'))
  assert('hls_flags', cmd.includes('-hls_flags delete_segments+append_list'))
  assert('hls_segment_type fmp4', cmd.includes('-hls_segment_type fmp4'))
}

{
  const cmd = serialize({
    videoCodec: 'copy', audioCodec: 'copy',
    outputFormat: 'mpegts', mpegtsServiceId: 1, mpegtsPmtStartPid: 256,
    mpegtsStartPid: 4096, mpegtsFlags: ['system_b', 'pat_pmt_at_frames'], pcrPeriod: 40,
  })
  assert('mpegts_service_id', cmd.includes('-mpegts_service_id 1'))
  assert('mpegts_pmt_start_pid', cmd.includes('-mpegts_pmt_start_pid 256'))
  assert('mpegts_start_pid', cmd.includes('-mpegts_start_pid 4096'))
  assert('mpegts_flags', cmd.includes('-mpegts_flags system_b+pat_pmt_at_frames'))
  assert('pcr_period', cmd.includes('-pcr_period 40'))
}

{
  const cmd = serialize({
    videoCodec: 'copy', audioCodec: 'copy', outputFormat: 'mpegts',
    copyts: true, avoidNegativeTs: 'make_zero', maxDelay: 500000, maxMuxingQueueSize: 1024,
  })
  assert('-copyts', cmd.includes('-copyts'))
  assert('-avoid_negative_ts make_zero', cmd.includes('-avoid_negative_ts make_zero'))
  assert('-max_delay 500000', cmd.includes('-max_delay 500000'))
  assert('-max_muxing_queue_size 1024', cmd.includes('-max_muxing_queue_size 1024'))
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n\x1b[1m═══ Section 14: serialize() — Custom placeholders ═══\x1b[0m')
// ═══════════════════════════════════════════════════════════════════════════════

{
  const cmd = serialize(
    { videoCodec: 'copy', audioCodec: 'copy', outputFormat: 'mpegts' },
    { inputPlaceholder: 'udp://239.0.0.1:1234', outputPlaceholder: 'udp://192.168.1.1:5000' }
  )
  assert('custom input placeholder', cmd.includes('-i udp://239.0.0.1:1234'))
  assert('custom output placeholder', cmd.endsWith('udp://192.168.1.1:5000'))
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n\x1b[1m═══ Section 15: Round-trip parse → serialize → parse ═══\x1b[0m')
// ═══════════════════════════════════════════════════════════════════════════════

{
  const original = 'ffmpeg -y -hide_banner -hwaccel cuda -hwaccel_output_format cuda -re -fflags +genpts -analyzeduration 5000000 -probesize 10000000 -timeout 5000000 -thread_queue_size 1024 -i ${i} -c:v h264_nvenc -preset p4 -profile:v main -s 1920x1080 -r 25 -g 50 -keyint_min 25 -forced-idr 1 -b:v 4M -maxrate 4M -bufsize 4M -pix_fmt yuv420p -level:v 4.1 -sc_threshold 0 -bf 2 -refs 3 -c:a aac -ar 48000 -ac 2 -b:a 128k -f mpegts ${o}'
  const state1 = parse(original)
  const reserialized = serialize(state1)
  const state2 = parse(reserialized)

  assert('RT videoCodec', state1.videoCodec === state2.videoCodec)
  assert('RT preset', state1.preset === state2.preset)
  assert('RT profile', state1.profile === state2.profile)
  assert('RT bitrateMode', state1.bitrateMode === state2.bitrateMode)
  assert('RT targetBitrate', state1.targetBitrate === state2.targetBitrate)
  assert('RT hwaccel', state1.hwaccel === state2.hwaccel)
  assert('RT hwaccelOutputFormat', state1.hwaccelOutputFormat === state2.hwaccelOutputFormat)
  assert('RT gop', state1.gop === state2.gop)
  assert('RT keyintMin', state1.keyintMin === state2.keyintMin)
  assert('RT scThreshold', state1.scThreshold === state2.scThreshold)
  assert('RT bframes', state1.bframes === state2.bframes)
  assert('RT refs', state1.refs === state2.refs)
  assert('RT pixFmt', state1.pixFmt === state2.pixFmt)
  assert('RT level', state1.level === state2.level)
  assert('RT forcedIdr', state1.forcedIdr === state2.forcedIdr)
  assert('RT audioCodec', state1.audioCodec === state2.audioCodec)
  assert('RT sampleRate', state1.sampleRate === state2.sampleRate)
  assert('RT channels', state1.channels === state2.channels)
  assert('RT audioBitrate', state1.audioBitrate === state2.audioBitrate)
  assert('RT outputFormat', state1.outputFormat === state2.outputFormat)
  assert('RT re', state1.re === state2.re)
  assert('RT fflags', eq(state1.fflags, state2.fflags))
  assert('RT analyzeDuration', state1.analyzeDuration === state2.analyzeDuration)
  assert('RT probeSize', state1.probeSize === state2.probeSize)
  assert('RT timeout', state1.timeout === state2.timeout)
  assert('RT threadQueueSize', state1.threadQueueSize === state2.threadQueueSize)
  assert('RT fps', state1.fps === state2.fps)
  assert('RT frameSize', state1.frameSize === state2.frameSize)
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n\x1b[1m═══ Section 16: Round-trip CRF mode ═══\x1b[0m')
// ═══════════════════════════════════════════════════════════════════════════════

{
  const original = 'ffmpeg -y -hide_banner -i ${i} -c:v libx265 -preset medium -crf 28 -c:a aac -b:a 128k -f matroska ${o}'
  const state1 = parse(original)
  const reserialized = serialize(state1)
  const state2 = parse(reserialized)
  assert('CRF RT bitrateMode', state1.bitrateMode === 'crf' && state2.bitrateMode === 'crf')
  assert('CRF RT crfValue', state1.crfValue === 28 && state2.crfValue === 28)
  assert('CRF RT videoCodec', state1.videoCodec === 'libx265' && state2.videoCodec === 'libx265')
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n\x1b[1m═══ Section 17: Round-trip VBR mode ═══\x1b[0m')
// ═══════════════════════════════════════════════════════════════════════════════

{
  const original = 'ffmpeg -y -hide_banner -i ${i} -c:v libx264 -preset fast -b:v 3M -maxrate 5M -bufsize 8M -c:a copy -f mpegts ${o}'
  const state1 = parse(original)
  const reserialized = serialize(state1)
  const state2 = parse(reserialized)
  assert('VBR RT bitrateMode', state1.bitrateMode === 'vbr' && state2.bitrateMode === 'vbr')
  assert('VBR RT targetBitrate', state1.targetBitrate === '3M' && state2.targetBitrate === '3M')
  assert('VBR RT maxrate', state1.maxrate === '5M' && state2.maxrate === '5M')
  assert('VBR RT bufsize', state1.bufsize === '8M' && state2.bufsize === '8M')
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n\x1b[1m═══ Section 18: Round-trip HLS ═══\x1b[0m')
// ═══════════════════════════════════════════════════════════════════════════════

{
  const original = 'ffmpeg -y -hide_banner -i ${i} -c:v libx264 -preset fast -b:v 3M -maxrate 3M -bufsize 3M -c:a aac -b:a 128k -f hls -hls_time 6 -hls_list_size 10 -hls_flags delete_segments+append_list -hls_segment_type fmp4 ${o}'
  const state1 = parse(original)
  const reserialized = serialize(state1)
  const state2 = parse(reserialized)
  assert('HLS RT hlsTime', state1.hlsTime === 6 && state2.hlsTime === 6)
  assert('HLS RT hlsListSize', state1.hlsListSize === 10 && state2.hlsListSize === 10)
  assert('HLS RT hlsFlags', eq(state1.hlsFlags, state2.hlsFlags))
  assert('HLS RT hlsSegmentType', state1.hlsSegmentType === 'fmp4' && state2.hlsSegmentType === 'fmp4')
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n\x1b[1m═══ Section 19: parse() output compatible with validate() ═══\x1b[0m')
// ═══════════════════════════════════════════════════════════════════════════════

{
  const state = parse('ffmpeg -y -hide_banner -hwaccel none -i ${i} -c:v h264_nvenc -preset p4 -b:v 4M -c:a aac -f mpegts ${o}')
  const results = validate(state)
  const hwaccelError = results.find(r => r.id === 'nvenc_no_hwaccel')
  assert('parse→validate detects hwaccel issue', hwaccelError !== undefined)
}

{
  const state = parse('ffmpeg -i ${i} -c:v copy -preset medium -c:a copy -f mpegts ${o}')
  const results = validate(state)
  const presetWarn = results.find(r => r.id === 'copy_video_preset')
  assert('parse→validate detects copy+preset', presetWarn !== undefined)
}

{
  const state = parse('ffmpeg -i ${i} -c:v libx264 -preset fast -b:v 4M -maxrate 4M -bufsize 8M -c:a aac -b:a 128k -ar 48000 -ac 2 -f mpegts ${o}')
  const results = validate(state)
  const errors = results.filter(r => r.severity === 'error')
  assert('valid command → no errors from validate()', errors.length === 0)
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n\x1b[1m═══ Section 20: serialize() output passable to parse() ═══\x1b[0m')
// ═══════════════════════════════════════════════════════════════════════════════

{
  const state = {
    videoCodec: 'h264_nvenc', hwaccel: 'cuda', hwaccelOutputFormat: 'cuda',
    preset: 'p4', profile: 'main', bitrateMode: 'cbr', targetBitrate: '5M',
    gop: 50, scThreshold: 0, audioCodec: 'aac', audioBitrate: '128k',
    sampleRate: '48000', channels: '2', outputFormat: 'mpegts',
  }
  const cmd = serialize(state)
  const reparsed = parse(cmd)
  assert('SRP videoCodec', reparsed.videoCodec === 'h264_nvenc')
  assert('SRP preset', reparsed.preset === 'p4')
  assert('SRP profile', reparsed.profile === 'main')
  assert('SRP bitrateMode', reparsed.bitrateMode === 'cbr')
  assert('SRP targetBitrate', reparsed.targetBitrate === '5M')
  assert('SRP gop', reparsed.gop === 50)
  assert('SRP scThreshold', reparsed.scThreshold === 0)
  assert('SRP audioCodec', reparsed.audioCodec === 'aac')
  assert('SRP audioBitrate', reparsed.audioBitrate === '128k')
  assert('SRP sampleRate', reparsed.sampleRate === '48000')
  assert('SRP channels', reparsed.channels === '2')
  assert('SRP outputFormat', reparsed.outputFormat === 'mpegts')
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n\x1b[1m═══ Section 21: serialize() with passthrough flags ═══\x1b[0m')
// ═══════════════════════════════════════════════════════════════════════════════

{
  const cmd = serialize({
    videoCodec: 'copy', audioCodec: 'copy', outputFormat: 'mpegts',
    passthroughPreInput: ['-custom_pre', 'foo'],
    passthroughPostInput: ['-custom_post', 'bar'],
  })
  assert('passthrough pre-input in cmd', cmd.includes('-custom_pre foo'))
  assert('passthrough post-input in cmd', cmd.includes('-custom_post bar'))

  // Verify order: pre-input before -i, post-input after codecs
  const idxPre = cmd.indexOf('-custom_pre')
  const idxI = cmd.indexOf('-i ')
  const idxPost = cmd.indexOf('-custom_post')
  assert('pre-input before -i', idxPre < idxI)
  assert('post-input after -i', idxPost > idxI)
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log(`\n\x1b[1m═══ Results: ${pass}/${pass + fail} passed ═══\x1b[0m`)
if (fail > 0) {
  console.log(`\x1b[31m${fail} test(s) FAILED\x1b[0m`)
  process.exit(1)
}
