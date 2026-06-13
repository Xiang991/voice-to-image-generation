import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { runAgent } from '../services/agent.js'
import { CONFIG } from '../config.js'

describe('runAgent — agent API', () => {
  beforeEach(() => {
    global.fetch = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ========== 成功路径 ==========
  describe('成功响应', () => {
    it('返回 JSON 对象 → 正确解构', async () => {
      const data = {
        status: 'success',
        actions: [{ type: 'draw_shape', params: { shape: 'circle', color: 'red', x: 400, y: 300, radius: 50 } }],
        summary: '画了一个红色圆',
      }
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(data),
      })

      const result = await runAgent('画红色圆', [])
      expect(result).toEqual(data)
    })

    it('canvasSummary 默认值为 []（不传第二个参数）', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'success', actions: [], summary: 'ok' }),
      })

      await runAgent('测试')

      const body = JSON.parse(fetch.mock.calls[0][1].body)
      expect(body.canvasSummary).toEqual([])
    })

    it('canvasSummary 内容正确传入 body', async () => {
      const summary = [{ type: 'shape', shape: 'circle', color: 'red', x: 400, y: 300, radius: 50 }]
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'success', actions: [], summary: 'ok' }),
      })

      await runAgent('画红色圆', summary)

      const body = JSON.parse(fetch.mock.calls[0][1].body)
      expect(body.canvasSummary).toEqual(summary)
    })

    it('请求方法为 POST', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'success', actions: [], summary: 'ok' }),
      })

      await runAgent('画红色圆')

      expect(fetch.mock.calls[0][1].method).toBe('POST')
    })

    it('请求 Content-Type 为 application/json', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'success', actions: [], summary: 'ok' }),
      })

      await runAgent('画红色圆')

      expect(fetch.mock.calls[0][1].headers['Content-Type']).toBe('application/json')
    })
  })

  // ========== HTTP 错误 ==========
  describe('HTTP 错误状态码', () => {
    it('400 → 抛出包含状态码的错误', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: () => Promise.resolve('Bad request body'),
      })

      await expect(runAgent('画红色圆')).rejects.toThrow('Proxy 400: Bad request body')
    })

    it('403 → 抛出包含状态码的错误', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: () => Promise.resolve('Forbidden'),
      })

      await expect(runAgent('画红色圆')).rejects.toThrow('Proxy 403: Forbidden')
    })

    it('500 → 抛出包含状态码的错误', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal error'),
      })

      await expect(runAgent('画红色圆')).rejects.toThrow('Proxy 500: Internal error')
    })

    it('502 → 抛出包含状态码的错误', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 502,
        text: () => Promise.resolve('Bad gateway'),
      })

      await expect(runAgent('画红色圆')).rejects.toThrow('Proxy 502: Bad gateway')
    })

    it('503 → 抛出包含状态码的错误', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: () => Promise.resolve('Service overloaded'),
      })

      await expect(runAgent('画红色圆')).rejects.toThrow('Proxy 503: Service overloaded')
    })
  })

  // ========== 网络异常 ==========
  describe('网络异常', () => {
    it('fetch 拒绝 → 抛出原始错误', async () => {
      fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))

      await expect(runAgent('画红色圆')).rejects.toThrow('Failed to fetch')
    })

    it('断网 → TypeError', async () => {
      fetch.mockRejectedValueOnce(new TypeError('NetworkError when attempting to fetch resource.'))

      await expect(runAgent('画红色圆')).rejects.toThrow(TypeError)
    })
  })

  // ========== 响应解析错误 ==========
  describe('响应解析异常', () => {
    it('res.json() 失败（非 JSON 响应）→ 抛出错误', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(new SyntaxError('Unexpected token <')),
      })

      await expect(runAgent('画红色圆')).rejects.toThrow('Unexpected token <')
    })

    it('res.text() 失败 → 错误传播', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.reject(new Error('Body stream already read')),
      })

      await expect(runAgent('画红色圆')).rejects.toThrow('Body stream already read')
    })
  })

  // ========== 边界情况 ==========
  describe('边界情况', () => {
    it('空 text → 仍发送请求', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'success', actions: [], summary: 'ok' }),
      })

      await runAgent('', [])

      const body = JSON.parse(fetch.mock.calls[0][1].body)
      expect(body.text).toBe('')
    })

    it('长文本 → 正确传入 body', async () => {
      const longText = '画一只非常可爱的小猫咪在绿色的草地上追捕一只蝴蝶'.repeat(5)
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'success', actions: [], summary: 'ok' }),
      })

      await runAgent(longText, [])

      const body = JSON.parse(fetch.mock.calls[0][1].body)
      expect(body.text).toBe(longText)
    })

    it('API URL 使用 CONFIG.proxyUrl', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'success', actions: [], summary: 'ok' }),
      })

      await runAgent('test')

      const url = fetch.mock.calls[0][0]
      expect(url).toBe(`${CONFIG.proxyUrl}/api/agent`)
    })
  })
})
