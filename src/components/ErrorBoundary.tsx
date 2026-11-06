import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Alert, Button } from './ui'

interface State {
  error: Error | null
}

/** Keeps a crashing screen from taking down the whole app. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Screen crashed', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      const chunkError = /dynamically imported module|Loading chunk|Importing a module script failed/i.test(this.state.error.message)
      return (
        <div className="flex flex-col items-start gap-3">
          <Alert tone="error" title={chunkError ? 'This screen could not be loaded' : 'Something went wrong'}>
            {chunkError
              ? 'You might be offline, or the app was just updated. Try again.'
              : this.state.error.message}
          </Alert>
          <Button variant="outline" onClick={() => (chunkError ? window.location.reload() : this.setState({ error: null }))}>
            {chunkError ? 'Reload' : 'Try again'}
          </Button>
        </div>
      )
    }
    return this.props.children
  }
}
