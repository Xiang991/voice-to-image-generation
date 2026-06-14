import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Canvas from './components/Canvas.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import VoiceController from './components/VoiceController.jsx'
import VoiceStatusBar from './components/VoiceStatusBar.jsx'
import QuickBar from './components/QuickBar.jsx'
import History from './components/History.jsx'
import { runAgent } from './services/agent.js'
import { generateCanvasSummary } from './services/canvasSummary.js'
import { classifyIntent } from './services/intentClassifier.js'
import { saveLayers, loadLayers, clearLayers } from './services/storage.js'
import { generateHints } from './services/hints.js'
import { CONFIG } from './config.js'

let nextId = 1
const MAX_UNDO = 50

export default function App() {
  const canvasRef = useRef(null)
  const [layers, setLayers] = useState([])
  const [history, setHistory] = useState([])
  const [status, setStatus] = useState('就绪')
  const [loading, setLoading] = useState(false)
  const [voiceMode, setVoiceMode] = useState('idle')
  const [selectedId, setSelectedId] = useState(null)
  const [gridVisible, setGridVisible] = useState(false)
  const [messages, setMessages] = useState([])

  /* ---- Undo / Redo stacks (refs avoid stale closures) ---- */
  const layersRef = useRef([])
  const undoStackRef = useRef([])
  const redoStackRef = useRef([])
  const [undoCount, setUndoCount] = useState(0)
  const [redoCount, setRedoCount] = useState(0)

  useEffect(() => { layersRef.current = layers }, [layers])

  const takeSnapshot = useCallback(() => {
    undoStackRef.current.push(JSON.parse(JSON.stringify(layersRef.current)))
    if (undoStackRef.current.length > MAX_UNDO) undoStackRef.current.shift()
    redoStackRef.current = []
    setUndoCount(undoStackRef.current.length)
    setRedoCount(0)
  }, [])

  const addMessage = useCallback((text) => {
    setMessages((prev) => [
      { id: nextId++, text, timestamp: new Date() },
      ...prev,
    ])
  }, [])

  /* ---- Canvas sync ---- */

  useEffect(() => {
    canvasRef.current?.setLayers(layers)
  }, [layers])

  /* ---- Persistence (localStorage) ---- */

  // Restore on mount
  useEffect(() => {
    const restored = loadLayers()
    if (restored && restored.length > 0) {
      // Rehydrate nextId from restored layers
      for (const l of restored) {
        if (l.id >= nextId) nextId = l.id + 1
      }
      setLayers(restored)
      setStatus('已恢复上次绘制的画布')
    }
  }, [])

  // Auto-save with 300ms debounce
  const saveTimerRef = useRef(null)
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      saveLayers(layers)
    }, 300)
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [layers])

  const handleLayersChange = useCallback((newLayers) => {
    takeSnapshot()
    setLayers(newLayers)
  }, [takeSnapshot, addMessage])

  /* ---- Local actions (undo / redo / clear / delete) ---- */

  const executeLocal = useCallback((action) => {
    if (action === 'undo') {
      if (undoStackRef.current.length === 0) {
        const msg = '没有可撤销的操作'
        setStatus(msg)
        addMessage(msg)
        return
      }
      const restored = undoStackRef.current.pop()
      redoStackRef.current.push(JSON.parse(JSON.stringify(layersRef.current)))
      setLayers(restored)
      setUndoCount(undoStackRef.current.length)
      setRedoCount(redoStackRef.current.length)
      setSelectedId(null)
      setHistory((prev) => [
        { id: nextId++, text: '撤销', status: 'success', timestamp: new Date() },
        ...prev,
      ])
      setStatus('已撤销')
      addMessage('已撤销')
    } else if (action === 'redo') {
      if (redoStackRef.current.length === 0) {
        const msg = '没有可重做的操作'
        setStatus(msg)
        addMessage(msg)
        return
      }
      const restored = redoStackRef.current.pop()
      undoStackRef.current.push(JSON.parse(JSON.stringify(layersRef.current)))
      setLayers(restored)
      setUndoCount(undoStackRef.current.length)
      setRedoCount(redoStackRef.current.length)
      setSelectedId(null)
      setHistory((prev) => [
        { id: nextId++, text: '重做', status: 'success', timestamp: new Date() },
        ...prev,
      ])
      setStatus('已重做')
      addMessage('已重做')
    } else if (action === 'clear') {
      if (layersRef.current.length === 0) {
        const msg = '画布已经是空的'
        setStatus(msg)
        addMessage(msg)
        return
      }
      takeSnapshot()
      clearLayers()
      setLayers([])
      setSelectedId(null)
      setHistory((prev) => [
        { id: nextId++, text: '清空', status: 'success', timestamp: new Date() },
        ...prev,
      ])
      setStatus('画布已清空')
      addMessage('画布已清空')
    } else if (action === 'deleteSelected') {
      if (canvasRef.current?.deleteSelected()) {
        setHistory((prev) => [
          { id: nextId++, text: '删除选中', status: 'success', timestamp: new Date() },
          ...prev,
        ])
      }
    }
  }, [takeSnapshot, addMessage])

  /* ---- Export / Import ---- */

  const fileInputRef = useRef(null)

  const exportPng = useCallback(() => {
    const dataUrl = canvasRef.current?.toDataURL('image/png')
    if (!dataUrl) return
    const a = document.createElement('a')
    a.download = `voice-painting-${Date.now()}.png`
    a.href = dataUrl
    a.click()
    addMessage('已保存图片')
    setStatus('已保存图片')
  }, [addMessage])

  const exportProject = useCallback(() => {
    const json = JSON.stringify({ version: 1, layers: layersRef.current }, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.download = `voice-painting-${Date.now()}.json`
    a.href = url
    a.click()
    URL.revokeObjectURL(url)
    addMessage('已保存项目')
    setStatus('已保存项目')
  }, [addMessage])

  const importProject = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const toggleGrid = useCallback(() => {
    canvasRef.current?.toggleGrid()
    setGridVisible(v => !v)
  }, [])

  const handleImportFile = useCallback((e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result)
        if (!data?.layers || !Array.isArray(data.layers)) {
          addMessage('文件格式不正确')
          setStatus('导入失败：格式不正确')
          return
        }
        takeSnapshot()
        for (const l of data.layers) {
          if (l.id >= nextId) nextId = l.id + 1
        }
        setLayers(data.layers)
        addMessage('已导入项目')
        setStatus('已导入项目')
      } catch {
        addMessage('文件格式不正确')
        setStatus('导入失败：无法解析文件')
      }
    }
    reader.readAsText(file)
    // Reset so the same file can be re-imported
    e.target.value = ''
  }, [takeSnapshot, addMessage])

  /* ---- Keyboard shortcuts ---- */

  useEffect(() => {
    const handler = (e) => {
      const ctrl = e.ctrlKey || e.metaKey
      if (ctrl && e.key === 'z') {
        e.preventDefault()
        executeLocal('undo')
      } else if (ctrl && e.key === 'y') {
        e.preventDefault()
        executeLocal('redo')
      } else if (ctrl && e.key === 's') {
        e.preventDefault()
        exportPng()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [executeLocal, exportPng])

  /* ---- LLM command handler ---- */

  const handleCommand = useCallback(async (text) => {
    const intent = classifyIntent(text)

    if (intent === 'chat') {
      setHistory((prev) => [
        { id: nextId++, text, status: 'ignored', timestamp: new Date() },
        ...prev,
      ])
      const msg = '请说绘图指令，例如画红色圆'
      setStatus(msg)
      addMessage(msg)
      return
    }

    if (intent === 'control') {
      if (/撤销|回退|后退|撤消/.test(text)) {
        executeLocal('undo')
      } else if (/重做|还原/.test(text)) {
        executeLocal('redo')
      } else if (/显示网格|打开网格/.test(text)) {
        if (!canvasRef.current?.isGridVisible?.()) toggleGrid()
        addMessage('已显示网格')
        setStatus('已显示网格')
      } else if (/隐藏网格|关闭网格/.test(text)) {
        if (canvasRef.current?.isGridVisible?.()) toggleGrid()
        addMessage('已隐藏网格')
        setStatus('已隐藏网格')
      } else if (/结束(绘画|绘图|画图|画画)/.test(text)) {
        return
      } else {
        executeLocal('clear')
      }
      return
    }

    setLoading(true)
    setStatus('思考中...')
    takeSnapshot()

    try {
      const canvasSummary = layersRef.current.length > 0 ? generateCanvasSummary(layersRef.current) : []
      const result = await runAgent(text, canvasSummary)

      // Use layersRef.current instead of closure-captured `layers` to
      // avoid race conditions when two commands fire in quick succession.
      const currentLayers = layersRef.current
      const newLayers = [...currentLayers]

      for (const action of result.actions || []) {
        const { type, params } = action
        switch (type) {
          case 'draw_shape': {
            newLayers.push({ id: nextId++, type: 'shape', ...params })
            break
          }
          case 'draw_svg': {
            newLayers.push({ id: nextId++, type: 'svg', ...params })
            break
          }
          case 'canvas_control': {
            if (params.action === 'clear') newLayers.length = 0
            else if (params.action === 'undo') newLayers.pop()
            break
          }
        }
      }

      setLayers([...newLayers])
      setHistory((prev) => [
        { id: nextId++, text, status: result.status === 'error' ? 'error' : 'success', timestamp: new Date() },
        ...prev,
      ])
      const summary = result.summary || '绘制完成'
      setStatus(summary)
      // Wait for canvas to finish rendering (esp. async SVGs) before speaking
      await canvasRef.current?.waitForRender?.()
      addMessage(summary)
    } catch (err) {
      console.error('Agent error:', err)
      const msg = '抱歉，出了点问题，请再试一次'
      setStatus(msg)
      addMessage(msg)
      setHistory((prev) => [
        { id: nextId++, text, status: 'error', timestamp: new Date() },
        ...prev,
      ])
    } finally {
      setLoading(false)
    }
  }, [executeLocal, takeSnapshot, addMessage])

  const drawingActive = voiceMode === 'listening'

  let statusMode = 'idle'
  if (voiceMode === 'listening' && loading) statusMode = 'thinking'
  else if (voiceMode === 'listening') statusMode = 'listening'
  else if (voiceMode === 'idle') statusMode = 'idle'

  const hints = drawingActive
    ? generateHints(layers, loading)
    : ['画红色圆', '画一只小狗', '画蓝色矩形', '画玫瑰花', '画房子和树', '画一条线']

  const showBar = drawingActive && (layers.length > 0 || undoCount > 0)

  return (
    <div className="app">
      <VoiceController
        onSubmit={handleCommand}
        disabled={loading}
        onStateChange={setVoiceMode}
      />

      <AnimatePresence mode="wait">
        {!loading && (
          <motion.div
            className="guidance-row"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4, ease: [0.22, 0.61, 0.36, 1] }}
          >
            {hints.map((h, i) => (
              <motion.span
                key={h}
                className="guidance-chip"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.35, ease: 'easeOut' }}
                whileHover={{ scale: 1.04, y: -2 }}
              >
                {h}
              </motion.span>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <header className="app-header">
        <h1>AI 语音绘图助手</h1>
        <VoiceStatusBar mode={statusMode} status={status} />
      </header>

      <main className="app-main">
        <div className="canvas-area">
          <ErrorBoundary>
          <Canvas ref={canvasRef} width={CONFIG.canvasWidth} height={CONFIG.canvasHeight}
            onLayersChange={handleLayersChange} onSelectChange={setSelectedId} />
          <QuickBar
            onUndo={() => executeLocal('undo')}
            onRedo={() => executeLocal('redo')}
            onClear={() => executeLocal('clear')}
            onDelete={() => executeLocal('deleteSelected')}
            onExportPng={exportPng}
            onExportProject={exportProject}
            onImportProject={importProject}
            onToggleGrid={toggleGrid}
            disabled={loading}
            visible={showBar}
            hasSelection={selectedId !== null}
            canUndo={undoCount > 0}
            canRedo={redoCount > 0}
            hasLayers={layers.length > 0}
            gridVisible={gridVisible}
          />
          <input ref={fileInputRef} type="file" accept=".json"
            style={{ display: 'none' }} onChange={handleImportFile} />
          </ErrorBoundary>
        </div>

        <aside className="side-panel">
<div className="panel-section">
            <h3>指令历史</h3>
            <History items={history} />
          </div>
        </aside>
      </main>
    </div>
  )
}
