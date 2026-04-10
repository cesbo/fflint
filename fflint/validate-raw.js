// validate-raw.js
// Convenience wrapper: validate a raw ffmpeg command string without a form/state.
//
// Usage:
//   import { validateRaw } from './fflint/validate-raw.js'
//   console.log(validateRaw('ffmpeg -y -i ${i} -c:v h264_nvenc -f mpegts ${o}'))
//   // → [ { severity: 'error'|'warning'|'info', message: '...', flag?, group?, layer? }, ... ]

import { validate as fflintValidate } from './fflint.js'
//ToDo NO_VALUE_FLAGS is imported but not used in this file. Should we remove it or is it intended for future use?
import { parse, KNOWN_FLAGS, VALUE_FLAGS, NO_VALUE_FLAGS } from './parse.js'

// ─── Phase sets for flag ordering validation ──────────────────────────────────
const PRE_INPUT_FLAGS = new Set([
  '-hwaccel', '-hwaccel_output_format', '-hwaccel_device', '-fflags', '-thread_queue_size',
  '-analyzeduration', '-probesize', '-re', '-stream_loop', '-deint', '-gpu',
  '-max_delay', '-timeout', '-reconnect', '-reconnect_streamed', '-listen',
  '-use_wallclock_as_timestamps',
])

const POST_INPUT_FLAGS = new Set([
  '-preset', '-tune', '-profile:v', '-tier', '-b:v', '-crf', '-maxrate', '-bufsize',
  '-g', '-keyint_min', '-sc_threshold', '-bf', '-refs', '-pix_fmt',
  '-level', '-level:v', '-field_order', '-color_primaries', '-color_trc',
  '-colorspace', '-bsf:v', '-vf', '-filter:v', '-b:a', '-bsf:a', '-af',
  '-x264opts', '-x265-params', '-lookahead', '-vframes',
  '-f', '-hls_time', '-hls_list_size', '-hls_flags', '-hls_segment_type', '-hls_segment_filename',
  '-mpegts_service_id', '-mpegts_pmt_start_pid', '-mpegts_start_pid',
  '-mpegts_flags', '-pcr_period', '-map', '-fps_mode',
  '-max_muxing_queue_size', '-aspect', '-avoid_negative_ts',
  '-vn', '-an', '-forced-idr', '-channel_layout',
])

const GLOBAL_FLAGS = new Set([
  '-y', '-hide_banner', '-nostdin', '-loglevel', '-v', '-copyts',
])

// Dual-use flags exempt from ordering checks
const DUAL_USE_FLAGS = new Set(['-c', '-c:v', '-c:a'])

// Flags that may appear multiple times
const REPEATABLE_FLAGS = new Set(['-map', '-i', '-filter_complex', '-vf', '-filter:v', '-c', '-c:v', '-c:a'])

// Format → expected extensions mapping
const FORMAT_EXTENSIONS = {
  mpegts:   ['.ts'],
  mp4:      ['.mp4'],
  flv:      ['.flv'],
  hls:      ['.m3u8'],
  matroska: ['.mkv'],
}

// Bare flag names (without leading dash) for detecting missing-dash typos
// Only include names ≥ 3 chars to avoid false positives on short values
const BARE_FLAG_NAMES = new Set(
  [...KNOWN_FLAGS]
    .map(f => f.replace(/^-/, ''))
    .filter(f => f.length >= 3 && f !== 'ffmpeg')
)

// ─── Text-level structural checks (duplicate/conflicting flags) ───────────────

