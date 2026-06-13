# AI 语音绘图助手 — 2026年6月12日 进度总结

## 今日改进总览（产品经理视角）

### 一、从零到一：全栈闭环搭建

**上午**：项目从空文件夹起步，4 小时内完成了从脚手架到文字绘图的完整链路。

**关键节点**：

```
11:37  Step 1 脚手架      → Vite + React 19 项目骨架
14:48  Step 2 全栈闭环    → 文字输入 → Agent(ReAct) → Canvas 2D 渲染
15:19  Fabric.js 引擎替换  → 从原生 Canvas 2D 切换到 Fabric.js 7
15:58  DebugPanel 调试面板 → API 传输记录可视化
```

**技术决策：Fabric.js 替代原生 Canvas 2D**

原生 Canvas 2D 需要手动管理绘图上下文、坐标变换、重绘逻辑。Fabric.js 提供了对象模型（Rect/Circle/Line/Group），每个图形是一个可操作对象。对于需要撤销、SVG 加载的场景，Fabric.js 的 `canvas.clear()` + `canvas.add()` 模式显著简化了代码。

### 二、语音集成演进：三阶段迭代

**阶段 1：VoiceInput（push-to-talk）** — 17:45

按住按钮说话、松开发送。本质是"把键盘输入换成了语音输入"。问题：用户需要手一直按着按钮，不是真正的语音体验。

**阶段 2：VoiceController（关键词触发）** — 18:54

说"开始绘画"进入模式 → 说绘图指令 → 说"结束绘画"退出。解放双手，但引入了"咒语"概念——用户必须记住和说出精确的关键词。

**阶段 3：纯语音零点击** — 20:11

页面加载自动启动语音识别 + Permissions API 监听权限恢复。用户允许麦克风后立即进入可用状态，零点击即可开始。

**关键改进**：
- `rec.continuous = false` 改为单次识别循环模式（更稳定，避免 Web Speech API 长时间运行的不稳定性）
- 1.5s 静默超时自动提交 + 15s 无语音自动重启
- 权限恢复自动启动（用户从浏览器设置中允许麦克风后无需刷新页面）

### 三、纯语音模式打磨：6 次迭代修复

19:00 → 20:11，一小时内连续 6 次提交，解决语音识别生命周期中的各种边界问题：

| 时间 | 问题 | 修复 |
|------|------|------|
| 19:00 | 识别无法启动，返回空文本 | 修复 rec.onresult 中 transcript 获取逻辑 |
| 19:05 | 死循环导致页面高频刷新 | 重构组件卸载时的清理逻辑，确保 `rec.stop()` |
| 19:09 | 连续模式不稳定 | 改为单次识别循环：每次识别结束后延迟 200ms 重启 |
| 19:14 | "结束绘画"变体不匹配 | 正则改为 `/结束.{0,1}(绘画|绘图|画图|画画)/` |
| 19:17 | 权限拒绝后页面持续闪动 | 加 `hadErrorRef` flag 阻止错误后的自动重启 |
| 19:21 | 重启过于频繁 | 硬性冷却：每秒最多重启 1 次（`lastRestartRef`） |

**设计教训**：Web Speech API 的 `continuous: true` 模式在不同浏览器上行为不一致，单次识别 + 自动重启的循环模式虽然代码更复杂，但可靠性更高。

### 四、架构精简：从 6 组件到 3 组件

**改进前**：App.jsx 渲染 6 个组件（VoiceInput、TextInput、Canvas、History、DebugPanel、VoiceController 入口切换）。

**改进后**：精简为 3 个组件（VoiceController、Canvas、History）。移除的组件：
- `TextInput.jsx` — 文字输入框（语音已覆盖）
- `VoiceInput.jsx` — push-to-talk 按钮（VoiceController 替代）
- `DebugPanel.jsx` — API 调试面板（开发期工具，不再需要）

**决策理由**：纯语音应用不需要文字输入作为 fallback，也不需要调试面板暴露给用户。保持代码库最小化，每个文件都有明确的存在理由。

### 五、部署就绪

- GitHub Pages 配置完成（base: `/voice-to-image-generation/`）
- cPanel 兼容（base 路径改为 `/`）
- `gh-pages` 依赖已安装
- 部署命令：`npm run build && npx gh-pages -d dist`

### 六、涉及文件清单

| 文件 | 变更性质 |
|------|---------|
| `src/main.jsx` | 新增：React 入口 |
| `src/App.jsx` | 新增 → 多次微调（组件精简、VoiceController 集成） |
| `src/App.css` | 新增 → 逐步添加 VoiceController 样式 |
| `src/config.js` | 新增：API Key + 模型配置 |
| `src/components/Canvas.jsx` | 新增 → 重写（原生 Canvas 2D → Fabric.js） |
| `src/components/History.jsx` | 新增：指令历史面板 |
| `src/components/VoiceInput.jsx` | 新增 → 后被 VoiceController 替代 → 移除渲染 |
| `src/components/TextInput.jsx` | 新增 → 后被移除渲染 |
| `src/components/DebugPanel.jsx` | 新增 → 后被移除渲染 |
| `src/components/VoiceController.jsx` | 新增 → 7 次迭代修复（00127d3 → a401738） |
| `src/services/agent.js` | 新增：ReAct Agent 循环 + 3 个工具定义 |
| `src/utils/colors.js` | 新增：中文→英文颜色映射 |
| `public/voice-test.html` | 新增：独立语音识别测试页 |
| `.env.example` | 新增：环境变量模板 |
| `CLAUDE.md` | 更新：项目说明 + 工作规范 |
| `.harness/progress.json` | 更新：Step 1/2/3 完成 |
| `package.json` | 新增 → 加 fabric/gh-pages 依赖 |
| `vite.config.js` | 新增 → 配置 GitHub Pages base 路径 |

---

## 当前状态（6月12日收工时）

- **分支**：`feature-voice-only-drawing`
- **进度**：Step 1/2/3 完成，Step 4/5/6 废弃
- **架构**：纯前端 ReAct Agent（API Key 暴露在前端）
- **UI**：纯语音零按钮（VoiceController + Canvas + History）
- **部署**：GitHub Pages → https://Xiang991.github.io/voice-to-image-generation/
- **下一步**：绘图优化（SVG 质量 / 复合指令 / 画布交互）

---

## 已知待解决问题（6月12日遗留）

- **API Key 暴露在前端**：`.env` 中 `VITE_OPENAI_API_KEY` 在 `npm run build` 后直接内嵌到 JS bundle 中，任何人可通过浏览器 DevTools 查看。需要薄代理层隐藏。
- **SVG 质量不可控**：DeepSeek V4 Flash 的 SVG 生成能力有限，复杂物体（如"小狗"）可能只是大致轮廓。
- **无 TTS 反馈**：绘图完成后无语音确认，用户需要看屏幕才知道结果。
- **必须说关键词**："开始绘画"和"结束绘画"是强制性入口/出口，不符合自然对话习惯。
- **无撤销栈**：`layers.pop()` 只支持单步撤销。
- **Web Speech API 仅 Chrome/Edge**：Firefox/Safari 不支持 `SpeechRecognition`。
