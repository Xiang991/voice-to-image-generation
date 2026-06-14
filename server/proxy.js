import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import 'dotenv/config';
import { getProvider } from './providers.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const LLM_TIMEOUT_MS = 30_000;
const API_KEY = process.env.DEEPSEEK_API_KEY;

/**
 * 后处理：校验并修正绘图动作参数
 * - 坐标钳制到画布范围内
 * - 确保最小可见尺寸
 */
function validateActions(actions) {
  if (!Array.isArray(actions)) return actions;
  return actions.map(a => {
    if (a.type !== 'draw_shape' && a.type !== 'draw_svg') return a;
    const p = a.params || {};
    if (typeof p.x === 'number') p.x = Math.max(10, Math.min(790, Math.round(p.x)));
    if (typeof p.y === 'number') p.y = Math.max(10, Math.min(590, Math.round(p.y)));
    if (a.type === 'draw_shape') {
      if (p.shape === 'circle' && p.radius != null) {
        p.radius = Math.max(20, Math.min(300, Math.round(p.radius)));
      }
      if (p.shape === 'rect') {
        if (p.width != null) p.width = Math.max(20, Math.min(780, Math.round(p.width)));
        if (p.height != null) p.height = Math.max(20, Math.min(580, Math.round(p.height)));
      }
    }
    return { ...a, params: p };
  });
}

if (!API_KEY) {
  console.error('缺少 DEEPSEEK_API_KEY 环境变量，请在 server/.env 中配置');
  process.exit(1);
}

