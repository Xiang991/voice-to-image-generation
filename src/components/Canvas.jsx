import { useRef, forwardRef, useImperativeHandle, useEffect } from 'react'
import {
  Canvas as FabricCanvas,
  Rect,
  Circle,
  Line,
  loadSVGFromString,
  Group,
} from 'fabric'

let loadGen = 0

function createShape(layer) {
  switch (layer.shape) {
    case 'circle':
      return new Circle({
        radius: layer.radius || 50,
        fill: layer.color,
        left: layer.x,
        top: layer.y,
        originX: 'center',
        originY: 'center',
      })
    case 'rect': {
      const w = layer.width || 100
      const h = layer.height || 80
      return new Rect({
        width: w,
        height: h,
        fill: layer.color,
        left: layer.x,
        top: layer.y,
        originX: 'center',
        originY: 'center',
      })
    }
    case 'line':
      return new Line(
        [layer.x, layer.y, layer.x2 ?? layer.x + 100, layer.y2 ?? layer.y],
        { stroke: layer.color, strokeWidth: 2 },
      )
    default:
      return null
  }
}

async function addSvg(canvas, layer, gen) {
  try {
    const parsed = await loadSVGFromString(layer.svg)
    if (gen !== loadGen) return
    if (!parsed.objects || parsed.objects.length === 0) return
    const group = new Group(parsed.objects, {
      left: layer.x ?? 0,
      top: layer.y ?? 0,
      scaleX: layer.scale ?? 1,
      scaleY: layer.scale ?? 1,
    })
    canvas.add(group)
    canvas.renderAll()
  } catch (e) {
    console.error('SVG 加载失败:', e)
  }
}

const Canvas = forwardRef(function Canvas({ width = 800, height = 600 }, ref) {
  const canvasElRef = useRef(null)
  const fabricRef = useRef(null)

  useEffect(() => {
    const fabric = new FabricCanvas(canvasElRef.current, {
      width,
      height,
      backgroundColor: '#ffffff',
      selection: false,
      renderOnAddRemove: false,
    })
    fabricRef.current = fabric
    return () => { fabric.dispose() }
  }, [width, height])

  useImperativeHandle(ref, () => ({
    setLayers(layers) {
      const canvas = fabricRef.current
      if (!canvas) return

      loadGen++
      const gen = loadGen

      canvas.clear()
      canvas.backgroundColor = '#ffffff'

      for (const layer of layers) {
        if (layer.type === 'shape') {
          const obj = createShape(layer)
          if (obj) canvas.add(obj)
        } else if (layer.type === 'svg') {
          addSvg(canvas, layer, gen)
        }
      }

      canvas.renderAll()
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
