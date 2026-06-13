import { motion, AnimatePresence } from 'framer-motion'
import { Mic, Sparkles, Loader2, AlertCircle, MicOff } from 'lucide-react'

const states = {
  idle: {
    Icon: Mic,
    label: '等待开始',
    dot: 'bg-slate-500/60',
    ring: 'ring-slate-500/20',
  },
  listening: {
    Icon: Mic,
    label: '正在听...',
    dot: 'bg-emerald-400',
    ring: 'ring-emerald-400/30',
    pulse: true,
  },
  thinking: {
    Icon: Loader2,
    label: '思考中...',
    dot: 'bg-amber-400',
    ring: 'ring-amber-400/30',
    spin: true,
  },
  drawing: {
    Icon: Sparkles,
    label: '绘制中...',
    dot: 'bg-violet-400',
    ring: 'ring-violet-400/30',
  },
  error: {
    Icon: AlertCircle,
    label: '出错',
    dot: 'bg-red-400',
    ring: 'ring-red-400/30',
  },
  denied: {
    Icon: MicOff,
    label: '麦克风被禁用',
    dot: 'bg-red-400',
    ring: 'ring-red-400/30',
  },
}

export default function VoiceStatusBar({ mode, status }) {
  const s = states[mode] || states.idle
  const Icon = s.Icon

  return (
    <div className="voice-status-bar">
      <div className={`vs-ring ${s.ring}`}>
        <motion.div
          className={`vs-dot ${s.dot}`}
          animate={s.spin ? { rotate: 360 } : s.pulse ? { scale: [1, 1.4, 1] } : {}}
          transition={
            s.spin
              ? { repeat: Infinity, duration: 1.2, ease: 'linear' }
              : s.pulse
                ? { repeat: Infinity, duration: 1.8, ease: 'easeInOut' }
                : {}
          }
        >
          <Icon size={12} strokeWidth={2.5} />
        </motion.div>
      </div>
      <span className="vs-label">{s.label}</span>
      <AnimatePresence mode="wait">
        {status && mode !== 'error' && (
          <motion.span
            key={status}
            className="vs-status-text"
            initial={{ opacity: 0, y: -8, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
            transition={{ duration: 0.35, ease: [0.22, 0.61, 0.36, 1] }}
          >
            {status}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  )
}
