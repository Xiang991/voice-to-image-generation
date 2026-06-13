import { motion, AnimatePresence } from 'framer-motion'
import { Check, X, Minus } from 'lucide-react'

const icons = {
  success: { Icon: Check, cls: 'history-success' },
  error: { Icon: X, cls: 'history-error' },
  ignored: { Icon: Minus, cls: 'history-ignored' },
}

export default function History({ items }) {
  if (items.length === 0) {
    return (
      <div className="history-empty">
        暂无指令记录
      </div>
    )
  }

  return (
    <div className="history-list">
      <AnimatePresence initial={false}>
        {items.map((item) => {
          const { Icon } = icons[item.status] || icons.ignored
          const cls = icons[item.status]?.cls || 'history-ignored'
          return (
            <motion.div
              key={item.id}
              className={`history-item ${cls}`}
              initial={{ opacity: 0, x: -16, height: 0 }}
              animate={{ opacity: 1, x: 0, height: 'auto' }}
              exit={{ opacity: 0, x: 16, height: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            >
              <span className="history-icon">
                <Icon size={12} strokeWidth={3} />
              </span>
              <span className="history-text">{item.text}</span>
              <span className="history-time">
                {item.timestamp.toLocaleTimeString('zh-CN')}
              </span>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
