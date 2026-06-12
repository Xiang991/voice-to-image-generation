import { useState, useRef, useEffect, useCallback } from 'react'

const SILENCE_MS = 1500

// Fuzzy match: tolerate minor ASR errors like "开始话画" / "结束会画"
const START_RE = /开始.{0,2}[绘画画划]/
const END_RE   = /结束.{0,2}[绘画画划]/

export default function VoiceController({ onSubmit, disabled }) {
  const [mode, setMode] = useState('waiting') // 'waiting' | 'drawing'
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState(null)
  const [micReady, setMicReady] = useState(false)

  const recRef = useRef(null)
  const silenceRef = useRef(null)
  const finalRef = useRef('')
  const modeRef = useRef('waiting')
  const deadRef = useRef(false)

  // sync ref for callbacks that can't see fresh state
  useEffect(() => { modeRef.current = mode }, [mode])

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
      try { r.stop() } catch (_) { /* already stopped */ }
    }
  }, [clearSilence])

  const commit = useCallback((text) => {
    if (text && !disabled) {
      onSubmit(text)
    }
  }, [disabled, onSubmit])

  // ---- silence → auto-commit current sentence ----
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
      commit(text)
    } else {
      // waiting mode — check for start keyword
      if (START_RE.test(text)) {
        setMode('drawing')
      }
    }
  }, [commit])

  const startSilenceTimer = useCallback(() => {
    clearSilence()
    silenceRef.current = setTimeout(onSilence, SILENCE_MS)
  }, [clearSilence, onSilence])

  // ---- recognition lifecycle ----
  const boot = useCallback(() => {
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

      // Real-time keyword detection (before silence timer fires)
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
      if (e.error === 'not-allowed') {
        setError('麦克风权限被拒绝，请在浏览器设置中允许后刷新页面')
        setMicReady(false)
      } else if (e.error !== 'aborted') {
        setError('语音识别出错: ' + e.error)
      }
    }

    rec.onend = () => {
      if (deadRef.current) return
      // auto-restart
      recRef.current = null
      boot()
    }

    recRef.current = rec
    rec.start()
    setMicReady(true)
    setError(null)
  }, [stopRec, clearSilence, startSilenceTimer])

  // boot on mount, shutdown on unmount
  useEffect(() => {
    boot()
    return () => {
      deadRef.current = true
      stopRec()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Allow manual restart from "重新开始" button
  const restartDrawing = () => {
    finalRef.current = ''
    setTranscript('')
    setMode('drawing')
  }

  // ---- render ----
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
