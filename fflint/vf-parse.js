// vf-parse.js — Lightweight tokenizer for FFmpeg filter chains.
//
// Parses the value of `-vf` / `-filter:v` / `-filter_complex` into a list of
// atoms `[{ name, args, raw }]`. Only enough structure is extracted to support
// broadcast-oriented linting rules — unknown filters are preserved verbatim
// (their `raw` is kept) so round-trip via `vfChain` is lossless.
//
// Recognized atoms (positional → named arg mapping):
//   scale*      — args.w, args.h
//   fps         — args.fps
//   overlay     — args.x, args.y
//   format      — args.pix_fmts (joined with '|' if multiple)
//   yadif*/bwdif* — captured as-is (deinterlacers)

const HW_SCALE_FILTERS = new Set([
  'scale_cuda', 'scale_vaapi', 'scale_npp', 'scale_qsv',
])

const DEINTERLACE_FILTERS = new Set([
  'yadif', 'yadif_cuda', 'bwdif', 'bwdif_cuda',
])

/**
 * Split a string by `sep` at top level (depth 0).
 * Honors backslash escapes and `[...]` link-label nesting so that
 * `[in]overlay=10:10[out]` is not mis-split on `:`.
 */
function splitTopLevel(str, sep) {
  const parts = []
  let cur = ''
  let depth = 0
  let i = 0
  while (i < str.length) {
    const c = str[i]
    if (c === '\\' && i + 1 < str.length) {
      cur += c + str[i + 1]
      i += 2
      continue
    }
    if (c === '[') { depth++; cur += c; i++; continue }
    if (c === ']') { depth = Math.max(0, depth - 1); cur += c; i++; continue }
    if (c === sep && depth === 0) {
      parts.push(cur)
      cur = ''
      i++
      continue
    }
    cur += c
    i++
  }
  if (cur.length) parts.push(cur)
  return parts
}

function stripLabels(s) {
  let out = s.trim()
  // Leading [in] labels (one or more, possibly with whitespace between)
  while (out.startsWith('[')) {
    const end = out.indexOf(']')
    if (end === -1) break
    out = out.slice(end + 1).trimStart()
  }
  // Trailing [out] labels
  while (out.endsWith(']')) {
    const start = out.lastIndexOf('[')
    if (start === -1) break
    out = out.slice(0, start).trimEnd()
  }
  return out
}

function mapPositional(name, args, positional) {
  if (positional.length === 0) return
  if (name === 'scale' || name.startsWith('scale_')) {
    if (positional[0] !== undefined && args.w === undefined && args.width === undefined)
      args.w = positional[0]
    if (positional[1] !== undefined && args.h === undefined && args.height === undefined)
      args.h = positional[1]
  } else if (name === 'fps') {
    if (positional[0] !== undefined && args.fps === undefined)
      args.fps = positional[0]
  } else if (name === 'overlay') {
    if (positional[0] !== undefined && args.x === undefined) args.x = positional[0]
    if (positional[1] !== undefined && args.y === undefined) args.y = positional[1]
  } else if (name === 'format') {
    if (args.pix_fmts === undefined) args.pix_fmts = positional.join('|')
  }
}

function parseAtom(raw) {
  const original = raw
  const stripped = stripLabels(raw)
  if (!stripped) return null

  const eq = stripped.indexOf('=')
  let name, body
  if (eq === -1) { name = stripped; body = '' }
  else           { name = stripped.slice(0, eq); body = stripped.slice(eq + 1) }

  // Strip @instance_id (e.g. `scale@id`)
  const at = name.indexOf('@')
  if (at !== -1) name = name.slice(0, at)
  name = name.trim()
  if (!name) return null

  const args = {}
  if (body) {
    const parts = splitTopLevel(body, ':')
    const positional = []
    for (const p of parts) {
      const eq2 = p.indexOf('=')
      if (eq2 === -1) {
        positional.push(p.trim())
      } else {
        const key = p.slice(0, eq2).trim()
        const val = p.slice(eq2 + 1).trim()
        if (key) args[key] = val
      }
    }
    mapPositional(name, args, positional)
  }

  return { name, args, raw: original.trim() }
}

/**
 * Parse a filter-chain string into atoms.
 * @param {string} str
 * @returns {{chain: string, atoms: Array<{name: string, args: object, raw: string}>}}
 */
export function parseFilterChain(str) {
  if (!str) return { chain: '', atoms: [] }
  const chain = String(str)
  const atoms = splitTopLevel(chain, ',')
    .map(parseAtom)
    .filter(a => a !== null)
  return { chain, atoms }
}

/**
 * Find a deinterlacer atom in the chain (returns its `name`, or '').
 */
export function findDeinterlacer(atoms) {
  if (!Array.isArray(atoms)) return ''
  const a = atoms.find(x => DEINTERLACE_FILTERS.has(x.name))
  return a ? a.name : ''
}

/**
 * Find the (first) scale atom and its WxH if both are numeric.
 * @returns {{w: string, h: string, atom: object} | null}
 */
export function getScaleSize(atoms) {
  if (!Array.isArray(atoms)) return null
  const a = atoms.find(x => x.name === 'scale' || x.name.startsWith('scale_'))
  if (!a) return null
  const w = a.args.w ?? a.args.width
  const h = a.args.h ?? a.args.height
  if (w === undefined || h === undefined) return null
  return { w: String(w), h: String(h), atom: a }
}

/**
 * True when the chain contains a hardware-accelerated scaler.
 */
export function hasHwScale(atoms) {
  if (!Array.isArray(atoms)) return false
  return atoms.some(x => HW_SCALE_FILTERS.has(x.name))
}

export { HW_SCALE_FILTERS, DEINTERLACE_FILTERS }
