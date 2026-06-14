// research.js — 调研 Workflow
// 并行搜索 GitHub + 博客，综合产出调研报告

export const meta = {
  name: 'research',
  description: '搜索 GitHub + 博客，产出现状调研报告',
  phases: [
    { title: '搜索', detail: '并行搜索 GitHub 和 Web 资源' },
    { title: '综合', detail: '汇总分析产出调研报告' },
  ],
}

// 搜索结果的结构
const SEARCH_RESULT = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    url: { type: 'string' },
    key_points: { type: 'array', items: { type: 'string' } },
  },
  required: ['title', 'url', 'key_points'],
}

// 调研报告的完整结构
const REPORT = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    background: { type: 'string' },
    existing_projects: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          stars: { type: 'string' },
          approach: { type: 'string' },
          pros: { type: 'array', items: { type: 'string' } },
          cons: { type: 'array', items: { type: 'string' } },
        },
        required: ['name', 'approach'],
      },
    },
    technical_landscape: { type: 'string' },
    recommended_approach: { type: 'string' },
    key_considerations: { type: 'array', items: { type: 'string' } },
  },
  required: ['title', 'existing_projects', 'recommended_approach'],
}

export default async function main() {
  const topic = args?.topic || args
  if (!topic || topic === '') {
    log('❌ 需要指定调研主题')
    return { error: '请提供调研主题，例如: args = { topic: "AI Agent 记忆系统" }' }
  }

  log(`🔍 开始调研: ${topic}`)

  phase('搜索')

  const [githubResults, webResults] = await parallel([
    () =>
      agent(`搜索 GitHub 上与 "${topic}" 相关的开源项目。列出每个项目的名称、Star 数、核心思路、优缺点。`, {
        label: 'github-search',
        schema: {
          type: 'object',
          properties: {
            projects: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  stars: { type: 'string' },
                  approach: { type: 'string' },
                  pros: { type: 'array', items: { type: 'string' } },
                  cons: { type: 'array', items: { type: 'string' } },
                  relevance: { type: 'string' },
                },
                required: ['name', 'approach'],
              },
            },
          },
          required: ['projects'],
        },
      }),
    () =>
      agent(`搜索 "${topic}" 相关的技术博客、论文、最佳实践。列出关键文章的标题、来源、核心观点和结论。`, {
        label: 'web-search',
        schema: {
          type: 'object',
          properties: {
            articles: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  source: { type: 'string' },
                  key_insights: { type: 'array', items: { type: 'string' } },
                  conclusion: { type: 'string' },
                },
                required: ['title', 'source', 'key_insights'],
              },
            },
          },
          required: ['articles'],
        },
      }),
  ])

  phase('综合')

  log('📊 搜索完成，正在综合分析...')

  const report = await agent(
    `综合以下调研结果，产出完整的调研报告。

GitHub 项目:
${JSON.stringify(githubResults?.projects || [], null, 2)}

技术文章:
${JSON.stringify(webResults?.articles || [], null, 2)}

主题: ${topic}

请产出包含以下内容的报告:
1. 行业现状与背景
2. 现有方案对比分析（含优缺点）
3. 技术选型全景
4. 推荐方案及理由
5. 关键注意事项`,
    { label: 'synthesize', schema: REPORT }
  )

  log(`✅ 调研完成: ${report?.title || topic}`)
  return report
}
