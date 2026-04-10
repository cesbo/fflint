// example_parse.mjs — Parse an FFmpeg command string into a fflint state object
// Usage: node examples/example_parse.mjs

import { parse } from '../fflint/parse.js'

// Parse a full FFmpeg command string
const command = 'ffmpeg -y -hide_banner -hwaccel cuda -hwaccel_output_format cuda -re -fflags +genpts -thread_queue_size 1024 -i ${i} -c:v h264_nvenc -preset p4 -profile:v main -s 1920x1080 -r 25 -g 50 -keyint_min 25 -b:v 5M -maxrate 5M -bufsize 5M -sc_threshold 0 -forced-idr 1 -pix_fmt yuv420p -c:a aac -ar 48000 -ac 2 -b:a 128k -f mpegts ${o}'

const state = parse(command)

console.log('Parsed fflint state:\n')
console.log(JSON.stringify(state, null, 2))

// The returned state uses fflint schema field names:
//   videoCodec, preset, profile, bitrateMode, targetBitrate,
//   hwaccel, hwaccelOutputFormat, gop, etc.
//
// This object can be:
//  1. Passed directly to validate() for validation
//  2. Used to populate a form/UI
//  3. Passed to serialize() to reconstruct the command