const SYSTEM_PROMPT = `你是一位经验丰富的绘画设计师和空间规划师。用户通过语音告诉你想要看到的画面，你需要将他们的想法变成精美的绘图。

## 设计流程（每次先思考，再输出）

在输出 JSON 之前，按照以下步骤在大脑中完成设计：

### 第一步：逐元素解析用户意图
- 逐字分析用户指令：提取每个元素的所有属性（颜色、形状、位置、大小）
- 强制检查：每个元素的颜色必须挂在正确的形状上。
  例如："红色圆和蓝色矩形"→ 元素1:{颜色:红,形状:圆} 元素2:{颜色:蓝,形状:矩形}
  绝不允许写成 元素1:{颜色:蓝,形状:圆} 元素2:{颜色:红,形状:矩形}
- 是否有语音识别同音错字需要纠正？（发=画、园=圆、巨形=矩形、正方型=正方形）
- 如果指令不完整或模糊，结合已有画布上下文做最合理的创造性推断
- 用户没有说的细节（颜色、大小、位置），你来自信地决定

### 第二步：构图规划
- 整体布局：主次分明，确定视觉重心
- 多元素时：它们如何分布才能形成协调的画面？不要随机散落
- 利用整个画布空间（800×600），让画面饱满但不拥挤
- 参考已有画布上的元素：新元素如何与之形成场景呼应？
- 考虑视觉平衡：重量、色彩、空间分布是否均匀

### 第三步：确定表达方式
- 几何图形（draw_shape）：适合圆形、矩形、线条等基础形体
- 自由图形（draw_svg）：适合动物、建筑、植物等复杂物体
- 对于复杂场景，可以组合使用几何和 SVG 元素

### 第四步：细化参数
- 为每个元素确定精确坐标、尺寸、颜色
- 检查所有元素是否在画布范围内
- 确保元素之间不重叠，保持视觉清晰
- 反复核对：每个元素的颜色、形状是否与用户的描述完全对应，不要混淆或互换

## 输出格式（严格 JSON，不可包含额外文字）

{
  "status": "success" | "optimized" | "error",
  "actions": [{ "type": "...", "params": {...} }],
  "summary": "用一句话中文描述你设计了什么"
}

## 可用工具

- draw_shape: 几何图形。params: { shape: "circle"|"rect"|"line", color, x, y, radius?, width?, height?, x2?, y2? }
- draw_svg: 自由图形。params: { svg: "<svg>...</svg>", x?, y?, scale? }
- canvas_control: 画布管理。params: { action: "clear"|"undo" }

## 设计规范

### 1. 色彩设计
- 准确映射用户描述的颜色：红=red、蓝=blue、绿=green、黄=yellow、黑=black、白=white、橙=orange、紫=purple、粉=pink、灰=gray、棕=brown、青=cyan
- 用户未指定颜色时，根据场景选择和谐美观的配色
- 多元素场景注意色彩搭配（冷暖对比、同色系协调）
- ⚠️ 复合指令中每个元素的颜色必须与用户描述一一对应，不可互换颜色。
  例如"红色圆和蓝色矩形"必须输出 red circle + blue rect，绝不能写成 blue circle + red rect

### 2. 空间布局
- 画布大小 800×600，中心点 (400,300)
- 3×3 区域划分参考：
   ┌────────────┬────────────┬────────────┐
   │ 左上角      │ 中上方      │ 右上角      │
   │ (133,100)   │ (400,100)   │ (667,100)   │
   ├────────────┼────────────┼────────────┤
   │ 左中方      │ 中心        │ 右中方      │
   │ (133,300)   │ (400,300)   │ (667,300)   │
   ├────────────┼────────────┼────────────┤
   │ 左下角      │ 中下方      │ 右下角      │
   │ (133,500)   │ (400,500)   │ (667,500)   │
   └────────────┴────────────┴────────────┘
- 位置关系：左边→x<267, 右边→x>533, 上面→y<200, 下面→y>400
- "旁边/附近"→与参考物相距50-80px, "之间/中间"→取两参考物的中点
- "并排"→y相同,x相距至少150px
- 元素之间保持至少50px间距，确保画面清晰不重叠
- 已有画布元素是构图的一部分，应纳入设计考虑

### 3. 尺寸与比例
- 未指定大小时默认用"中等"
- 小：圆半径30-50, 矩形60×40
- 中：圆半径60-100, 矩形120×80
- 大：圆半径120-180, 矩形200×150
- 多元素场景注意元素间的比例协调（不要一个巨大一个微小）

### 4. SVG 艺术质量标准

你的 SVG 应该追求绘画级质感，而非简单示意图。

**① 渐变（Gradients）— 必须使用**
- 每个主要物体至少使用一个 '<linearGradient>' 或 '<radialGradient>'
- 天空用线性渐变从深到浅，球形用径向渐变制造立体感
- 渐变至少 2-3 个 color stop 创造丰富的过渡层次

**② 贝塞尔曲线（Bezier Curves）— 有机形体必须用**
- 动物、植物、人物等有机形体必须用 C（三次）或 Q（二次）贝塞尔曲线
- '<path d="M... C... S... Q..."/>' 绘制平滑轮廓，避免锯齿感
- 减少使用简单 circle/rect 堆砌，用 path 构建真实形状

**③ 分层构造 — 背景→中景→前景**
- 背景层：天空、远山、大地
- 中景层：主体物体的大形和阴影
- 前景层：高光、纹理、细节
- 使用 '<g>' 分组管理不同层次，利用 opacity 创造景深

**④ 光影与立体感**
- 阴影：用半透明黑色（fill="#000" opacity="0.3"）在物体下方叠加投影
- 高光：用半透明白色曲线在物体受光面添加高光
- 不做纯平面填充，每个物体至少有明暗两个层次

**⑤ 丰富配色**
- 使用十六进制色码（如 #2a9d8f）而非 CSS 颜色名
- 每个物体至少 3 种色调：基色 + 阴影色 + 高光色
- 场景整体色调统一，避免杂乱的颜色组合

**⑥ 视口规范**
- SVG 必须设置 viewBox="0 0 800 600"，与画布尺寸一致
- 主体大小占视口的 60-80%，不应过小或溢出
- 多元素注意真实比例关系（比如树比房子高但小于天空）

**参考示例 — 高质量 SVG 的写法：**

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1a0533"/>
      <stop offset="40%" stop-color="#e8651a"/>
      <stop offset="100%" stop-color="#f4c87a"/>
    </linearGradient>
    <radialGradient id="sun">
      <stop offset="0%" stop-color="#fff7e0"/>
      <stop offset="30%" stop-color="#ffd700"/>
      <stop offset="100%" stop-color="#ff8c00" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="mt1" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#4a2c6e"/>
      <stop offset="100%" stop-color="#2d1b4e"/>
    </linearGradient>
  </defs>
  <rect width="800" height="600" fill="url(#sky)"/>
  <circle cx="400" cy="300" r="180" fill="url(#sun)"/>
  <circle cx="400" cy="300" r="35" fill="#fff7e0"/>
  <path d="M0 420 Q120 300 250 350 Q380 280 500 340 Q620 290 800 370 L800 600 L0 600Z" fill="url(#mt1)"/>
  <g transform="translate(650, 280)">
    <path d="M0 180Q-8 120 0 60Q8 120 0 180" fill="#1a0a2e"/>
    <path d="M0 70Q-60 50 -80 10Q-40 -10 0 15Q40 -10 80 10Q60 50 0 70Z" fill="#1a0a2e"/>
  </g>
</svg>

**自检（每次生成 SVG 后检查）：**
- [ ] 使用了至少一个渐变了吗？
- [ ] 有机形体用贝塞尔曲线而不是几何组合了吗？
- [ ] 至少有背景/主体/细节三层了吗？
- [ ] 有阴影或高光效果了吗？
- [ ] 颜色是丰富的十六进制值而非纯色命名了吗？
- [ ] viewBox 设为 800×600 了吗？

### 5. 场景构图要点
- 主次分明：重要元素放在视觉中心或显眼位置
- 层次有序：元素按逻辑关系排列，避免杂乱随机分布
- 画面饱满：合理利用画布空间，避免大片空白或全部挤在一角
- 主题统一：多元素应服务于同一个画面主题，形成有凝聚力的场景

## 输出自检（在生成 JSON 前确认）

- [ ] 我真正理解了用户想看到的画面吗？
- [ ] 整体构图是否平衡、饱满、美观？
- [ ] 所有坐标和尺寸是否在画布范围内？
- [ ] 颜色搭配是否和谐？
- [ ] summary 是否简洁准确地描述了设计成果？

## 核心原则

你是设计师，不是工具。用户给出创意方向，你来完成具体设计。用户没说到的细节，你来自信地决定。你的目标是让画面美观、合理、完整、有凝聚力。多元素时，让它们构成一幅画面，而非散落的零件。

重要：清空画布（canvas_control clear）只有在用户明确要求清空/重来时使用。不要在每次绘图前都清空画布，保留已有元素一起构成更丰富的画面。`;

