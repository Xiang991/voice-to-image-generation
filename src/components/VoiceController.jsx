import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, MicOff, Loader2, Lock } from 'lucide-react'

const SILENCE_MS = 1500
const END_RE = /结束.{0,1}(绘画|绘图|画图|画画)/

export default function VoiceController({ onSubmit, disabled, onStateChange }) {
  const [mode, setMode] = useState('idle')
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState(null)
  const [micReady, setMicReady] = useState(false)
  const [permDenied, setPermDenied] = useState(false)

  const recRef = useRef(null)
  const silenceRef = useRef(null)
  const finalRef = useRef('')
  const deadRef = useRef(false)
  const restartTimerRef = useRef(null)
  const hadErrorRef = useRef(false)
  const lastRestartRef = useRef(0)
  const permWatcherRef = useRef(null)
  const bootRef = useRef(null)
  const restartRef = useRef(null)
  const watchPermRef = useRef(null)

  const onSubmitRef = useRef(onSubmit)
  const disabledRef = useRef(disabled)
  const modeRef = useRef('idle')

  useEffect(() => { onSubmitRef.current = onSubmit }, [onSubmit])
  useEffect(() => { disabledRef.current = disabled }, [disabled])
  useEffect(() => { modeRef.current = mode }, [mode])
  useEffect(() => {
    if (onStateChange) onStateChange(mode)
  }, [mode, onStateChange])

  const clearTimers = useCallback(() => {
    if (silenceRef.current) { clearTimeout(silenceRef.current); silenceRef.current = null }
    if (restartTimerRef.current) { clearTimeout(restartTimerRef.current); restartTimerRef.current = null }
  }, [])

  const stopRec = useCallback(() => {
    const r = recRef.current
    if (r) { recRef.current = null; try { r.stop() } catch { /* ignore */ } }
  }, [])

  // Handles silence timeout — commits text and tries to restart
  const handleSilence = useCallback(() => {
    silenceRef.current = null
    const text = finalRef.current.trim()
    finalRef.current = ''
    setTranscript('')
    if (text) {
      const em = text.match(END_RE)
      if (em) {
        const before = text.slice(0, em.index).trim()
        if (before) onSubmitRef.current(before)
        setMode('idle')
        stopRec()
        clearTimers()
        return
      }
      onSubmitRef.current(text)
    }
    // After submitting, try to restart. bootRec checks disabledRef internally
    // and will skip if App is still processing (returns for draw intent,
    // proceeds immediately for chat/control intents because disabled stays false)
    if (modeRef.current === 'listening' && !deadRef.current) {
      restartRef.current?.()
    }
  }, [stopRec, clearTimers])

  const bootRec = useCallback(() => {
    if (deadRef.current) return
    if (modeRef.current === 'idle') return
    if (disabledRef.current) return
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
      clearTimers()

      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) finalRef.current += r[0].transcript
        else interim += r[0].transcript
      }
      setTranscript(finalRef.current + interim)
    }

    rec.onspeechend = () => {
      if (deadRef.current || recRef.current !== rec) return
      if (finalRef.current.trim()) {
        silenceRef.current = setTimeout(handleSilence, SILENCE_MS)
      }
    }

    rec.onerror = (e) => {
      if (deadRef.current || recRef.current !== rec) return
      if (e.error === 'not-allowed') {
        hadErrorRef.current = true
        setError('请在浏览器设置中允许麦克风权限，然后刷新页面')
        setMicReady(false)
        setPermDenied(true)
        watchPermRef.current?.()
      } else if (e.error === 'aborted') {
        // Normal — happens when stopRec() is called or browser kills idle rec
      } else {
        // Transient error (network, no-speech, etc.) — try to restart
        setError('语音识别出错: ' + e.error + '，自动重试中...')
        if (modeRef.current === 'listening') restartRef.current?.()
      }
    }

    rec.onend = () => {
      if (deadRef.current) return
      if (recRef.current === rec) {
        recRef.current = null
        if (hadErrorRef.current) return
        if (finalRef.current.trim() && !silenceRef.current) {
          // Text collected but silence timer not started yet → start it
          silenceRef.current = setTimeout(handleSilence, SILENCE_MS)
        } else if (!finalRef.current.trim() && modeRef.current === 'listening' && !disabledRef.current) {
          // Recognition ended with no text → restart
          restartRef.current?.()
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
      if (modeRef.current === 'listening') restartRef.current?.()
    }
  }, [stopRec, clearTimers, handleSilence])

  const doRestart = useCallback(() => {
    if (deadRef.current || hadErrorRef.current) return
    const now = Date.now()
    if (now - lastRestartRef.current < 300) return
    lastRestartRef.current = now
    clearTimers()
    stopRec()
    restartTimerRef.current = setTimeout(() => bootRef.current?.(), 200)
  }, [clearTimers, stopRec])

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
          if (modeRef.current !== 'idle') bootRef.current?.()
        } else if (perm.state === 'denied') {
          setPermDenied(true)
        }
      }
    }).catch(() => {})
  }, [])

  // Sync refs — these run once per render, keeping refs always current
  useEffect(() => { bootRef.current = bootRec }, [bootRec])
  useEffect(() => { restartRef.current = doRestart }, [doRestart])
  useEffect(() => { watchPermRef.current = watchPermission }, [watchPermission])

  const startListening = useCallback(() => {
    setMode('listening')
    setError(null)
    hadErrorRef.current = false
    lastRestartRef.current = 0
  }, [])

  // Single effect: boot when entering listening mode or resuming after processing
  useEffect(() => {
    if (mode === 'listening' && !disabled) {
      hadErrorRef.current = false
      lastRestartRef.current = 0
      // eslint-disable-next-line react-hooks/set-state-in-effect
      bootRec()
    }
  }, [mode, disabled, bootRec])

  useEffect(() => {
    deadRef.current = false
    return () => {
      deadRef.current = true
      clearTimers()
      stopRec()
      if (permWatcherRef.current) {
        permWatcherRef.current.onchange = null
        permWatcherRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const barCls = mode === 'listening' ? 'vc-bar vc-listening'
    : disabled ? 'vc-bar vc-thinking'
    : permDenied ? 'vc-bar vc-denied'
    : 'vc-bar vc-idle'

  let hint, StatusIcon
  if (permDenied) {
    hint = '请在浏览器设置中允许麦克风权限'
    StatusIcon = Lock
  } else if (disabled) {
    hint = 'AI 正在思考...'
    StatusIcon = Loader2
  } else if (mode === 'listening') {
    hint = '正在听... 说"结束绘画"退出'
    StatusIcon = micReady ? Mic : MicOff
  } else {
    hint = '点击麦克风按钮开始绘图'
    StatusIcon = Mic
  }

  return (
    <div className={barCls}>
      <div className="vc-status">
        {mode === 'idle' && !disabled ? (
          <motion.button
            className="vc-start-btn"
            onClick={startListening}
            disabled={permDenied}
            type="button"
            whileHover={{ scale: 1.03, y: -2 }}
            whileTap={{ scale: 0.97, y: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 25 }}
          >
            <Mic size={18} strokeWidth={2.2} />
            <span className="vc-start-label">开始绘画</span>
          </motion.button>
        ) : (
          <motion.span
            className="vc-dot"
            animate={
              disabled
                ? { rotate: 360 }
                : mode === 'listening'
                  ? { scale: [1, 1.2, 1] }
                  : {}
            }
            transition={
              disabled
                ? { repeat: Infinity, duration: 1.5, ease: 'linear' }
                : mode === 'listening'
                  ? { repeat: Infinity, duration: 1.8, ease: 'easeInOut' }
                  : {}
            }
          >
            <StatusIcon size={16} strokeWidth={2.2} />
          </motion.span>
        )}
        <span className="vc-hint">{hint}</span>
      </div>

      <AnimatePresence mode="wait">
        {transcript && (
          <motion.div
            key="live"
            className="vc-live"
            initial={{ opacity: 0, y: -10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
          >
            {transcript}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {error && (
          <motion.div
            key="err"
            className="vc-err"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
