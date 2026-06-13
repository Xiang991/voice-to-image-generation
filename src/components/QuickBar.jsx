import { motion, AnimatePresence } from 'framer-motion'
import { Undo2, Trash2 } from 'lucide-react'

export default function QuickBar({ onUndo, onClear, disabled, visible }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="quick-bar"
          initial={{ opacity: 0, y: 12, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.94 }}
          transition={{ type: 'spring', stiffness: 400, damping: 28 }}
        >
          <motion.button
            className="qb-btn"
            onClick={onUndo}
            disabled={disabled}
            type="button"
            title="撤销上一步"
            whileHover={{ scale: 1.04, y: -1 }}
            whileTap={{ scale: 0.96 }}
          >
            <Undo2 size={15} strokeWidth={2} />
            <span className="qb-label">撤销</span>
          </motion.button>
          <motion.button
            className="qb-btn qb-danger"
            onClick={onClear}
            disabled={disabled}
            type="button"
            title="清空画布"
            whileHover={{ scale: 1.04, y: -1 }}
            whileTap={{ scale: 0.96 }}
          >
            <Trash2 size={15} strokeWidth={2} />
            <span className="qb-label">清空</span>
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
