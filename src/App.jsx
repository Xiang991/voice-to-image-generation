import { useState, useRef, useEffect } from 'react'
import Canvas from './components/Canvas.jsx'
import TextInput from './components/TextInput.jsx'
import History from './components/History.jsx'
import { runAgent } from './services/agent.js'
import { resolveColor } from './utils/colors.js'
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

  const handleCommand = async (text) => {
    setLoading(true)
    setStatus('思考中...')

    const newLayers = [...layers]

    try {
      await runAgent(text, async (name, args) => {
        switch (name) {
          case 'draw_shape': {
            args.color = resolveColor(args.color)
            newLayers.push({ id: nextId++, type: 'shape', ...args })
            break
          }
          case 'draw_svg': {
            newLayers.push({
              id: nextId++,
              type: 'svg',
              svg: args.svg,
              x: args.x ?? 0,
              y: args.y ?? 0,
              scale: args.scale ?? 1,
            })
            break
          }
          case 'canvas_control': {
            if (args.action === 'clear') newLayers.length = 0
            else if (args.action === 'undo') newLayers.pop()
            break
          }
        }
        setLayers([...newLayers])
        return { success: true }
      })

      setLayers([...newLayers])
      setHistory((prev) => [
        { id: nextId++, text, status: 'success', timestamp: new Date() },
        ...prev,
      ])
      setStatus('就绪')
    } catch (err) {
      console.error('Agent error:', err)
      setHistory((prev) => [
        { id: nextId++, text, status: 'error', timestamp: new Date() },
        ...prev,
      ])
      setStatus('出错：' + (err.message || '未知错误'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app">
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
            <h3>指令输入</h3>
            <TextInput onSubmit={handleCommand} disabled={loading} />
          </div>
          <div className="panel-section">
            <h3>指令历史</h3>
            <History items={history} />
          </div>
        </aside>
      </main>
    </div>
  )
}
