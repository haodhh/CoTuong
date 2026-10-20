import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Changing this value clears the error (e.g. the current route). */
  resetKey?: string;
}

interface State {
  error: Error | null;
  resetKey?: string;
}

/**
 * Catches rendering errors so a bug shows a message with a way out instead of unmounting the
 * whole app (which leaves only the page background: the "gray screen").
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, resetKey: this.props.resetKey };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    // Navigating elsewhere gives the new page a fresh start.
    if (props.resetKey !== state.resetKey) return { error: null, resetKey: props.resetKey };
    return null;
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Lỗi giao diện:', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="card mx-auto max-w-xl text-center">
        <div className="text-4xl">⚠️</div>
        <div className="mt-2 text-lg font-bold">Đã có lỗi xảy ra</div>
        <p className="mt-1 text-sm text-muted">Trang này gặp lỗi khi hiển thị. Bạn có thể thử lại, hoặc tải lại trang.</p>
        <pre className="mt-3 max-h-32 overflow-auto rounded bg-black/30 p-2 text-left text-xs whitespace-pre-wrap text-stone-400">{String(error.message || error)}</pre>
        <div className="mt-4 flex justify-center gap-2">
          <button className="btn btn-primary" onClick={() => this.setState({ error: null })}>
            ↻ Thử lại
          </button>
          <button className="btn" onClick={() => window.location.reload()}>
            Tải lại trang
          </button>
        </div>
      </div>
    );
  }
}
