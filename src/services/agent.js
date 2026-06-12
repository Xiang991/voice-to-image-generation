import { CONFIG } from '../config.js'

const API_BASE = `${CONFIG.apiBaseUrl}/chat/completions`

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'draw_shape',
      description: '在画布上绘制精确几何图形。用于"画红色圆"、"画蓝色矩形"等指令。',
      parameters: {
        type: 'object',
        properties: {
          shape: { type: 'string', enum: ['circle', 'rect', 'line'], description: '图形类型' },
          color: { type: 'string', description: '颜色：中文色名（红/蓝/绿/黄/黑/白）或英文或hex' },
          x: { type: 'number', description: 'X坐标（圆心/矩形中心/线段起点）' },
          y: { type: 'number', description: 'Y坐标（圆心/矩形中心/线段起点）' },
          radius: { type: 'number', description: '半径，仅circle需要' },
          width: { type: 'number', description: '宽度，仅rect需要' },
          height: { type: 'number', description: '高度，仅rect需要' },
          x2: { type: 'number', description: '线段终点X，仅line需要' },
          y2: { type: 'number', description: '线段终点Y，仅line需要' },
        },
        required: ['shape', 'color', 'x', 'y'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'draw_svg',
      description: '使用SVG绘制任意自由图形。用于"画小狗"、"画汽车"、"画房子"、"画树"等非几何指令。',
      parameters: {
        type: 'object',
        properties: {
          svg: { type: 'string', description: 'SVG标记字符串，使用<circle>/<rect>/<path>/<ellipse>等元素' },
          x: { type: 'number', description: 'SVG在画布上的X偏移，默认0' },
          y: { type: 'number', description: 'SVG在画布上的Y偏移，默认0' },
          scale: { type: 'number', description: '缩放比例，默认1.0' },
        },
        required: ['svg'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'canvas_control',
      description: '管理画布。清空或撤销上一步操作。',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['clear', 'undo'], description: 'clear=清空画布, undo=撤销上一步' },
        },
        required: ['action'],
      },
    },
  },
]

const SYSTEM_PROMPT = `你是一个AI绘画助手。用户在画布上作画，你使用工具执行绘图指令。

## 工具选择策略
1. 精确几何图形（圆/矩形/线段）→ draw_shape
2. 具体物体（动物、车辆、建筑、植物、自然元素）→ draw_svg
3. 画布管理（清空/撤销）→ canvas_control

## 坐标参考
- 画布800×600，原点(0,0)在左上角
- 默认图形大小：圆radius=60，矩形width=120 height=80

## SVG生成规则
- 使用标准SVG标签：<circle>, <rect>, <path>, <ellipse>, <line>, <polygon>
- 颜色用英文名（red/blue/green等）或hex
- SVG内容紧凑放在一行，避免换行
- viewBox建议"0 0 200 200"，图形居中
- 简单图形：<circle cx="100" cy="100" r="80" fill="red"/>
- 矩形：<rect x="20" y="20" width="160" height="120" fill="blue"/>

## 颜色参考
中文→英文：红→red 蓝→blue 绿→green 黄→yellow 黑→black 白→white 橙→orange 紫→purple 粉→pink 灰→gray 棕→brown 青→cyan

## 重要规则
- 直接调用工具执行，不要用文字解释
- 单步指令一次工具调用完成
- 复合指令可多次调用
- 位置参数合理分布，避免图形重叠在角落`

async function chat(messages) {
  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CONFIG.apiKey}`,
    },
    body: JSON.stringify({
      model: CONFIG.model,
      messages,
      tools: TOOLS,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`API ${res.status}: ${err}`)
  }

  return res.json()
}

export async function runAgent(userText, onToolCall) {
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userText },
  ]

  for (let turn = 0; turn < CONFIG.maxAgentTurns; turn++) {
    const data = await chat(messages)

    const choice = data.choices?.[0]
    if (!choice) break

    const msg = choice.message

    if (msg.tool_calls && msg.tool_calls.length > 0) {
      messages.push({
        role: 'assistant',
        content: msg.content || '',
        tool_calls: msg.tool_calls,
      })

      for (const tc of msg.tool_calls) {
        const args = JSON.parse(tc.function.arguments)
        const result = await onToolCall(tc.function.name, args)
        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: JSON.stringify(result),
        })
      }
    } else {
      return { text: msg.content || '' }
    }
  }

  return { text: '' }
}
