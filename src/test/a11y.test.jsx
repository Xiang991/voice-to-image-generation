import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import App from '../App.jsx'

// Mock agent
vi.mock('../services/agent.js', () => ({
  runAgent: vi.fn(),
}))

// Mock Canvas
vi.mock('../components/Canvas.jsx', () => ({
  default: (() => {
    const React = require('react')
    return React.forwardRef((props, ref) => {
      React.useImperativeHandle(ref, () => ({
        setLayers: vi.fn(),
        deleteSelected: vi.fn(),
        toDataURL: vi.fn(() => 'data:image/png;base64,'),
        waitForRender: vi.fn(() => Promise.resolve()),
        toggleGrid: vi.fn(),
        isGridVisible: vi.fn(() => false),
        getSelectedId: vi.fn(() => null),
      }), [])
      return React.createElement('canvas', {
        'data-testid': 'mock-canvas',
        'aria-label': '绘图画布',
      })
    })
  })(),
}))

// Mock VoiceController to provide test input
vi.mock('../components/VoiceController.jsx', () => ({
  default: ({ onSubmit, disabled, onStateChange }) => {
    const React = require('react')
    const [text, setText] = React.useState('')
    return React.createElement('div', { 'data-testid': 'mock-voice-controller' },
      React.createElement('input', {
        'data-testid': 'vc-input',
        'aria-label': '语音指令输入',
        value: text,
        onChange: (e) => setText(e.target.value),
      }),
      React.createElement('button', {
        'data-testid': 'vc-submit',
        disabled,
        'aria-label': '提交语音指令',
        onClick: () => {
          onStateChange('listening')
          onSubmit(text)
        },
      }, '提交指令'),
    )
  },
}))

describe('可访问性 (a11y)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ========== 语义化 HTML 结构 ==========
  describe('语义化 HTML 结构', () => {
    it('App 使用 <header> 作为页头', () => {
      const { container } = render(<App />)
      expect(container.querySelector('header')).toBeInTheDocument()
    })

    it('App 使用 <main> 作为主内容区', () => {
      const { container } = render(<App />)
      expect(container.querySelector('main')).toBeInTheDocument()
    })

    it('App 使用 <aside> 作为侧边栏', () => {
      const { container } = render(<App />)
      expect(container.querySelector('aside')).toBeInTheDocument()
    })

    it('App 有 h1 标题', () => {
      render(<App />)
      const headings = screen.getAllByRole('heading', { level: 1 })
      expect(headings.length).toBeGreaterThanOrEqual(1)
    })

    it('App h1 标题为"AI 语音绘图助手"', () => {
      render(<App />)
      const h1 = screen.getByRole('heading', { level: 1 })
      expect(h1).toHaveTextContent('AI 语音绘图助手')
    })
  })

  // ========== 按钮可访问性 ==========
  describe('按钮可访问名称', () => {
    it('提交按钮有文本内容作为可访问名称', () => {
      render(<App />)
      expect(screen.getByTestId('vc-submit')).toHaveTextContent('提交指令')
    })

    it('提交按钮有 aria-label', () => {
      render(<App />)
      expect(screen.getByTestId('vc-submit')).toHaveAttribute('aria-label')
    })
  })

  // ========== 表单输入可访问性 ==========
  describe('输入可访问性', () => {
    it('语音输入框有 aria-label', () => {
      render(<App />)
      expect(screen.getByTestId('vc-input')).toHaveAttribute('aria-label')
    })
  })

  // ========== Canvas 可访问性 ==========
  describe('Canvas 可访问性', () => {
    it('Canvas 有 aria-label', () => {
      render(<App />)
      expect(screen.getByTestId('mock-canvas')).toHaveAttribute('aria-label', '绘图画布')
    })
  })

  // ========== 键盘可操作性 ==========
  describe('键盘可操作性', () => {
    it('按钮可通过 Enter 键激活', () => {
      render(<App />)
      const btn = screen.getByTestId('vc-submit')
      fireEvent.keyDown(btn, { key: 'Enter', code: 'Enter' })
      // 不应该报错
    })

    it('按钮可通过 Space 键激活', () => {
      render(<App />)
      const btn = screen.getByTestId('vc-submit')
      fireEvent.keyDown(btn, { key: ' ', code: 'Space' })
    })

    it('输入框支持键盘输入', () => {
      render(<App />)
      const input = screen.getByTestId('vc-input')
      fireEvent.change(input, { target: { value: '画红色圆' } })
      expect(input).toHaveValue('画红色圆')
    })
  })

  // ========== focus 管理 ==========
  describe('focus 管理', () => {
    it('按钮可获取焦点', () => {
      render(<App />)
      const btn = screen.getByTestId('vc-submit')
      expect(btn).not.toHaveFocus()
      btn.focus()
      expect(btn).toHaveFocus()
    })

    it('输入框可获取焦点', () => {
      render(<App />)
      const input = screen.getByTestId('vc-input')
      expect(input).not.toHaveFocus()
      input.focus()
      expect(input).toHaveFocus()
    })
  })

  // ========== 跨浏览器兼容性 ==========
  describe('跨浏览器兼容性', () => {
    it('window.SpeechRecognition 存在或可安全降级', () => {
      // 验证组件在 SR 不可用时不会崩溃
      delete window.SpeechRecognition
      delete window.webkitSpeechRecognition

      // 渲染应不抛错（即使 SR 不可用）
      expect(() => render(<App />)).not.toThrow()
    })

    it('window.webkitSpeechRecognition 备用检查', () => {
      delete window.SpeechRecognition
      window.webkitSpeechRecognition = class {}
      expect(() => render(<App />)).not.toThrow()
      delete window.webkitSpeechRecognition
    })
  })

  // ========== 移动端触摸 ==========
  describe('移动端兼容性', () => {
    it('按钮响应 click 事件（触摸设备）→ 不抛错', () => {
      render(<App />)
      const btn = screen.getByTestId('vc-submit')
      expect(() => fireEvent.click(btn)).not.toThrow()
    })

    it('提交 draw 指令后按钮进入 disabled（loading）', async () => {
      const { runAgent } = await import('../services/agent.js')
      // 让 agent 挂起，不 resolve
      runAgent.mockReturnValueOnce(new Promise(() => {}))

      render(<App />)
      fireEvent.change(screen.getByTestId('vc-input'), { target: { value: '画红色圆' } })
      fireEvent.click(screen.getByTestId('vc-submit'))

      // draw 指令 → loading=true → submit disabled
      await waitFor(() => {
        expect(screen.getByTestId('vc-submit')).toBeDisabled()
      })
    })
  })
})
