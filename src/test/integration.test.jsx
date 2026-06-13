import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock agent
vi.mock('../services/agent.js', () => ({
  runAgent: vi.fn(),
}))

// Mock Canvas (Fabric.js requires real DOM)
vi.mock('../components/Canvas.jsx', () => ({
  default: (() => {
    const React = require('react')
    return React.forwardRef((props, ref) => {
      React.useImperativeHandle(ref, () => ({ setLayers: vi.fn() }), [])
      return React.createElement('div', { 'data-testid': 'mock-canvas' })
    })
  })(),
}))

// Mock VoiceController to provide a test input
vi.mock('../components/VoiceController.jsx', () => ({
  default: ({ onSubmit, disabled, onStateChange }) => {
    const React = require('react')
    const [text, setText] = React.useState('')
    return React.createElement('div', { 'data-testid': 'mock-voice-controller' },
      React.createElement('input', {
        'data-testid': 'vc-input',
        value: text,
        onChange: (e) => setText(e.target.value),
        placeholder: '说些什么...',
      }),
      React.createElement('button', {
        'data-testid': 'vc-submit',
        disabled,
        onClick: () => {
          onStateChange('listening')
          onSubmit(text)
        },
      }, '提交指令'),
    )
  },
}))

import App from '../App.jsx'
import { runAgent } from '../services/agent.js'

function submitCommand(text) {
  const input = screen.getByTestId('vc-input')
  const btn = screen.getByTestId('vc-submit')
  fireEvent.change(input, { target: { value: text } })
  fireEvent.click(btn)
}

