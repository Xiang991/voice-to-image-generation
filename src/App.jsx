import { useState, useRef, useEffect } from 'react'
import Canvas from './components/Canvas.jsx'
import VoiceController from './components/VoiceController.jsx'
import History from './components/History.jsx'
import { runAgent } from './services/agent.js'
import { speak } from './services/tts.js'
import { generateCanvasSummary } from './services/canvasSummary.js'
import { CONFIG } from './config.js'

let nextId = 1

export default function App() {
  const canvasRef = useRef(null)
  const [layers, setLayers] = useState([])
  const [history, setHistory] = useState([])
  const [status, setStatus] = useState('就绪')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    canvasRef.current?.setLayers(layers)
  }, [layers])

  function executeActions(actions) {
    const newLayers = [...layers]
    for (const action of actions) {
      switch (action.type) {
        case 'draw_shape':
          newLayers.push({ id: nextId++, type: 'shape', ...action.params })
          break
        case 'draw_svg':
          newLayers.push({
            id: nextId++,
            type: 'svg',
            svg: action.params.svg,
            x: action.params.x ?? 0,
            y: action.params.y ?? 0,
            scale: action.params.scale ?? 1,
          })
          break
        case 'canvas_control':
          if (action.params.action === 'clear') newLayers.length = 0
          else if (action.params.action === 'undo') newLayers.pop()
          break
      }
    }
    setLayers(newLayers)
  }

  const handleCommand = async (text) => {
    setLoading(true)
    setStatus('思考中...')

    try {
      const summary = generateCanvasSummary(layers)
      const response = await runAgent(text, summary)

      switch (response.status) {
        case 'success':
          executeActions(response.actions)
          setStatus('就绪')
          speak(response.summary)
          setHistory((prev) => [
            { id: nextId++, text, status: 'success', summary: response.summary, timestamp: new Date() },
            ...prev,
          ])
          break

        case 'optimized':
          executeActions(response.actions)
          setStatus('已优化')
          speak('已优化：' + response.summary)
          setHistory((prev) => [
            { id: nextId++, text, status: 'optimized', summary: response.summary, timestamp: new Date() },
            ...prev,
          ])
          break

        case 'error':
          setStatus('没理解')
          speak('没理解您的指令，请再说一遍')
          setHistory((prev) => [
            { id: nextId++, text, status: 'error', summary: response.summary, timestamp: new Date() },
            ...prev,
          ])
          break
      }
    } catch (err) {
      console.error('Agent error:', err)
      speak('出错了，请重试')
      setStatus('出错')
      setHistory((prev) => [
        { id: nextId++, text, status: 'error', summary: err.message, timestamp: new Date() },
        ...prev,
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app">
      <VoiceController onSubmit={handleCommand} disabled={loading} />

      <header className="app-header">
        <h1>AI 语音绘图助手</h1>
        <span className="status-badge">{loading ? '⏳' : '🎨'} {status}</span>
      </header>

      <main className="app-main">
        <div className="canvas-area">
          <Canvas ref={canvasRef} width={CONFIG.canvasWidth} height={CONFIG.canvasHeight} />
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
