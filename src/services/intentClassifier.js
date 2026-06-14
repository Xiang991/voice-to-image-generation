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
  /重做/,
  /还原/,
  /显示网格|打开网格/,
  /隐藏网格|关闭网格/,
  /清空/,
  /清除/,
  /删掉/,
  /删了/,
  /全删/,
  /重来/,
  /重新开始/,
  /结束(绘画|绘图|画图|画画)/,
]

// Obvious conversational phrases → chat
const CHAT_PATTERNS = [
  /^你/,
  /你好/,
  /谢谢/,
  /再见/,
  /怎么样/,
  /是什么/,
  /为什么/,
  /怎么/,
  /可以吗/,
  /好吗/,
  /行吗/,
  /对不对/,
  /今天/,
  /天气/,
  /你是谁/,
  /叫什么/,
  /名字/,
  /干嘛/,
  /做什么/,
  /什么用/,
  /什么功能/,
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

  // No explicit draw verb — check if it's obviously chat
  for (const re of CHAT_PATTERNS) {
    if (re.test(t)) return 'chat'
  }

  // Fallback: in a pure voice-drawing app, anything else is a draw command
  // Covers phrases like "一只小牛", "红色圆", "蓝色正方形", "太阳和云"
  return 'draw'
}