describe('App integration — 完整语音→绘图链路', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    runAgent.mockReset()
  })

  // ========== draw 成功 ==========
  describe('draw 指令成功', () => {
    it('输入"画红色圆" → agent 返回 shape → 历史记录 success', async () => {
      runAgent.mockResolvedValueOnce({
        status: 'success',
        actions: [{ type: 'draw_shape', params: { shape: 'circle', color: 'red', x: 400, y: 300, radius: 50 } }],
        summary: '画了一个红色圆',
      })

      render(<App />)
      submitCommand('画红色圆')

      await waitFor(() => {
        expect(screen.getByText('画了一个红色圆')).toBeInTheDocument()
      })

      // 历史记录中应有该项（guidance chip 也包含"画红色圆"）
      const matches = screen.getAllByText('画红色圆')
      expect(matches.length).toBeGreaterThanOrEqual(2) // chip + history
    })

    it('agent 返回多个 actions → 全部执行', async () => {
      runAgent.mockResolvedValueOnce({
        status: 'success',
        actions: [
          { type: 'draw_shape', params: { shape: 'circle', color: 'red', x: 400, y: 300, radius: 50 } },
          { type: 'draw_shape', params: { shape: 'rect', color: 'blue', x: 200, y: 150, width: 100, height: 80 } },
        ],
        summary: '画了红色圆和蓝色矩形',
      })

      render(<App />)
      submitCommand('画红色圆和蓝色矩形')

      await waitFor(() => {
        expect(screen.getByText('画了红色圆和蓝色矩形')).toBeInTheDocument()
      })
    })

    it('draw_svg action → 正确添加 svg layer', async () => {
      runAgent.mockResolvedValueOnce({
        status: 'success',
        actions: [{ type: 'draw_svg', params: { svg: '<svg>...</svg>', x: 100, y: 200, scale: 1.5 } }],
        summary: '画了 SVG 图标',
      })

      render(<App />)
      submitCommand('画一个图标')

      await waitFor(() => {
        expect(screen.getByText('画了 SVG 图标')).toBeInTheDocument()
      })
    })

    it('agent 返回空 actions → 仅更新 status', async () => {
      runAgent.mockResolvedValueOnce({
        status: 'success',
        actions: [],
        summary: '没有可绘制的元素',
      })

      render(<App />)
      submitCommand('画一个笑脸')

      await waitFor(() => {
        expect(screen.getByText('没有可绘制的元素')).toBeInTheDocument()
      })
    })
  })

  // ========== draw 失败 ==========
  describe('agent 错误处理', () => {
    it('agent 抛出异常 → status 显示错误消息', async () => {
      runAgent.mockRejectedValueOnce(new Error('网络错误'))

      render(<App />)
      submitCommand('画一只小猫')

      await waitFor(() => {
        expect(screen.getByText('抱歉，出了点问题，请再试一次')).toBeInTheDocument()
      })
    })

    it('agent 抛出异常 → 历史有 error icon', async () => {
      runAgent.mockRejectedValueOnce(new Error('超时'))

      const { container } = render(<App />)
      submitCommand('画一棵树')

      await waitFor(() => {
        expect(screen.getByText('抱歉，出了点问题，请再试一次')).toBeInTheDocument()
      })

      // "画一棵树" 同时出现在 guidance chip 和 history 中
      const matches = screen.getAllByText('画一棵树')
      expect(matches.length).toBeGreaterThanOrEqual(2)
      expect(container.querySelector('.history-error')).toBeInTheDocument()
    })
  })

  // ========== chat 意图 ==========
  describe('chat 意图', () => {
    it('"你好" → ignored，不调 agent', async () => {
      render(<App />)
      submitCommand('你好')

      await waitFor(() => {
        expect(screen.getByText('请说绘图指令，例如画红色圆')).toBeInTheDocument()
      })

      expect(runAgent).not.toHaveBeenCalled()
    })

    it('chat 内容记录为 ignored', async () => {
      render(<App />)
      submitCommand('今天天气怎么样')

      await waitFor(() => {
        expect(screen.getByText('今天天气怎么样')).toBeInTheDocument()
      })
    })
  })

  // ========== control 意图 ==========
  describe('control 意图', () => {
    it('"撤销" → 不调 agent，执行本地 undo', async () => {
      // First add a layer, then undo
      runAgent.mockResolvedValueOnce({
        status: 'success',
        actions: [{ type: 'draw_shape', params: { shape: 'circle', color: 'red', x: 400, y: 300, radius: 50 } }],
        summary: '画了一个红色圆',
      })

      render(<App />)
      submitCommand('画红色圆')

      await waitFor(() => {
        expect(screen.getByText('画了一个红色圆')).toBeInTheDocument()
      })

      // Now undo
      submitCommand('撤销')

      await waitFor(() => {
        expect(screen.getByText('已撤销')).toBeInTheDocument()
      })

      // agent should only have been called once (for draw, not undo)
      expect(runAgent).toHaveBeenCalledTimes(1)
    })

    it('"清空" → 不调 agent，执行本地 clear', async () => {
      runAgent.mockResolvedValueOnce({
        status: 'success',
        actions: [{ type: 'draw_shape', params: { shape: 'circle', color: 'red', x: 400, y: 300, radius: 50 } }],
        summary: '画了一个红色圆',
      })

      render(<App />)
      submitCommand('画红色圆')

      await waitFor(() => {
        expect(screen.getByText('画了一个红色圆')).toBeInTheDocument()
      })

      submitCommand('清空')

      await waitFor(() => {
        expect(screen.getByText('画布已清空')).toBeInTheDocument()
      })
    })

    it('空画布撤销 → 显示"没有可撤销的操作"', async () => {
      render(<App />)
      submitCommand('撤销')

      await waitFor(() => {
        expect(screen.getByText('没有可撤销的操作')).toBeInTheDocument()
      })
    })
  })

  // ========== canvas_control action ==========
  describe('agent 返回 canvas_control', () => {
    it('canvas_control clear → 清空 layers', async () => {
      // 使用 draw 关键词触发 agent 调用，mock 返回 canvas_control
      runAgent.mockResolvedValueOnce({
        status: 'success',
        actions: [{ type: 'canvas_control', params: { action: 'clear' } }],
        summary: '清空了画布',
      })

      render(<App />)
      submitCommand('画一个透明背景')

      await waitFor(() => {
        expect(screen.getByText('清空了画布')).toBeInTheDocument()
      })
    })

    it('canvas_control undo → 撤销最后一层', async () => {
      // First draw
      runAgent.mockResolvedValueOnce({
        status: 'success',
        actions: [{ type: 'draw_shape', params: { shape: 'circle', color: 'red', x: 400, y: 300, radius: 50 } }],
        summary: '画了一个红色圆',
      })
      // Then agent returns undo
      runAgent.mockResolvedValueOnce({
        status: 'success',
        actions: [{ type: 'canvas_control', params: { action: 'undo' } }],
        summary: '已撤销上一个元素',
      })

      render(<App />)
      submitCommand('画红色圆')

      await waitFor(() => {
        expect(screen.getByText('画了一个红色圆')).toBeInTheDocument()
      })

      submitCommand('画一条直线')

      await waitFor(() => {
        expect(screen.getByText('已撤销上一个元素')).toBeInTheDocument()
      })
    })
  })

  // ========== agent 返回 error status ==========
  describe('agent 返回 error status', () => {
    it('status=error → 历史标记 error（显示 error icon）', async () => {
      runAgent.mockResolvedValueOnce({
        status: 'error',
        actions: [],
        summary: '无法识别该指令',
      })

      const { container } = render(<App />)
      submitCommand('画一个不存在的形状')

      await waitFor(() => {
        expect(screen.getByText('无法识别该指令')).toBeInTheDocument()
      })

      // 历史记录中应有 error icon
      expect(screen.getByText('画一个不存在的形状')).toBeInTheDocument()
      expect(container.querySelector('.history-error')).toBeInTheDocument()
    })
  })

  // ========== 禁用状态 ==========
  describe('loading 期间按钮禁用', () => {
    it('agent 请求期间 submit 按钮 disabled', async () => {
      // Use a never-resolving promise so we can check disabled state
      let resolveAgent
      runAgent.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveAgent = resolve
        })
      )

      render(<App />)
      submitCommand('画红色圆')

      await waitFor(() => {
        expect(screen.getByTestId('vc-submit')).toBeDisabled()
      })

      // Clean up
      resolveAgent({ status: 'success', actions: [], summary: 'done' })
    })
  })
})
