// fflint.js
import { rules }          from './rules.js'
import { validateLayer1 } from './layer1.js'

/** Library version number */
export const VERSION = '1.1.0'

/**
 * Validate an FFmpeg profile state object.
 *
 * @param {object} state                          All fields optional.
 * @param {object} [options]
 * @param {boolean} [options.broadcastRules=true] Include Layer 3 DVB/IPTV rules.
 * @param {Array}   [options.customRules=[]]      Extra rules to append.
 * @returns {Array} Result objects { id, group, severity, message, flag, layer }
 */
export function validate(state, options = {}) {
  const { broadcastRules = true, customRules = [] } = options

  const activeRules = [
    ...rules.filter(r => broadcastRules || r.layer !== 3),
    ...customRules,
  ]

  const l1   = validateLayer1(state)
  const l2l3 = activeRules
    .filter(r => r.check(state))
    .map(({ id, group, severity, flag, layer, message: rawMessage }) => ({
      id,
      group,
      severity,
      flag,
      layer,
      message: typeof rawMessage === 'function' ? rawMessage(state) : rawMessage,
    }))
  return deduplicate([...l1, ...l2l3])
}

function deduplicate(results) {
  const best = new Map()
  for (const r of results) {
    const existing = best.get(r.group)
    if (!existing || rank(r.severity) > rank(existing.severity))
      best.set(r.group, r)
  }
  return [...best.values()]
}

function rank(s) {
  return { info: 0, warning: 1, error: 2 }[s] ?? 0
}