function structuralChecks(rawText) {
  const results = []
  const tokens = rawText.match(/"[^"]*"|\S+/g) || []
  const seen = {}
  const flagValues = {}
  const unknownFlags = []
  let hasInput = false
  let firstInputIdx = -1

  // Find the first -i index for ordering checks
  for (let j = 0; j < tokens.length; j++) {
    if (tokens[j] === '-i') { firstInputIdx = j; break }
  }

  // Find output target index (last non-flag, non-template token that is not a flag value)
  let outputTargetIdx = -1
  let outputTarget = ''
  for (let j = tokens.length - 1; j >= 0; j--) {
    const tok = tokens[j]
    // Skip template variables
    if (tok.startsWith('${')) break
    // "-" and "pipe:N" are valid output targets
    if (tok === '-' || /^pipe:\d+$/.test(tok)) {
      outputTarget = tok
      outputTargetIdx = j
      break
    }
    if (tok.startsWith('-')) continue
    // Skip values that belong to the preceding flag
    if (j > 0 && tokens[j - 1].startsWith('-') && !tokens[j - 1].startsWith('${')) {
      const prevNorm = tokens[j - 1].replace(/^(-[a-z_]+:[vasd]):\d+$/i, '$1')
      if (VALUE_FLAGS.has(prevNorm)) continue
    }
    // Skip 'ffmpeg' at position 0
    if (tok === 'ffmpeg') continue
    outputTarget = tok
    outputTargetIdx = j
    break
  }

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]

    // Normalize stream-indexed specifiers: -c:a:0 → -c:a, -b:v:1 → -b:v
    const nt = t.replace(/^(-[a-z_]+:[vasd]):\d+$/i, '$1')
    const isStreamIndexed = nt !== t

    if (t === '-i') hasInput = true

    // Detect tokens that look like flags missing their leading dash
    if (!t.startsWith('-') && !t.startsWith('${') && BARE_FLAG_NAMES.has(t)) {
      // Only warn if this token is not a value for the preceding flag
      if (i === 0 || !tokens[i - 1].startsWith('-') || !VALUE_FLAGS.has(tokens[i - 1])) {
        results.push({ severity: 'warning', message: `"${t}" looks like a flag missing its dash — did you mean "-${t}"?` })
      }
    }

    if (!t.startsWith('-') || t.startsWith('${')) continue
    if (/^-\d+(\.\d+)?$/.test(t)) continue
    if (!KNOWN_FLAGS.has(nt)) { unknownFlags.push(t); continue }

    // Phase 3: Track flag values for duplicate detection
    // Stream-indexed flags (-c:a:0, -c:a:1) are inherently repeatable
    if (!REPEATABLE_FLAGS.has(nt) && !isStreamIndexed) {
      const val = VALUE_FLAGS.has(nt) ? (tokens[i + 1] || '') : ''
      if (seen[t]) {
        if (flagValues[t] === val) {
          results.push({ severity: 'info', message: `${t} appears more than once with the same value — redundant` })
        } else {
          results.push({ severity: 'warning', message: `${t} appears twice with different values — only the last value is used` })
        }
      }
      flagValues[t] = val
    }
    seen[t] = true

    // Phase 1: Flag ordering validation
    if (!DUAL_USE_FLAGS.has(nt) && !GLOBAL_FLAGS.has(nt) && firstInputIdx >= 0) {
      if (POST_INPUT_FLAGS.has(nt) && i < firstInputIdx) {
        results.push({ severity: 'warning', message: `${t} is an output/encoding flag but appears before -i — it should be placed after the input` })
      }
      if (PRE_INPUT_FLAGS.has(nt) && i > firstInputIdx) {
        results.push({ severity: 'warning', message: `${t} is an input flag but appears after -i — it should be placed before the input` })
      }
    }

    // Phase 1.3: Detect options after the output target
    if (outputTargetIdx >= 0 && i > outputTargetIdx) {
      results.push({ severity: 'error', message: `${t} appears after the output target — options after output are not applied by FFmpeg` })
    }

    // Check for missing value: flag expects a value but next token is missing or is another known flag
    if (VALUE_FLAGS.has(nt)) {
      const next = tokens[i + 1]
      if (next === undefined) {
        results.push({ severity: 'error', message: `${t} at end of command is missing its value` })
      } else if (next.startsWith('-') && !next.startsWith('${') && !/^-\d+(\.\d+)?$/.test(next) && KNOWN_FLAGS.has(next.replace(/^(-[a-z_]+:[vasd]):\d+$/i, '$1'))) {
        results.push({ severity: 'error', message: `${t} is followed by ${next} — the value for ${t} appears to be missing` })
      }
    }
  }

  if (!hasInput && tokens.length > 1)
    results.push({ severity: 'error', message: 'No -i (input) flag found — FFmpeg requires at least one input' })

  // Phase 2: Missing output
  if (hasInput && !outputTarget && tokens.length > 1) {
    // Check if there's a template variable as output (last token is ${...})
    const lastToken = tokens[tokens.length - 1]
    const lastNonFlagIsTemplate = lastToken.startsWith('${')
    if (!lastNonFlagIsTemplate)
      results.push({ severity: 'error', message: 'No output file/URL specified' })
  }

  // Phase 2.3: Format/extension mismatch
  if (outputTarget && seen['-f']) {
    const fmtValue = flagValues['-f']
    const extMatch = outputTarget.match(/(\.[a-z0-9]+)$/i)
    if (fmtValue && extMatch) {
      const ext = extMatch[1].toLowerCase()
      const expectedExts = FORMAT_EXTENSIONS[fmtValue]
      if (expectedExts && !expectedExts.includes(ext)) {
        results.push({ severity: 'warning', message: `-f ${fmtValue} but output file extension is "${ext}" — expected ${expectedExts.join(' or ')}` })
      }
    }
  }

  if (seen['-vn'] && seen['-c:v']) results.push({ severity: 'error', message: '-vn and -c:v are both present.' })
  if (seen['-an'] && seen['-c:a']) results.push({ severity: 'error', message: '-an and -c:a are both present.' })
  if (seen['-crf'] && seen['-b:v']) results.push({ severity: 'error', message: '-crf and -b:v should not both be present.' })

  // Phase 4: Multi-input without -map
  let inputCount = 0
  for (const tok of tokens) { if (tok === '-i') inputCount++ }
  if (inputCount > 1 && !seen['-map'])
    results.push({ severity: 'warning', message: 'Multiple inputs without -map — FFmpeg will auto-select streams, which may not be what you want' })

  // Phase 5: Pipe I/O advisory
  for (let j = 0; j < tokens.length; j++) {
    if (tokens[j] === '-i') {
      const inp = tokens[j + 1] || ''
      if (inp === '-' || inp === 'pipe:0')
        results.push({ severity: 'info', message: 'Pipe input detected (-i - / pipe:0) — ensure the feeding process writes a supported container format' })
    }
  }
  if (outputTarget === '-' || outputTarget === 'pipe:1')
    results.push({ severity: 'info', message: 'Pipe output detected (- / pipe:1) — ensure the receiving process can consume the output format' })

  if (unknownFlags.length) results.push({ severity: 'warning', message: 'Unrecognized flag(s): ' + unknownFlags.join(', ') })

  return results
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Validate a raw ffmpeg command string.
 * Returns an array of result objects: { severity, message, flag?, group?, layer? }
 *
 * @param {string} rawText  Full ffmpeg command string.
 * @param {object} [options]
 * @param {boolean} [options.broadcastRules=true]  Include Layer 3 DVB/IPTV rules.
 * @returns {Array}
 */
export function validateRaw(rawText, options = {}) {
  if (!rawText || !rawText.trim()) {
    return [{ severity: 'error', message: 'Command is empty.' }]
  }

  const structural = structuralChecks(rawText)
  const state      = parse(rawText)
  const semantic   = fflintValidate(state, options)

  return [...structural, ...semantic]
}
