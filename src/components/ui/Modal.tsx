import { useOutsideAndEscape } from '@/hooks/useOutsideAndEscape';
import clsx from 'clsx';
import { type ReactNode, useRef } from 'react';

export type ModalProps = {
  open: boolean;
  onDismiss: () => void;
  children: ReactNode;
  /** Wrapper alignment within the viewport. Defaults to 'center'. */
  align?: 'center' | 'top';
  /** Tailwind class for the inner dialog's width. */
  widthClass?: string;
  /** Optional aria-labelledby id pointing to a label inside `children`. */
  labelledBy?: string;
};

/**
 * Shared modal shell: full-viewport backdrop, dismiss-on-outside-click,
 * dismiss-on-Escape, focus is left to the caller (so command palettes that
 * own an input can autofocus it themselves).
 *
 * The inner `<dialog open>` element gives us native aria-modal semantics
 * and satisfies Biome's a11y/useSemanticElements rule. We render manually
 * (no .showModal()) because we control visibility through React state.
 *
 * Session 93 — width-class convention reference (#38).
 *
 * Existing dialogs / picker surfaces use a tiered widthClass:
 *
 *   - `max-w-md` (~448 px) — confirm dialogs, narrow info dialogs
 *     (ConfirmDialog). Single column of text + 2 buttons fits.
 *   - `max-w-lg` (~512 px) — the **CommandPalette**. One input + a
 *     scrollable list of one-line rows.
 *   - `max-w-2xl` (~672 px) — the **HelpDialog** (keyboard shortcuts
 *     + gestures). Two-column grid of label + key.
 *   - Pickers / large dialogs that don't use `Modal`: DiagramType,
 *     Export, Templates, PrintPreview each render their own
 *     `<dialog>` at `w-[min(960px,94vw)]` (or similar) because
 *     they're card-grids that want viewport-clamping rather than
 *     a fixed max. Future consolidation: pull these into a
 *     `LargeDialog` shell with an explicit `size: 'card-grid'` prop.
 *
 * When adding a new modal: pick the smallest width that fits without
 * forcing horizontal scrolling, and pass it via `widthClass`.
 */
export function Modal({
  open,
  onDismiss,
  children,
  align = 'center',
  widthClass = 'max-w-md',
  labelledBy,
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  useOutsideAndEscape(dialogRef, onDismiss, open);

  if (!open) return null;

  return (
    <div
      className={clsx(
        'fixed inset-0 z-50 flex justify-center bg-neutral-900/30 px-4 backdrop-blur-sm',
        align === 'top' ? 'items-start pt-[15vh]' : 'items-center'
      )}
      // No `aria-hidden` on the backdrop — propagates to descendants and
      // hides the `<dialog>` inside it from the accessibility tree (and
      // from Playwright's `getByRole('dialog')`). `aria-modal="true"` on
      // the dialog itself is the right way to mark surrounding content
      // inert for assistive tech.
    >
      <dialog
        ref={dialogRef}
        open
        className={clsx(
          'w-full overflow-hidden rounded-xl border border-neutral-200 bg-white p-0 shadow-2xl dark:border-neutral-800 dark:bg-neutral-950',
          widthClass
        )}
        aria-modal="true"
        aria-labelledby={labelledBy}
      >
        {children}
      </dialog>
    </div>
  );
}
