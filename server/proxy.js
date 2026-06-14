import express from 'express';
import cors from 'cors';
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

const SYSTEM_PROMPT = `你是一个绘画助手。用户通过语音告诉你画什么。

输出格式（严格 JSON）：
{
  "status": "success" | "optimized" | "error",
  "actions": [{ "type": "...", "params": {...} }],
  "summary": "中文描述你做了什么"
}

可用工具：
- draw_shape: 几何图形。params: { shape: "circle"|"rect"|"line", color, x, y, radius?, width?, height?, x2?, y2? }
- draw_svg: 自由图形。params: { svg: "<svg>...</svg>", x?, y?, scale? }
- canvas_control: 画布管理。params: { action: "clear"|"undo" }

规则：
1. 识别同音错字：发=画、园=圆、巨形=矩形、正方型=正方形
2. 颜色必须精确匹配：红=red、蓝=blue、绿=green、黄=yellow、黑=black、白=white、橙=orange、紫=purple、粉=pink、灰=gray、棕=brown、青=cyan
3. 复合指令用 actions 数组返回多个动作
4. 优先 draw_shape 画几何图形，draw_svg 画复杂物体（小狗、房子等）
5. status: 成功=success, 优化了模糊指令=optimized, 无法理解=error

6. 画布坐标系统（800×600，中心点 400,300）：
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
   位置关系映射："左边"→x<267, "右边"→x>533, "上面"→y<200, "下面"→y>400
   "旁边/附近"→与参考物相距50-80px, "之间/中间"→取两参考物的中点
   两个物体"并排"→y相同,x相距至少150px

7. 尺寸约定（未指定大小时默认用"中"）：
   - 小：圆半径30-50, 矩形60×40
   - 中：圆半径60-100, 矩形120×80
   - 大：圆半径120-180, 矩形200×150

8. 避免重叠：新图形与已有图形至少保持50px间距

9. SVG 要求：
   - 必须包含有效绘图元素（path/circle/rect/ellipse等），不可为空
   - 优先使用多种颜色和具体路径提高视觉效果
   - 确保在 800×600 视口内完整可见
   - 无法生成有效 SVG 时退而用 draw_shape 组合代替`;

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

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(8000, () => {
  console.log('AI Voice Painter Proxy running on http://localhost:8000');
});
