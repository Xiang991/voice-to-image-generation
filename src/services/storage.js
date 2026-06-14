const STORAGE_KEY = 'ai-voice-painter:layers'
const MAX_BYTES = 4 * 1024 * 1024 // 4 MB — leave room for other localStorage usage

export function saveLayers(layers) {
  try {
    const json = JSON.stringify({ version: 1, layers })
    if (json.length > MAX_BYTES) {
      console.warn('storage: layers too large, skipping auto-save', json.length)
      return { ok: false, reason: 'too large' }
    }
    localStorage.setItem(STORAGE_KEY, json)
    return { ok: true }
  } catch (err) {
    console.warn('storage: save failed', err)
    return { ok: false, reason: err.message }
  }
}

export function loadLayers() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed?.layers)) return null
    return parsed.layers
  } catch {
    return null
  }
}

export function clearLayers() {
  localStorage.removeItem(STORAGE_KEY)
}
