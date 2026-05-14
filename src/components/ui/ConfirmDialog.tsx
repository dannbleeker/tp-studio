import { useDocumentStore } from '@/store';
import { useEffect, useId } from 'react';
import { Button } from './Button';
import { Modal } from './Modal';

/**
 * In-app replacement for `window.confirm`. The store exposes a
 * `confirm(message)` action that returns a `Promise<boolean>` — this
 * component is the visible side: it renders the prompt when the store
 * has an open `confirmDialog` and resolves the promise on Confirm or
 * Cancel.
 *
 * Why not `window.confirm`:
 *   - Blocks the JS thread; animations and other UI freeze.
 *   - Doesn't match the app's theme / dark mode.
 *   - Some embedders (iOS Safari in PWA mode, certain WebViews) reject
 *     native confirms entirely, leaving destructive actions unreachable.
 *
 * Behavior:
 *   - Confirm button is the primary CTA; Enter activates it (default
 *     focus on mount).
 *   - Cancel button + Esc + backdrop-click all resolve `false`.
 *   - Mounted at the App root next to the other dialogs.
 */
export function ConfirmDialog() {
  const confirmDialog = useDocumentStore((s) => s.confirmDialog);
  const resolveConfirm = useDocumentStore((s) => s.resolveConfirm);
  const titleId = useId();

  const open = confirmDialog !== null;
  const message = confirmDialog?.message ?? '';
  const confirmLabel = confirmDialog?.confirmLabel ?? 'Confirm';
  const cancelLabel = confirmDialog?.cancelLabel ?? 'Cancel';

  // Auto-focus the primary CTA when the dialog appears so Enter
  // activates Confirm — matches `window.confirm`'s default focus.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      const btn = document.querySelector<HTMLButtonElement>('[data-confirm-primary="true"]');
      btn?.focus();
    }, 0);
    return () => clearTimeout(t);
  }, [open]);

  return (
    <Modal
      open={open}
      onDismiss={() => resolveConfirm(false)}
      labelledBy={titleId}
      widthClass="max-w-sm"
    >
      <div className="flex flex-col gap-4 p-5">
        <p id={titleId} className="text-neutral-900 text-sm dark:text-neutral-100">
          {message}
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => resolveConfirm(false)}>
            {cancelLabel}
          </Button>
          <Button
            variant="primary"
            onClick={() => resolveConfirm(true)}
            data-confirm-primary="true"
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
