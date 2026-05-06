// i18n.js
import enCatalog from './locales/en.js'

let _catalog = enCatalog

export function setLocale(catalog) {
  _catalog = catalog
}

export function t(id, params = {}) {
  const entry = _catalog?.[id]
  if (!entry) return params
  return {
    message: typeof entry.message === 'function' ? entry.message(params) : entry.message,
    hint:    entry.hint === undefined ? params.hint :
             typeof entry.hint    === 'function' ? entry.hint(params)    : entry.hint,
  }
}
