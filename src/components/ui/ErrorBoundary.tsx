import { AlertTriangle } from 'lucide-react';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from './Button';

type Props = { children: ReactNode };
type State = { error: Error | null };

/**
 * Catches render-time errors anywhere below it and shows a recovery card.
 * The active document is autosaved on every mutation, so the user can refresh
 * without losing work. We keep the displayed error message terse — the full
 * stack is logged to the console for whoever's debugging.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error('TP Studio render error:', error, info);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex h-screen w-screen items-center justify-center bg-neutral-50 px-6 dark:bg-neutral-950">
        <div className="max-w-md rounded-xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <AlertTriangle className="h-5 w-5" />
            <h1 className="text-sm font-semibold">Something went wrong</h1>
          </div>
          <p className="mt-3 text-sm text-neutral-700 dark:text-neutral-200">
            Your document is autosaved — reloading should bring it back intact.
          </p>
          {error.message && (
            <pre className="mt-3 overflow-x-auto rounded-md bg-neutral-100 px-3 py-2 font-mono text-[11px] text-neutral-700 dark:bg-neutral-950 dark:text-neutral-300">
              {error.message}
            </pre>
          )}
          <div className="mt-4 flex gap-2">
            <Button variant="primary" onClick={this.handleReload}>
              Reload
            </Button>
            <Button variant="ghost" onClick={this.handleReset}>
              Try again
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
