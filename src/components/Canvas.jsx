import { useRef, forwardRef, useImperativeHandle, useState, useCallback } from 'react'

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

/* ---- Hit-test helpers ---- */

function getLayerBounds(layer) {
  switch (layer.type) {
    case 'shape':
      switch (layer.shape) {
        case 'circle': {
          const r = layer.radius || 50
          return { minX: layer.x - r, minY: layer.y - r, maxX: layer.x + r, maxY: layer.y + r }
        }
        case 'rect': {
          const w = layer.width || 100
          const h = layer.height || 80
          return {
            minX: layer.x - w / 2, minY: layer.y - h / 2,
            maxX: layer.x + w / 2, maxY: layer.y + h / 2,
          }
        }
        case 'line': {
          const x2 = layer.x2 ?? layer.x + 100
          const y2 = layer.y2 ?? layer.y
          const pad = 10
          return {
            minX: Math.min(layer.x, x2) - pad, minY: Math.min(layer.y, y2) - pad,
            maxX: Math.max(layer.x, x2) + pad, maxY: Math.max(layer.y, y2) + pad,
          }
        }
      }
      break
    case 'svg': {
      const s = layer.scale ?? 1
      const w = (layer._imgW || 200) * s
      const h = (layer._imgH || 200) * s
      return { minX: layer.x, minY: layer.y, maxX: layer.x + w, maxY: layer.y + h }
    }
  }
  return { minX: layer.x - 25, minY: layer.y - 25, maxX: layer.x + 25, maxY: layer.y + 25 }
}

function hitTest(x, y, layers) {
  for (let i = layers.length - 1; i >= 0; i--) {
    const layer = layers[i]
    const b = getLayerBounds(layer)
    if (x >= b.minX && x <= b.maxX && y >= b.minY && y <= b.maxY) {
      return layer
    }
  }
  return null
}

/* ---- Selection visuals ---- */

function drawSelectionBox(ctx, layer) {
  const b = getLayerBounds(layer)
  const pad = 6
  const x = b.minX - pad
  const y = b.minY - pad
  const w = b.maxX - b.minX + pad * 2
  const h = b.maxY - b.minY + pad * 2

  ctx.save()

  // Dashed outline
  ctx.setLineDash([5, 4])
  ctx.strokeStyle = '#3b82f6'
  ctx.lineWidth = 1.5
  ctx.strokeRect(x, y, w, h)

  // Corner handles
  ctx.setLineDash([])
  ctx.fillStyle = '#ffffff'
  ctx.strokeStyle = '#3b82f6'
  ctx.lineWidth = 1.5
  const hs = 7
  for (const [hx, hy] of [[x, y], [x + w, y], [x, y + h], [x + w, y + h]]) {
    ctx.fillRect(hx - hs / 2, hy - hs / 2, hs, hs)
    ctx.strokeRect(hx - hs / 2, hy - hs / 2, hs, hs)
  }

  ctx.restore()
}

