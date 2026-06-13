#!/usr/bin/env node

/**
 * Benchmark Runner — 多模型基准测试主入口
 *
 * 直接调用各 Provider API（不经过 proxy），隔离网络/代理干扰。
 *
 * 使用方法：
 *   node benchmark/runner.mjs                      # 所有已配置 Key 的模型
 *   node benchmark/runner.mjs --models deepseek-v4-pro,qwen3.7-max  # 指定模型
 *   node benchmark/runner.mjs --limit 5             # 快速测试（前5条）
 *   node benchmark/runner.mjs --format json         # JSON 输出
 *   node benchmark/runner.mjs --output ./results/result.json
 */

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROVIDERS } from '../providers.js';
import { TEST_CASES } from './test-cases.js';
import { scoreAll, aggregateResults } from './scorer.js';
import { printConsoleReport, generateHTMLReport, toJSON } from './report.js';

// ── CLI 参数解析 ──
const args = process.argv.slice(2);
const flags = {};
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--models' && i + 1 < args.length) {
    flags.models = args[++i].split(',').map(s => s.trim()).filter(Boolean);
  } else if (args[i] === '--limit' && i + 1 < args.length) {
    flags.limit = parseInt(args[++i], 10);
  } else if (args[i] === '--format') {
    flags.format = args[++i];
  } else if (args[i] === '--output' && i + 1 < args.length) {
    flags.output = args[++i];
  } else if (args[i] === '--delay') {
    flags.delay = parseInt(args[++i], 10);
  } else if (args[i] === '--verbose' || args[i] === '-v') {
    flags.verbose = true;
  }
}

// 与 proxy.js 保持一致的 SYSTEM_PROMPT
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

const RATE_LIMIT_DELAY_MS = flags.delay ?? 500;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── 确定要测试的 providers/models ──
function resolveTargets() {
  const targets = [];

  if (flags.models) {
    for (const modelId of flags.models) {
      // 查找 modelId 所属 provider
      for (const [pid, prov] of Object.entries(PROVIDERS)) {
        if (prov.models.includes(modelId)) {
          targets.push({ providerId: pid, model: modelId, prov });
          break;
        }
      }
    }
    if (targets.length === 0) {
      console.error(`❌ 未找到指定模型: ${flags.models.join(', ')}`);
      console.error(`   可用: ${listAllModels()}`);
      process.exit(1);
    }
  } else {
    // 默认：所有已配置 Key 的 provider 各跑一个默认模型
    for (const [pid, prov] of Object.entries(PROVIDERS)) {
      if (process.env[prov.apiKeyEnv]) {
        targets.push({ providerId: pid, model: prov.defaultModel, prov });
      }
    }
  }

  if (targets.length === 0) {
    console.error('❌ 未找到已配置 API Key 的 Provider。');
    console.error('   请在 server/.env 中设置以下之一：');
    for (const p of Object.values(PROVIDERS)) {
      console.error(`   ${p.apiKeyEnv}=your_key_here`);
    }
    process.exit(1);
  }

  return targets;
}

function listAllModels() {
  const ids = [];
  for (const prov of Object.values(PROVIDERS)) {
    ids.push(...prov.models);
  }
  return ids.join(', ');
}

function buildUserContent(instruction, canvasSummary) {
  if (canvasSummary && canvasSummary.length > 0) {
    return `当前画布状态：${JSON.stringify(canvasSummary)}\n\n用户指令：${instruction}`;
  }
  return instruction;
}

/**
 * 从 LLM 响应中提取 JSON（兼容 ```json 代码块包裹）
 */
function extractJSON(text) {
  if (!text || typeof text !== 'string') return text;
  const trimmed = text.trim();
  // 匹配 ```json\n...\n``` 或 ```\n...\n```
  const fenceMatch = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/);
  if (fenceMatch) return fenceMatch[1].trim();
  return trimmed;
}

// ── 调用单个模型 API ──
async function callModel(prov, model, instruction, canvasSummary) {
  const apiKey = process.env[prov.apiKeyEnv];
  if (!apiKey) {
    return { error: `API Key 未配置 (${prov.apiKeyEnv})` };
  }

  const start = Date.now();
  try {
    const response = await fetch(prov.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildUserContent(instruction, canvasSummary) },
        ],
        ...(prov.extraBody || {}),
      }),
    });

    const latencyMs = Date.now() - start;

    if (!response.ok) {
      const errText = await response.text().catch(() => 'unknown error');
      return { error: `HTTP ${response.status}: ${errText.slice(0, 200)}`, latencyMs };
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;

    if (!content) {
      return { error: '模型返回为空', latencyMs, raw: data };
    }

    let parsed;
    try {
      parsed = JSON.parse(extractJSON(content));
    } catch {
      return { error: 'JSON 解析失败', latencyMs, raw: content };
    }

    return { response: parsed, latencyMs };
  } catch (err) {
    const latencyMs = Date.now() - start;
    return { error: `网络错误: ${err.message}`, latencyMs };
  }
}

