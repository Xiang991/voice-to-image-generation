/**
 * Report — 基准测试报告格式化输出
 *
 * 支持三种输出：
 *   - console.table 格式（终端阅读）
 *   - HTML 表格文件（浏览器阅读）
 *   - JSON 文件（数据交换）
 */

import { CATEGORY_LABELS } from './test-cases.js';

/**
 * 打印控制台报告
 * @param {Object[]} aggregatedList — aggregateResults() 的返回值数组
 * @param {Object} [options]
 * @param {boolean} [options.verbose] — 是否显示每条用例详情
 * @param {ScoreResult[]} [options.detailed] — 所有评分结果，verbose 时需要
 */
export function printConsoleReport(aggregatedList, options = {}) {
  const { verbose, detailed } = options;

  // ── 总表 ──
  const header = [
    'Provider',
    'Model',
    '总分(%)',
    '平均延迟',
    '测试数',
  ].join('  ');
  const sep = '─'.repeat(header.length + 10);

  console.log(`\n${'='.repeat(header.length + 10)}`);
  console.log('  AI Voice Painter — LLM 基准测试结果');
  console.log(`${'='.repeat(header.length + 10)}`);
  console.log('');
  console.log(header);
  console.log(sep);

  // 按总分降序排列
  const sorted = [...aggregatedList].sort((a, b) => b.avgPct - a.avgPct);

  for (const agg of sorted) {
    const pct = agg.avgPct.toFixed(1).padStart(6);
    const lat = `${agg.avgLatencyMs}ms`.padStart(8);
    const cnt = String(agg.totalTests).padStart(4);
    console.log(`  ${agg.providerId.padEnd(12)} ${agg.modelName.padEnd(20)} ${pct}%  ${lat}  ${cnt}`);
  }
  console.log(sep);

  // 最佳
  const best = sorted[0];
  if (best) {
    console.log(`\n🏆 最佳整体: ${best.providerId} / ${best.modelName} (${best.avgPct.toFixed(1)}%)`);
  }

  // ── 按类别分解表 ──
  console.log(`\n${'─'.repeat(80)}`);
  console.log('  分类成绩 (%)');
  console.log('');

  // 收集所有类别
  const allCats = new Set();
  for (const agg of sorted) {
    for (const cat of Object.keys(agg.byCategory)) {
      allCats.add(cat);
    }
  }
  const catList = Array.from(allCats);

  // 表头
  const catHeader = ['Provider'].concat(catList.map(c => CATEGORY_LABELS[c] || c)).join('  ');
  console.log(catHeader);
  console.log('─'.repeat(catHeader.length + 10));

  for (const agg of sorted) {
    const row = [agg.providerId.padEnd(12)];
    for (const cat of catList) {
      const v = agg.byCategory[cat];
      row.push((v !== undefined ? v.toFixed(1) : '─').padStart(CATEGORY_LABELS[cat]?.length || 6));
    }
    console.log(row.join('  '));
  }
  console.log('');

  // ── Verbose: 每条用例的详细评分 ──
  if (verbose && detailed) {
    console.log(`${'─'.repeat(80)}`);
    console.log('  逐用例详情');

    for (const agg of sorted) {
      const modelResults = detailed
        .filter(r => r.providerId === agg.providerId && r.modelName === agg.modelName)
        .flatMap(group => group.results || []);

      if (modelResults.length === 0) continue;

      console.log(`\n  ◆ ${agg.providerId} / ${agg.modelName}`);
      for (const r of modelResults) {
        const pct = typeof r.pct === 'number' ? `${r.pct.toFixed(0)}%`.padStart(5) : '  N/A';
        const lat = `${r.latencyMs}ms`.padEnd(8);
        console.log(`    ${pct}  ${lat}  ${r.instruction.padEnd(20)}  → ${r.response?.status || 'FAIL'}`);
      }
    }
    console.log('');
  }
}

/**
 * 生成 HTML 报告
 * @param {Object[]} aggregatedList
 * @param {Object} [options]
 * @param {ScoreResult[][]} [options.detailedByProvider] — 每个 provider 的详细评分
 * @returns {string} HTML 字符串
 */
export function generateHTMLReport(aggregatedList, options = {}) {
  const sorted = [...aggregatedList].sort((a, b) => b.avgPct - a.avgPct);
  const allCats = new Set();
  for (const agg of sorted) {
    for (const cat of Object.keys(agg.byCategory)) allCats.add(cat);
  }
  const catList = Array.from(allCats);

  let totalRows = '';
  for (const agg of sorted) {
    const pct = agg.avgPct.toFixed(1);
    const lat = `${agg.avgLatencyMs}ms`;
    totalRows += `<tr>
      <td>${escHtml(agg.providerId)}</td>
      <td>${escHtml(agg.modelName)}</td>
      <td><strong>${pct}%</strong></td>
      <td>${lat}</td>
      <td>${agg.totalTests}</td>
    </tr>\n`;
  }

  let catRows = '';
  for (const agg of sorted) {
    let row = `<tr><td>${escHtml(agg.providerId)}</td>`;
    for (const cat of catList) {
      const v = agg.byCategory[cat];
      const val = v !== undefined ? `${v.toFixed(1)}%` : '—';
      row += `<td>${val}</td>`;
    }
    row += '</tr>\n';
    catRows += row;
  }

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="utf-8"><title>AI Voice Painter — 模型基准测试</title>
<style>
  body { font-family: -apple-system, 'Segoe UI', sans-serif; margin: 2rem; background: #f8f9fa; }
  h1 { color: #1a1a1a; }
  table { border-collapse: collapse; margin: 1rem 0 2rem; width: 100%; max-width: 900px; }
  th, td { padding: 8px 16px; text-align: left; border-bottom: 1px solid #dee2e6; }
  th { background: #e9ecef; font-weight: 600; }
  .best { background: #d4edda; }
  .footer { margin-top: 2rem; color: #6c757d; font-size: 0.85rem; }
</style></head>
<body>
<h1>🤖 AI Voice Painter — LLM Benchmark</h1>
<p>生成时间: ${new Date().toISOString()}</p>

<h2>📊 总分排名</h2>
<table>
<tr><th>Provider</th><th>Model</th><th>总分</th><th>平均延迟</th><th>测试数</th></tr>
${totalRows}
</table>

<h2>📈 分类成绩</h2>
<table>
<tr><th>Provider</th>${catList.map(c => `<th>${escHtml(CATEGORY_LABELS[c] || c)}</th>`).join('')}</tr>
${catRows}
</table>

<div class="footer">AI Voice Painter · Benchmark Runner</div>
</body></html>`;
}

/**
 * 保存 JSON 报告到文件（由 runner 调用）
 * @param {Object} data
 * @returns {string} 格式化的 JSON
 */
export function toJSON(data) {
  return JSON.stringify(data, null, 2);
}

function escHtml(s) {
  return String(s).replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[m]);
}
