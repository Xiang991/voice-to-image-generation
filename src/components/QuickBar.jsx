import { motion, AnimatePresence } from 'framer-motion'
import { Undo2, Redo2, Trash2, XSquare, Download, Upload, FileImage } from 'lucide-react'

export default function QuickBar({
  onUndo, onRedo, onClear, onDelete,
  onExportPng, onExportProject, onImportProject,
  disabled, visible, hasSelection, canUndo, canRedo, hasLayers,
}) {
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
            disabled={disabled || !canUndo}
            type="button"
            title="撤销"
            whileHover={canUndo ? { scale: 1.04, y: -1 } : {}}
            whileTap={canUndo ? { scale: 0.96 } : {}}
          >
            <Undo2 size={15} strokeWidth={2} />
            <span className="qb-label">撤销</span>
          </motion.button>
          <motion.button
            className="qb-btn"
            onClick={onRedo}
            disabled={disabled || !canRedo}
            type="button"
            title="重做"
            whileHover={canRedo ? { scale: 1.04, y: -1 } : {}}
            whileTap={canRedo ? { scale: 0.96 } : {}}
          >
            <Redo2 size={15} strokeWidth={2} />
            <span className="qb-label">重做</span>
          </motion.button>
          <motion.button
            className="qb-btn qb-danger"
            onClick={onDelete}
            disabled={disabled || !hasSelection}
            type="button"
            title="删除选中的图形"
            whileHover={hasSelection ? { scale: 1.04, y: -1 } : {}}
            whileTap={hasSelection ? { scale: 0.96 } : {}}
          >
            <XSquare size={15} strokeWidth={2} />
            <span className="qb-label">删除</span>
          </motion.button>
          <motion.button
            className="qb-btn"
            onClick={onExportPng}
            disabled={disabled || !hasLayers}
            type="button"
            title="导出为 PNG 图片"
            whileHover={hasLayers ? { scale: 1.04, y: -1 } : {}}
            whileTap={hasLayers ? { scale: 0.96 } : {}}
          >
            <FileImage size={15} strokeWidth={2} />
            <span className="qb-label">图片</span>
          </motion.button>
          <motion.button
            className="qb-btn"
            onClick={onExportProject}
            disabled={disabled || !hasLayers}
            type="button"
            title="导出项目文件 (.json)"
            whileHover={hasLayers ? { scale: 1.04, y: -1 } : {}}
            whileTap={hasLayers ? { scale: 0.96 } : {}}
          >
            <Download size={15} strokeWidth={2} />
            <span className="qb-label">导出</span>
          </motion.button>
          <motion.button
            className="qb-btn"
            onClick={onImportProject}
            disabled={disabled}
            type="button"
            title="导入项目文件 (.json)"
            whileHover={{ scale: 1.04, y: -1 }}
            whileTap={{ scale: 0.96 }}
          >
            <Upload size={15} strokeWidth={2} />
            <span className="qb-label">导入</span>
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
