import clsx from 'clsx';
import { useState } from 'react';
import { DIAGRAM_TYPE_LABEL } from '@/domain/entityTypeMeta';
import { PATTERNS } from '@/domain/patterns';
import type { DiagramType } from '@/domain/types';
import { getCanvasInstance } from '@/services/canvasRef';
import { useDocumentStore } from '@/store';
import { currentDoc } from '@/store/selectors';
import { CARD_FOCUS } from '../ui/focusClasses';
import { LargeDialog } from '../ui/LargeDialog';
import { undoRestoreAction } from '../ui/loadToast';

/**
 * Session 134 — pattern-library picker.
 *
 * Closes minor gap #4 (sub-item A) from the spec gap analysis:
 * "reusable domain templates". A growing library of curated starter
 * diagrams for common TOC scenarios. Distinct from the
 * DiagramTypePickerDialog (which loads one example per diagram type)
 * — this dialog lists every pattern in the registry, optionally
 * filtered to one diagram type via the chip row at the top.
 *
 * UX: cards arranged in a 2-3 column grid (matches the diagram
 * picker), each card carrying a diagram-type chip + pattern label +
 * one-line hint. Click → load with an undo toast (same pattern as
 * the diagram picker's "Load example" mode).
 *
 * The filter chip row supports "All" plus every diagram type that has
 * at least one pattern in the registry (computed from `PATTERNS` so
 * future additions auto-surface).
 */

// Diagram types that appear in the chip row, in the same operational
// flow order as the DiagramTypePickerDialog so the two pickers feel
// like the same family. Anything without patterns is filtered out at
// render time.
const FILTER_ORDER: DiagramType[] = ['crt', 'frt', 'prt', 'tt', 'ec', 'goalTree', 'st', 'freeform'];

const fitViewAfterLoad = (): void => {
  if (typeof window === 'undefined') return;
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      getCanvasInstance()?.fitView({ padding: 0.4, maxZoom: 1.2 });
    });
  });
};

export function PatternLibraryDialog() {
  const state = useDocumentStore((s) => s.patternLibraryOpen);
  const close = useDocumentStore((s) => s.closePatternLibrary);
  const setDocument = useDocumentStore((s) => s.setDocument);
  const openDocInTab = useDocumentStore((s) => s.openDocInTab);
  const showToast = useDocumentStore((s) => s.showToast);

  // Local filter state is seeded from the open-payload but the user
  // can change it after the dialog opens. Reset is implicit — the
  // initial state is captured on each open via `useState`.
  const [filter, setFilter] = useState<DiagramType | 'all'>(state?.filter ?? 'all');

  if (!state) return null;

  const available = new Set(PATTERNS.map((p) => p.diagramType));
  const chips = ['all' as const, ...FILTER_ORDER.filter((t) => available.has(t))];

  const visible = filter === 'all' ? PATTERNS : PATTERNS.filter((p) => p.diagramType === filter);

  const handlePick = (patternId: string): void => {
    const pattern = PATTERNS.find((p) => p.id === patternId);
    if (!pattern) return;
    const previousDoc = currentDoc(useDocumentStore.getState());
    const openedNewTab = openDocInTab(pattern.build());
    fitViewAfterLoad();
    showToast(
      'success',
      openedNewTab
        ? `Opened template "${pattern.label}" in a new tab.`
        : `Loaded template "${pattern.label}".`,
      undoRestoreAction(openedNewTab, previousDoc, setDocument)
    );
    close();
  };

  return (
    <LargeDialog
      open={true}
      onClose={close}
      title="Templates"
      subtitle="Curated starter diagrams for every TOC diagram type. Pick one to open it (in a new tab by default)."
      closeAriaLabel="Close templates"
    >
      {/* Session 135 — `<fieldset>` + visually-hidden `<legend>` is
          the canonical accessible pattern for "a labelled group of
          related controls." Biome's `useSemanticElements` rule
          replaces a plain `<div role="group">`; the legend names the
          group for screen readers while staying out of the visual
          layout via `sr-only`. UA-default fieldset chrome (border,
          padding, inline margin) is reset with `border-0 p-0 m-0`. */}
      <fieldset className="m-0 mb-3 flex flex-wrap gap-1.5 border-0 p-0">
        <legend className="sr-only">Filter by diagram type</legend>
        {chips.map((c) => {
          const isActive = filter === c;
          const label = c === 'all' ? 'All' : DIAGRAM_TYPE_LABEL[c];
          const count =
            c === 'all' ? PATTERNS.length : PATTERNS.filter((p) => p.diagramType === c).length;
          return (
            <button
              key={c}
              type="button"
              onClick={() => setFilter(c)}
              aria-pressed={isActive}
              className={clsx(
                'rounded-full border px-2.5 py-0.5 font-medium text-[11px] transition',
                isActive
                  ? 'border-accent-500 bg-accent-100 text-accent-800 dark:border-accent-400 dark:bg-accent-950 dark:text-accent-200'
                  : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800'
              )}
            >
              {label} <span className="ml-0.5 opacity-70">({count})</span>
            </button>
          );
        })}
      </fieldset>

      {visible.length === 0 ? (
        <p className="px-1 py-6 text-center text-neutral-500 text-sm dark:text-neutral-400">
          No templates registered for this diagram type yet.
        </p>
      ) : (
        <ul
          className="grid grid-cols-1 gap-3 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3"
          aria-label="Templates"
        >
          {visible.map((pattern) => (
            <li key={pattern.id}>
              <button
                type="button"
                onClick={() => handlePick(pattern.id)}
                aria-label={`Load template: ${pattern.label}`}
                className={clsx(
                  'group flex h-full w-full flex-col gap-1.5 rounded-md border border-neutral-200 bg-white p-3 text-left transition',
                  'hover:border-accent-400 hover:bg-accent-50/40',
                  CARD_FOCUS,
                  'dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-accent-500 dark:hover:bg-accent-950/40'
                )}
              >
                <span className="self-start rounded-sm bg-accent-100 px-1.5 py-0 font-semibold text-[9px] text-accent-700 uppercase tracking-wide dark:bg-accent-950 dark:text-accent-200">
                  {DIAGRAM_TYPE_LABEL[pattern.diagramType]}
                </span>
                <h3 className="font-medium text-neutral-900 text-sm leading-tight dark:text-neutral-100">
                  {pattern.label}
                </h3>
                <p className="text-neutral-600 text-xs leading-snug dark:text-neutral-400">
                  {pattern.hint}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </LargeDialog>
  );
}
