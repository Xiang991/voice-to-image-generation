export default function History({ items }) {
  if (items.length === 0) {
    return (
      <div style={{ color: '#888', fontSize: 14, textAlign: 'center', padding: 20 }}>
        暂无指令记录
      </div>
    )
  }

  return (
    <div style={{ maxHeight: 320, overflowY: 'auto' }}>
      {items.map((item) => (
        <div
          key={item.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 0',
            borderBottom: '1px solid #333',
            fontSize: 14,
          }}
        >
          <span>{item.status === 'success' ? '✅' : '❌'}</span>
          <span style={{ flex: 1, color: '#ddd' }}>{item.text}</span>
          <span style={{ color: '#888', fontSize: 12 }}>
            {item.timestamp.toLocaleTimeString('zh-CN')}
          </span>
        </div>
      ))}
    </div>
  )
}
