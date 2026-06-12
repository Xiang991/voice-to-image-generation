import { useState, useRef, useCallback } from 'react'

export default function VoiceInput({ onSubmit, disabled }) {
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState(null)
  const [supported, setSupported] = useState(true)

  const recognitionRef = useRef(null)
  const transcriptRef = useRef('')
  const disposedRef = useRef(false)

  const stopRecognition = useCallback(() => {
    const rec = recognitionRef.current
    if (rec) {
      recognitionRef.current = null
      try { rec.stop() } catch (_) { /* already stopped */ }
    }
  }, [])

  const startListening = useCallback(() => {
    if (disabled) return

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setSupported(false)
      setError('浏览器不支持语音识别，请使用 Chrome 或 Edge')
      return
    }

    stopRecognition()

    const rec = new SpeechRecognition()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = 'zh-CN'

    let final = ''
    disposedRef.current = false

    rec.onresult = (event) => {
      if (disposedRef.current) return
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i]
        if (r.isFinal) final += r[0].transcript
        else interim += r[0].transcript
      }
      const display = final + interim
      transcriptRef.current = display
      setTranscript(display)
    }

    rec.onerror = (event) => {
      if (disposedRef.current) return
      if (event.error === 'not-allowed') {
        setError('麦克风权限被拒绝，请在浏览器设置中允许麦克风访问')
      } else if (event.error !== 'aborted') {
        setError(`语音识别出错：${event.error}`)
      }
      setListening(false)
    }

    rec.onend = () => {
      if (disposedRef.current) return
      setListening(false)
    }

    recognitionRef.current = rec
    setTranscript('')
    setError(null)
    setListening(true)
    rec.start()
  }, [disabled, stopRecognition])

  const finishListening = useCallback(() => {
    disposedRef.current = true
    stopRecognition()
    setListening(false)

    const text = transcriptRef.current.trim()
    if (text && !disabled) {
      onSubmit(text)
    }
    transcriptRef.current = ''
    setTranscript('')
  }, [stopRecognition, disabled, onSubmit])

  const handlePointerDown = useCallback((e) => {
    e.preventDefault()
    startListening()
  }, [startListening])

  const handlePointerUp = useCallback((e) => {
    e.preventDefault()
    if (listening) finishListening()
  }, [listening, finishListening])

  if (!supported) {
    return (
      <div className="voice-input">
        <p className="voice-error">{error}</p>
      </div>
    )
  }

  return (
    <div className="voice-input">
      <button
        className={`voice-btn${listening ? ' is-recording' : ''}`}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={listening ? handlePointerUp : undefined}
        disabled={disabled}
        type="button"
        aria-label={listening ? '松开发送' : '按住说话'}
      >
        <span className="voice-btn-icon">{listening ? '🎙️' : '🎤'}</span>
        <span className="voice-btn-label">
          {listening ? '松开发送' : '按住说话'}
        </span>
      </button>

      {listening && transcript && (
        <div className="voice-transcript">{transcript}</div>
      )}
      {listening && !transcript && (
        <div className="voice-transcript voice-hint">正在聆听...</div>
      )}

      {error && <p className="voice-error">{error}</p>}
    </div>
  )
}
