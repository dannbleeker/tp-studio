import type { ReactNode } from 'react';
import { EYEBROW } from '../ui/textClasses';

/**
 * Labelled inspector field.
 *
 * Session 135 (design audit #1, #12) — `Field` now emits real
 * label semantics instead of a presentational `<span>`:
 *
 *   - **Default (`as="field"`)** wraps the control in a `<label>`.
 *     A `<label>` containing both its text and a single form control
 *     associates them implicitly (the first labelable descendant), so
 *     screen readers announce e.g. the Owner input as "Owner" with no
 *     hand-rolled `aria-label` and no id threading. Use for a Field
 *     whose body is ONE input / textarea / select.
 *   - **`as="group"`** renders `<fieldset><legend>` instead. Use for a
 *     Field whose body is a group of buttons (Type / State / Polarity
 *     pickers) — a `<label>` may only name one control, so wrapping a
 *     button row in one is invalid; a fieldset/legend is the correct
 *     grouping semantics.
 *
 * Label always renders in a `<span>` / `<legend>` (never a `<div>`),
 * fixing the finding-12 footgun where a ReactNode label silently
 * swapped the wrapper element.
 */
export function Field({
  label,
  children,
  as = 'field',
}: {
  label: ReactNode;
  children: ReactNode;
  /** `'field'` (default) = `<label>`-wrapped single control;
   *  `'group'` = `<fieldset><legend>` for a button group. */
  as?: 'field' | 'group';
}) {
  if (as === 'group') {
    return (
      <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
        <legend className={EYEBROW}>{label}</legend>
        {children}
      </fieldset>
    );
  }
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: the `field` variant's contract is "body is exactly one form control" — biome can't see the control through the opaque `children`, but the label associates with it implicitly at runtime. Fields without a single control use `as="group"`.
    <label className="flex flex-col gap-1.5">
      <span className={EYEBROW}>{label}</span>
      {children}
    </label>
  );
}
