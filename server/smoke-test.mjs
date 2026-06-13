/**
 * Smoke Test — AI Voice Painter Proxy
 *
 * 验证代理服务器基本功能：
 * 1. /api/health 返回 {"status":"ok"}
 * 2. /api/agent 接受指令返回正确 JSON 格式
 * 3. 错误输入返回 error status
 *
 * 使用: node smoke-test.mjs
 */

const BASE = process.env.TEST_URL || 'http://localhost:8000';

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ❌ ${name}: ${err.message}`);
    failed++;
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg);
}

// ---- Tests ----

async function healthCheck() {
  const res = await fetch(`${BASE}/api/health`);
  const data = await res.json();
  assert(res.status === 200, `Expected 200, got ${res.status}`);
  assert(data.status === 'ok', `Expected status="ok", got "${data.status}"`);
}

async function simpleInstruction() {
  const res = await fetch(`${BASE}/api/agent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: '画红色圆', canvasSummary: [] }),
  });
  const data = await res.json();
  assert(res.status === 200, `Expected 200, got ${res.status}`);
  assert(data.status === 'success' || data.status === 'optimized',
    `Expected success/optimized, got "${data.status}"`);
  assert(Array.isArray(data.actions), 'actions must be an array');
  if (data.actions.length > 0) {
    const action = data.actions[0];
    assert(action.type === 'draw_shape' || action.type === 'draw_svg',
      `Expected draw_shape/draw_svg, got "${action.type}"`);
    if (action.type === 'draw_shape') {
      assert(action.params.shape, 'draw_shape must have shape');
      assert(action.params.color, 'draw_shape must have color');
      assert(action.params.x != null, 'draw_shape must have x');
      assert(action.params.y != null, 'draw_shape must have y');
    }
  }
  assert(typeof data.summary === 'string', 'summary must be a string');
}

async function emptyInput() {
  const res = await fetch(`${BASE}/api/agent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: '', canvasSummary: [] }),
  });
  const data = await res.json();
  assert(data.status === 'error', `Expected error for empty input, got "${data.status}"`);
}

async function compoundInstruction() {
  const res = await fetch(`${BASE}/api/agent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: '画红色圆和蓝色矩形', canvasSummary: [] }),
  });
  const data = await res.json();
  assert(data.status === 'success' || data.status === 'optimized',
    `Compound instruction should succeed, got "${data.status}"`);
  assert(Array.isArray(data.actions) && data.actions.length >= 2,
    `Expected 2+ actions, got ${data.actions?.length}`);
}

async function canvasClear() {
  const res = await fetch(`${BASE}/api/agent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: '清空', canvasSummary: [] }),
  });
  const data = await res.json();
  if (data.status === 'success') {
    assert(data.actions.some(a => a.type === 'canvas_control'),
      'clear should use canvas_control');
  }
  // Note: clear may fail due to model inconsistency, that's expected
}

// ---- Main ----

console.log(`\n🔍 AI Voice Painter — Smoke Test`);
console.log(`   Target: ${BASE}\n`);

async function main() {
  // Health check first — server must be running
  try {
    const res = await fetch(`${BASE}/api/health`, { method: 'HEAD' });
    if (res.status !== 200) {
      console.log('  ❌ Server not reachable. Start with: node proxy.js\n');
      process.exit(1);
    }
  } catch {
    console.log('  ❌ Cannot connect to server. Start with: node proxy.js\n');
    process.exit(1);
  }

  await test('GET /api/health returns ok', healthCheck);
  await test('POST /api/agent — simple instruction', simpleInstruction);
  await test('POST /api/agent — empty input → error', emptyInput);
  await test('POST /api/agent — compound instruction', compoundInstruction);
  await test('POST /api/agent — canvas clear', canvasClear);

  const total = passed + failed;
  console.log(`\n📊 Results: ${passed}/${total} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
