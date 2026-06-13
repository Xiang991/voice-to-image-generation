const LANG = 'zh-CN'

let voicesCache = null
let voicesReady = false

function loadVoices() {
  if (typeof speechSynthesis === 'undefined') return Promise.resolve([])
  const voices = speechSynthesis.getVoices()
  if (voices.length > 0) {
    voicesCache = voices
    voicesReady = true
    return Promise.resolve(voices)
  }
  return new Promise((resolve) => {
    const handler = () => {
      voicesCache = speechSynthesis.getVoices()
      voicesReady = true
      speechSynthesis.removeEventListener('voiceschanged', handler)
      resolve(voicesCache)
    }
    speechSynthesis.addEventListener('voiceschanged', handler)
  })
}

function pickVoice(voices) {
  if (!voices || voices.length === 0) return null
  const zh = voices.filter((v) => v.lang.startsWith('zh'))
  if (zh.length > 0) return zh[0]
  const en = voices.filter((v) => v.lang.startsWith('en'))
  if (en.length > 0) return en[0]
  return voices[0]
}

// Start preloading immediately
loadVoices()

export async function speak(text, onEnd) {
  if (typeof speechSynthesis === 'undefined') {
    if (onEnd) onEnd()
    return
  }

  if (!voicesReady) {
    await loadVoices()
  }

  speechSynthesis.cancel()

  const utter = new SpeechSynthesisUtterance(text)
  utter.lang = LANG
  utter.rate = 1.1

  const voice = pickVoice(voicesCache)
  if (voice) utter.voice = voice

  if (onEnd) {
    utter.onend = onEnd
    utter.onerror = () => onEnd()
  }

  speechSynthesis.speak(utter)
}

export function stopSpeaking() {
  if (typeof speechSynthesis !== 'undefined') {
    speechSynthesis.cancel()
  }
}
