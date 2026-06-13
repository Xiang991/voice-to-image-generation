const DRAW_PATTERNS = [
  /画/,
  /绘/,
  /加.?个/,
  /添.?个/,
  /来.?个/,
  /弄.?个/,
  /做个?/,
  /加一/,
  /添加/,
  /画一/,
  /绘制/,
  /涂/,
]

const CONTROL_PATTERNS = [
  /撤销/,
  /回退/,
  /后退/,
  /撤消/,
  /清空/,
  /清除/,
  /删掉/,
  /删了/,
  /全删/,
  /重来/,
  /重新开始/,
  /结束(绘画|绘图|画图|画画)/,
]

export function classifyIntent(text) {
  const t = text.trim()
  if (!t) return 'chat'

  for (const re of CONTROL_PATTERNS) {
    if (re.test(t)) return 'control'
  }

  for (const re of DRAW_PATTERNS) {
    if (re.test(t)) return 'draw'
  }

  return 'chat'
}
