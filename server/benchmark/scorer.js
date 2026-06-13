/**
 * Scorer — 多维评分引擎
 *
 * 每条测试用例评分维度（满分 10 分）：
 *   JSON 有效(1) + 状态正确(1) + 动作类型(2) + 参数精确(2)
 *   + 最少动作数(1) + 有摘要(1) + SVG 有效(1) + 中文摘要(1)
 *
 * 不适用维度不扣分（N/A 处理）。
 */

/**
 * @typedef {Object} TestCase
 * @property {string} id
 * @property {string} instruction
 * @property {Array} canvasSummary
 * @property {string} category
 * @property {Object} check
 * @property {string[]} check.statusIn
 * @property {number} [check.minActions]
 * @property {string} [check.actionType]
 * @property {Object} [check.params]
 * @property {boolean} [check.hasSummary]
 * @property {boolean} [check.summaryInChinese]
 * @property {boolean} [check.svgValid]
 * @property {boolean} [check.allowCanvasControl]
 * @property {boolean} [check.hintSmallRadius]
 * @property {boolean} [check.hintSpatialOrder]
 * @property {boolean} [check.hintTopLeft]
 * @property {number} weight
 */

/**
 * @typedef {Object} ScoreResult
 * @property {string} testId
 * @property {string} category
 * @property {string} instruction
 * @property {Object} dimensions — 各维度得分明细
 * @property {number} rawScore — 加权前得分（满分 10）
 * @property {number} weightedScore — 加权后得分
 * @property {number} maxWeighted — 加权后满分
 * @property {number} pct — 百分比
 * @property {Object} response — 原始响应（用于调试）
 * @property {number} latencyMs — 延迟毫秒
 */

const CHINESE_RE = /[一-鿿㐀-䶿]/;

/** 简易 SVG 有效性检查 */
function checkSVG(svg) {
  if (!svg || typeof svg !== 'string') return false;
  const s = svg.trim();
  // 必须包含 <svg> 和至少一个绘图元素
  if (!/^<svg/i.test(s) && !/<svg/i.test(s)) return false;
  const hasElement = /<(path|circle|rect|ellipse|line|polygon|polyline|g|text|image)\b/i.test(s);
  return hasElement;
}

/** 分数判断：预期 status 是否在允许范围内 */
function checkStatus(status, allowedList) {
  return allowedList.includes(status);
}

/**
 * 对单个响应进行评分
 * @param {TestCase} testCase
 * @param {Object} response — 解析后的 LLM JSON 响应
 * @param {number} latencyMs
 * @returns {ScoreResult}
 */
