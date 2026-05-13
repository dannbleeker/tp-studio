import { errorMessage } from '@/services/errors';
import { log } from '@/services/logger';
import { AlertTriangle } from 'lucide-react';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from './Button';

type Props = {
  children: ReactNode;
  /**
   * Optional label for nested boundaries — shown in the inline fallback
   * card so the user knows which sub-panel failed (e.g. "Inspector",
   * "Revision history") rather than seeing a full-screen "something
   * broke". When omitted the boundary renders its full-screen reload
   * card, which is the right mode for the root boundary in `App.tsx`.
   */
  label?: string;
  /**
   * Optional explicit fallback. Overrides both modes. Useful when a
   * sub-tree wants to render nothing (`fallback={null}`) so its absence
   * doesn't disturb the surrounding layout.
   */
  fallback?: ReactNode;
};
type State = { error: Error | null };

/**
 * Catches render-time errors anywhere below it and shows a recovery card.
 *
 * **Two modes:**
 *  - **Root** (no `label`): full-screen card with a Reload button. Used
 *    once at the App root so a crash anywhere produces a coherent
 *    recovery surface.
 *  - **Nested** (with `label`): inline card that fills the failed
 *    subtree's slot. Used around modular surfaces (Inspector,
 *    RevisionPanel, SettingsDialog, DocumentInspector) so one panel can
 *    crash without taking the canvas down.
 *
 * The active document is autosaved on every mutation, so the user can
 * refresh without losing work. We keep the displayed error message
 * terse — the full stack is logged to the console for whoever's
 * debugging.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    const where = this.props.label ? ` [${this.props.label}]` : '';
    // Use the shared `errorMessage` helper so non-Error throws still
    // produce a readable string in the log. The Error object itself
    // stays in the third arg so DevTools can expand its stack. Routed
    // through `log` (not `console`) so the message stays out of the
    // vitest output during expected-error tests.
    log.error(`TP Studio render error${where}: ${errorMessage(error)}`, error, info);
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
    if (this.props.fallback !== undefined) return this.props.fallback;

    // Nested-boundary path: inline card scoped to the failed sub-tree.
    if (this.props.label) {
      return (
        <div className="flex h-full w-full items-center justify-center p-4">
          <div className="max-w-md rounded-xl border border-red-200 bg-red-50 p-4 text-sm dark:border-red-900/40 dark:bg-red-950/40">
            <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
              <AlertTriangle className="h-4 w-4" />
              <span className="font-semibold">{this.props.label} failed to render</span>
            </div>
            {error.message && (
              <pre className="mt-2 overflow-x-auto rounded-md bg-white/70 px-2 py-1.5 font-mono text-[11px] text-neutral-700 dark:bg-neutral-950/60 dark:text-neutral-200">
                {error.message}
              </pre>
            )}
            <div className="mt-3 flex gap-2">
              <Button variant="ghost" onClick={this.handleReset}>
                Retry
              </Button>
            </div>
          </div>
        </div>
      );
    }

    // Root-boundary path: full-screen recovery card.
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
