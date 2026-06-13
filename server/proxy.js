import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { getProvider } from './providers.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

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
6. 坐标在画布中央区域（400,300 附近）`;


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

    const response = await fetch(apiUrl, {
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
      })
    });

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
      return res.json({ status: 'error', actions: [], summary: '模型返回为空', _provider: providerId || 'deepseek', _model: effectiveModel });
    }

    let parsed;
    try {
      parsed = JSON.parse(extractJSON(content));
    } catch {
      return res.json({ status: 'error', actions: [], summary: '模型返回格式错误', _provider: providerId || 'deepseek', _model: effectiveModel });
    }

    res.json({ ...parsed, _provider: providerId || 'deepseek', _model: effectiveModel });
  } catch (err) {
    res.status(500).json({ status: 'error', summary: err.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(8000, () => {
  console.log('AI Voice Painter Proxy running on http://localhost:8000');
});
