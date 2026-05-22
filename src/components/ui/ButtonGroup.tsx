import clsx from 'clsx';
import {
  SELECTED_BUTTON_CLASS,
  SELECTED_BUTTON_CLASS_PLAIN,
  TOGGLE_BUTTON_BASE,
  UNSELECTED_BUTTON_CLASS,
  UNSELECTED_BUTTON_CLASS_PLAIN,
} from './buttonClasses';

/**
 * Session 135 (design audit #4 + #17) — single-select toggle-button
 * grid. Six near-identical implementations had drifted across the
 * inspectors (Type / TitleSize / Locus / State pickers, EdgeInspector
 * Polarity, MultiInspector convert-all), each re-coding the same
 * `grid` + per-button `clsx(layout, selected ? … : …)`. This bakes the
 * shared shape (`TOGGLE_BUTTON_BASE`) + colour pair so each call site
 * shrinks to a declarative `options` array.
 *
 * Accessibility: render inside a `<Field as="group">` (which supplies
 * the `<fieldset><legend>` naming the group). Each option is a
 * `<button aria-pressed>` — the pressed state is what a screen reader
 * announces for a single-select toggle row.
 *
 * Variants:
 *   - `'default'` — the option's own label text carries the colour
 *     (uses SELECTED/UNSELECTED_BUTTON_CLASS). Centered label.
 *   - `'plain'` — an inner element (a colour stripe) owns the text
 *     colour, so the button uses the `_PLAIN` colour pair and lays the
 *     label out left-aligned next to the stripe. Used by the
 *     entity-type pickers.
 */
export type ButtonGroupOption<T extends string> = {
  id: T;
  label: string;
  /** `'plain'`-variant stripe colour (entity-type pickers). When set,
   *  the button renders the swatch + a left-aligned truncated label. */
  stripe?: string;
  /** Native `title` tooltip (e.g. Polarity hints). */
  hint?: string;
};

export function ButtonGroup<T extends string>({
  options,
  value,
  onChange,
  columns = 3,
  disabled = false,
  variant = 'default',
  ariaLabel,
}: {
  options: readonly ButtonGroupOption<T>[];
  /** The selected id, or `null`/`undefined` when nothing is selected. */
  value: T | null | undefined;
  onChange: (id: T) => void;
  columns?: 2 | 3 | 4;
  disabled?: boolean;
  variant?: 'default' | 'plain';
  /** Optional group label when not already wrapped by a `<Field>`. */
  ariaLabel?: string;
}) {
  const colClass = columns === 2 ? 'grid-cols-2' : columns === 4 ? 'grid-cols-4' : 'grid-cols-3';
  return (
    // biome-ignore lint/a11y/useSemanticElements: this is a single-select toggle row, not a radiogroup of native radios; aria-pressed buttons are the intended pattern and the naming comes from the wrapping <Field as="group"> fieldset/legend.
    <div className={clsx('grid gap-1.5', colClass)} role="group" aria-label={ariaLabel}>
      {options.map((opt) => {
        const selected = value === opt.id;
        const colour =
          variant === 'plain'
            ? selected
              ? SELECTED_BUTTON_CLASS_PLAIN
              : UNSELECTED_BUTTON_CLASS_PLAIN
            : selected
              ? SELECTED_BUTTON_CLASS
              : UNSELECTED_BUTTON_CLASS;
        return (
          <button
            key={opt.id}
            type="button"
            disabled={disabled}
            aria-pressed={selected}
            title={opt.hint}
            onClick={() => onChange(opt.id)}
            className={clsx(
              TOGGLE_BUTTON_BASE,
              opt.stripe ? 'flex items-center gap-2 text-left' : 'text-center',
              colour
            )}
          >
            {opt.stripe && (
              <span
                className="h-3 w-1 shrink-0 rounded-sm"
                style={{ backgroundColor: opt.stripe }}
                aria-hidden
              />
            )}
            <span className={clsx(opt.stripe && 'truncate text-neutral-700 dark:text-neutral-200')}>
              {opt.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
