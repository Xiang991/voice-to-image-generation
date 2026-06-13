# AI 语音绘图助手 — CLAUDE.md

## 项目概述

纯语音控制的绘图工具。用户通过语音指令完成绘图创作。

**架构：** 厚前端 + 薄代理 + 纯云 LLM
**核心链路：** 语音识别 → 厚前端解析 → 薄代理转发 → LLM 输出 JSON → 前端状态判断 → Canvas 渲染 + TTS 反馈

## 快速开始

```bash
# 终端 1：启动代理
cd server && npm install && node proxy.js
# → http://localhost:8000

# 终端 2：启动前端
npm run dev
# → http://localhost:5173
```

## 技术栈

| 模块 | 选型 |
|------|------|
| 前端框架 | React 19 + Vite 8 |
| 语音识别 | Web Speech API |
| 画布渲染 | Fabric.js 7 |
| LLM | DeepSeek V4 Flash (JSON 直出) |
| 代理层 | Node Express（仅透传） |
| TTS | Web Speech Synthesis API |

## 目录结构

```
voice-to-image-generation/
├── src/                          # React 前端源码
│   ├── components/
│   │   ├── VoiceController.jsx   语音输入 + 关键词检测 + 生命周期管理
│   │   ├── Canvas.jsx            Fabric.js 画布渲染
│   │   └── History.jsx           指令历史
│   ├── services/
│   │   ├── agent.js              代理客户端（调后端 API）
│   │   ├── tts.js                Speech Synthesis 封装
│   │   └── canvasSummary.js      画布状态摘要
│   ├── App.jsx                   根组件 + status 分支判断
│   ├── App.css                   样式
│   ├── config.js                 配置
│   └── main.jsx                  React 入口
├── server/                       # Express 代理后端
│   ├── proxy.js                  加 Key 转发
│   ├── .env                      环境变量（API Key）
│   └── package.json              依赖
├── docs/
│   └── design.md                 设计文档（交付物）
├── .harness/
│   ├── design.md                 设计方案
│   └── progress.json             进度跟踪
├── README.md                     项目说明（交付物）
├── .nvmrc                        Node.js 版本锁定
├── index.html                    Vite 入口
├── vite.config.js                构建配置
├── package.json                  前端依赖
└── CLAUDE.md                     项目规范（本文件）
```

## 架构说明：厚前端 + 薄代理 + 纯云 LLM

```
用户 → 厚前端（浏览器）
  ├── ASR 转文本（VoiceController）
  ├── 调用代理层（agent.js）
  ├── 解析 LLM 返回的 JSON
  ├── 执行状态判断：success / optimized / error
  ├── 绘图（Canvas.jsx）+ TTS 反馈（tts.js）
  └── 存储画布状态（canvasSummary.js）

厚前端 → 薄代理（Express）
  └── 仅加 Key 透传，无分支判断

薄代理 → 云 LLM（DeepSeek）
  └── 理解自然语言 → 输出带 status 标签的结构化 JSON
```

## 当前状态

- **阶段：** ✅ 已完成
- **进度：** 13/13 步完成
- **里程碑：** Tier 1 骨架 ✓ | 语音输入 ✓ | 薄代理 ✓ | 全栈闭环 ✓
- **说明：** 项目所有步骤已完成并通过验收，详见 `.harness/progress.json`

## 工作规范

- **语言：** 中文（普通话）
- **信息粒度：** 偏好极细的信息粒度，不跳过中间步骤
- **设计解释：** 每个决策需详细解释设计缘由与权衡
- **全景视角：** 每项任务先说明整体背景和当前步骤的位置
