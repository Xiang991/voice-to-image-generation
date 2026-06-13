import { CONFIG } from '../config.js'

export async function runAgent(text, canvasSummary = []) {
  const res = await fetch(`${CONFIG.proxyUrl}/api/agent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, canvasSummary })
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Proxy ${res.status}: ${err}`)
  }

  return res.json()
}
