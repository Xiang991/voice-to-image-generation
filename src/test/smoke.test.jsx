import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import App from '../App.jsx'

describe('App smoke test', () => {
  it('renders the app title', () => {
    render(<App />)
    expect(screen.getByText('AI 语音绘图助手')).toBeInTheDocument()
  })

  it('renders the voice controller start button', () => {
    render(<App />)
    expect(screen.getByText('开始绘画')).toBeInTheDocument()
  })

  it('renders the guidance chips', () => {
    render(<App />)
    expect(screen.getByText('画红色圆')).toBeInTheDocument()
  })
})
