export function generateCanvasSummary(layers) {
  if (!layers || layers.length === 0) return []

  return layers.map(l => {
    const item = { type: l.type }

    if (l.type === 'shape') {
      item.shape = l.shape
      item.color = l.color
      item.x = l.x
      item.y = l.y
      if (l.radius) item.radius = l.radius
      if (l.width) item.width = l.width
      if (l.height) item.height = l.height
    } else if (l.type === 'svg') {
      item.x = l.x
      item.y = l.y
      item.scale = l.scale
    }

    return item
  })
}
