import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, MicOff, Loader2, Lock } from 'lucide-react'
import { createAsr } from '../services/asr-manager.js'

const SILENCE_MS = 150
const END_RE = /结束.{0,1}(绘画|绘图|画图|画画)/

export default function VoiceController({ onSubmit, disabled, onStateChange, onCancel }) {
  const [mode, setMode] = useState('idle')
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState(null)
  const [micReady, setMicReady] = useState(false)
  const [permDenied, setPermDenied] = useState(false)

  const asrRef = useRef(null)
  const silenceRef = useRef(null)
  const finalRef = useRef('')
  const deadRef = useRef(false)
  const bootAttemptRef = useRef(0)

  const onSubmitRef = useRef(onSubmit)
  const disabledRef = useRef(disabled)
  const modeRef = useRef(mode)

  useEffect(() => { onSubmitRef.current = onSubmit }, [onSubmit])
  useEffect(() => { disabledRef.current = disabled }, [disabled])
  useEffect(() => { modeRef.current = mode }, [mode])
  useEffect(() => {
    if (onStateChange) onStateChange(mode)
  }, [mode, onStateChange])

  const clearSilence = useCallback(() => {
    if (silenceRef.current) { clearTimeout(silenceRef.current); silenceRef.current = null }
  }, [])

  const commitText = useCallback((text) => {
    const trimmed = text.trim()
    if (!trimmed) return
    const em = trimmed.match(END_RE)
    if (em) {
      const before = trimmed.slice(0, em.index).trim()
      if (before) onSubmitRef.current(before)
      setMode('idle')
      return
    }
    onSubmitRef.current(trimmed)
  }, [])

  // Called when ASR has results
  const handleResult = useCallback(({ transcript: t, isFinal: f }) => {
    if (deadRef.current) return
    clearSilence()
    finalRef.current = f ? t : finalRef.current
    setTranscript(t)
  }, [clearSilence])

  // Called when ASR detects end of speech
  const handleAsrEnd = useCallback(() => {
    if (deadRef.current) return
    const text = finalRef.current.trim()
    if (text) {
      silenceRef.current = setTimeout(() => {
        silenceRef.current = null
        const t = finalRef.current.trim()
        finalRef.current = ''
        setTranscript('')
        commitText(t)
        // Restart after submit if still in listening mode
        if (modeRef.current === 'listening' && !disabledRef.current) {
          bootAttemptRef.current++
          setTimeout(() => doBoot(), 150)
        }
      }, SILENCE_MS)
    } else if (modeRef.current === 'listening' && !disabledRef.current) {
      // No text yet, restart right away
      bootAttemptRef.current++
      setTimeout(() => doBoot(), 150)
    }
  }, [clearSilence, commitText])

  const handleAsrError = useCallback(({ message }) => {
    if (deadRef.current) return
    // Permanent errors — show to user, don't retry
    if (/权限|permission|not.allowed|禁止|拒绝/i.test(message)) {
      setPermDenied(true)
      setError(message)
      setMicReady(false)
      return
    }
    if (/未配置|config|Key|API|密钥|鉴权/i.test(message)) {
      setError(message)
      setMode('idle')
      setMicReady(false)
      return
    }
    // Transient errors — show + retry
    setError(message)
    if (modeRef.current === 'listening') {
      bootAttemptRef.current++
      setTimeout(() => doBoot(), 300)
    }
  }, [])

  const createAndBoot = useCallback(async () => {
    if (deadRef.current) return
    if (disabledRef.current) return
    if (bootAttemptRef.current > 5) {
      setError('语音识别多次失败，请检查后重新点击开始')
      setMode('idle')
      setMicReady(false)
      return
    }

    // Destroy previous
    try { asrRef.current?.destroy() } catch {}

    try {
      const asr = await createAsr()
      if (deadRef.current) { asr.destroy(); return }
      asr.onResult(handleResult)
      asr.onError(handleAsrError)
      asr.onEnd(handleAsrEnd)
      asr.start()
      asrRef.current = asr
      setMicReady(true)
      setError(null)
      setPermDenied(false)
    } catch (err) {
      if (!deadRef.current) {
        setError(err.message || '语音识别初始化失败')
        if (modeRef.current === 'listening') {
          bootAttemptRef.current++
          setTimeout(() => doBoot(), 500)
        }
      }
    }
  }, [handleResult, handleAsrError, handleAsrEnd])

  // Stable ref to doBoot
  const doBootRef = useRef(createAndBoot)
  useEffect(() => { doBootRef.current = createAndBoot }, [createAndBoot])
  const doBoot = useCallback(() => doBootRef.current(), [])

  // Start listening
  const startListening = useCallback(() => {
    setMode('listening')
    setError(null)
    bootAttemptRef.current = 0
  }, [])

  // Stop listening manually
  const stopListening = useCallback(() => {
    clearSilence()
    deadRef.current = false
    try { asrRef.current?.destroy() } catch {}
    asrRef.current = null
    const text = finalRef.current.trim()
    finalRef.current = ''
    setTranscript('')
    setMode('idle')
    setMicReady(false)
    if (text) commitText(text)
  }, [clearSilence, commitText])

  // Boot when entering listening mode
  useEffect(() => {
    if (mode === 'listening' && !disabled) {
      bootAttemptRef.current = 0
      createAndBoot()
    }
  }, [mode, disabled, createAndBoot])

  // Cleanup on unmount
  useEffect(() => {
    deadRef.current = false
    return () => {
      deadRef.current = true
      clearSilence()
      try { asrRef.current?.destroy() } catch {}
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
        {(mode === 'listening' || disabled) && (
          <motion.button
            className="vc-stop-btn"
            onClick={disabled ? () => onCancel?.() : stopListening}
            type="button"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 500, damping: 25 }}
          >
            <MicOff size={14} strokeWidth={2.5} />
            <span>结束会话</span>
          </motion.button>
        )}
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
