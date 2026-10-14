import { Component } from 'react'

export class AppErrorBoundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (!this.state.failed) return this.props.children
    return <main className="workspace-loading" role="alert" style={{ minHeight: '100dvh', display: 'grid', placeContent: 'center', padding: 24, gap: 16 }}>
      <h1>This page could not be displayed.</h1>
      <p>Your saved work is still available. Reload to get the latest version.</p>
      <button className="dark-button" onClick={() => window.location.reload()}>Reload page</button>
      <a href="/">Return to SolveNest</a>
    </main>
  }
}
