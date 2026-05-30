import { useStore as useRFStore } from '@xyflow/react';
import clsx from 'clsx';
import { X } from 'lucide-react';
import { type CSSProperties, useEffect, useMemo, useState } from 'react';
import { iconForCommandId } from '@/components/command-palette/commandIcons';
import { runVerbCommand } from '@/components/command-palette/verbCommandRuns';
/**
 * Session 95 — Selection-anchored floating toolbar.
 *
 * Renders 3-5 verbs above the bounding rect of the current selection.
 * The verbs come from `verbsForBranch()` so the toolbar and
 * ContextMenu share a single source of truth (and a future selection-
 * aware palette filter can join them).
 *
 * Visibility rules (all checked every render — cheap, the inputs are
 * primitives shared via `useShallow`):
 *   - Settings → `showSelectionToolbar` must be true
 *   - A selection must produce a non-`none` branch
 *   - No modal / palette / context-menu can be open
 *   - The user must not be editing an entity title (which would
 *     compete with the toolbar for focus)
 *   - The pane / a node must not be mid-drag (would jitter)
 *   - `getSelectionViewportRect()` must return a real rect
 *
 * Positioning:
 *   - Anchored above the selection bbox, centered horizontally on it.
 *   - 10 px gap so the toolbar doesn't touch the selected element's
 *     outline.
 *   - Clamped to viewport so it never renders off-screen — if the
 *     selection is near the top, the toolbar flips below it.
 *
 * The bbox lives in CSS viewport coordinates (resolved by
 * `getSelectionViewportRect()`), so the toolbar uses `position: fixed`
 * relative to the viewport rather than an `absolute` anchored to a
 * canvas wrapper. This keeps the math independent of any future
 * canvas-chrome restructuring.
 */
import { DataComponent } from '@/components/dataComponentNames';
import { CARD_FOCUS } from '@/components/ui/focusClasses';
import { branchFor, type Verb, verbsForBranch } from '@/domain/selectionVerbs';
import { paletteKbdForCommand } from '@/domain/shortcuts';
import { Z } from '@/domain/zLayers';
import { useCanvasInteractionState } from '@/hooks/useCanvasInteractionState';
import { getSelectionViewportRect } from '@/services/canvasRef';
import { useDocumentStore } from '@/store';
import { currentDoc } from '@/store/selectors';
import { computeToolbarPlacement } from './selectionToolbarPlacement';

// Geometry constants. All pixels. Passed to `computeToolbarPlacement`
// each render; the pure function in `selectionToolbarPlacement.ts`
// has direct unit tests.
const GAP_PX = 10; // gap between selection bbox edge and toolbar
// Session 137 — Option B beef-up. The chip row now wraps to a second
// line when the verb count exceeds what fits at `ESTIMATED_WIDTH_PX`.
// The placement math accepts `estimatedHeight` per-render so we can
// pass `ESTIMATED_HEIGHT_PX * rowCount` and the anchor still clears
// the selection rect.
const ESTIMATED_ROW_HEIGHT_PX = 36; // single chip row height
const CHIPS_PER_ROW = 6; // verb count that fits on one row at ~480 px
const ESTIMATED_WIDTH_PX = 480; // chip row width (~6 verbs); used for horizontal clamp
const VIEWPORT_MARGIN_PX = 8; // minimum distance from viewport edges
// Session 137 — discoverability tip sub-row. ~22 px tall (10 px text
// + vertical padding + the 1 px separator border). Added to the
// estimated height when the tip is visible so the placement math
// reserves room above the selection.
const TIP_ROW_HEIGHT_PX = 22;

/**
 * Resolve a verb's onClick handler. Palette-backed verbs go through the
 * canonical command handler (with its Browse-Lock guard etc.) — resolved
 * synchronously via the light `runVerbCommand` registry (Perf #35) so the
 * eager toolbar no longer imports the whole command catalogue.
 * Registry-only verbs use their inline `run`.
 */
const dispatchVerb = (verb: Verb): void => {
  const state = useDocumentStore.getState();
  if (verb.paletteCommandId) {
    runVerbCommand(verb.paletteCommandId, state);
    return;
  }
  if (verb.run) void verb.run(state);
};

