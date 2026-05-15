import clsx from 'clsx';
import type { ChangeEventHandler, ReactNode } from 'react';
import { INPUT_FOCUS } from '../ui/focusClasses';

/**
 * Settings-dialog form primitives. Extracted from `SettingsDialog.tsx` so
 * the dialog file stays focused on which preference goes in which section,
 * and these visual primitives can be reused by other Settings-style
 * surfaces (e.g. `DocumentInspector`) without duplication.
 *
 * Each primitive is intentionally minimal — label + hint + control —
 * matching the existing Settings UX. Variants that need richer behaviour
 * (search-in-radio, slider with steps) can be added here as additional
 * components, not as one-off variations in the consumer file.
 */

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="font-semibold text-[10px] text-neutral-500 uppercase tracking-wider dark:text-neutral-400">
        {title}
      </h3>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

export function RadioGroup<T extends string>({
  name,
  value,
  onChange,
  options,
}: {
  name: string;
  value: T;
  onChange: (v: T) => void;
  options: readonly { id: T; label: string; hint?: string }[];
}) {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {options.map((opt) => {
        const selected = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={clsx(
              'flex flex-col items-start gap-0.5 rounded-md border px-2.5 py-1.5 text-left text-xs transition',
              selected
                ? 'border-indigo-400 bg-indigo-50 text-indigo-900 dark:border-indigo-500 dark:bg-indigo-950/40 dark:text-indigo-200'
                : 'border-neutral-200 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900'
            )}
            aria-pressed={selected}
            data-radio-name={name}
          >
            <span className="font-medium">{opt.label}</span>
            {opt.hint && (
              <span className="text-[10px] text-neutral-500 dark:text-neutral-400">{opt.hint}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * 0–100 slider used by the Layout section's Compactness control. Shares
 * the label/hint visual treatment with `Toggle` so the Settings rows read
 * consistently. The numeric label on the right (`{value}`) lets the user
 * see the exact slider position — useful because two different positions
 * can look identical at small compactness deltas.
 */
export function Slider({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-center justify-between">
        <span className="text-neutral-800 text-sm dark:text-neutral-200">{label}</span>
        <span className="font-mono text-[11px] text-neutral-500 dark:text-neutral-400">
          {value}
        </span>
      </span>
      {hint && <span className="text-[11px] text-neutral-500 dark:text-neutral-400">{hint}</span>}
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 h-1 w-full cursor-pointer appearance-none rounded-full bg-neutral-200 accent-indigo-500 dark:bg-neutral-800"
      />
    </label>
  );
}

export function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3">
      <span className="flex flex-col">
        <span className="text-neutral-800 text-sm dark:text-neutral-200">{label}</span>
        {hint && <span className="text-[11px] text-neutral-500 dark:text-neutral-400">{hint}</span>}
      </span>
      <input
        type="checkbox"
        className="mt-1 h-4 w-4 cursor-pointer accent-indigo-500"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

/**
 * Session 94 (Top-30 #5) — shared base classes for form fields.
 *
 * The same 60-char className string was duplicated across 12+ inspector
 * + history + print files. Pulled here so the input/textarea/select
 * elements use one source of truth for border / padding / focus-ring.
 * `INPUT_FOCUS` carries the focus styling (Session 93 #36 constant).
 *
 * Components that need a non-default shape (e.g. inline assumption
 * editor in TPNode) can still compose this with extra classes, but
 * the canonical shape is here.
 */
const FIELD_BASE =
  'w-full rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-neutral-900 text-sm disabled:opacity-60 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100';

export type TextInputProps = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Accept the raw `aria-label` when the field isn't visibly labelled
   *  by a sibling `<label>`. Inspectors that wrap with `<Field>` don't
   *  need to set this. */
  ariaLabel?: string;
  type?: 'text' | 'number' | 'search' | 'url' | 'email';
  /** Optional id — when the host `<label htmlFor>` references this. */
  id?: string;
};

export function TextInput({
  value,
  onChange,
  placeholder,
  disabled,
  className,
  ariaLabel,
  type = 'text',
  id,
}: TextInputProps) {
  return (
    <input
      id={id}
      type={type}
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value)}
      className={clsx(FIELD_BASE, INPUT_FOCUS, className)}
    />
  );
}

export type TextAreaProps = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
  id?: string;
  rows?: number;
  /** When true, vertical resize is allowed; otherwise the textarea
   *  is fixed at the row count. Defaults to false (matches inspector
   *  convention of letting the row count drive the height). */
  resizable?: boolean;
  /** Optional raw onChange (rare — most callers want the `string`
   *  variant). When supplied, replaces the default value-passing. */
  onChangeRaw?: ChangeEventHandler<HTMLTextAreaElement>;
};

export function TextArea({
  value,
  onChange,
  placeholder,
  disabled,
  className,
  ariaLabel,
  id,
  rows = 2,
  resizable = false,
  onChangeRaw,
}: TextAreaProps) {
  return (
    <textarea
      id={id}
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      aria-label={ariaLabel}
      rows={rows}
      onChange={onChangeRaw ?? ((e) => onChange(e.target.value))}
      className={clsx(FIELD_BASE, INPUT_FOCUS, resizable ? 'resize-y' : 'resize-none', className)}
    />
  );
}
