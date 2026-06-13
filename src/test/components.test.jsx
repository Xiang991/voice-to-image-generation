import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import VoiceStatusBar from '../components/VoiceStatusBar.jsx'
import History from '../components/History.jsx'
import QuickBar from '../components/QuickBar.jsx'

// ========== VoiceStatusBar ==========
describe('VoiceStatusBar', () => {
  it('idle → 显示"等待开始"', () => {
    render(<VoiceStatusBar mode="idle" status="就绪" />)
    expect(screen.getByText('等待开始')).toBeInTheDocument()
  })

  it('listening → 显示"正在听..."', () => {
    render(<VoiceStatusBar mode="listening" status="" />)
    expect(screen.getByText('正在听...')).toBeInTheDocument()
  })

  it('thinking → 显示"思考中..."', () => {
    render(<VoiceStatusBar mode="thinking" status="思考中..." />)
    const matches = screen.getAllByText('思考中...')
    expect(matches.length).toBeGreaterThanOrEqual(1)
  })

  it('error → 显示"出错"', () => {
    render(<VoiceStatusBar mode="error" status="出错" />)
    expect(screen.getByText('出错')).toBeInTheDocument()
  })

  it('denied → 显示"麦克风被禁用"', () => {
    render(<VoiceStatusBar mode="denied" status="" />)
    expect(screen.getByText('麦克风被禁用')).toBeInTheDocument()
  })

  it('未知 mode 回退到 idle', () => {
    render(<VoiceStatusBar mode="unknown" status="" />)
    expect(screen.getByText('等待开始')).toBeInTheDocument()
  })

  it('status 文字渲染', () => {
    render(<VoiceStatusBar mode="idle" status="一切就绪" />)
    expect(screen.getByText('一切就绪')).toBeInTheDocument()
  })

  it('error mode 时不渲染 status（组件逻辑）', () => {
    const { container } = render(<VoiceStatusBar mode="error" status="服务异常" />)
    // error 模式下不显示 status 文字（vs-status-text 不出现在 DOM）
    expect(container.querySelector('.vs-status-text')).not.toBeInTheDocument()
  })

  it('容器有 voice-status-bar class', () => {
    const { container } = render(<VoiceStatusBar mode="idle" status="" />)
    expect(container.querySelector('.voice-status-bar')).toBeInTheDocument()
  })
})

// ========== History ==========
describe('History', () => {
  it('空列表 → 显示"暂无指令记录"', () => {
    render(<History items={[]} />)
    expect(screen.getByText('暂无指令记录')).toBeInTheDocument()
  })

  it('success 项 → 渲染文字和时间', () => {
    const ts = new Date('2026-06-13T14:32:00')
    render(<History items={[{ id: 1, text: '画红色圆', status: 'success', timestamp: ts }]} />)
    expect(screen.getByText('画红色圆')).toBeInTheDocument()
  })

  it('error 项 → 渲染 error icon', () => {
    const ts = new Date()
    const { container } = render(
      <History items={[{ id: 2, text: '画小猫', status: 'error', timestamp: ts }]} />
    )
    expect(screen.getByText('画小猫')).toBeInTheDocument()
    expect(container.querySelector('.history-error')).toBeInTheDocument()
  })

  it('ignored 项 → 渲染 ignored icon', () => {
    const ts = new Date()
    const { container } = render(
      <History items={[{ id: 3, text: '你好', status: 'ignored', timestamp: ts }]} />
    )
    expect(container.querySelector('.history-ignored')).toBeInTheDocument()
  })

  it('多条记录全部渲染', () => {
    const ts = new Date()
    const items = [
      { id: 1, text: '画红色圆', status: 'success', timestamp: ts },
      { id: 2, text: '画小猫', status: 'error', timestamp: ts },
      { id: 3, text: '你好', status: 'ignored', timestamp: ts },
    ]
    render(<History items={items} />)
    expect(screen.getByText('画红色圆')).toBeInTheDocument()
    expect(screen.getByText('画小猫')).toBeInTheDocument()
    expect(screen.getByText('你好')).toBeInTheDocument()
  })

  it('容器有 history-list class', () => {
    const ts = new Date()
    const { container } = render(
      <History items={[{ id: 1, text: 'test', status: 'success', timestamp: ts }]} />
    )
    expect(container.querySelector('.history-list')).toBeInTheDocument()
  })
})

// ========== QuickBar ==========
describe('QuickBar', () => {
  it('visible=false → 不渲染任何内容', () => {
    const { container } = render(
      <QuickBar onUndo={vi.fn()} onClear={vi.fn()} disabled={false} visible={false} />
    )
    expect(container.querySelector('.quick-bar')).not.toBeInTheDocument()
  })

  it('visible=true → 渲染撤销和清空按钮', () => {
    render(
      <QuickBar onUndo={vi.fn()} onClear={vi.fn()} disabled={false} visible={true} />
    )
    expect(screen.getByText('撤销')).toBeInTheDocument()
    expect(screen.getByText('清空')).toBeInTheDocument()
  })

  it('点击撤销 → 触发 onUndo', () => {
    const onUndo = vi.fn()
    render(
      <QuickBar onUndo={onUndo} onClear={vi.fn()} disabled={false} visible={true} />
    )
    fireEvent.click(screen.getByText('撤销'))
    expect(onUndo).toHaveBeenCalledOnce()
  })

  it('点击清空 → 触发 onClear', () => {
    const onClear = vi.fn()
    render(
      <QuickBar onUndo={vi.fn()} onClear={onClear} disabled={false} visible={true} />
    )
    fireEvent.click(screen.getByText('清空'))
    expect(onClear).toHaveBeenCalledOnce()
  })

  it('disabled=true → 按钮不可点击', () => {
    render(
      <QuickBar onUndo={vi.fn()} onClear={vi.fn()} disabled={true} visible={true} />
    )
    expect(screen.getByText('撤销').closest('button')).toBeDisabled()
    expect(screen.getByText('清空').closest('button')).toBeDisabled()
  })
})
