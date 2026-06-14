# AI 语音绘图助手 — CLAUDE.md (docs)

> **此文档已同步到根目录 `CLAUDE.md`，以根目录为准。**

## 当前状态

- **阶段：** ✅ 完成（13/13 步 + 绘画质量专项改进）
- **核心链路：** 语音识别 → 薄代理转发 → LLM 输出 JSON → 前端执行 → Canvas 渲染
- **模型选型：** DeepSeek V4 Flash（265ms，95.5% 准确率）
- **质量改进（2026-06-14）：** 系统提示词 3×3 坐标网格 + 尺寸约定 + 碰撞规避 + SVG 规则，proxy.js validateActions() 后处理，canvasSummary zone 增强

## 关键文件

| 文件 | 职责 |
|------|------|
| `src/components/VoiceController.jsx` | 语音捕获 + 生命周期管理 |
| `src/services/agent.js` | 代理客户端（调后端 API） |
| `src/services/canvasSummary.js` | 画布摘要（含 zone 区域） |
| `server/proxy.js` | LLM 代理 + validateActions() 坐标校验 |
| `server/providers.js` | 模型注册表 |
| `server/benchmark/` | 多模型基准测试框架 |