// ── 延时工具 ──
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── 主流程 ──
async function main() {
  console.log('\n🔬 AI Voice Painter — 多模型基准测试');
  console.log(`   测试用例: ${flags.limit ? `前 ${flags.limit} 条` : `${TEST_CASES.length} 条全部`}`);
  console.log(`   请求间隔: ${RATE_LIMIT_DELAY_MS}ms\n`);

  const targets = resolveTargets();
  const testCases = flags.limit ? TEST_CASES.slice(0, flags.limit) : TEST_CASES;

  console.log(`   待测模型: ${targets.map(t => `${t.providerId}/${t.model}`).join(', ')}\n`);

  // ── 逐个 Provider 运行测试 ──
  const allDetailed = []; // { providerId, modelName, results }

  for (const target of targets) {
    const { providerId, model, prov } = target;
    console.log(`━━━ ${prov.name} / ${model} ━━━`);

    const responses = [];

    for (const tc of testCases) {
      process.stdout.write(`  ${tc.id.padEnd(25)} `);

      const result = await callModel(prov, model, tc.instruction, tc.canvasSummary);

      if (result.error) {
        console.log(`❌ ${result.error.slice(0, 50)}`);
        responses.push({
          testId: tc.id,
          response: { status: result.error, actions: [], summary: '' },
          latencyMs: result.latencyMs || 0,
        });
      } else {
        console.log(`✅ ${result.latencyMs}ms`);
        responses.push({
          testId: tc.id,
          response: result.response,
          latencyMs: result.latencyMs,
        });
      }

      await sleep(RATE_LIMIT_DELAY_MS);
    }

    // 评分
    const scored = scoreAll(testCases, responses);
    const aggregated = aggregateResults(providerId, model, scored);
    allDetailed.push({ providerId, modelName: model, results: scored });

    console.log(`  ── 得分: ${aggregated.avgPct.toFixed(1)}% | 平均延迟: ${aggregated.avgLatencyMs}ms\n`);
  }

  // ── 报告 ──
  const aggregatedList = allDetailed.map(d =>
    aggregateResults(d.providerId, d.modelName, d.results)
  );

  printConsoleReport(aggregatedList, {
    verbose: flags.verbose,
    detailed: allDetailed,
  });

  // ── 写文件 ──
  if (flags.output) {
    const outputPath = path.resolve(flags.output);
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const reportData = {
      timestamp: new Date().toISOString(),
      config: { limit: flags.limit || TEST_CASES.length, delayMs: RATE_LIMIT_DELAY_MS },
      summary: aggregatedList,
      detailed: allDetailed,
    };

    if (flags.format === 'json' || flags.output.endsWith('.json')) {
      fs.writeFileSync(outputPath, toJSON(reportData), 'utf-8');
      console.log(`\n📄 JSON 报告已保存: ${outputPath}`);
    } else if (flags.output.endsWith('.html')) {
      const html = generateHTMLReport(aggregatedList);
      fs.writeFileSync(outputPath, html, 'utf-8');
      console.log(`\n📄 HTML 报告已保存: ${outputPath}`);
    } else {
      fs.writeFileSync(outputPath, toJSON(reportData), 'utf-8');
      console.log(`\n📄 JSON 报告已保存: ${outputPath}`);
    }
  }

  // ── 如果未指定 output 且只跑了一个 provider，也存一份 ──
  if (!flags.output && aggregatedList.length > 0) {
    const defaultPath = path.join(__dirname, 'results', 'benchmark-result.json');
    if (!fs.existsSync(path.dirname(defaultPath))) {
      fs.mkdirSync(path.dirname(defaultPath), { recursive: true });
    }
    const reportData = {
      timestamp: new Date().toISOString(),
      config: { limit: flags.limit || TEST_CASES.length, delayMs: RATE_LIMIT_DELAY_MS },
      summary: aggregatedList,
      detailed: allDetailed,
    };
    fs.writeFileSync(defaultPath, toJSON(reportData), 'utf-8');
    console.log(`\n📄 默认结果已保存: ${defaultPath}`);
  }

  // 退码：有失败用例则退 1
  const anyFailure = allDetailed.some(d => d.results.some(r => r.pct === 0));
  process.exit(anyFailure ? 1 : 0);
}

main().catch(err => {
  console.error('💥 Benchmark 异常:', err);
  process.exit(1);
});
