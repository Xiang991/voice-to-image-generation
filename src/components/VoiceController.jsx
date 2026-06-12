import { useState, useRef, useEffect, useCallback } from 'react'

const SILENCE_MS = 1500
const BOOT_COOLDOWN_MS = 800

const START_RE = /开始.{0,2}[绘画画划]/
const END_RE   = /结束.{0,2}[绘画画划]/

export default function VoiceController({ onSubmit, disabled }) {
  const [mode, setMode] = useState('waiting')
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState(null)
  const [micReady, setMicReady] = useState(false)

  const recRef = useRef(null)
  const silenceRef = useRef(null)
  const finalRef = useRef('')
  const modeRef = useRef('waiting')
  const deadRef = useRef(false)
  const lastBootRef = useRef(0)
  const hadErrorRef = useRef(false)

  const onSubmitRef = useRef(onSubmit)
  const disabledRef = useRef(disabled)

  useEffect(() => { modeRef.current = mode }, [mode])
  useEffect(() => { onSubmitRef.current = onSubmit }, [onSubmit])
  useEffect(() => { disabledRef.current = disabled }, [disabled])

  const clearSilence = useCallback(() => {
    if (silenceRef.current) {
      clearTimeout(silenceRef.current)
      silenceRef.current = null
    }
  }, [])

  const stopRec = useCallback(() => {
    clearSilence()
    const r = recRef.current
    if (r) {
      recRef.current = null
      try { r.stop() } catch (_) {}
    }
  }, [clearSilence])

  const onSilence = useCallback(() => {
    const text = finalRef.current.trim()
    finalRef.current = ''
    setTranscript('')
    if (!text) return

    if (modeRef.current === 'drawing') {
      if (END_RE.test(text)) {
        setMode('waiting')
        return
      }
      if (!disabledRef.current) {
        onSubmitRef.current(text)
      }
    } else if (START_RE.test(text)) {
      setMode('drawing')
    }
  }, [])

  const startSilenceTimer = useCallback(() => {
    clearSilence()
    silenceRef.current = setTimeout(onSilence, SILENCE_MS)
  }, [clearSilence, onSilence])

  const boot = useCallback(() => {
    // Prevent runaway restart loop
    const now = Date.now()
    if (now - lastBootRef.current < BOOT_COOLDOWN_MS) return
    lastBootRef.current = now

    deadRef.current = false
    hadErrorRef.current = false

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setError('浏览器不支持语音识别，请使用 Chrome 或 Edge')
      return
    }

    stopRec()

    const rec = new SpeechRecognition()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = 'zh-CN'

    rec.onresult = (e) => {
      if (deadRef.current) return
      clearSilence()

      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) finalRef.current += r[0].transcript
        else interim += r[0].transcript
      }

      const display = finalRef.current + interim
      setTranscript(display)

      const m = modeRef.current
      if (m === 'waiting' && START_RE.test(display)) {
        finalRef.current = ''
        setTranscript('')
        setMode('drawing')
      } else if (m === 'drawing' && END_RE.test(display)) {
        finalRef.current = ''
        setTranscript('')
        setMode('waiting')
      }
    }

    rec.onspeechend = () => {
      if (deadRef.current) return
      if (finalRef.current.trim()) {
        startSilenceTimer()
      }
    }

    rec.onerror = (e) => {
      if (deadRef.current) return
      hadErrorRef.current = true
      if (e.error === 'not-allowed') {
        setError('麦克风权限被拒绝，请在浏览器设置中允许后刷新页面')
        setMicReady(false)
      } else if (e.error !== 'aborted') {
        setError('语音识别出错: ' + e.error)
      }
    }

    rec.onend = () => {
      if (deadRef.current) return
      recRef.current = null
      // Never auto-restart after an error — that causes the infinite loop
      if (hadErrorRef.current) return
      boot()
    }

    recRef.current = rec
    try {
      rec.start()
      setMicReady(true)
      setError(null)
    } catch (e) {
      setError('启动语音识别失败: ' + (e.message || e))
    }
  }, [stopRec, clearSilence, startSilenceTimer])

  useEffect(() => {
    boot()
    return () => {
      deadRef.current = true
      stopRec()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const restartDrawing = () => {
    finalRef.current = ''
    setTranscript('')
    setMode('drawing')
  }

  const barCls = mode === 'drawing' ? 'vc-bar vc-drawing' : 'vc-bar vc-waiting'

  let hint
  if (!micReady && !error) {
    hint = '正在初始化麦克风...'
  } else if (mode === 'waiting') {
    hint = '说「开始绘画」进入纯语音绘图模式'
  } else {
    hint = '正在绘画中... 说「结束绘画」退出'
  }

  return (
    <div className={barCls}>
      <div className="vc-status">
        <span className="vc-dot">{mode === 'drawing' ? '🟢' : '🔴'}</span>
        <span className="vc-hint">{hint}</span>
        {mode === 'waiting' && micReady && (
          <button className="vc-manual-start" onClick={restartDrawing}>
            手动开始
          </button>
        )}
      </div>

      {transcript && (
        <div className="vc-live">{transcript}</div>
      )}

      {error && (
        <div className="vc-err">{error}</div>
      )}
    </div>
  )
}
