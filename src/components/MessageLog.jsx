import { useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageCircle } from 'lucide-react'

export default function MessageLog({ items }) {
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [items])

  if (items.length === 0) {
    return (
      <div className="msg-empty">
        <MessageCircle size={20} strokeWidth={1.5} />
        <span>暂无系统消息</span>
      </div>
    )
  }

  return (
    <div className="msg-list">
      <AnimatePresence initial={false}>
        {items.map((item) => (
          <motion.div
            key={item.id}
            className="msg-item"
            initial={{ opacity: 0, x: -12, height: 0 }}
            animate={{ opacity: 1, x: 0, height: 'auto' }}
            exit={{ opacity: 0, x: 12, height: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          >
            <span className="msg-text">{item.text}</span>
            <span className="msg-time">
              {item.timestamp.toLocaleTimeString('zh-CN')}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
      <div ref={bottomRef} />
    </div>
  )
}
