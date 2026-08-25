import React, { Component, ErrorInfo } from 'react'

interface Props {
  children: React.ReactNode
  fallback?: React.ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo)
    this.props.onError?.(error, errorInfo)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }
      return (
        <FallbackErrorUI
          error={this.state.error}
          onRetry={this.handleRetry}
        />
      )
    }
    return this.props.children
  }
}

export function FallbackErrorUI({
  error,
  onRetry,
}: {
  error: Error | null
  onRetry?: () => void
}) {
  return (
    <div className="flex items-center justify-center h-full w-full bg-slate-50">
      <div className="flex flex-col items-center gap-4 p-8 max-w-md text-center">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
          <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Something went wrong</h3>
          <p className="text-xs text-slate-500 mt-1">
            {error?.message || 'An unexpected error occurred in this panel.'}
          </p>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-colors"
          >
            Try Again
          </button>
        )}
      </div>
    </div>
  )
}
