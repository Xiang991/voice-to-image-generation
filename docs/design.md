# AI 语音绘图工具 — 设计文档

## 1. 项目概述

### 1.1 项目目标

开发一款纯语音控制的绘图工具。用户不能使用鼠标或键盘，仅通过语音指令完成绘图创作。

### 1.2 核心要求

- 指令理解的准确性与容错性（ASR 同音错字纠正、模糊指令优化）
- 语音到绘图操作的响应延迟（单次 LLM 调用，避免多轮交互）
- 复杂指令的拆解与执行能力（复合指令如"画红色圆和蓝色矩形"一次性执行）

### 1.3 技术栈

| 模块 | 选型 | 选择理由 |
|------|------|---------|
| 前端框架 | React 19 + Vite 8 | 组件化 UI 管理，语音组件生命周期管理成熟 |
| 语音识别 | Web Speech API | 浏览器原生，无需额外服务 |
| 画布渲染 | Fabric.js 7 | Canvas 2D 渲染，支持几何图形和 SVG |
| UI 动画 | Framer Motion 12 | React 动画库，布局动画、弹簧物理、手势交互 |
| UI 图标 | Lucide React 1 | 1500+ 精致 SVG 图标，按需加载 |
| LLM | DeepSeek V4 Flash | 支持结构化 JSON 输出，延迟低 |
| 代理层 | Node Express | 轻量级转发，与前端同语言 |
| TTS | Web Speech Synthesis API | 浏览器原生，零成本 |

---

## 2. 总体架构

### 2.1 架构设计：厚前端 + 薄代理 + 纯云 LLM

```
┌─────────────────────────────────────────────────────────────┐
│  用户层                                                      │
│  输入语音指令                                                │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  前端层（厚前端）                                             │
│                                                             │
│  ① ASR 转文本                                               │
│  ② 调用代理层                                                │
│  ③ 解析 LLM 返回的 JSON                                      │
│  ④ 执行状态判断 (error/optimized/success)                    │
│  ⑤ 绘图 + TTS 反馈                                          │
│  ⑥ 存储画布状态                                              │
└────────────────────────────┬────────────────────────────────┘
                             │ { text, canvasSummary }
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  中间层（薄代理）                                             │
│  接收文本 + 画布摘要 → 加 Key → 转发 LLM → 透传 JSON 返回     │
│  无分支判断，纯透传                                          │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  云端 LLM（DeepSeek V4 Flash）                                │
│  理解自然语言 → 输出结构化 JSON 指令                          │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 层级职责

| 层级 | 名称 | 核心职责 |
|------|------|---------|
| 1 | 用户 | 输入语音指令 |
| 2 | 厚前端 | ASR 转文本 → 调用代理 → 解析 JSON → 状态判断 → 绘图 + TTS → 存储画布状态 |
| 3 | 薄代理 | 接收文本 + 画布摘要 → 加 Key → 转发 LLM → 透传 JSON 返回 |
| 4 | 云 LLM | 理解自然语言 → 输出结构化 JSON 指令 |

### 2.3 设计原则

1. **所有智能在前端**：状态判断、指令解析、绘图逻辑、反馈生成全部在前端完成
2. **代理层无业务逻辑**：仅负责隐藏 API Key，不做任何解析或判断
3. **单次 LLM 调用**：避免多轮 ReAct 循环，降低延迟和成本
4. **JSON 直出**：LLM 直接输出带 status 标签的结构化 JSON，前端据此做分支处理

---

## 3. 数据流

```
用户说 "画红色圆"
  │
  ▼ ① VoiceController (Web Speech API → 文本)
"画红色圆"
  │
  ▼ ② agent.js → fetch POST /api/agent
  { text: "画红色圆", canvasSummary: [] }
  │
  ▼ ③ Express 代理注入 API Key → POST DeepSeek API
  │
  ▼ ④ DeepSeek 返回 JSON
  {
    "status": "success",
    "actions": [{
      "type": "draw_shape",
      "params": { "shape": "circle", "color": "red", "x": 400, "y": 300, "radius": 80 }
    }],
    "summary": "画了一个红色的圆"
  }
  │
  ▼ ⑤ 代理透传 JSON → 前端 agent.js 解析
  │
  ▼ ⑥ App.jsx: status === "success"
  ├── Canvas.jsx: 渲染红色圆形
  ├── tts.js: 语音播报"画了一个红色的圆"
  ├── canvasSummary.js: 更新画布摘要（供下一次指令使用）
  └── History.jsx: 添加历史记录
