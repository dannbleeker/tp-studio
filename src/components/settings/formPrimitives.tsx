import clsx from 'clsx';
import type { ReactNode } from 'react';

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
