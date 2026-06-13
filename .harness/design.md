# AI 语音绘图助手 — 设计文档

## 项目概述

纯语音控制的绘图工具。用户通过语音指令完成绘图创作。

**核心机制：** 浏览器 Web Speech API 语音识别 → 厚前端解析指令 → 薄代理透传 → DeepSeek LLM 输出 JSON → 前端状态判断 → Canvas 渲染 + TTS 反馈。

## 总体架构：厚前端 + 薄代理 + 纯云 LLM

```
┌─────────────────────────────────────────────────────────────┐
│  用户层                                                      │
│  用户语音输入指令                                            │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  前端层（厚前端）                                             │
│                                                             │
│  ① ASR 转文本  ← VoiceController (Web Speech API)           │
│  ② 调用代理层  ← agent.js (fetch POST)                      │
│  ③ 解析 JSON   ← 解析 LLM 返回的 { status, actions }         │
│  ④ 状态判断    ← success / optimized / error                 │
│  ⑤ 绘图 + TTS  ← Canvas.jsx 渲染 + tts.js 语音反馈           │
│  ⑥ 存储画布    ← canvasSummary.js 更新画布状态               │
└────────────────────────────┬────────────────────────────────┘
                             │ { text, canvasSummary }
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  中间层（薄代理）                                             │
│  Express 服务                                               │
│  ① 接收文本 + 画布摘要                                       │
│  ② 注入 API Key + 系统提示词                                  │
│  ③ 转发 LLM                                                 │
│  ④ 透传 JSON 返回前端                                        │
│  代码量：~30 行，无分支判断                                    │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  云端 LLM（DeepSeek V4 Flash）                                │
│  理解自然语言 → 输出结构化 JSON                                │
│  { status, actions[], summary }                              │
└─────────────────────────────────────────────────────────────┘
```

### 架构原则

| 层级 | 职责 | 决策权 |
|------|------|--------|
| 前端（厚） | ASR / 调代理 / 解析 JSON / 状态判断 / 渲染 / TTS / 存储 | 全部业务判断 |
| 代理（薄） | 接收请求 / 加 Key / 转发 / 透传 | 无（纯透传） |
| LLM（云） | 理解自然语言 / 输出结构化指令 | 仅理解输出 |

关键设计：**所有智能在前端**。前端解析 LLM 返回的 JSON 后，根据 `status` 标签做分支判断（成功执行 / 已优化 / 报错重说）。代理层不做任何业务逻辑判断。

## 技术选型

| 模块 | 选型 |
|------|------|
| 前端框架 | React 19 + Vite 8 |
| 语音识别 | Web Speech API |
| 画布渲染 | Fabric.js 7 |
| Agent LLM | DeepSeek V4 Flash (JSON 直出) |
| 代理层 | Node Express (仅转发) |
| TTS | Web Speech Synthesis API |

## 数据流

```
用户说 "画红色圆"
  │
  ▼ ① VoiceController (Web Speech API → 文本)
"画红色圆"
  │
  ▼ ② agent.js → fetch POST /api/agent
  { text: "画红色圆", canvasSummary: [] }
  │
  ▼ ③ Express 代理 → 注入 Key → POST DeepSeek
  │
  ▼ ④ DeepSeek → 返回 JSON
  { "status": "success", "actions": [{...}], "summary": "画了一个红色的圆" }
  │
  ▼ ⑤ 代理透传 → 前端解析
  │
  ▼ ⑥ App.jsx: status === "success"
  ├── Canvas.jsx: 渲染红色圆形
  ├── tts.js: "画了一个红色的圆"
  ├── canvasSummary.js: 更新画布摘要
  └── History.jsx: 添加历史记录
```

## LLM 输出格式

```json
{
  "status": "success" | "optimized" | "error",
  "actions": [
    {
      "type": "draw_shape" | "draw_svg" | "canvas_control",
      "params": { ... }
    }
  ],
  "summary": "中文描述"
}
```

### status 取值与前端行为

| 值 | 含义 | 前端行为 |
|----|------|---------|
| `success` | 成功解析并生成完整指令 | 执行 actions，TTS 播报 summary |
| `optimized` | 优化了模糊指令（如"小圆"→radius:40） | 执行 actions，TTS 播报"已优化："+summary |
| `error` | 无法理解指令 | 不执行，TTS 播报"没理解，请重说" |

### actions 支持的工具

| 工具 | 说明 | 参数 |
|------|------|------|
| `draw_shape` | 几何图形 | shape, color, x, y, radius/width/height |
| `draw_svg` | 自由图形（SVG） | svg 字符串, x, y, scale |
| `canvas_control` | 画布管理 | action: "clear" / "undo" |

## 指令能力

| 类别 | 示例 | 处理方式 |
|------|------|---------|
| 几何图形 | "画一个红色的圆" | draw_shape |
| 自由物体 | "画一只小狗" / "画玫瑰花" | draw_svg |
| 复合指令 | "画红圆和蓝方块" | actions 数组 |
| 画布控制 | "清空" / "撤销" | canvas_control |
| ASR 容错 | "发房子"（同音错字） | 系统提示词纠正 |

## 容错策略

| 场景 | 处理方式 |
|------|---------|
| ASR 同音错字 | 系统提示词指明常见错误映射（发→画、园→圆） |
| 模糊指令 | LLM 返回 status: "optimized"，前端告知用户优化内容 |
| 无法理解 | LLM 返回 status: "error"，前端提示用户重说 |
| 代理/网络错误 | 前端 catch 异常，TTS 提示"出错了，请重试" |
| 语音静默 | 1.5s 超时自动提交，15s 无语音自动重启识别 |