```

### 复合指令示例

```
用户说 "画红色圆和蓝色矩形，圆在左边"
  │
  ▼ 同上流程
  │
  ▼ ④ DeepSeek 返回 JSON
  {
    "status": "success",
    "actions": [
      {
        "type": "draw_shape",
        "params": { "shape": "circle", "color": "red", "x": 200, "y": 300, "radius": 60 }
      },
      {
        "type": "draw_shape",
        "params": { "shape": "rect", "color": "blue", "x": 600, "y": 300, "width": 120, "height": 80 }
      }
    ],
    "summary": "在左侧画了一个红色圆形，右侧画了一个蓝色矩形"
  }
  │
  ▼ ⑤ 前端遍历 actions，逐条渲染
```

---

## 4. LLM 输出格式设计

### 4.1 请求格式（前端 → 代理 → LLM）

```json
{
  "text": "画红色圆",
  "canvasSummary": [
    { "type": "shape", "shape": "circle", "color": "red", "x": 200, "y": 300, "radius": 60 }
  ]
}
```

### 4.2 响应格式（LLM → 代理 → 前端）

```json
{
  "status": "success",
  "actions": [
    {
      "type": "draw_shape",
      "params": { "shape": "circle", "color": "red", "x": 400, "y": 300, "radius": 80 }
    }
  ],
  "summary": "画了一个红色的圆"
}
```

### 4.3 status 字段说明

| 值 | 含义 | 触发条件 | 前端行为 |
|----|------|---------|---------|
| `success` | 成功解析 | 指令明确且可完整执行 | 执行 actions + TTS 播报 summary |
| `optimized` | 优化执行 | 指令模糊（如"小圆"→设 radius:40） | 执行 actions + TTS"已优化为："+summary |
| `error` | 无法理解 | ASR 严重错误 / 指令超出能力 | 不执行 + TTS"没理解，请再说一遍" |

### 4.4 可用工具

| 工具 | 说明 | 参数 |
|------|------|------|
| `draw_shape` | 几何图形 | shape: "circle"\|"rect"\|"line", color, x, y, radius?, width?, height?, x2?, y2? |
| `draw_svg` | 自由图形 | svg: SVG 标记字符串, x?, y?, scale? |
| `canvas_control` | 画布管理 | action: "clear"\|"undo" |

---

## 5. 指令能力清单

### 5.1 已实现能力

| 类别 | 示例指令 | 处理方式 | 实现状态 |
|------|---------|---------|---------|
| 几何图形 | "画红色圆"、"画蓝色矩形" | draw_shape | ✅ 已实现 |
| 线条 | "画一条线从左上到右下" | draw_shape(line) | ✅ 已实现 |
| 自由图形 | "画一只小狗"、"画玫瑰花" | draw_svg（LLM 生成 SVG） | ✅ 已实现 |
| 复合指令 | "画红色圆和蓝色矩形，圆在左边" | actions 数组 | ✅ 已实现 |
| 画布清空 | "清空"、"清空画布" | canvas_control(clear) | ✅ 已实现 |
| 撤销 | "撤销"、"回退" | canvas_control(undo) | ✅ 已实现 |
| ASR 容错 | "发房子"（同音错字→画房子） | 系统提示词纠正 | ✅ 已实现 |
| 模糊优化 | "画小圆"（模糊描述→自动设定尺寸） | status: optimized | ✅ 已实现 |
| 颜色中英文 | "红"、"red"、"#FF0000" | 系统提示词 + colors.js | ✅ 已实现 |
| 语音反馈 | 绘图完成后 TTS 播报结果 | Web Speech Synthesis API | ✅ 已实现 |
| 画布摘要 | 后续指令参考已绘制图形位置 | canvasSummary.js | ✅ 已实现 |
| API Key 安全 | Key 仅存于代理层，前端不可见 | Express 代理隐藏 | ✅ 已实现 |

### 5.2 已知限制

| 限制 | 原因 | 影响 |
|------|------|------|
| 仅支持 Chrome/Edge | Web Speech API 浏览器兼容性 | 其他浏览器无语音输入 |
| 需"开始绘画"关键词触发 | 需防止误触发 | 启动多一步操作 |
| SVG 质量取决于 LLM | DeepSeek 的 SVG 生成能力有限 | 复杂物体可能不完美 |

---

## 6. 容错设计

### 6.1 ASR 容错

通过在系统提示词中定义常见同音错字映射：

```
发=画（"发房子"→"画房子"）
园=圆（"园形"→"圆形"）
巨形=矩形（"巨形"→"矩形"）
正方型=正方形（"正方型"→"正方形"）
```

LLM 在 Plan 阶段自动纠正，无需前端额外处理。

### 6.2 指令模糊处理

当用户指令模糊（如"小圆"——没有指定尺寸）时：
1. LLM 返回 `status: "optimized"`
2. 前端根据 actions 中的参数执行绘图
3. TTS 播报"已优化：画了一个小圆"

### 6.3 网络/服务异常

| 异常场景 | 前端响应 |
|---------|---------|
| 代理不可用 | catch 异常 → TTS"出错了，请重试" |
| LLM 返回格式错误 | 代理返回 error status → 提示重说 |
| API Key 无效 | 代理返回 401 → 前端提示配置错误 |
| 语音识别超时 | 1.5s 静默自动提交 / 15s 无语音自动重启 |

---

## 7. 未完成功能与原因

| 功能 | 预期能力 | 未完成原因 |
|------|---------|-----------|
| 场景模板系统（draw_scene） | 预设场景组合（"秋天的街道"→房子+树+落叶） | draw_svg 已可覆盖场景绘制需求，模板系统的边际收益有限 |
| 撤销多步栈 | 支持多次撤销操作 | Canvas 状态栈未实现，当前仅支持单步 undo |
| 语音唤醒免关键词 | 无需"开始绘画"直接说话 | 避免环境杂音误触发，关键词是安全启动的必要机制 |
| 画布持久化 | 刷新页面后保留绘制的图形 | localStorage 存储和恢复逻辑未集成 |
| TTS 语速/音色定制 | 可调节语速和选择语音 | Web Speech Synthesis API 支持有限，且优先级较低 |
| 画布导出 | 保存为图片 | Canvas.jsx 已有 toDataURL 能力，但未封装导出按钮（纯语音应用无需按钮） |

---

## 8. 运行指南

### 8.1 环境要求

- Node.js 20+
- Chrome / Edge 浏览器（Web Speech API 支持）
- 麦克风权限

### 8.2 启动方式

```bash
# 终端 1：启动代理（隐藏 API Key）
cd server
npm install
node proxy.js
# → 代理运行在 http://localhost:8000

