/**
 * Session 135 — shared button-state className constants.
 *
 * The two strings below were inlined in 10+ places (EntityInspector
 * type/size buttons, MultiInspector, EdgeInspector polarity buttons,
 * PrintPreviewDialog mode picker, CustomEntityClassesSection icon
 * picker, DocumentInspector diagram-type buttons, `RadioGroup` in
 * formPrimitives). Every callsite hand-coded the same indigo / neutral
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
  'border-indigo-400 bg-indigo-50 text-indigo-900 dark:border-indigo-500 dark:bg-indigo-950/40 dark:text-indigo-200';

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
  'border-indigo-400 bg-indigo-50 dark:border-indigo-500 dark:bg-indigo-950/40';

export const UNSELECTED_BUTTON_CLASS_PLAIN =
  'border-neutral-200 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900';

/**
 * Session 135 — sister pair for icon-only buttons where the text
 * colour drives the icon's `currentColor` stroke. The default
 * `text-indigo-900` reads too bold for small (h-3.5 w-3.5) Lucide
 * glyphs — the lighter `text-indigo-700` matches the design intent
 * at icon-picker scale (CustomEntityClassesSection).
 *
 * Use these when the button's inner element is an icon, not a text
 * label.
 */
export const SELECTED_BUTTON_CLASS_ICON =
  'border-indigo-400 bg-indigo-50 text-indigo-700 dark:border-indigo-500 dark:bg-indigo-950 dark:text-indigo-200';

export const UNSELECTED_BUTTON_CLASS_ICON =
  'border-neutral-200 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800';
