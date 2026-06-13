import express from 'express';
import cors from 'cors';
import 'dotenv/config';

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const LLM_TIMEOUT_MS = 30_000;
const API_KEY = process.env.DEEPSEEK_API_KEY;

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
6. 坐标在画布中央区域（400,300 附近）`;

function extractJson(text) {
  const trimmed = text.trim()
  // strip ```json / ``` fences
  const fence = trimmed.match(/^```(?:json)?\s*\n([\s\S]*?)\n\s*```$/)
  if (fence) return fence[1].trim()
  // strip leading/trailing ``` when the fence is on the same line
  if (trimmed.startsWith('```json') || trimmed.startsWith('```')) {
    return trimmed.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '').trim()
  }
  return trimmed
}

app.post('/api/agent', async (req, res) => {
  try {
    const { text, canvasSummary } = req.body;

    let userContent = text;
    if (canvasSummary && canvasSummary.length > 0) {
      userContent = `当前画布状态：${JSON.stringify(canvasSummary)}\n\n用户指令：${text}`;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

    let response;
    try {
      response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`
        },
        body: JSON.stringify({
          model: process.env.MODEL || 'deepseek-v4-flash',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userContent }
          ]
        }),
        signal: controller.signal,
      });
    } catch (fetchErr) {
      clearTimeout(timer);
      if (fetchErr.name === 'AbortError') {
        return res.status(504).json({ status: 'error', summary: 'LLM 响应超时，请重试' });
      }
      throw fetchErr;
    }
    clearTimeout(timer);

    if (!response.ok) {
      const errText = await response.text();
      console.error(`LLM API error ${response.status}: ${errText}`);
      return res.status(response.status).json({ status: 'error', summary: `API ${response.status}` });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return res.json({ status: 'error', actions: [], summary: '模型返回为空' });
    }

    let parsed;
    try {
      parsed = JSON.parse(extractJson(content));
    } catch {
      return res.json({ status: 'error', actions: [], summary: '模型返回格式错误' });
    }

    res.json(parsed);
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
