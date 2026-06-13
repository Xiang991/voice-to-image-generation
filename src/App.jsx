import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Canvas from './components/Canvas.jsx'
import VoiceController from './components/VoiceController.jsx'
import VoiceStatusBar from './components/VoiceStatusBar.jsx'
import QuickBar from './components/QuickBar.jsx'
import History from './components/History.jsx'
import { runAgent } from './services/agent.js'
import { generateCanvasSummary } from './services/canvasSummary.js'
import { classifyIntent } from './services/intentClassifier.js'
import { CONFIG } from './config.js'

let nextId = 1

export default function App() {
  const canvasRef = useRef(null)
  const [layers, setLayers] = useState([])
  const [history, setHistory] = useState([])
  const [status, setStatus] = useState('就绪')
  const [loading, setLoading] = useState(false)
  const [voiceMode, setVoiceMode] = useState('idle')

  useEffect(() => {
    canvasRef.current?.setLayers(layers)
  }, [layers])

  const executeLocal = useCallback((action) => {
    if (action === 'undo') {
      setLayers((prev) => {
        if (prev.length === 0) {
          setStatus('没有可撤销的操作')
          return prev
        }
        setStatus('已撤销')
        return prev.slice(0, -1)
      })
      setHistory((prev) => [
        { id: nextId++, text: '撤销', status: 'success', timestamp: new Date() },
        ...prev,
      ])
    } else if (action === 'clear') {
      setLayers([])
      setStatus('画布已清空')
      setHistory((prev) => [
        { id: nextId++, text: '清空', status: 'success', timestamp: new Date() },
        ...prev,
      ])
    }
  }, [])

  const handleCommand = useCallback(async (text) => {
    const intent = classifyIntent(text)

    if (intent === 'chat') {
      setHistory((prev) => [
        { id: nextId++, text, status: 'ignored', timestamp: new Date() },
        ...prev,
      ])
      setStatus('请说绘图指令，例如"画红色圆"')
      return
    }

    if (intent === 'control') {
      if (/撤销|回退|后退|撤消/.test(text)) {
        executeLocal('undo')
      } else if (/结束(绘画|绘图|画图|画画)/.test(text)) {
        return
      } else {
        executeLocal('clear')
      }
      return
    }

    setLoading(true)
    setStatus('思考中...')

    try {
      const summary = layers.length > 0 ? generateCanvasSummary(layers) : []
      const result = await runAgent(text, summary)

      const newLayers = [...layers]

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
      setStatus(result.summary || '绘制完成')
    } catch (err) {
      console.error('Agent error:', err)
      setStatus('出错')
      setHistory((prev) => [
        { id: nextId++, text, status: 'error', timestamp: new Date() },
        ...prev,
      ])
    } finally {
      setLoading(false)
    }
  }, [layers, executeLocal])

  const drawingActive = voiceMode === 'listening'

  let statusMode = 'idle'
  if (voiceMode === 'listening' && loading) statusMode = 'thinking'
  else if (voiceMode === 'listening') statusMode = 'listening'
  else if (voiceMode === 'idle') statusMode = 'idle'

  const hints = drawingActive && !loading
    ? ['画红色圆', '画一只小猫', '画蓝色矩形', '画一棵树', '清空', '画黄色太阳']
    : ['画红色圆', '画一只小狗', '画蓝色矩形', '画玫瑰花', '画房子和树', '画一条线']

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
          <Canvas ref={canvasRef} width={CONFIG.canvasWidth} height={CONFIG.canvasHeight} />
          <QuickBar
            onUndo={() => executeLocal('undo')}
            onClear={() => executeLocal('clear')}
            disabled={loading}
            visible={drawingActive && layers.length > 0}
          />
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
