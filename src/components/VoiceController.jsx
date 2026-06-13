import { useState, useRef, useEffect, useCallback } from 'react'

const SILENCE_MS = 1500

const START_RE = /开始.{0,1}(绘画|绘图|画图|画画)/
const END_RE   = /结束.{0,1}(绘画|绘图|画图|画画)/

export default function VoiceController({ onSubmit, disabled }) {
  const [mode, setMode] = useState('waiting')
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState(null)
  const [micReady, setMicReady] = useState(false)
  const [permDenied, setPermDenied] = useState(false)

  const recRef = useRef(null)
  const bootRecRef = useRef(null)
  const scheduleRestartRef = useRef(null)
  const silenceRef = useRef(null)
  const finalRef = useRef('')
  const modeRef = useRef('waiting')
  const deadRef = useRef(false)
  const restartTimerRef = useRef(null)
  const hadErrorRef = useRef(false)
  const lastRestartRef = useRef(0)
  const permWatcherRef = useRef(null)

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
    if (r) { recRef.current = null; try { r.stop() } catch { /* already stopped */ } }
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

  // ---- silence -> commit then restart ----
  // Use refs to break circular dependency:
  //   handleSilence -> scheduleRestart -> bootRec -> handleSilence
  // Each callback reads the latest version via .current at call time,
  // avoiding forward-reference constraints in the source order.

  const handleSilence = useCallback(() => {
    const text = finalRef.current.trim()
    finalRef.current = ''
    setTranscript('')
    commitText(text)
    scheduleRestartRef.current?.()
  }, [commitText])

  scheduleRestartRef.current = useCallback(() => { // eslint-disable-line react-hooks/refs
    if (deadRef.current || hadErrorRef.current) return
    const now = Date.now()
    if (now - lastRestartRef.current < 1000) return
    lastRestartRef.current = now
    clearAll()
    stopRec()
    restartTimerRef.current = setTimeout(() => bootRecRef.current?.(), 200)
  }, [clearAll, stopRec])

  // ---- watch for browser permission changes (no refresh needed) ----

  const watchPermission = useCallback(() => {
    if (!navigator.permissions) return
    navigator.permissions.query({ name: 'microphone' }).then((perm) => {
      if (deadRef.current) return
      permWatcherRef.current = perm
      perm.onchange = () => {
        if (perm.state === 'granted') {
          setPermDenied(false)
          hadErrorRef.current = false
          lastRestartRef.current = 0
          setError(null)
          bootRecRef.current?.()
        } else if (perm.state === 'denied') {
          setPermDenied(true)
        }
      }
    }).catch(() => {
      // Permissions API not available, ignore
    })
  }, [])

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
          scheduleRestartRef.current?.()
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
          scheduleRestartRef.current?.()
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
        setError('请在浏览器设置中允许麦克风权限，然后说「开始绘画」即可')
        setMicReady(false)
        setPermDenied(true)
        watchPermission()
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
          scheduleRestartRef.current?.()
        }
      }
    }

    recRef.current = rec
    try {
      rec.start()
      setMicReady(true)
      setError(null)
      setPermDenied(false)
    } catch (e) {
      setError('启动语音识别失败: ' + (e.message || e))
      scheduleRestartRef.current?.()
    }
  }, [stopRec, clearAll, handleSilence, watchPermission])

  bootRecRef.current = bootRec // eslint-disable-line react-hooks/refs

  // ---- bootstrap ----

  useEffect(() => {
    deadRef.current = false
    bootRecRef.current?.()
    return () => {
      deadRef.current = true
      clearAll()
      stopRec()
      if (permWatcherRef.current) {
        permWatcherRef.current.onchange = null
        permWatcherRef.current = null
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ---- render ----

  const barCls = mode === 'drawing' ? 'vc-bar vc-drawing'
    : permDenied ? 'vc-bar vc-denied'
    : 'vc-bar vc-waiting'

  let hint
  if (!micReady && !error) {
    hint = '正在请求麦克风权限...如果浏览器询问，请点击"允许"'
  } else if (permDenied) {
    hint = '请在浏览器设置中允许麦克风权限，允许后自动恢复'
  } else if (mode === 'waiting') {
    hint = '说「开始绘画」进入纯语音绘图模式'
  } else {
    hint = '正在绘画中... 说「结束绘画」退出'
  }

  return (
    <div className={barCls}>
      <div className="vc-status">
        <span className="vc-dot">
          {permDenied ? '🔒' : mode === 'drawing' ? '🟢' : micReady ? '🔴' : '🎤'}
        </span>
        <span className="vc-hint">{hint}</span>
      </div>
      {transcript && <div className="vc-live">{transcript}</div>}
      {error && <div className="vc-err">{error}</div>}
    </div>
  )
}
