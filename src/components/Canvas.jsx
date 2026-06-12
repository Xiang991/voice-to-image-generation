import { useRef, forwardRef, useImperativeHandle } from 'react'

function drawShape(ctx, layer) {
  ctx.fillStyle = layer.color
  ctx.strokeStyle = layer.color
  ctx.lineWidth = 2

  switch (layer.shape) {
    case 'circle': {
      ctx.beginPath()
      ctx.arc(layer.x, layer.y, layer.radius || 50, 0, Math.PI * 2)
      ctx.fill()
      break
    }
    case 'rect': {
      const w = layer.width || 100
      const h = layer.height || 80
      ctx.fillRect(layer.x - w / 2, layer.y - h / 2, w, h)
      break
    }
    case 'line': {
      ctx.beginPath()
      ctx.moveTo(layer.x, layer.y)
      ctx.lineTo(layer.x2 ?? layer.x + 100, layer.y2 ?? layer.y)
      ctx.stroke()
      break
    }
  }
}

function loadSvgImage(layer) {
  return new Promise((resolve) => {
    const blob = new Blob([layer.svg], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => resolve(null)
    img.src = url
  })
}

const Canvas = forwardRef(function Canvas({ width = 800, height = 600 }, ref) {
  const canvasRef = useRef(null)
  const layersRef = useRef([])
  const svgCacheRef = useRef({})

  const redrawAll = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)

    for (const layer of layersRef.current) {
      if (layer.type === 'shape') {
        drawShape(ctx, layer)
      } else if (layer.type === 'svg') {
        const cached = svgCacheRef.current[layer.id]
        if (cached) {
          const s = layer.scale || 1
          ctx.drawImage(cached, layer.x || 0, layer.y || 0, cached.width * s, cached.height * s)
        }
      }
    }
  }

  const addSvgLayer = async (layer) => {
    const img = await loadSvgImage(layer)
    if (img) {
      svgCacheRef.current[layer.id] = img
    }
    redrawAll()
  }

  useImperativeHandle(ref, () => ({
    setLayers(layers) {
      layersRef.current = layers
      // 清除无对应 layer 的缓存
      const ids = new Set(layers.map((l) => l.id))
      for (const key of Object.keys(svgCacheRef.current)) {
        if (!ids.has(Number(key))) delete svgCacheRef.current[key]
      }
      redrawAll()
      // 异步加载新的 SVG
      for (const layer of layers) {
        if (layer.type === 'svg' && !svgCacheRef.current[layer.id]) {
          addSvgLayer(layer)
        }
      }
    },
  }))

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ background: '#fff', borderRadius: 8, boxShadow: '0 2px 12px rgba(0,0,0,0.3)' }}
    />
  )
})

export default Canvas
