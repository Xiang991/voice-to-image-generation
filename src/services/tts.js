const LANG = 'zh-CN'

function pickVoice() {
  if (typeof speechSynthesis === 'undefined') return null
  const voices = speechSynthesis.getVoices()
  if (voices.length === 0) return null

  const zh = voices.filter((v) => v.lang.startsWith('zh'))
  if (zh.length > 0) return zh[0]

  const en = voices.filter((v) => v.lang.startsWith('en'))
  if (en.length > 0) return en[0]

  return voices[0]
}

export function speak(text, onEnd) {
  if (typeof speechSynthesis === 'undefined') {
    if (onEnd) onEnd()
    return
  }

  speechSynthesis.cancel()

  const utter = new SpeechSynthesisUtterance(text)
  utter.lang = LANG
  utter.rate = 1.1

  const voice = pickVoice()
  if (voice) utter.voice = voice

  if (onEnd) {
    utter.onend = onEnd
  }

  speechSynthesis.speak(utter)
}

export function stopSpeaking() {
  if (typeof speechSynthesis !== 'undefined') {
    speechSynthesis.cancel()
  }
}
