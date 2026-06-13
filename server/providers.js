/**
 * Provider Registry — 共享模型注册表
 *
 * 所有 LLM Provider 定义、API 基址、可用模型的单一真实来源。
 * 同时被 proxy.js（运行时路由）和 benchmark/（基准测试）使用。
 */

export const PROVIDERS = {
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1/chat/completions',
    models: ['deepseek-v4-flash', 'deepseek-v4-pro'],
    defaultModel: 'deepseek-v4-flash',
    apiKeyEnv: 'DEEPSEEK_API_KEY',
    notes: 'deepseek-chat / deepseek-reasoner 将于 2026-07-24 停用',
  },
  qwen: {
    id: 'qwen',
    name: 'Qwen（阿里云通义千问）',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    models: ['qwen3.7-max'],
    defaultModel: 'qwen3.7-max',
    apiKeyEnv: 'QWEN_API_KEY',
    notes: '推理模型，关闭 thinking 加速响应',
    extraBody: { enable_thinking: false },
  },
  glm: {
    id: 'glm',
    name: '智谱 GLM',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    models: ['glm-5.1'],
    defaultModel: 'glm-5.1',
    apiKeyEnv: 'GLM_API_KEY',
    notes: 'API Key 格式: xxxxxxxx.xxxxxxxxxxxxxxxx（含小数点）',
  },
  moonshot: {
    id: 'moonshot',
    name: '月之暗面 Kimi',
    baseUrl: 'https://api.moonshot.cn/v1/chat/completions',
    models: ['kimi-k2.6'],
    defaultModel: 'kimi-k2.6',
    apiKeyEnv: 'MOONSHOT_API_KEY',
    notes: '旧版 moonshot-v1 系列已下线',
  },
};

/** 按 ID 获取 Provider（不存在返回 null） */
export function getProvider(id) {
  return PROVIDERS[id] || null;
}

/** 列出所有 Provider（含 Key 配置状态） */
export function listProviders() {
  return Object.entries(PROVIDERS).map(([id, p]) => ({
    id,
    name: p.name,
    models: p.models,
    defaultModel: p.defaultModel,
    configured: !!process.env[p.apiKeyEnv],
  }));
}
