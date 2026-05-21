import { useReactFlow } from '@xyflow/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useMemo } from 'react';
import { useShallow } from 'zustand/shallow';
import { isNonCausal } from '@/domain/graph';
import { useDocumentStore } from '@/store';

/**
 * Session 135 / spec gap #9 Phase 1C — Presentation-mode step-through
 * control.
 *
 * Surfaces only when `appMode === 'presentation'`. A small floating
 * chip at the bottom-centre of the canvas with Prev / Next buttons
 * and a `current / total` position label. Walks the doc's
 * causally-meaningful entities (`structuralEntities` — drops notes
 * and assumptions) in a stable order:
 *
 *   1. Explicit `ordering` (TT actions) first, ascending.
 *   2. Entities without `ordering` fall back to `annotationNumber`
 *      ascending, ordered AFTER the explicit-ordering entities.
 *
 * Selecting an entity:
 *   - Updates the store selection via `selectEntities([id])`.
 *   - Calls `fitView({ nodes: [{ id }], padding: 0.3 })` so the
 *     selected entity centres in the viewport. Padding keeps a
 *     comfortable margin so a single node doesn't render at 100%
 *     of the canvas.
 *
 * Keyboard:
 *   - `ArrowRight` / `ArrowLeft` — next / prev step. Bound to
 *     `window` only while Presentation is active so the handler
 *     doesn't leak into the other modes' arrow-key flows.
 *
 * Suppressed when there are no structural entities (an empty doc
 * has nothing to step through).
 */
export function PresentationStepThrough() {
  const isPresentation = useDocumentStore((s) => s.appMode === 'presentation');

  // Subscribe via `useShallow` so the chip re-renders only when the
  // ordered-id list or the current selection actually shifts.
  // Recomputing `orderedIds` per snapshot is cheap (one pass over
  // doc.entities), and the shallow comparison on the returned
  // record means snapshot churn that doesn't change ids / selection
  // is free.
  const { orderedIds, currentId } = useDocumentStore(
    useShallow((s) => {
      const list: { id: string; ordering: number | undefined; annotation: number }[] = [];
      for (const e of Object.values(s.doc.entities)) {
        // Drop assumptions + notes — they're conceptually outside
        // the causal walk and would be confusing to step through.
        if (isNonCausal(e)) continue;
        list.push({ id: e.id, ordering: e.ordering, annotation: e.annotationNumber });
      }
      // Sort: explicit-ordering first (ascending), then no-ordering
      // by annotation (ascending). Tie-break on annotation so two
      // entities with identical ordering still sort deterministically.
      list.sort((a, b) => {
        const aHas = typeof a.ordering === 'number';
        const bHas = typeof b.ordering === 'number';
        if (aHas && !bHas) return -1;
        if (!aHas && bHas) return 1;
        if (aHas && bHas) {
          const diff = (a.ordering as number) - (b.ordering as number);
          if (diff !== 0) return diff;
        }
        return a.annotation - b.annotation;
      });
      const sel = s.selection;
      const cur = sel.kind === 'entities' && sel.ids.length > 0 ? (sel.ids[0] as string) : null;
      return { orderedIds: list.map((x) => x.id), currentId: cur };
    })
  );
  const selectEntities = useDocumentStore((s) => s.selectEntities);
  const flow = useReactFlow();

  const currentIndex = useMemo(() => {
    if (!currentId) return -1;
    return orderedIds.indexOf(currentId);
  }, [orderedIds, currentId]);

  const focusEntity = useCallback(
    (id: string) => {
      selectEntities([id]);
      // `fitView` accepts a `nodes` array via React Flow's typed
      // options; the cast satisfies TS's narrower `FitViewOptions`
      // type without forcing us to import the full Node type just
      // for this one call.
      flow.fitView({
        nodes: [{ id }],
        padding: 0.3,
        duration: 250,
      } as Parameters<typeof flow.fitView>[0]);
    },
    [selectEntities, flow]
  );

  const goPrev = useCallback(() => {
    if (orderedIds.length === 0) return;
    // No selection → start at the LAST step (so first Prev press
    // lands on something visible rather than wrapping invisibly).
    const idx = currentIndex < 0 ? orderedIds.length - 1 : currentIndex - 1;
    if (idx < 0) return; // already at first; stop rather than wrap.
    const next = orderedIds[idx];
    if (next) focusEntity(next);
  }, [orderedIds, currentIndex, focusEntity]);

  const goNext = useCallback(() => {
    if (orderedIds.length === 0) return;
    const idx = currentIndex < 0 ? 0 : currentIndex + 1;
    if (idx >= orderedIds.length) return; // already at last; stop.
    const next = orderedIds[idx];
    if (next) focusEntity(next);
  }, [orderedIds, currentIndex, focusEntity]);

  // Keyboard bindings — only attach while presentation is active
  // so other modes' arrow-key flows aren't shadowed.
  useEffect(() => {
    if (!isPresentation) return;
    const onKey = (e: KeyboardEvent) => {
      // Ignore when typing into an input / textarea so a stray arrow
      // keystroke during text edit doesn't step through. (Presentation
      // engages Browse Lock, so there shouldn't be active text inputs
      // — defensive belt-and-braces.)
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        goNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goPrev();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isPresentation, goNext, goPrev]);

  if (!isPresentation || orderedIds.length === 0) return null;

  // Position label: "current / total" when something is selected,
  // "— / total" otherwise. Treat the "no selection" case as "before
  // step 1" rather than "step 0" — reads more naturally to a
  // first-time viewer.
  const positionLabel =
    currentIndex >= 0 ? `${currentIndex + 1} / ${orderedIds.length}` : `— / ${orderedIds.length}`;

  return (
    // `<fieldset>` + visually-hidden `<legend>` carries the accessible
    // group name without the div+role=group pattern biome's
    // `useSemanticElements` rule rejects. UA-default fieldset chrome
    // (border + padding) reset via the `m-0` token + border in the
    // className.
    <fieldset
      data-component="presentation-step-through"
      className="pointer-events-auto fixed bottom-6 left-1/2 z-20 m-0 flex -translate-x-1/2 items-center gap-1 rounded-full border border-neutral-200 bg-white/95 px-1.5 py-1 shadow-lg backdrop-blur-sm dark:border-neutral-800 dark:bg-neutral-900/95"
    >
      <legend className="sr-only">Presentation step-through</legend>
      <button
        type="button"
        onClick={goPrev}
        disabled={currentIndex <= 0}
        className="rounded-full p-1.5 text-neutral-600 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-neutral-300 dark:hover:bg-neutral-800"
        aria-label="Previous entity"
        title="Previous (←)"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span
        className="min-w-[3.5rem] text-center font-mono text-[11px] text-neutral-700 tabular-nums dark:text-neutral-200"
        aria-live="polite"
      >
        {positionLabel}
      </span>
      <button
        type="button"
        onClick={goNext}
        disabled={currentIndex >= orderedIds.length - 1}
        className="rounded-full p-1.5 text-neutral-600 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-neutral-300 dark:hover:bg-neutral-800"
        aria-label="Next entity"
        title="Next (→)"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </fieldset>
  );
}
