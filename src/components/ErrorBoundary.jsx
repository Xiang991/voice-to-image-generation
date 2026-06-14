import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <div className="error-boundary-box">
            <h3>画布渲染出现错误</h3>
            <p className="error-boundary-detail">{this.state.error?.message || '未知错误'}</p>
            <button className="error-boundary-btn" onClick={() => this.setState({ hasError: false })}>
              重试
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
