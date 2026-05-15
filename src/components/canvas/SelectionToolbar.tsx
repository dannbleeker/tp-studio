import { iconForCommandId } from '@/components/command-palette/commandIcons';
import { COMMANDS } from '@/components/command-palette/commands';
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
import { type Verb, branchFor, verbsForBranch } from '@/domain/selectionVerbs';
import { paletteKbdForCommand } from '@/domain/shortcuts';
import { useCanvasInteractionState } from '@/hooks/useCanvasInteractionState';
import { getSelectionViewportRect } from '@/services/canvasRef';
import { useDocumentStore } from '@/store';
import { useStore as useRFStore } from '@xyflow/react';
import clsx from 'clsx';
import { type CSSProperties, useEffect, useMemo, useState } from 'react';

// Build the command-id → Command map once. The palette command
// catalogue is module-scoped; the map's references are stable.
const COMMANDS_BY_ID = new Map(COMMANDS.map((c) => [c.id, c]));

// Geometry constants. All pixels.
const GAP_PX = 10; // gap between selection bbox edge and toolbar
const ESTIMATED_HEIGHT_PX = 36; // chip row height; used for flip-below test
const VIEWPORT_MARGIN_PX = 8; // minimum distance from viewport edges

/**
 * Resolve a verb's onClick handler. Palette-backed verbs go through
 * `command.run(state)` so the canonical handler runs (with its
 * Browse-Lock guard etc.); registry-only verbs use their inline `run`.
 */
const dispatchVerb = (verb: Verb): void => {
  const state = useDocumentStore.getState();
  if (verb.paletteCommandId) {
    const cmd = COMMANDS_BY_ID.get(verb.paletteCommandId);
    if (cmd) {
      void cmd.run(state);
      return;
    }
  }
  if (verb.run) void verb.run(state);
};

export function SelectionToolbar() {
  // Subscriptions. Visibility-affecting selectors return primitives so
  // each is shallow-equal-stable.
  const showSelectionToolbar = useDocumentStore((s) => s.showSelectionToolbar);
  const selection = useDocumentStore((s) => s.selection);
  // Edge presence — when the selection mode changes we want to
  // re-compute the verb list. The actual selection IDs are inside
  // `selection`; this re-subscribes us on edge-graph mutations so the
  // conditional ungroup-* verbs flip in lockstep.
  const edges = useDocumentStore((s) => s.doc.edges);
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
  // verbsForBranch reads edges (for ungroup conditional checks) so it
  // must re-run whenever the edge graph changes. Reading
  // `useDocumentStore.getState()` here gives us the live state at
  // render time without an additional subscription.
  // biome-ignore lint/correctness/useExhaustiveDependencies: edges intentionally retriggers the verb recompute when group state changes
  const verbs = useMemo(() => verbsForBranch(branch, useDocumentStore.getState()), [branch, edges]);

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

  // Compute placement. Anchored above when there's room; flip below
  // when the selection sits near the top of the viewport. Centered
  // horizontally on the selection's center; clamped to viewport so
  // wide selections at viewport edges still render the toolbar in-view.
  const cx = rect.left + rect.width / 2;
  const wantTop = rect.top - ESTIMATED_HEIGHT_PX - GAP_PX;
  const flipBelow = wantTop < VIEWPORT_MARGIN_PX;
  const top = flipBelow ? rect.bottom + GAP_PX : wantTop;

  const style: CSSProperties = {
    position: 'fixed',
    top: `${top}px`,
    left: `${cx}px`,
    transform: 'translateX(-50%)',
    zIndex: 20,
  };

  return (
    <div
      data-component={DataComponent.SelectionToolbar}
      role="toolbar"
      aria-label="Selection actions"
      // pointer-events-auto on the chip row but `none` on the wrapper
      // would be cleaner; the wrapper itself doesn't intercept anything
      // since its only child is the visible chip row.
      className="pointer-events-auto flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-1.5 py-1 shadow-lg dark:border-neutral-800 dark:bg-neutral-900"
      style={style}
    >
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
            onClick={() => dispatchVerb(verb)}
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
            <span>{display}</span>
          </button>
        );
      })}
    </div>
  );
}
