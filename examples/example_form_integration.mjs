// example_form_integration.mjs — Demonstrates how to integrate parse/serialize with a form UI
// Usage: node examples/example_form_integration.mjs

import { parse, validate, serialize } from '../fflint/fflint.js'
import { VALID_VIDEO_CODECS, VALID_AUDIO_CODECS, PRESETS, CODEC_PRESET_FAMILY } from '../fflint/codec-data.js'

// ── Simulate: user opens editor, loads a stored profile command ───────────────
const storedCommand = 'ffmpeg -y -hide_banner -hwaccel cuda -hwaccel_output_format cuda -re -i ${i} -c:v h264_nvenc -preset p4 -profile:v main -g 50 -b:v 4M -maxrate 4M -bufsize 4M -sc_threshold 0 -c:a aac -b:a 128k -ar 48000 -ac 2 -f mpegts ${o}'

// Step 1: Parse to populate form fields
const formState = parse(storedCommand)

console.log('Form populated from stored command:')
console.log(`  Video Codec:  ${formState.videoCodec}`)
console.log(`  HW Accel:     ${formState.hwaccel}`)
console.log(`  Preset:       ${formState.preset}`)
console.log(`  Bitrate Mode: ${formState.bitrateMode}`)
console.log(`  Bitrate:      ${formState.targetBitrate}`)
console.log(`  Audio Codec:  ${formState.audioCodec}`)
console.log(`  Audio Rate:   ${formState.sampleRate}`)
console.log(`  Output:       ${formState.outputFormat}`)
console.log()

// Step 2: Show available presets for the parsed codec (for dropdown)
const presetFamily = CODEC_PRESET_FAMILY[formState.videoCodec]
const availablePresets = presetFamily ? PRESETS[presetFamily] : []
console.log(`Available presets for ${formState.videoCodec}: ${availablePresets.join(', ')}`)
console.log()

// Step 3: User changes the codec via form
formState.videoCodec = 'libx264'
formState.preset = 'fast'
formState.hwaccel = undefined  // CPU codec, no hwaccel
formState.hwaccelOutputFormat = undefined

// Step 4: Validate after change
const issues = validate(formState)
const errors = issues.filter(r => r.severity === 'error')
console.log(`After switching to libx264:`)
console.log(`  Errors:   ${errors.length}`)
console.log(`  Warnings: ${issues.filter(r => r.severity === 'warning').length}`)
console.log(`  Infos:    ${issues.filter(r => r.severity === 'info').length}`)
for (const r of issues) {
  console.log(`  [${r.severity}] ${r.flag || ''} ${r.message}`)
}
console.log()

// Step 5: Save — serialize back to command string
const newCommand = serialize(formState)
console.log('New command to store:')
console.log(newCommand)
