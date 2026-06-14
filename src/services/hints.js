export function generateHints(layers, loading) {
  if (loading) return []

  const count = layers.length
  const shapes = layers.filter(l => l.type === 'shape').length
  const svgs = layers.filter(l => l.type === 'svg').length

  // Empty canvas
  if (count === 0) {
    return [
      '画红色圆',
      '画蓝色矩形',
      '画一只小狗',
      '画黄色太阳和白云',
      '画一棵绿色的树',
      '显示网格',
    ]
  }

  // Few items — encourage expansion
  if (count <= 3) {
    const hints = ['画一个更大的圆形']
    if (shapes > 0 && svgs === 0) hints.push('画一朵玫瑰花')
    if (svgs > 0 && shapes === 0) hints.push('画蓝色矩形在旁边')
    hints.push('画一条线', '清空', '保存图片')
    return hints
  }

  // Moderate — suggest composition
  if (count <= 8) {
    return [
      '在左边画一个矩形',
      '画一个更大的太阳',
      '清空',
      '保存图片',
      '撤销',
      '导出项目',
    ]
  }

  // Dense canvas — management actions
  return [
    '保存图片',
    '导出项目',
    '清空',
    '撤销',
    '隐藏网格',
    '画一个小圆形在空位',
  ]
}
