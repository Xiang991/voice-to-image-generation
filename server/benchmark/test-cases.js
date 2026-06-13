/**
 * Test Cases — 标准基准测试用例集
 *
 * 16 条用例覆盖 6 大能力维度，每条包含预期行为的可检查约束。
 * 评分引擎据此进行逐维度打分。
 */

/** @typedef {import('./scorer.js').TestCase} TestCase */

/** @type {TestCase[]} */
export const TEST_CASES = [
  // ──────────────────────────────────────
  // A. 基础几何图形 (5 cases)
  // ──────────────────────────────────────
  {
    id: 'simple-circle',
    instruction: '画红色圆',
    canvasSummary: [],
    category: 'geometry',
    check: {
      statusIn: ['success', 'optimized'],
      minActions: 1,
      actionType: 'draw_shape',
      params: { shape: 'circle', color: 'red' },
      hasSummary: true,
      summaryInChinese: true,
    },
    weight: 1.0,
  },
  {
    id: 'simple-rect',
    instruction: '画蓝色矩形',
    canvasSummary: [],
    category: 'geometry',
    check: {
      statusIn: ['success', 'optimized'],
      minActions: 1,
      actionType: 'draw_shape',
      params: { shape: 'rect', color: 'blue' },
      hasSummary: true,
      summaryInChinese: true,
    },
    weight: 1.0,
  },
  {
    id: 'simple-line',
    instruction: '画一条绿色线从左上到右下',
    canvasSummary: [],
    category: 'geometry',
    check: {
      statusIn: ['success', 'optimized'],
      minActions: 1,
      actionType: 'draw_shape',
      params: { shape: 'line', color: 'green' },
      hasSummary: true,
      summaryInChinese: true,
    },
    weight: 1.0,
  },
  {
    id: 'small-circle',
    instruction: '画黄色小圆',
    canvasSummary: [],
    category: 'geometry',
    check: {
      statusIn: ['success', 'optimized'],
      minActions: 1,
      actionType: 'draw_shape',
      params: { shape: 'circle', color: 'yellow' },
      hasSummary: true,
      summaryInChinese: true,
      // "小" 暗示 radius 应当偏小（< 80）
      hintSmallRadius: true,
    },
    weight: 1.0,
  },
  {
    id: 'purple-rect',
    instruction: '画紫色矩形',
    canvasSummary: [],
    category: 'geometry',
    check: {
      statusIn: ['success', 'optimized'],
      minActions: 1,
      actionType: 'draw_shape',
      params: { shape: 'rect', color: 'purple' },
      hasSummary: true,
      summaryInChinese: true,
    },
    weight: 1.0,
  },

  // ──────────────────────────────────────
  // B. 颜色映射 + ASR 容错 (4 cases)
  // ──────────────────────────────────────
  {
    id: 'color-brown',
    instruction: '画棕色圆',
    canvasSummary: [],
    category: 'color',
    check: {
      statusIn: ['success', 'optimized'],
      minActions: 1,
      actionType: 'draw_shape',
      params: { shape: 'circle', color: 'brown' },
      hasSummary: true,
      summaryInChinese: true,
    },
    weight: 1.2,
  },
  {
    id: 'color-cyan',
    instruction: '画青色线',
    canvasSummary: [],
    category: 'color',
    check: {
      statusIn: ['success', 'optimized'],
      minActions: 1,
      actionType: 'draw_shape',
      params: { shape: 'line', color: 'cyan' },
      hasSummary: true,
      summaryInChinese: true,
    },
    weight: 1.2,
  },
  {
    id: 'asr-homophone',
    instruction: '发红色圆',
    canvasSummary: [],
    category: 'asr',
    check: {
      statusIn: ['success', 'optimized'],
      minActions: 1,
      actionType: 'draw_shape',
      // 同音纠错：发→画，应仍输出 red circle
      params: { shape: 'circle', color: 'red' },
      hasSummary: true,
      summaryInChinese: true,
    },
    weight: 1.2,
  },
  {
    id: 'asr-shape-name',
    instruction: '画正方型',
    canvasSummary: [],
    category: 'asr',
    check: {
      statusIn: ['success', 'optimized'],
      minActions: 1,
      actionType: 'draw_shape',
      // 字形纠错：正方型→正方形，应输出 rect
      params: { shape: 'rect' },
      hasSummary: true,
      summaryInChinese: true,
    },
    weight: 1.2,
  },

  // ──────────────────────────────────────
  // C. 复合指令 (2 cases)
  // ──────────────────────────────────────
  {
    id: 'compound-two-shapes',
    instruction: '画红色圆和蓝色矩形',
    canvasSummary: [],
    category: 'compound',
    check: {
      statusIn: ['success', 'optimized'],
      minActions: 2,
      actionType: 'draw_shape',
      hasSummary: true,
      summaryInChinese: true,
    },
    weight: 1.5,
  },
  {
    id: 'compound-with-position',
    instruction: '画红色圆在左边和蓝色矩形在右边',
    canvasSummary: [],
    category: 'compound',
    check: {
      statusIn: ['success', 'optimized'],
      minActions: 2,
      actionType: 'draw_shape',
      hasSummary: true,
      summaryInChinese: true,
      // 圆在左→x 偏小，矩形在右→x 偏大
      hintSpatialOrder: true,
    },
    weight: 1.5,
  },

  // ──────────────────────────────────────
  // D. SVG 复杂物体 (3 cases)
  // ──────────────────────────────────────
  {
    id: 'svg-dog',
    instruction: '画一只小狗',
    canvasSummary: [],
    category: 'svg',
    check: {
      statusIn: ['success', 'optimized'],
      minActions: 1,
      actionType: 'draw_svg',
      hasSummary: true,
      summaryInChinese: true,
      svgValid: true,
    },
    weight: 1.5,
  },
  {
    id: 'svg-house',
    instruction: '画房子',
    canvasSummary: [],
    category: 'svg',
    check: {
      statusIn: ['success', 'optimized'],
      minActions: 1,
      actionType: 'draw_svg',
      hasSummary: true,
      summaryInChinese: true,
      svgValid: true,
    },
    weight: 1.5,
  },
  {
    id: 'svg-flower',
    instruction: '画玫瑰花',
    canvasSummary: [],
    category: 'svg',
    check: {
      statusIn: ['success', 'optimized'],
      minActions: 1,
      actionType: 'draw_svg',
      hasSummary: true,
      summaryInChinese: true,
      svgValid: true,
    },
    weight: 1.5,
  },

  // ──────────────────────────────────────
  // E. 画布控制 + 空输入 (1 case)
  // ──────────────────────────────────────
  {
    id: 'control-clear',
    instruction: '清空',
    canvasSummary: [],
    category: 'control',
    check: {
      statusIn: ['success', 'optimized'],
      // 清空可以是 canvas_control(clear) 或 canvas_control("clear")
      // 有些模型仅返回 success + no actions 也算可接受
      allowCanvasControl: true,
      hasSummary: true,
      summaryInChinese: true,
    },
    weight: 1.0,
  },

  // ──────────────────────────────────────
  // F. 空间推理 (1 case)
  // ──────────────────────────────────────
  {
    id: 'spatial-top-left',
    instruction: '画红色圆在左上角',
    canvasSummary: [],
    category: 'spatial',
    check: {
      statusIn: ['success', 'optimized'],
      minActions: 1,
      actionType: 'draw_shape',
      params: { shape: 'circle', color: 'red' },
      hasSummary: true,
      summaryInChinese: true,
      // 左上角：x < 300, y < 200（画布 800×600）
      hintTopLeft: true,
    },
    weight: 1.0,
  },
];

/** 按 category 分组 */
export function groupByCategory() {
  const map = {};
  for (const tc of TEST_CASES) {
    (map[tc.category] ||= []).push(tc);
  }
  return map;
}

/** 获取 category 的中文名称 */
export const CATEGORY_LABELS = {
  geometry: '几何图形',
  color: '颜色映射',
  asr: 'ASR 容错',
  compound: '复合指令',
  svg: 'SVG 复杂物体',
  control: '画布控制',
  spatial: '空间推理',
};
