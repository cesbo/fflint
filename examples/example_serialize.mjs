// example_serialize.mjs — Build an FFmpeg command string from a fflint state object
// Usage: node examples/example_serialize.mjs

import { serialize } from '../fflint/serialize.js'

// Build a command from a state object (same schema as validate() accepts)
const state = {
  inputType:          'udp',
  videoCodec:         'h264_nvenc',
  hwaccel:            'cuda',
  hwaccelOutputFormat:'cuda',
  preset:             'p4',
  profile:            'main',
  bitrateMode:        'cbr',
  targetBitrate:      '5M',
  frameSize:          '1920x1080',
  fps:                '25',
  gop:                50,
  keyintMin:          25,
  scThreshold:        0,
  forcedIdr:          true,
  pixFmt:             'yuv420p',
  audioCodec:         'aac',
  sampleRate:         '48000',
  channels:           '2',
  audioBitrate:       '128k',
  outputFormat:       'mpegts',
  re:                 true,
  fflags:             ['+genpts'],
  threadQueueSize:    1024,
}

// Default: uses ${i} and ${o} as placeholders (Senta convention)
const cmd1 = serialize(state)
console.log('With default placeholders:')
console.log(cmd1)
console.log()

// Custom placeholders: use real URLs
const cmd2 = serialize(state, {
  inputPlaceholder:  'udp://239.0.0.1:1234?pkt_size=1316',
  outputPlaceholder: 'udp://192.168.1.1:5000?pkt_size=1316',
})
console.log('With real URLs:')
console.log(cmd2)
