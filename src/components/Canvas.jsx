import { useRef, forwardRef, useImperativeHandle } from 'react'

let renderGen = 0

function drawShape(ctx, layer) {
  switch (layer.shape) {
    case 'circle': {
      const r = layer.radius || 50
      ctx.beginPath()
      ctx.arc(layer.x, layer.y, r, 0, Math.PI * 2)
      ctx.fillStyle = layer.color
      ctx.fill()
      break
    }
    case 'rect': {
      const w = layer.width || 100
      const h = layer.height || 80
      ctx.fillStyle = layer.color
      ctx.fillRect(layer.x - w / 2, layer.y - h / 2, w, h)
      break
    }
    case 'line':
      ctx.beginPath()
      ctx.moveTo(layer.x, layer.y)
      ctx.lineTo(layer.x2 ?? layer.x + 100, layer.y2 ?? layer.y)
      ctx.strokeStyle = layer.color
      ctx.lineWidth = 2
      ctx.stroke()
      break
  }
}

function drawSvg(ctx, layer, gen) {
  try {
    const blob = new Blob([layer.svg], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      if (gen !== renderGen) return
      const scale = layer.scale ?? 1
      const x = layer.x ?? 0
      const y = layer.y ?? 0
      ctx.drawImage(img, x, y, img.naturalWidth * scale, img.naturalHeight * scale)
      URL.revokeObjectURL(url)
    }
    img.onerror = () => {
      console.error('SVG 加载失败:', layer.svg?.substring(0, 80))
      URL.revokeObjectURL(url)
    }
    img.src = url
  } catch (e) {
    console.error('SVG 渲染异常:', e)
  }
}

const Canvas = forwardRef(function Canvas({ width = 800, height = 600 }, ref) {
  const canvasElRef = useRef(null)

  useImperativeHandle(ref, () => ({
    setLayers(layers) {
      const el = canvasElRef.current
      if (!el) return
      const ctx = el.getContext('2d')
      if (!ctx) return

      renderGen++
      const gen = renderGen

      ctx.clearRect(0, 0, width, height)
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, width, height)

      for (const layer of layers) {
        if (layer.type === 'shape') {
          drawShape(ctx, layer)
        }
      }

      for (const layer of layers) {
        if (layer.type === 'svg') {
          drawSvg(ctx, layer, gen)
        }
      }
    },
  }))

  return (
    <canvas
      ref={canvasElRef}
      width={width}
      height={height}
      style={{ borderRadius: 8, boxShadow: '0 2px 12px rgba(0,0,0,0.3)' }}
    />
  )
})

export default Canvas
