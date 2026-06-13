import { useState } from 'react'

function formatJson(obj) {
  try {
    return JSON.stringify(obj, null, 2)
  } catch {
    return String(obj)
  }
}

function MessageBlock({ msg, index }) {
  const roleLabel = {
    system: 'SYSTEM',
    user: 'USER',
    assistant: 'ASSISTANT',
    tool: 'TOOL',
  }

  const roleColor = {
    system: '#666',
    user: '#42a5f5',
    assistant: '#f9a825',
    tool: '#66bb6a',
  }

  const flag = roleLabel[msg.role] || msg.role
  const color = roleColor[msg.role] || '#aaa'

  if (msg.role === 'system') {
    return (
      <details style={{ marginBottom: 6 }}>
        <summary style={{ color, fontSize: 12, cursor: 'pointer' }}>
          [{index}] {flag} — 系统提示词 (点击展开)
        </summary>
        <pre style={preStyle}>{msg.content}</pre>
      </details>
    )
  }

  return (
    <div style={{ marginBottom: 8, borderBottom: '1px solid #2a2a2a', paddingBottom: 6 }}>
      <div style={{ color, fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
        [{index}] {flag}
      </div>
      {msg.content && msg.content.length > 0 && (
        <pre style={preStyle}>{msg.content}</pre>
      )}
      {msg.tool_calls && msg.tool_calls.map((tc, i) => (
        <details key={i} style={{ marginTop: 4 }}>
          <summary style={{ color: '#f9a825', fontSize: 12, cursor: 'pointer' }}>
            tool_call: {tc.function.name}()
          </summary>
          <pre style={preStyle}>{formatJson(JSON.parse(tc.function.arguments))}</pre>
        </details>
      ))}
    </div>
  )
}

const preStyle = {
  background: '#111',
  color: '#7ec699',
  fontSize: 11,
  padding: 6,
  borderRadius: 4,
  overflow: 'auto',
  maxHeight: 200,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-all',
  margin: '4px 0',
}

export default function DebugPanel({ trace }) {
  const [open, setOpen] = useState(false)

  if (!trace || trace.length === 0) {
    return (
      <div style={{ color: '#666', fontSize: 13, textAlign: 'center', padding: 10 }}>
        发送指令后此处显示完整 API 传输记录
      </div>
    )
  }

  return (
    <div>
      <div
        onClick={() => setOpen(!open)}
        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}
      >
        <span style={{ fontSize: 12 }}>{open ? '▼' : '▶'}</span>
        <span style={{ fontSize: 13, color: '#aaa' }}>
          传输记录 ({trace.length} 条消息)
        </span>
      </div>

      {open && (
        <div style={{ maxHeight: 400, overflowY: 'auto' }}>
          {trace.map((msg, i) => (
            <MessageBlock key={i} msg={msg} index={i} />
          ))}
        </div>
      )}
    </div>
  )
}
