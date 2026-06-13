import { useState } from 'react'

export default function TextInput({ onSubmit, disabled }) {
  const [text, setText] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed || disabled) return
    onSubmit(trimmed)
    setText('')
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8 }}>
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="输入绘图指令，如：画红色圆"
        disabled={disabled}
        style={{
          flex: 1,
          padding: '10px 14px',
          fontSize: 16,
          border: '1px solid #444',
          borderRadius: 6,
          background: '#2a2a4a',
          color: '#eee',
          outline: 'none',
        }}
      />
      <button
        type="submit"
        disabled={disabled || !text.trim()}
        style={{
          padding: '10px 20px',
          fontSize: 16,
          border: 'none',
          borderRadius: 6,
          background: disabled ? '#555' : '#7c5cfc',
          color: '#fff',
          cursor: disabled ? 'not-allowed' : 'pointer',
          fontWeight: 600,
        }}
      >
        发送
      </button>
    </form>
  )
}
