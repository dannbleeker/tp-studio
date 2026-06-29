import { type ReactNode, useEffect, useId } from 'react';
import { Button } from './Button';
import { Modal } from './Modal';

/**
 * In-app, theme-aware replacement for `window.confirm` — the **visible**
 * side of a confirm flow. Prop-driven and store-free: it renders a
 * prompt with two buttons and reports the user's choice through
 * `onConfirm` / `onCancel`. The async/promise plumbing that turns this
 * into a `confirm(): Promise<boolean>` lives in the app-layer host
 * (`ConfirmDialogHost`), not here.
 *
 * Why this is an **app-aware shell**, not a pure primitive (see
 * `ui/README.md`): it bakes in a fixed two-action confirm/cancel shape
 * + the "Confirm is the primary CTA, Enter activates it" semantics that
 * a generic dialog primitive (`Modal`) deliberately doesn't. Those
 * semantics are app behaviour, so the component stays a shell — but it
 * takes ALL of its state and callbacks as props, so it has zero store
 * coupling and is safe to vendor.
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
 *   - Cancel button + Esc + backdrop-click all invoke `onCancel`.
 */
export type ConfirmDialogProps = {
  /** Whether the dialog is visible. When false, renders nothing. */
  open: boolean;
  /** The prompt content (the message). Passed as children so callers
   *  can render rich content, not just a string. */
  children: ReactNode;
  /** Primary-CTA label. Defaults to `Confirm`. */
  confirmLabel?: string;
  /** Cancel-button label. Defaults to `Cancel`. */
  cancelLabel?: string;
  /** Fires when the user confirms (Confirm button). */
  onConfirm: () => void;
  /** Fires when the user cancels (Cancel button, Esc, or backdrop click). */
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  children,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();

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
    <Modal open={open} onDismiss={onCancel} labelledBy={titleId} widthClass="max-w-sm">
      <div className="flex flex-col gap-4 p-5">
        <p id={titleId} className="text-neutral-900 text-sm dark:text-neutral-100">
          {children}
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant="primary" onClick={onConfirm} data-confirm-primary="true">
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