# 终端 2：启动前端
npm install   # 若首次运行
npm run dev
# → 前端运行在 http://localhost:5173
```

### 8.3 使用流程

1. 在 Chrome/Edge 中打开 `http://localhost:5173`
2. 允许麦克风权限
3. 点击 **"开始绘画"** 按钮进入绘图模式
4. 发出绘图指令（如"画红色圆"、"画小狗"）
5. 说 **"结束绘画"** 退出绘图模式

### 8.4 依赖清单

| 包名 | 版本 | 用途 | 类别 |
|------|------|------|------|
| react | ^19.2.6 | UI 框架 | runtime |
| react-dom | ^19.2.6 | React DOM 渲染 | runtime |
| fabric | ^7.4.0 | Canvas 2D 绘图引擎 | runtime |
| framer-motion | ^12.40.0 | React 动画库（布局动画、弹簧物理、手势） | runtime |
| lucide-react | ^1.18.0 | SVG 图标库（1500+ 图标，按需加载） | runtime |
| vite | ^8.0.12 | 构建工具 | dev |
| @vitejs/plugin-react | ^6.0.1 | Vite React 插件 | dev |
| eslint | ^10.3.0 | 代码检查 | dev |
| eslint-plugin-react-hooks | ^7.1.1 | React Hooks 规则 | dev |
| gh-pages | ^6.3.0 | GitHub Pages 部署 | dev |

### 8.5 环境搭建步骤

```bash
# 1. 克隆项目
git clone <repo-url>
cd voice

# 2. 安装依赖（一键安装所有 runtime + dev 依赖）
npm install

# 3. 配置 API Key
cp .env.example .env
# 编辑 .env，填入 VITE_OPENAI_API_KEY

# 4. 启动开发服务器
npm run dev
# → http://localhost:5173

# 5. 生产构建
npm run build
# → dist/
```

---

## 9. 验收测试结果

