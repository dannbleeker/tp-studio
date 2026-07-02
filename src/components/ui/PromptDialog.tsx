import { type FormEvent, useEffect, useId, useRef, useState } from 'react';
import { Button } from './Button';
import { Modal } from './Modal';

/**
 * In-app, theme-aware replacement for `window.prompt` — the **visible** side of
 * a text-prompt flow. Prop-driven and store-free (sibling of `ConfirmDialog`):
 * it renders a message + single-line input and reports the result through
 * `onSubmit(value)` / `onCancel`. The async/promise plumbing that turns this
 * into `prompt(): Promise<string | null>` lives in `PromptDialogHost`.
 *
 * Why not `window.prompt`: it blocks the JS thread, ignores the app theme, and
 * some PWA/WebView embedders reject native prompts outright.
 *
 * Behavior: the input auto-focuses + selects its seeded value on open; Enter
 * submits (it's inside a `<form>`); Cancel / Esc / backdrop-click cancel.
 */
export type PromptDialogProps = {
  open: boolean;
  message: string;
  defaultValue?: string;
  placeholder?: string;
  /** Primary-CTA label. Defaults to `OK`. */
  confirmLabel?: string;
  /** Fires with the current input value when the user submits. */
  onSubmit: (value: string) => void;
  /** Fires on Cancel, Esc, or backdrop click. */
  onCancel: () => void;
};

export function PromptDialog({
  open,
  message,
  defaultValue = '',
  placeholder,
  confirmLabel = 'OK',
  onSubmit,
  onCancel,
}: PromptDialogProps) {
  const titleId = useId();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [value, setValue] = useState(defaultValue);

  // Re-seed the field + focus/select it whenever the dialog (re)opens.
  useEffect(() => {
    if (!open) return;
    setValue(defaultValue);
    const t = setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
    return () => clearTimeout(t);
  }, [open, defaultValue]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit(value);
  };

  return (
    <Modal open={open} onDismiss={onCancel} labelledBy={titleId} widthClass="max-w-sm">
      <form onSubmit={submit} className="flex flex-col gap-4 p-5">
        <label
          id={titleId}
          htmlFor={inputId}
          className="text-neutral-900 text-sm dark:text-neutral-100"
        >
          {message}
        </label>
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          value={value}
          placeholder={placeholder}
          onChange={(e) => setValue(e.target.value)}
          className="w-full rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-neutral-900 text-sm outline-hidden focus:border-accent-400 focus:ring-1 focus:ring-accent-400 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100"
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" type="button" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" type="submit">
            {confirmLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
