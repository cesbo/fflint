// i18n.js
import enCatalog from './locales/en.js'

let _catalog = enCatalog

export function setLocale(catalog) {
  _catalog = catalog || enCatalog
}

export function t(id, params = {}) {
  const entry = _catalog?.[id] || enCatalog?.[id]
  if (!entry) return { message: id }
  return {
    message: typeof entry.message === 'function' ? entry.message(params) : entry.message,
    hint: entry.hint === undefined ? params.hint :
      typeof entry.hint === 'function' ? entry.hint(params) : entry.hint,
  }
}
