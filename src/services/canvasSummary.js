/**
 * 计算图形所在的画布区域
 * 画布 800×600，3×3 网格
 */
function getZone(x, y) {
  const h = x < 267 ? '左' : x > 533 ? '右' : '中'
  const v = y < 200 ? '上' : y > 400 ? '下' : '中'
  return h + v
}

export function generateCanvasSummary(layers) {
  if (!layers || layers.length === 0) return []

  return layers.map(l => {
    const item = { type: l.type }

    if (l.type === 'shape') {
      item.shape = l.shape
      item.color = l.color
      item.x = l.x
      item.y = l.y
      // 追加空间区域描述
      item.zone = getZone(l.x, l.y)
      if (l.radius) item.radius = l.radius
      if (l.width) item.width = l.width
      if (l.height) item.height = l.height
    } else if (l.type === 'svg') {
      item.x = l.x
      item.y = l.y
      item.scale = l.scale
      item.zone = getZone(l.x || 400, l.y || 300)
    }

    return item
  })
}