const Canvas = forwardRef(function Canvas({ width = 800, height = 600, onLayersChange, onSelectChange }, ref) {
  const canvasElRef = useRef(null)
  const layersRef = useRef([])
  const selectedIdRef = useRef(null)
  const dragRef = useRef(null)
  const svgCacheRef = useRef(new Map())

  const [cursor, setCursor] = useState('default')

  /* ===== Main render ===== */

  const fullRender = useCallback(() => {
    const el = canvasElRef.current
    if (!el) return
    const ctx = el.getContext('2d')
    if (!ctx) return

    renderGen++
    const gen = renderGen

    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)

    const layers = layersRef.current

    for (const layer of layers) {
      if (layer.type === 'shape') drawShape(ctx, layer)
    }
    for (const layer of layers) {
      if (layer.type === 'svg') drawSvgCached(ctx, layer, gen)
    }

    const selId = selectedIdRef.current
    if (selId != null) {
      const selLayer = layers.find(l => l.id === selId)
      if (selLayer) drawSelectionBox(ctx, selLayer)
    }
  }, [width, height])

  /* ---- SVG with Image cache ---- */

  function drawSvgCached(ctx, layer, gen) {
    const key = layer.svg
    const cached = svgCacheRef.current.get(key)

    if (cached && cached.complete && cached.naturalWidth > 0) {
      const s = layer.scale ?? 1
      ctx.drawImage(cached, layer.x, layer.y, cached.naturalWidth * s, cached.naturalHeight * s)
      layer._imgW = cached.naturalWidth
      layer._imgH = cached.naturalHeight
      return
    }

    if (cached) return // still loading, will draw on onload

    // First load
    const img = new Image()
    svgCacheRef.current.set(key, img)

    const blob = new Blob([key], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)

    img.onload = () => {
      URL.revokeObjectURL(url)
      layer._imgW = img.naturalWidth
      layer._imgH = img.naturalHeight
      if (gen !== renderGen) return

      const ctx2 = canvasElRef.current?.getContext('2d')
      if (ctx2) {
        const s = layer.scale ?? 1
        ctx2.drawImage(img, layer.x, layer.y, img.naturalWidth * s, img.naturalHeight * s)
        // Redraw selection on top
        const selId = selectedIdRef.current
        if (selId != null) {
          const selLayer = layersRef.current.find(l => l.id === selId)
          if (selLayer) drawSelectionBox(ctx2, selLayer)
        }
      }
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      svgCacheRef.current.delete(key)
      console.error('SVG 加载失败:', key.substring(0, 80))
    }

    img.src = url
  }

  /* ===== Interaction handlers ===== */

  const getCanvasCoords = useCallback((e) => {
    const rect = canvasElRef.current.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }, [])

  const handleMouseDown = useCallback((e) => {
    const { x, y } = getCanvasCoords(e)
    const hit = hitTest(x, y, layersRef.current)

    if (hit) {
      selectedIdRef.current = hit.id
      dragRef.current = {
        layerId: hit.id,
        startX: x, startY: y,
        origX: hit.x, origY: hit.y,
      }
    } else {
      selectedIdRef.current = null
      dragRef.current = null
    }

    if (onSelectChange) onSelectChange(selectedIdRef.current)
    fullRender()
  }, [getCanvasCoords, fullRender, onSelectChange])

  const handleMouseMove = useCallback((e) => {
    const { x, y } = getCanvasCoords(e)
    const drag = dragRef.current

    if (drag) {
      const layer = layersRef.current.find(l => l.id === drag.layerId)
      if (layer) {
        layer.x = Math.round(drag.origX + (x - drag.startX))
        layer.y = Math.round(drag.origY + (y - drag.startY))
        fullRender()
      }
      setCursor('grabbing')
    } else {
      const hit = hitTest(x, y, layersRef.current)
      setCursor(hit ? 'grab' : 'default')
    }
  }, [getCanvasCoords, fullRender])

  const handleMouseUp = useCallback(() => {
    const drag = dragRef.current
    if (drag && onLayersChange) {
      onLayersChange([...layersRef.current])
    }
    dragRef.current = null
  }, [onLayersChange])

  const handleMouseLeave = useCallback(() => {
    if (dragRef.current && onLayersChange) {
      onLayersChange([...layersRef.current])
    }
    dragRef.current = null
    setCursor('default')
  }, [onLayersChange])

  const handleKeyDown = useCallback((e) => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIdRef.current != null) {
      e.preventDefault()
      const idx = layersRef.current.findIndex(l => l.id === selectedIdRef.current)
      if (idx !== -1) {
        layersRef.current.splice(idx, 1)
        selectedIdRef.current = null
        if (onSelectChange) onSelectChange(null)
        fullRender()
        if (onLayersChange) onLayersChange([...layersRef.current])
      }
    }
  }, [onLayersChange, fullRender, onSelectChange])

  /* ===== Imperative API for parent ===== */

  useImperativeHandle(ref, () => ({
    setLayers(layers) {
      layersRef.current = layers.map(l => ({ ...l }))
      selectedIdRef.current = null
      if (onSelectChange) onSelectChange(null)
      fullRender()
    },
    deleteSelected() {
      if (selectedIdRef.current == null) return false
      const idx = layersRef.current.findIndex(l => l.id === selectedIdRef.current)
      if (idx === -1) return false
      layersRef.current.splice(idx, 1)
      selectedIdRef.current = null
      if (onSelectChange) onSelectChange(null)
      fullRender()
      if (onLayersChange) onLayersChange([...layersRef.current])
      return true
    },
    getSelectedId() {
      return selectedIdRef.current
    },
  }))

  return (
    <canvas
      ref={canvasElRef}
      width={width}
      height={height}
      style={{
        borderRadius: 8,
        boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
        cursor,
        userSelect: 'none',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onContextMenu={(e) => e.preventDefault()}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    />
  )
})

export default Canvas
