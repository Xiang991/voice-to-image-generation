import { useState, useRef, useEffect, useCallback } from 'react'

const SILENCE_MS = 1500

const START_RE = /开始.{0,1}(绘画|绘图|画图|画画)/
const END_RE   = /结束.{0,1}(绘画|绘图|画图|画画)/

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
  const restartTimerRef = useRef(null)
  const hadErrorRef = useRef(false)
  const lastRestartRef = useRef(0)

  const onSubmitRef = useRef(onSubmit)
  const disabledRef = useRef(disabled)

  useEffect(() => { modeRef.current = mode }, [mode])
  useEffect(() => { onSubmitRef.current = onSubmit }, [onSubmit])
  useEffect(() => { disabledRef.current = disabled }, [disabled])

  // ---- helpers ----

  const clearAll = useCallback(() => {
    if (silenceRef.current) { clearTimeout(silenceRef.current); silenceRef.current = null }
    if (restartTimerRef.current) { clearTimeout(restartTimerRef.current); restartTimerRef.current = null }
  }, [])

  const stopRec = useCallback(() => {
    const r = recRef.current
    if (r) { recRef.current = null; try { r.stop() } catch (_) {} }
  }, [])

  // ---- commit sentence ----

  const commitText = useCallback((text) => {
    if (!text) return
    const m = modeRef.current
    if (m === 'drawing') {
      const em = text.match(END_RE)
      if (em) {
        const before = text.slice(0, em.index).trim()
        if (before && !disabledRef.current) onSubmitRef.current(before)
        setMode('waiting')
        return
      }
      if (!disabledRef.current) onSubmitRef.current(text)
    } else {
      const sm = text.match(START_RE)
      if (sm) {
        setMode('drawing')
        const after = text.slice(sm.index + sm[0].length).trim()
        if (after && !disabledRef.current) onSubmitRef.current(after)
      }
    }
  }, [])

  // ---- silence → commit then restart ----

  const handleSilence = useCallback(() => {
    const text = finalRef.current.trim()
    finalRef.current = ''
    setTranscript('')
    commitText(text)
    scheduleRestart()
  }, [commitText])

  const scheduleRestart = useCallback(() => {
    if (deadRef.current || hadErrorRef.current) return
    const now = Date.now()
    if (now - lastRestartRef.current < 1000) return
    lastRestartRef.current = now
    clearAll()
    stopRec()
    restartTimerRef.current = setTimeout(bootRec, 200)
  }, [clearAll, stopRec])

  // ---- single recognition cycle ----

  const bootRec = useCallback(() => {
    if (deadRef.current) return
    hadErrorRef.current = false

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setError('浏览器不支持语音识别，请使用 Chrome 或 Edge')
      return
    }

    stopRec()

    const rec = new SpeechRecognition()
    rec.continuous = false
    rec.interimResults = true
    rec.lang = 'zh-CN'

    rec.onresult = (e) => {
      if (deadRef.current || recRef.current !== rec) return
      clearAll()

      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) finalRef.current += r[0].transcript
        else interim += r[0].transcript
      }

      const display = finalRef.current + interim
      setTranscript(display)

      const m = modeRef.current
      if (m === 'waiting') {
        const sm = display.match(START_RE)
        if (sm) {
          const after = display.slice(sm.index + sm[0].length).trim()
          finalRef.current = after
          setTranscript(after)
          setMode('drawing')
          stopRec()
          scheduleRestart()
        }
      } else if (m === 'drawing') {
        const em = display.match(END_RE)
        if (em) {
          const before = display.slice(0, em.index).trim()
          if (before && !disabledRef.current) onSubmitRef.current(before)
          finalRef.current = ''
          setTranscript('')
          setMode('waiting')
          stopRec()
          scheduleRestart()
        }
      }
    }

    rec.onspeechend = () => {
      if (deadRef.current || recRef.current !== rec) return
      if (finalRef.current.trim()) {
        silenceRef.current = setTimeout(handleSilence, SILENCE_MS)
      }
    }

    rec.onerror = (e) => {
      if (deadRef.current || recRef.current !== rec) return
      hadErrorRef.current = true
      if (e.error === 'not-allowed') {
        setError('麦克风权限被拒绝，请在浏览器设置中允许后点击重试')
        setMicReady(false)
      } else if (e.error !== 'aborted') {
        setError('语音识别出错: ' + e.error)
      }
    }

    rec.onend = () => {
      if (deadRef.current) return
      if (recRef.current === rec) {
        recRef.current = null
        if (hadErrorRef.current) return
        if (finalRef.current.trim() && !silenceRef.current) {
          silenceRef.current = setTimeout(handleSilence, SILENCE_MS)
        } else if (!finalRef.current.trim()) {
          scheduleRestart()
        }
      }
    }

    recRef.current = rec
    try {
      rec.start()
      setMicReady(true)
      setError(null)
    } catch (e) {
      setError('启动语音识别失败: ' + (e.message || e))
      scheduleRestart()
    }
  }, [stopRec, clearAll, handleSilence, scheduleRestart])

  // ---- bootstrap (no auto-start — wait for user gesture) ----

  useEffect(() => {
    deadRef.current = false
    return () => {
      deadRef.current = true
      clearAll()
      stopRec()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ---- user-triggered enable (provides user gesture for permission prompt) ----

  const enableMic = () => {
    hadErrorRef.current = false
    lastRestartRef.current = 0
    setError(null)
    setMicReady(false)
    stopRec()
    bootRec()
  }

  // ---- render ----

  const barCls = mode === 'drawing' ? 'vc-bar vc-drawing' : 'vc-bar vc-waiting'

  let content
  if (!micReady && !error) {
    // Initial state: need user gesture to trigger permission prompt
    content = (
      <div className="vc-status">
        <span className="vc-dot">🎤</span>
        <span className="vc-hint">点击按钮启用语音识别</span>
        <button className="vc-enable-btn" onClick={enableMic}>
          启用麦克风
        </button>
      </div>
    )
  } else if (error) {
    // Error state: show retry button (also user gesture for recovery)
    content = (
      <>
        <div className="vc-status">
          <span className="vc-dot">⚠️</span>
          <span className="vc-hint vc-hint-err">{error}</span>
          <button className="vc-enable-btn" onClick={enableMic}>
            重试
          </button>
        </div>
        {transcript && <div className="vc-live">{transcript}</div>}
      </>
    )
  } else {
    // Active state: mic is live, show mode-specific UI
    const hint = mode === 'waiting'
      ? '说「开始绘画」进入纯语音绘图模式'
      : '正在绘画中... 说「结束绘画」退出'
    content = (
      <>
        <div className="vc-status">
          <span className="vc-dot">{mode === 'drawing' ? '🟢' : '🔴'}</span>
          <span className="vc-hint">{hint}</span>
        </div>
        {transcript && <div className="vc-live">{transcript}</div>}
      </>
    )
  }

  return <div className={barCls}>{content}</div>
}
