// validate-raw.js
// Convenience wrapper: validate a raw ffmpeg command string without a form/state.
//
// Usage:
//   import { validateRaw } from './fflint/validate-raw.js'
//   console.log(validateRaw('ffmpeg -y -i ${i} -c:v h264_nvenc -f mpegts ${o}'))
//   // → [ { severity: 'error'|'warning'|'info', message: '...', flag?, group?, layer? }, ... ]

import { validate as fflintValidate } from './fflint.js'
import { t } from './i18n.js'
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
    const tok = tokens[i]

    // Normalize stream-indexed specifiers: -c:a:0 → -c:a, -b:v:1 → -b:v
    const nt = tok.replace(/^(-[a-z_]+:[vasd]):\d+$/i, '$1')
    const isStreamIndexed = nt !== tok

    if (tok === '-i') hasInput = true

    // Detect tokens that look like flags missing their leading dash
    if (!tok.startsWith('-') && !tok.startsWith('${') && BARE_FLAG_NAMES.has(tok)) {
      // Only warn if this token is not a value for the preceding flag
      if (i === 0 || !tokens[i - 1].startsWith('-') || !VALUE_FLAGS.has(tokens[i - 1])) {
        results.push({ severity: 'warning', message: t('raw_missing_dash', { flag: tok }).message })
      }
    }

    if (!tok.startsWith('-') || tok.startsWith('${')) continue
    if (/^-\d+(\.\d+)?$/.test(tok)) continue
    if (!KNOWN_FLAGS.has(nt)) { unknownFlags.push(tok); continue }

    // Phase 3: Track flag values for duplicate detection
    // Stream-indexed flags (-c:a:0, -c:a:1) are inherently repeatable
    if (!REPEATABLE_FLAGS.has(nt) && !isStreamIndexed) {
      const val = VALUE_FLAGS.has(nt) ? (tokens[i + 1] || '') : ''
      if (seen[tok]) {
        if (flagValues[tok] === val) {
          results.push({ severity: 'info', message: t('raw_duplicate_same', { flag: tok }).message })
        } else {
          results.push({ severity: 'warning', message: t('raw_duplicate_diff', { flag: tok }).message })
        }
      }
      flagValues[tok] = val
    }
    seen[tok] = true

    // Phase 1: Flag ordering validation
    if (!DUAL_USE_FLAGS.has(nt) && !GLOBAL_FLAGS.has(nt) && firstInputIdx >= 0) {
      if (POST_INPUT_FLAGS.has(nt) && i < firstInputIdx) {
        results.push({ severity: 'warning', message: t('raw_flag_before_input', { flag: tok }).message })
      }
      if (PRE_INPUT_FLAGS.has(nt) && i > firstInputIdx) {
        results.push({ severity: 'warning', message: t('raw_flag_after_input', { flag: tok }).message })
      }
    }

    // Phase 1.3: Detect options after the output target
    if (outputTargetIdx >= 0 && i > outputTargetIdx) {
      results.push({ severity: 'error', message: t('raw_flag_after_output', { flag: tok }).message })
    }

    // Check for missing value: flag expects a value but next token is missing or is another known flag
    if (VALUE_FLAGS.has(nt)) {
      const next = tokens[i + 1]
      if (next === undefined) {
        results.push({ severity: 'error', message: t('raw_missing_value_eof', { flag: tok }).message })
      } else if (next.startsWith('-') && !next.startsWith('${') && !/^-\d+(\.\d+)?$/.test(next) && KNOWN_FLAGS.has(next.replace(/^(-[a-z_]+:[vasd]):\d+$/i, '$1'))) {
        results.push({ severity: 'error', message: t('raw_missing_value_next', { flag: tok, next }).message })
      }
    }
  }

  if (!hasInput && tokens.length > 1)
    results.push({ severity: 'error', message: t('raw_no_input').message })

  // Phase 2: Missing output
  if (hasInput && !outputTarget && tokens.length > 1) {
    // Check if there's a template variable as output (last token is ${...})
    const lastToken = tokens[tokens.length - 1]
    const lastNonFlagIsTemplate = lastToken.startsWith('${')
    if (!lastNonFlagIsTemplate)
      results.push({ severity: 'error', message: t('raw_no_output').message })
  }

  // Phase 2.3: Format/extension mismatch
  if (outputTarget && seen['-f']) {
    const fmtValue = flagValues['-f']
    const extMatch = outputTarget.match(/(\.[a-z0-9]+)$/i)
    if (fmtValue && extMatch) {
      const ext = extMatch[1].toLowerCase()
      const expectedExts = FORMAT_EXTENSIONS[fmtValue]
      if (expectedExts && !expectedExts.includes(ext)) {
        results.push({ severity: 'warning', message: t('raw_format_ext_mismatch', { fmt: fmtValue, ext, expected: expectedExts.join(' or ') }).message })
      }
    }
  }

  if (seen['-vn'] && seen['-c:v']) results.push({ severity: 'error', message: t('raw_vn_cv_conflict').message })
  if (seen['-an'] && seen['-c:a']) results.push({ severity: 'error', message: t('raw_an_ca_conflict').message })
  if (seen['-crf'] && seen['-b:v']) results.push({ severity: 'error', message: t('raw_crf_bv_conflict').message })

  // Phase 4: Multi-input without -map
  let inputCount = 0
  for (const tok of tokens) { if (tok === '-i') inputCount++ }
  if (inputCount > 1 && !seen['-map'])
    results.push({ severity: 'warning', message: t('raw_multi_input_no_map').message })

  // Phase 5: Pipe I/O advisory
  for (let j = 0; j < tokens.length; j++) {
    if (tokens[j] === '-i') {
      const inp = tokens[j + 1] || ''
      if (inp === '-' || inp === 'pipe:0')
        results.push({ severity: 'info', message: t('raw_pipe_input').message })
    }
  }
  if (outputTarget === '-' || outputTarget === 'pipe:1')
    results.push({ severity: 'info', message: t('raw_pipe_output').message })

  if (unknownFlags.length) results.push({ severity: 'warning', message: t('raw_unknown_flags', { flags: unknownFlags.join(', ') }).message })

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
    return [{ severity: 'error', message: t('raw_empty').message }]
  }

  const structural = structuralChecks(rawText)
  const state      = parse(rawText)
  const semantic   = fflintValidate(state, options)

  return [...structural, ...semantic]
}