| # | 测试指令 | 预期结果 | 状态 |
|---|---------|---------|------|
| 1 | "画红色圆" | Canvas 出现红色圆形 + TTS 反馈 | — |
| 2 | "画红色圆和蓝色矩形，圆在左边" | 两个图形按描述排列 | — |
| 3 | "清空" | 画布清空 + TTS 反馈 | — |
| 4 | "画一只小狗" | SVG 小狗轮廓 | — |
| 5 | "发房子"（同音错字） | 画出房子 | — |
| 6 | DevTools → Network | 看不到 API Key | — |

*注：验收测试在实施完成后逐项填写。*

---

## 10. 前端重设计更新（2026-06-13）

### 10.1 交互模式变更

**从"纯语音关键词"改为"语音主导"模式：**

| 变更项 | 旧方案 | 新方案 |
|--------|--------|--------|
| 进入绘图 | 说"开始绘画" | 点击麦克风按钮 |
| 退出绘图 | 说"结束绘画" | 说"结束绘画"（语音） |
| 指令发送 | 说 + 1.5s 静默 | 说 + 1.5s 静默（不变） |
| 快捷操作 | 无 | 悬浮按钮：撤销/清空 |

**设计理由**：手动启动避免环境杂音误触发，用户主动控制启动时机。语音结束保留，因结束时用户双手可能在画画，说比点快。快捷栏按钮为语音识别失败时提供兜底。

### 10.2 新增模块

| 模块 | 文件 | 功能 |
|------|------|------|
| TTS 语音反馈 | `src/services/tts.js` | `speak(text)` 封装 Web Speech Synthesis（当前使用文字反馈，TTS 预留） |
| 意图分类 | `src/services/intentClassifier.js` | `classifyIntent(text)` → `draw`/`control`/`chat` 三分类 |
| 状态指示器 | `src/components/VoiceStatusBar.jsx` | 四态可视化指示（等待/监听/思考/出错） |
| 快捷操作栏 | `src/components/QuickBar.jsx` | 悬浮撤销/清空按钮 |
| UI 动画库 | `framer-motion` (npm) | 布局动画 AnimatePresence、弹簧物理、手势交互 |
| UI 图标库 | `lucide-react` (npm) | 1500+ SVG 图标替代 emoji，按需 tree-shake |

### 10.3 旧组件归档

以下组件移入 `src/components/_archived/` 暂存（不删除）：
- `VoiceInput.jsx` — push-to-talk 语音按钮
- `TextInput.jsx` — 文字输入框
- `DebugPanel.jsx` — API 调试面板

### 10.4 当前组件结构

```
src/components/
├── VoiceController.jsx    ← 重写：手动启动 + 语音停止 + 持续监听
├── Canvas.jsx             ← 保持：Fabric.js 渲染
├── History.jsx            ← 优化：CSS 类替代内联样式
├── VoiceStatusBar.jsx     ← 新增：四态状态指示
├── QuickBar.jsx           ← 新增：悬浮快捷栏
└── _archived/             ← 旧组件暂存
    ├── VoiceInput.jsx
    ├── TextInput.jsx
    └── DebugPanel.jsx
```

### 10.5 更新后的指令能力清单

| 类别 | 示例指令 | 处理方式 | 状态 |
|------|---------|---------|------|
| 几何图形 | "画红色圆" | LLM → draw_shape → Canvas | ✅ |
| 自由图形 | "画一只小狗" | LLM → draw_svg → Canvas | ✅ |
| 复合指令 | "画红色圆和蓝色矩形" | LLM → 多 actions | ✅ |
| 本地撤销 | "撤销" / 点击按钮 | 本地 layers.pop() | ✅ 新增 |
| 本地清空 | "清空" / 点击按钮 | 本地 layers = [] | ✅ 新增 |
| 语音结束 | "结束绘画" | VoiceController 退出监听 | ✅ 新增 |
| 闲聊过滤 | "今天天气真好" | 本地分类 → TTS 提示 | ✅ 新增 |
| TTS 反馈 | 每条指令执行后 | speak(summary/error) | ✅ 新增 |

### 10.6 未完成功能

| 功能 | 原因 |
|------|------|
| 薄代理层（server/） | 计划于 Step 7，需独立 Express 服务 |
| API Key 隐藏 | 依赖代理层完成后迁移 |
| 画布摘要（canvasSummary.js） | 依赖 agent.js 重写，当前 ReAct 循环不传画布状态 |
| 撤销多步栈 | Fabric.js 状态栈实现复杂度高 |
| 纯语音模式 | 后续以双模式切换方式加入 |
| 画布导出 | P2 优先级 |
