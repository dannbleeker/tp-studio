/**
 * Z-index contract for TP Studio.
 *
 * The app's overlay surface is layered into a handful of tiers. This module
 * is the single place that documents what lives at each tier and assigns a
 * numeric value. Most consumers use Tailwind's `z-10` / `z-20` / `z-40` /
 * `z-50` classes which match these tiers — the value is here so that
 * code-search lands somewhere with an explanation, and any future consumer
 * that needs an explicit z-index in JS / inline style imports from here
 * instead of inventing a fresh number.
 *
 * Tier ladder (low → high):
 *
 *   `Z.below`     (-1)  — React Flow nodes that should render behind sibling
 *                        nodes. Used for group rectangles so members paint
 *                        on top.
 *   `Z.canvas`     (0)  — Default for entity nodes / edges (React Flow
 *                        decides internally; do not override).
 *   `Z.controls`   (5)  — React Flow's `<Controls>` and `<MiniMap>`.
 *                        Visible at all times; sit just above the canvas.
 *   `Z.chrome`    (10)  — Top-left title region, top-right TopBar, breadcrumb,
 *                        bottom-center FirstEntityTip + ZoomPercent. Always
 *                        visible app chrome that lives outside the canvas
 *                        but inside the viewport.
 *   `Z.aside`     (20)  — Inspector (right slide-in) and SearchPanel (top
 *                        slide-down). Cover the canvas, never cover modals.
 *   `Z.menu`      (40)  — ContextMenu (right-click). Tracks the cursor;
 *                        floats above asides but below modals.
 *   `Z.toast`     (40)  — Toaster. Same tier as the context menu because
 *                        they never collide geometrically (bottom-center vs
 *                        cursor-anchored). Sits BELOW modals — toasts that
 *                        fire while a modal is open are intentionally
 *                        obscured so the modal stays the focal point.
 *   `Z.modal`     (50)  — Modal dialogs (Help, Settings, DocumentInspector,
 *                        QuickCapture). Capture focus and click outside to
 *                        dismiss.
 *
 * **Rule of thumb**: a new overlay should fit into an existing tier rather
 * than introduce a fresh one. If you genuinely need an in-between value,
 * add it here with a docstring first.
 */
export const Z = {
  below: -1,
  canvas: 0,
  controls: 5,
  chrome: 10,
  aside: 20,
  menu: 40,
  toast: 40,
  modal: 50,
} as const;

export type ZTier = keyof typeof Z;

/**
 * Session 94 (Top-30 #18) — Y-axis offset reference table.
 *
 * The y-axis (top/bottom) is the OTHER stacking dimension. Inline
 * Tailwind classes like `top-4`, `top-14`, `bottom-20` are scattered
 * across the chrome components; this table documents what lives at
 * each vertical position so a future viewport-restructure can audit
 * in one place. The classes themselves stay inline (Tailwind tooling
 * has best support for literal class names) — this is a navigation
 * reference, not a runtime constants module.
 *
 * Top of viewport, descending:
 *
 *   `top-4`   (16 px)  — TitleBadge (top-left), TopBar (top-right).
 *                        Primary app chrome. Always visible.
 *   `top-12`  (48 px)  — Multi-doc tab bar was here in the cancelled
 *                        FL-EX8 preview; currently unused. Reserved
 *                        for a future "second row" of chrome.
 *   `top-14`  (56 px)  — CreationWizardPanel default (`top-14 left-4`).
 *                        Also CompareBanner (when in diff-mode).
 *                        Injection chip on EC canvas.
 *
 * Bottom of viewport, ascending:
 *
 *   `bottom-2` (8 px)   — React Flow `<Controls>` + `<MiniMap>` at
 *                        bottom-left (React Flow's own positioning).
 *   `bottom-20` (80 px) — Toaster (centered). Bumped from `bottom-6`
 *                        in Session 92 so wide toasts on narrow
 *                        viewports don't overlap the Controls stack.
 *   `bottom-24` (96 px) — FirstEntityTip. Sits above the Toaster's
 *                        usual zone since it shows on a new doc
 *                        where toasts are rare.
 *
 * Rule of thumb: prefer existing offsets. If a new overlay needs a
 * different y-position, update this table first.
 */