export function scoreResponse(testCase, response, latencyMs) {
  const { check, id, category, instruction, weight } = testCase;
  const dims = {};
  const actions = response?.actions || [];
  const status = response?.status || 'missing';
  const summary = response?.summary || '';

  // 1. JSON 有效 (1分)
  // response 本身已解析成功，给分；这里检测是否有必要字段
  dims.jsonValid = response && typeof response === 'object' ? 1 : 0;

  // 2. 状态正确 (1分)
  dims.statusCorrect = checkStatus(status, check.statusIn) ? 1 : 0;

  // 3. 动作类型 (2分) — N/A 判断
  dims.actionType = 0;
  if (check.allowCanvasControl) {
    // 允许 canvas_control 或任何非 error 状态
    const hasControl = actions.some(a => a?.type === 'canvas_control');
    const isEmptyOk = status === 'success' && actions.length === 0;
    dims.actionType = (hasControl || isEmptyOk) ? 2 : 0;
  } else if (check.actionType) {
    // 检查所有 action 是否为期望类型
    const allCorrect = actions.length > 0 && actions.every(a => a?.type === check.actionType);
    const partial = actions.some(a => a?.type === check.actionType);
    dims.actionType = allCorrect ? 2 : partial ? 1 : 0;
  } else {
    dims.actionType = 'N/A'; // 不适用，不扣分
  }

  // 4. 参数精确度 (2分)
  dims.params = 0;
  if (check.params) {
    let points = 0;
    let total = 0;
    // shape 检查
    if (check.params.shape) {
      total++;
      const foundShape = actions.some(a =>
        a?.params?.shape === check.params.shape
      );
      if (foundShape) points++;
    }
    // color 检查
    if (check.params.color) {
      total++;
      const foundColor = actions.some(a =>
        a?.params?.color === check.params.color
      );
      if (foundColor) points++;
    }
    dims.params = total > 0 ? (points / total) * 2 : 'N/A';
  } else {
    dims.params = 'N/A';
  }

  // 5. 最少动作数 (1分)
  dims.minActions = 0;
  if (check.minActions != null) {
    dims.minActions = actions.length >= check.minActions ? 1 : 0;
  } else {
    dims.minActions = 'N/A';
  }

  // 6. 有摘要 (1分)
  dims.hasSummary = check.hasSummary
    ? (typeof summary === 'string' && summary.trim().length > 0 ? 1 : 0)
    : 'N/A';

  // 7. SVG 有效性 (1分)
  dims.svgValid = 'N/A';
  if (check.svgValid) {
    const svgActions = actions.filter(a => a?.type === 'draw_svg');
    if (svgActions.length > 0) {
      dims.svgValid = svgActions.every(a => checkSVG(a?.params?.svg)) ? 1 : 0;
    } else {
      // 模型可能用 draw_shape 替代了 SVG — 给 0 分
      dims.svgValid = 0;
    }
  }

  // 8. 中文摘要 (1分)
  dims.summaryInChinese = check.summaryInChinese
    ? (CHINESE_RE.test(summary) ? 1 : 0)
    : 'N/A';

  // 计算原始分（跳过 'N/A'）
  let rawScore = 0;
  for (const d of Object.values(dims)) {
    if (typeof d === 'number') rawScore += d;
  }

  // 计算最大可能分（10 - N/A 项数）
  const naCount = Object.values(dims).filter(v => v === 'N/A').length;
  const maxScore = 10 - naCount;

  const weightedScore = rawScore * weight;
  const maxWeighted = maxScore * weight;
  const pct = maxWeighted > 0 ? (weightedScore / maxWeighted) * 100 : 0;

  return {
    testId: id,
    category,
    instruction,
    dimensions: dims,
    rawScore,
    maxScore,
    weightedScore,
    maxWeighted,
    pct,
    response: {
      status,
      actions: actions.map(a => ({ type: a?.type, params: a?.params })),
      summary,
    },
    latencyMs,
  };
}

/**
 * 对所有测试用例 × 所有响应进行评分
 * @param {TestCase[]} testCases
 * @param {Object[]} responses — [{testId, response, latencyMs}]
 * @returns {ScoreResult[]}
 */
export function scoreAll(testCases, responses) {
  const resultMap = {};
  for (const r of responses) {
    resultMap[r.testId] = r;
  }

  return testCases.map(tc => {
    const resp = resultMap[tc.id];
    if (!resp) {
      // 超时 / 失败的用例
      return {
        testId: tc.id,
        category: tc.category,
        instruction: tc.instruction,
        dimensions: {},
        rawScore: 0,
        maxScore: 0,
        weightedScore: 0,
        maxWeighted: 0,
        pct: 0,
        response: { status: 'TIMEOUT', actions: [], summary: '' },
        latencyMs: 0,
        error: 'No response recorded',
      };
    }
    return scoreResponse(tc, resp.response, resp.latencyMs);
  });
}

/**
 * 按 Provider/Model 聚合评分
 * @param {string} providerId
 * @param {string} modelName
 * @param {ScoreResult[]} results
 * @returns {Object}
 */
export function aggregateResults(providerId, modelName, results) {
  const total = results.length;
  const sumPct = results.reduce((a, r) => a + r.pct, 0);
  const avgPct = total > 0 ? sumPct / total : 0;
  const avgLatency = results.reduce((a, r) => a + r.latencyMs, 0) / total;

  // 按类别聚合
  const byCategory = {};
  for (const r of results) {
    if (!byCategory[r.category]) {
      byCategory[r.category] = { scores: [], count: 0 };
    }
    byCategory[r.category].scores.push(r.pct);
    byCategory[r.category].count++;
  }
  const catAgg = {};
  for (const [cat, data] of Object.entries(byCategory)) {
    catAgg[cat] = data.scores.reduce((a, s) => a + s, 0) / data.scores.length;
  }

  return {
    providerId,
    modelName,
    totalTests: total,
    avgPct,
    avgLatencyMs: Math.round(avgLatency),
    byCategory: catAgg,
  };
}