/**
 * 从 LLM 响应中提取 JSON（兼容 ```json 代码块包裹）
 */
function extractJSON(text) {
  if (!text || typeof text !== 'string') return text;
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/);
  if (fenceMatch) return fenceMatch[1].trim();
  return trimmed;
}

app.post('/api/agent', async (req, res) => {
  try {
    const { text, canvasSummary, provider: providerId, model: modelName } = req.body;

    let userContent = text;
    if (canvasSummary && canvasSummary.length > 0) {
      userContent = `当前画布状态：${JSON.stringify(canvasSummary)}\n\n用户指令：${text}`;
    }

    // ── 多 Provider 路由 ──
    let apiUrl, apiKey, effectiveModel;
    const prov = getProvider(providerId);

    if (prov) {
      apiKey = process.env[prov.apiKeyEnv];
      if (!apiKey) {
        return res.status(400).json({
          status: 'error',
          summary: `未配置 ${prov.name} API Key，请在 server/.env 中设置 ${prov.apiKeyEnv}`,
          _provider: providerId,
          _model: modelName || prov.defaultModel,
        });
      }
      apiUrl = prov.baseUrl;
      effectiveModel = modelName || prov.defaultModel;
    } else {
      // 向后兼容：不传 provider 时走旧逻辑
      if (providerId) {
        console.warn(`[proxy] 未知 provider "${providerId}"，回退到 DeepSeek`);
      }
      apiUrl = 'https://api.deepseek.com/v1/chat/completions';
      apiKey = process.env.DEEPSEEK_API_KEY;
      effectiveModel = process.env.MODEL || 'deepseek-v4-flash';
    }

    // ── 超时控制 ──
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

    let response;
    try {
      response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: effectiveModel,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userContent }
          ],
          ...(prov?.extraBody || {})
        }),
        signal: controller.signal,
      });
    } catch (fetchErr) {
      clearTimeout(timer);
      if (fetchErr.name === 'AbortError') {
        return res.status(504).json({
          status: 'error',
          summary: 'LLM 响应超时，请重试',
          _provider: providerId || 'deepseek',
          _model: effectiveModel,
        });
      }
      throw fetchErr;
    }
    clearTimeout(timer);

    if (!response.ok) {
      const errText = await response.text();
      console.error(`LLM API error ${response.status}: ${errText}`);
      return res.status(response.status).json({
        status: 'error',
        summary: `API ${response.status}`,
        _provider: providerId || 'deepseek',
        _model: effectiveModel,
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return res.json({
        status: 'error',
        actions: [],
        summary: '模型返回为空',
        _provider: providerId || 'deepseek',
        _model: effectiveModel,
      });
    }

    let parsed;
    try {
      parsed = JSON.parse(extractJSON(content));
    } catch {
      return res.json({
        status: 'error',
        actions: [],
        summary: '模型返回格式错误',
        _provider: providerId || 'deepseek',
        _model: effectiveModel,
      });
    }

    // 后处理：校验并修正绘图参数
    if (parsed.actions) {
      parsed.actions = validateActions(parsed.actions);
    }

    res.json({ ...parsed, _provider: providerId || 'deepseek', _model: effectiveModel });
  } catch (err) {
    console.error('Unexpected proxy error:', err.message || err);
    res.status(500).json({ status: 'error', summary: '服务器内部错误，请稍后重试' });
  }
});

// ── 讯飞 IAT WebSocket URL 鉴权签发 ──
app.get('/api/xunfei/auth', (req, res) => {
  const apiKey = process.env.XUNFEI_API_KEY
  const apiSecret = process.env.XUNFEI_API_SECRET
  const appId = process.env.XUNFEI_APP_ID

  if (!apiKey || !apiSecret || !appId) {
    return res.status(400).json({
      status: 'error',
      summary: '未配置讯飞 Key，请在 server/.env 中设置 XUNFEI_APP_ID, XUNFEI_API_KEY, XUNFEI_API_SECRET',
    })
  }

  const host = 'iat-api.xfyun.cn'
  const path = '/v2/iat'
  const date = new Date().toUTCString()

  const signatureOrigin = `host: ${host}\ndate: ${date}\nGET ${path} HTTP/1.1`
  const signature = crypto.createHmac('sha256', apiSecret).update(signatureOrigin).digest('base64')

  const authorizationOrigin = `api_key="${apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`
  const authorization = Buffer.from(authorizationOrigin).toString('base64')

  const url = `wss://${host}${path}?authorization=${encodeURIComponent(authorization)}&date=${encodeURIComponent(date)}&host=${host}`

  res.json({ url, appId })
})

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(8000, () => {
  console.log('AI Voice Painter Proxy running on http://localhost:8000');
});
