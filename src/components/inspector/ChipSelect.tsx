import clsx from 'clsx';

/**
 * Session 193 — a compact, colour-coded native `<select>` styled as a status
 * chip. Replaces the inspector's forward-only *cycle* chips (click to advance
 * one step) so any value is a single direct pick, while keeping the dense
 * per-row layout of the Assumption Well + Evidence list. Native `<select>`
 * means keyboard + screen-reader support come free — the same reasoning behind
 * the Edge-inspector re-wire dropdowns. The closed control keeps the
 * value's colour (`colorClass`); the option list uses browser chrome.
 */
export function ChipSelect<T extends string>({
  value,
  options,
  onChange,
  colorClass,
  disabled,
  ariaLabel,
  title,
}: {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  /** Tailwind colour classes for the current value (bg/border/text, light+dark). */
  colorClass: string;
  disabled?: boolean;
  ariaLabel: string;
  title?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      disabled={disabled}
      aria-label={ariaLabel}
      title={title}
      className={clsx(
        'shrink-0 cursor-pointer rounded-sm border py-0 pr-4 pl-1.5 font-semibold text-[10px] uppercase tracking-wide outline-hidden transition focus-visible:ring-2 focus-visible:ring-accent-400 disabled:cursor-not-allowed disabled:opacity-50',
        colorClass
      )}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
