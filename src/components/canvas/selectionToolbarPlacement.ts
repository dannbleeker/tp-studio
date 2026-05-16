/**
 * Session 97 — Pure placement math for the SelectionToolbar.
 *
 * Extracted out of `SelectionToolbar.tsx` so the anchor / flip /
 * clamp logic has direct unit tests instead of being verified
 * only indirectly through component renders. The toolbar pulls
 * the rect from React Flow at click time and feeds it here; the
 * result is the `top` and `left` (in CSS viewport pixels) plus a
 * `flipped` flag callers can use for arrow-direction visuals.
 *
 * Three concerns the math handles:
 *   1. **Anchor above by default** — the toolbar sits above the
 *      selection's bounding rect with a small gap, centered
 *      horizontally on the bbox center.
 *   2. **Flip below when near the viewport top** — if the
 *      computed `top` would clip out the viewport, render
 *      below the bbox instead.
 *   3. **Horizontal clamp** — the toolbar's centroid can't go
 *      off-screen left/right; clamp the `left` value to leave at
 *      least `viewportMargin` to either edge. (The actual
 *      toolbar uses `transform: translateX(-50%)` so the `left`
 *      value points at the toolbar's centroid; the clamp accounts
 *      for that by reasoning about half the estimated width.)
 *
 * The function is intentionally side-effect-free: no DOM reads,
 * no React. Pass in everything it needs; get back a plain record.
 */

export type ToolbarPlacementInput = {
  /** Bounding rect of the current selection, in CSS viewport
   *  coordinates. The toolbar centers on this rect horizontally
   *  and anchors to its top edge vertically. */
  selectionRect: { left: number; top: number; right: number; bottom: number };
  /** Current viewport size — used for the clamp + flip checks. */
  viewport: { width: number; height: number };
  /** Estimated height of the toolbar chip row. The toolbar
   *  doesn't measure its own DOM (would require an extra render
   *  cycle); a fixed estimate is good enough since the bar's
   *  height is invariant across selection kinds. */
  estimatedHeight: number;
  /** Estimated width of the toolbar chip row. Same rationale as
   *  `estimatedHeight` — used for the horizontal clamp. The
   *  toolbar can grow wider than this (verb list varies); the
   *  clamp prevents the *centroid* from going off-screen, which
   *  is the failure mode users notice. */
  estimatedWidth: number;
  /** Gap (px) between the selection rect edge and the toolbar. */
  gap: number;
  /** Minimum distance (px) the toolbar must stay from any
   *  viewport edge. Used by both the flip-below check (vertical)
   *  and the horizontal clamp. */
  viewportMargin: number;
};

export type ToolbarPlacement = {
  /** CSS `top` in viewport pixels. Pass into `style.top`. */
  top: number;
  /** CSS `left` in viewport pixels. The toolbar is rendered with
   *  `transform: translateX(-50%)` so this points at the
   *  toolbar's centroid, not its left edge. */
  left: number;
  /** True when the toolbar was flipped from "above selection" to
   *  "below selection" because of viewport top clearance. The
   *  caller can use this to flip an arrow / pointer direction
   *  on the toolbar's visual chrome. */
  flipped: boolean;
};

export const computeToolbarPlacement = (input: ToolbarPlacementInput): ToolbarPlacement => {
  const { selectionRect, viewport, estimatedHeight, estimatedWidth, gap, viewportMargin } = input;
  const cx = (selectionRect.left + selectionRect.right) / 2;

  // Vertical: try above first, flip below when the above-anchor
  // would clip out of the viewport's top margin.
  const wantTopAbove = selectionRect.top - estimatedHeight - gap;
  const flipped = wantTopAbove < viewportMargin;
  const top = flipped ? selectionRect.bottom + gap : wantTopAbove;

  // Horizontal clamp: the centroid must allow `estimatedWidth/2`
  // on each side without crossing the viewport edge minus the
  // margin. We treat this as "don't let the centroid go below
  // `halfWidth + margin` or above `viewport.width - halfWidth -
  // margin`." If the viewport is too narrow for the toolbar to
  // fit at all, we just center it — the toolbar will overflow,
  // but at least it'll be reachable by Tab.
  const halfWidth = estimatedWidth / 2;
  const minCenter = halfWidth + viewportMargin;
  const maxCenter = viewport.width - halfWidth - viewportMargin;
  const left =
    minCenter > maxCenter ? viewport.width / 2 : Math.max(minCenter, Math.min(maxCenter, cx));

  return { top, left, flipped };
};
