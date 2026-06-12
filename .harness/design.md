# AI 语音绘图助手 — 设计文档

## 项目概述

纯语音控制的绘图工具。用户通过语音指令完成绘图创作。

**核心机制：** 浏览器 Web Speech API 语音识别 → DeepSeek V4 Agent (ReAct) 理解指令 → 调用绘图工具执行 → Canvas 显示结果。

## 技术架构

```
交互层 (VoiceInput + 文本 fallback + Canvas 画布 + 历史列表 + 状态栏)
    ↓ 文字
Agent 循环层 (DeepSeek V4 ReAct: 思考→工具调用→检查结果)
    ↓ tool_call
执行层 (draw_shape / draw_svg / draw_scene / canvas_control)
    ↓ end_turn
交互层 (Canvas 更新 + 状态提示)
```

## 技术选型

| 模块 | 选型 |
|------|------|
| 前端框架 | React 19 + Vite 8 |
| 语音识别 | Web Speech API |
| Agent LLM | DeepSeek V4 Flash (function calling) |
| 几何绘图 | HTML5 Canvas 2D |
| 自由图形 | SVG → Blob → Image → Canvas drawImage |
| 场景模板 | Canvas 组合函数 (模板可扩充) |
| 后端 | 无 (纯静态) |
| 部署 | Vercel |

## 工具系统

### draw_shape — 几何图形
- 形状：circle / rect / line
- 参数：颜色（中文色名/hex）、位置（left/center/right/top/bottom）、尺寸
- 适用：精确几何指令（"画红色圆"、"画蓝色矩形"）

### draw_svg — 任意自由图形（新增）
- 参数：SVG 路径标记 + 位置 + 缩放
- Agent 直接生成 SVG `<path>` `<circle>` `<rect>` 等元素
- 适用：任意物体（"画一只小狗"、"画一朵玫瑰花"、"画一辆汽车"）
- 渲染：SVG字符串 → Blob URL → Image → Canvas drawImage

### draw_scene — 组合场景
- 15 个可组合模板：house, tree, sun, mountain, cloud, flower, bench, road, star, heart, leaf, grass, river, fence, moon
- Agent 分解场景 → 映射模板 → 确定位置/颜色 → 输出 elements 数组
- 支持背景渐变（gradient_sky/gradient_autumn/gradient_sunset/gradient_night）
- 适用：复杂场景（"秋天的街道"、"日落海边"）

### canvas_control — 画布管理
- clear：清空画布
- undo：撤销上一步

## 指令能力清单

| 类别 | 示例 | 处理方式 |
|------|------|---------|
| 基本几何 | "画一个红色的圆" | draw_shape |
| 任意物体 | "画一只小狗" / "画玫瑰花" | **draw_svg**（Agent 生成 SVG） |
| 复合几何 | "画红圆和蓝方块" | draw_shape × N |
| 模糊物体 | "画一座房子" / "画一棵树" | draw_svg 或 draw_scene |
| 场景意象 | "秋天的街道" / "日落海边" | draw_scene（分解→组合模板） |
| 画布控制 | "清空" / "撤销" | canvas_control |
| ASR 容错 | "发房子"（同音错字） | Agent 自动纠正 |

## Agent 设计

- **模式：** ReAct (Reasoning + Acting)
- **工具：** draw_shape / draw_svg / draw_scene / canvas_control
- **工具选择策略：**
  1. 精确几何 → draw_shape
  2. 物体/动物/物品 → draw_svg（先生成 SVG 再渲染）
  3. 复杂场景 → draw_scene（分解为模板组合）
  4. 画布管理 → canvas_control
- **容错：** 轻度 ASR 错误自动纠正，重度返回 need_repeat
- **循环上限：** 5 轮
- **模型：** DeepSeek V4 Flash (deepseek-v4-flash)

## SVG 生成指导（给 Agent 的系统提示）

Agent 在生成 SVG 时使用标准 SVG 标签：
- `<circle cx="50" cy="50" r="40" fill="red"/>`
- `<rect x="10" y="10" width="80" height="60" fill="blue"/>`
- `<path d="M10 80 Q 95 10 180 80" stroke="black" fill="transparent"/>`
- `<ellipse cx="50" cy="50" rx="40" ry="20" fill="green"/>`
- 颜色使用英文名或 hex (#FF0000)
- 多个元素组合时注意相对位置和比例
