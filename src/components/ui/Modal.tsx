import clsx from 'clsx';
import { type ReactNode, useRef } from 'react';
import { useOutsideAndEscape } from '../../hooks/useOutsideAndEscape';

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
      aria-hidden="true"
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
