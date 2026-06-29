/**
 * Session 135 — shared button-state className constants.
 *
 * The two strings below were inlined in 10+ places (EntityInspector
 * type/size buttons, MultiInspector, EdgeInspector polarity buttons,
 * PrintPreviewDialog mode picker, DocumentInspector diagram-type
 * buttons, `RadioGroup` in formPrimitives). Every callsite hand-coded
 * the same indigo / neutral
 * combo for selected vs unselected states; a single design-token
 * tweak (e.g. swapping the accent hue) required 10 manual edits.
 *
 * The constants below carry only the *state colours*. Layout
 * (`rounded-md`, `border`, `px-*`, `py-*`, `text-xs`) stays on each
 * call site because button densities differ — a type-picker chip and
 * a polarity radio have the same selected / unselected palette but
 * different paddings and corners.
 *
 * Use together with the layout classes via `clsx` or template
 * literal. Example:
 *
 * ```tsx
 * className={clsx(
 *   'flex items-center gap-2 rounded-md border px-2 py-1.5 text-left text-xs transition',
 *   selected ? SELECTED_BUTTON_CLASS : UNSELECTED_BUTTON_CLASS,
 * )}
 * ```
 *
 * Migration is incremental: callers that haven't been touched yet
 * still work, since the strings are byte-identical to the inlined
 * versions they replaced.
 */

export const SELECTED_BUTTON_CLASS =
  'border-accent-400 bg-accent-50 text-accent-900 dark:border-accent-500 dark:bg-accent-950/40 dark:text-accent-200';

export const UNSELECTED_BUTTON_CLASS =
  'border-neutral-200 text-neutral-700 hover:bg-neutral-50 dark:border-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-900';

/**
 * Session 135 — sister constants for buttons whose inner content
 * (icon, thumbnail, stripe) owns the text colour. Used by:
 *   - EntityInspector / MultiInspector type-picker buttons (an
 *     inner `<span>` carries the entity-label text in its own
 *     neutral colour)
 *   - PrintPreviewDialog mode picker (`<ModeThumbnail>` + an
 *     inner label span)
 *   - DocumentInspector diagram-type picker (icon + label span)
 *
 * Same border + background as the full versions; just no `text-…`
 * to avoid overriding the inner span's colour.
 */
export const SELECTED_BUTTON_CLASS_PLAIN =
  'border-accent-400 bg-accent-50 dark:border-accent-500 dark:bg-accent-950/40';

export const UNSELECTED_BUTTON_CLASS_PLAIN =
  'border-neutral-200 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900';

/**
 * Session 135 (design audit #4) — the shared *shape* of a toggle /
 * radio button, factoring out the third thing every picker hand-coded
 * alongside the colour constants above: `rounded-md border px-2 py-1.5
 * text-xs transition` + the disabled fade. Three paddings
 * (px-2 / px-2.5 / px-3) had drifted across the Type / TitleSize /
 * Locus / State / Polarity / mode pickers and `RadioGroup`. Compose
 * with one of the colour pairs:
 *
 * ```tsx
 * clsx(TOGGLE_BUTTON_BASE, selected ? SELECTED_BUTTON_CLASS : UNSELECTED_BUTTON_CLASS)
 * ```
 *
 * The `<ButtonGroup>` primitive bakes this in; raw call sites that
 * aren't worth converting can still use the constant directly.
 */
export const TOGGLE_BUTTON_BASE =
  'rounded-md border px-2 py-1.5 text-xs transition disabled:cursor-not-allowed disabled:opacity-60';
