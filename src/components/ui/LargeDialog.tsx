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
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import clsx from 'clsx';
import { X } from 'lucide-react';
import { type ReactNode, useId, useRef } from 'react';
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
  const dialogRef = useRef<HTMLDivElement | null>(null);
  useFocusTrap(dialogRef, open);
  // Local Esc handler still fires even though Session 92's global
  // cascade also handles each picker's open flag. The two are
  // idempotent — local closes via prop, global closes via store action
  // — but keeping the local one means the dialog stays Esc-dismissable
  // if a host ever forgets to wire the cascade entry. Cheap.
  useEscapeKey(open, onClose);

  if (!open) return null;

  return (
    <dialog
      open
      className="fixed inset-0 z-50 m-0 flex h-screen max-h-screen w-screen max-w-none items-center justify-center bg-black/40 p-0"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={clsx(
          'flex max-h-[88vh] flex-col gap-4 rounded-lg border border-neutral-200 bg-white p-5 shadow-xl outline-none dark:border-neutral-800 dark:bg-neutral-950',
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
