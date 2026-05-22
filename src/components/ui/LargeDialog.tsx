/**
 * Session 94 (refactor #1) — shared shell for the centered-card picker
 * dialogs (DiagramTypePicker / ExportPicker / TemplatePicker / PrintPreview).
 *
 * Each of those dialogs had grown its own copy of the same scaffolding:
 *   - raw `<dialog open>` with `fixed inset-0 z-50 ... bg-black/40` backdrop
 *   - inner `<div ref tabIndex={-1}>` carrying the card chrome + max width
 *   - `useFocusTrap(dialogRef, open)`
 *   - `useEscapeKey(open, close)`
 *   - header band with title + optional subtitle + close X button
 *
 * That's ~25 lines × 4 files = 100 lines of duplicated boilerplate. This
 * primitive absorbs it, leaving each dialog responsible only for its
 * own body content.
 *
 * Why this exists separately from `<Modal>`:
 *   - `Modal` is sized for short content (max-w-md / max-w-lg) and
 *     uses `useOutsideAndEscape` for click-outside dismissal.
 *   - The pickers are card-grids that want viewport-clamped widths
 *     like `w-[min(960px,94vw)]` and `max-h-[88vh]` with internal
 *     scrolling, plus an explicit close button (clicking outside the
 *     card grid shouldn't close — the cards are too easy to miss).
 *
 * SideBySideDialog stays out of this abstraction: it's a fullscreen
 * native `<dialog>` using `showModal()` for browser-built-in focus
 * management, structurally different from the centered cards.
 */

import clsx from 'clsx';
import { X } from 'lucide-react';
import { type ReactNode, useEffect, useId, useRef } from 'react';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { Button } from './Button';

export type LargeDialogProps = {
  /** Whether the dialog is open. When false, returns `null`. */
  open: boolean;
  /** Fires on Esc or on the close-X click. The host store-action
   *  typically sets the `*PickerOpen` flag to false. */
  onClose: () => void;
  /** Visible title in the header band. */
  title: string;
  /** Optional sub-line under the title; one short sentence at most. */
  subtitle?: string;
  /** aria-label for the close button. Defaults to `Close ${title}` —
   *  override when the title is too long or carries content that
   *  doesn't read well in an aria-label. */
  closeAriaLabel?: string;
  /** Tailwind width class applied to the card. Defaults to
   *  `w-[min(960px,94vw)]` (the card-grid pickers' canonical size).
   *  PrintPreview overrides to a narrower `w-[min(640px,92vw)]`. */
  widthClass?: string;
  /** Extra classes to merge onto the card root. Use sparingly —
   *  prefer the structural defaults. */
  cardClassName?: string;
  /** Body content. The shell renders the header band and a flex column
   *  scroll-container; place your form / card-grid / preview here. */
  children: ReactNode;
};

const DEFAULT_WIDTH = 'w-[min(960px,94vw)]';

export function LargeDialog({
  open,
  onClose,
  title,
  subtitle,
  closeAriaLabel,
  widthClass = DEFAULT_WIDTH,
  cardClassName,
  children,
}: LargeDialogProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  // Design audit #19 — open as a true modal via `showModal()` so the
  // browser provides the focus trap + page-behind `inert`-ness (the
  // page-root stays out of the tab order and AT navigation), replacing
  // the hand-rolled `useFocusTrap`. The component only mounts the
  // `<dialog>` while open, so this runs once on mount; the cleanup
  // closes it on unmount. The `showModal` feature-detect + `el.open`
  // fallback keeps the dialog visible under jsdom / very old browsers
  // where `showModal` isn't implemented (mirrors SideBySideDialog).
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    const supportsModal = typeof el.showModal === 'function';
    if (supportsModal) {
      if (!el.open) el.showModal();
    } else {
      // jsdom / very old browsers: `showModal` (and `close`) aren't
      // implemented — toggle the `open` attribute so the dialog stays
      // visible + queryable. Mirrors SideBySideDialog's guard.
      el.open = true;
    }
    return () => {
      if (supportsModal) {
        if (el.open) el.close();
      } else {
        el.open = false;
      }
    };
  }, []);
  // Esc handler — covers the non-modal fallback path (where the native
  // dialog doesn't respond to Esc) and the global Session-92 cascade.
  // In the modal path the browser also closes on Esc; the resulting
  // store update is idempotent.
  useEscapeKey(open, onClose);

  if (!open) return null;

  return (
    // No `open` attribute — the effect above calls `showModal()` (true
    // top-layer modal) instead, which throws if the element is already
    // open. Esc is handled by `useEscapeKey` (covers both the modal and
    // the jsdom non-modal fallback); the X button drives `onClose`.
    <dialog
      ref={dialogRef}
      className="fixed inset-0 z-50 m-0 flex h-screen max-h-screen w-screen max-w-none items-center justify-center bg-black/40 p-0"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        className={clsx(
          'flex max-h-[88vh] flex-col gap-4 rounded-lg border border-neutral-200 bg-white p-5 shadow-xl outline-hidden dark:border-neutral-800 dark:bg-neutral-950',
          widthClass,
          cardClassName
        )}
      >
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id={titleId} className="font-semibold text-base">
              {title}
            </h2>
            {subtitle && (
              <p className="text-neutral-500 text-xs dark:text-neutral-400">{subtitle}</p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label={closeAriaLabel ?? `Close ${title}`}
          >
            <X className="h-4 w-4" />
          </Button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