export function SelectionToolbar() {
  // Subscriptions. Visibility-affecting selectors return primitives so
  // each is shallow-equal-stable.
  const showSelectionToolbar = useDocumentStore((s) => s.showSelectionToolbar);
  // Session 137 — discoverability tip. Mirrors `emptyStateTipDismissed`
  // / `FirstEntityTip` — a single boolean + a setter, persisted to
  // localStorage. The tip auto-dismisses on the first verb click;
  // X-button click flips it explicitly without firing a verb.
  const tipDismissed = useDocumentStore((s) => s.selectionToolbarTipDismissed);
  const dismissTip = useDocumentStore((s) => s.dismissSelectionToolbarTip);
  const selection = useDocumentStore((s) => s.selection);
  // Edge presence — when the selection mode changes we want to
  // re-compute the verb list. The actual selection IDs are inside
  // `selection`; this re-subscribes us on edge-graph mutations so the
  // conditional ungroup-* verbs flip in lockstep.
  const edges = useDocumentStore((s) => currentDoc(s).edges);
  // Session 96 — re-subscribe on diagramType so the per-diagram
  // verbs (Mark as UDE / Mark as rootCause for CRT; Add NC + Promote
  // to Goal for Goal Tree) flip when the user loads a different
  // diagram type via Import / New / Load example.
  const diagramType = useDocumentStore((s) => currentDoc(s).diagramType);
  // Session 96 — re-subscribe on Browse Lock so write-verbs hide
  // the moment the user toggles the lock on.
  const browseLocked = useDocumentStore((s) => s.browseLocked);
  const interaction = useCanvasInteractionState();

  // React Flow's transform — we want to re-position the toolbar
  // whenever the user pans or zooms, since the selection's screen
  // position moves underneath us. The transform is `[x, y, zoom]`.
  // Subscribing here triggers a re-render on every pan tick, but
  // `useRFStore` is shallow-equal so changes only land when something
  // moved; React batches the work cheaply.
  const transform = useRFStore((s) => s.transform);

  // Local positioned rect for the toolbar — null when hidden.
  const [rect, setRect] = useState<DOMRect | null>(null);

  // Derive the registry branch + verbs from the current selection.
  // `branchFor` is pure; the IDs collapsed via useShallow above
  // mean the branch reference only changes when selection actually
  // changes shape.
  const branch = useMemo(() => branchFor(selection), [selection]);
  // verbsForBranch reads edges + doc.diagramType + entity.type for
  // conditional checks. Reading `useDocumentStore.getState()` here
  // gives us the live state at render time without an additional
  // subscription. The `edges` / `diagramType` deps retrigger the
  // recompute when those change — biome can't see they're used
  // transitively through getState().
  // biome-ignore lint/correctness/useExhaustiveDependencies: edges + diagramType retrigger the verb recompute via getState()
  const verbsBeforeLockFilter = useMemo(
    () => verbsForBranch(branch, useDocumentStore.getState()),
    [branch, edges, diagramType]
  );
  // Session 96 — when Browse Lock is on, hide write-verbs (which
  // would just produce the standard "Browse Lock is on" toast on
  // click). Read-only verbs (none today, but a future "Show in
  // inspector" would qualify) stay visible. We hide rather than
  // grey-out: a chip with zero clickable actions reads as broken;
  // an empty toolbar reads as "nothing applicable right now."
  const verbs = useMemo(
    () => (browseLocked ? verbsBeforeLockFilter.filter((v) => !v.writes) : verbsBeforeLockFilter),
    [browseLocked, verbsBeforeLockFilter]
  );

  // Recompute the anchor rect on every relevant change: selection
  // shape, viewport transform, or any interaction state that might
  // hide the bar. `transform` doesn't appear in the body but its
  // change is the trigger to re-read the rect — the rect math itself
  // happens inside `getSelectionViewportRect()` which reads the live
  // React Flow instance, not the captured `transform` value.
  // biome-ignore lint/correctness/useExhaustiveDependencies: transform is a re-run trigger, not a dep used in the body
  useEffect(() => {
    if (!showSelectionToolbar) {
      setRect(null);
      return;
    }
    if (branch.kind === 'none' || branch.kind === 'pane') {
      setRect(null);
      return;
    }
    if (verbs.length === 0) {
      setRect(null);
      return;
    }
    if (
      interaction.isEditing ||
      interaction.isPaletteOpen ||
      interaction.isModalOpen ||
      interaction.isDragging
    ) {
      setRect(null);
      return;
    }
    // React Flow renders the new selection state on a microtask; defer
    // the rect read by a frame so we read against the post-render DOM
    // rather than the pre-render one. Single rAF is enough — we don't
    // need the double-rAF dance used by export.
    let cancelled = false;
    const id = window.requestAnimationFrame(() => {
      if (cancelled) return;
      setRect(getSelectionViewportRect());
    });
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(id);
    };
  }, [
    showSelectionToolbar,
    branch,
    verbs.length,
    interaction.isEditing,
    interaction.isPaletteOpen,
    interaction.isModalOpen,
    interaction.isDragging,
    transform,
  ]);

  if (!rect) return null;
  if (verbs.length === 0) return null;

  // Session 137 — multi-row chip layout. Verb-heavy branches (CRT
  // single-entity hits 7+ verbs; multi-edge AND/OR/XOR + ungroups
  // hit 7) wrap to a second row rather than truncating. The
  // placement math gets the actual row count so the anchor still
  // clears the selection rect. The discoverability tip adds one
  // extra row of fixed height when visible.
  const rowCount = Math.max(1, Math.ceil(verbs.length / CHIPS_PER_ROW));
  const tipVisible = !tipDismissed;
  const estimatedHeight =
    ESTIMATED_ROW_HEIGHT_PX * rowCount +
    (rowCount - 1) * 4 + // 4 px gap between chip rows
    (tipVisible ? TIP_ROW_HEIGHT_PX : 0);

  // Compute placement via the extracted pure function. The math
  // (anchor above / flip below near top / horizontal clamp) is
  // unit-tested in `selectionToolbarPlacement.test.ts`.
  const placement = computeToolbarPlacement({
    selectionRect: rect,
    viewport: {
      width: typeof window === 'undefined' ? 1024 : window.innerWidth,
      height: typeof window === 'undefined' ? 768 : window.innerHeight,
    },
    estimatedHeight,
    estimatedWidth: ESTIMATED_WIDTH_PX,
    gap: GAP_PX,
    viewportMargin: VIEWPORT_MARGIN_PX,
  });

  const style: CSSProperties = {
    position: 'fixed',
    top: `${placement.top}px`,
    left: `${placement.left}px`,
    transform: 'translateX(-50%)',
    // Session 137 — sits *above* the Inspector aside (`Z.aside`, also a
    // right-side surface) so a selection on the right of the canvas doesn't
    // get its toolbar silently covered; still below the header chrome
    // (`z-30`). Centralised as `Z.toolbar` (Session 138) so this z-order is
    // greppable from `zLayers.ts` rather than a bare inline number.
    zIndex: Z.toolbar,
  };

  return (
    <div
      data-component={DataComponent.SelectionToolbar}
      role="toolbar"
      aria-label="Selection actions"
      // pointer-events-auto on the chip row but `none` on the wrapper
      // would be cleaner; the wrapper itself doesn't intercept anything
      // since its only child is the visible chip row.
      //
      // Session 137 — outer wrapper now uses `flex-col` so the chip row
      // and the optional discoverability tip stack vertically. The
      // chip row itself still uses `flex-wrap` for verb-heavy
      // branches; `max-w-[480px]` matches `ESTIMATED_WIDTH_PX` so the
      // placement math and the actual width stay in lockstep.
      className="pointer-events-auto flex max-w-[480px] flex-col gap-y-1 rounded-lg border border-neutral-200 bg-white px-1.5 py-1 shadow-lg dark:border-neutral-800 dark:bg-neutral-900"
      style={style}
    >
      <div className="flex flex-wrap items-center gap-x-1 gap-y-1">
        {verbs.map((verb) => {
          const Icon = verb.icon ?? iconForCommandId(verb.id);
          const kbd = verb.paletteCommandId
            ? paletteKbdForCommand(verb.paletteCommandId)
            : paletteKbdForCommand(verb.id);
          const display = verb.shortLabel ?? verb.label;
          const tooltip = kbd ? `${verb.label}  (${kbd})` : verb.label;
          return (
            <button
              key={verb.id}
              type="button"
              onClick={() => {
                dispatchVerb(verb);
                // Session 137 — first verb click counts as discovery;
                // dismiss the tip permanently. The action is idempotent
                // so repeated clicks coalesce.
                if (tipVisible) dismissTip();
              }}
              title={tooltip}
              aria-label={verb.label}
              className={clsx(
                'inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium text-xs transition',
                CARD_FOCUS,
                verb.destructive
                  ? 'text-rose-700 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/40'
                  : 'text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800'
              )}
            >
              {Icon ? <Icon className="h-3 w-3" aria-hidden /> : null}
              {/* Design audit #23 — guard the empty span so a verb with
                  no label doesn't leave a stray gap-1 slot beside the icon. */}
              {display && <span>{display}</span>}
            </button>
          );
        })}
      </div>
      {/* Session 137 — Option B discoverability hint. One subtle line
          under the chip row pointing users at the right-click menu
          (which still carries the dynamic / less-common items —
          Convert-to-X, Pin/Unpin, Spawn EC, NBR, etc). Dismissed
          permanently on first verb click or on the X. Mirrors the
          first-entity tip's dismiss pattern. */}
      {tipVisible && (
        <div
          data-component="selection-toolbar-tip"
          className="flex items-center justify-between gap-2 border-neutral-100 border-t px-1 pt-1 text-[10px] text-neutral-500 dark:border-neutral-800 dark:text-neutral-400"
        >
          <span>Right-click for more actions</span>
          <button
            type="button"
            onClick={dismissTip}
            className="-mr-0.5 rounded-sm p-0.5 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
            aria-label="Dismiss tip"
          >
            <X className="h-2.5 w-2.5" aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}
