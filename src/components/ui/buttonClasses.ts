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
