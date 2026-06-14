import clsx from 'clsx';
import { ChevronRight, ChevronUp, Sparkles } from 'lucide-react';
import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { DIAGRAM_SHORT_LABEL, DIAGRAM_TYPE_LABEL } from '@/domain/entityTypeMeta';
import { createDocument } from '@/domain/factory';
import { nextStepFor, TP_GOAL_BRANCH, TP_METHOD_SEQUENCE } from '@/domain/methodPath';
import type { DiagramType, DocumentId } from '@/domain/types';
import { useDocumentStore } from '@/store';
import { currentDoc } from '@/store/selectors';

/**
 * Method-path stepper — situates the active document in the canonical TP method
 * sequence (CRT → EC → FRT → PRT → TT, with Goal / S&T as a parallel branch) and
 * suggests the next move. The current diagram is filled; sibling diagrams already
 * open as tabs are active (click to switch); the rest are dashed "todo" (click to
 * create + open). A contextual suggestion appears once the current tree hits a
 * milestone — e.g. a CRT with a root cause → "break it with an Evaporating Cloud".
 */
export function MethodStepper() {
  const { doc, tabOrder, docs, openDocInTab, switchTab, setMethodPathCollapsed } = useDocumentStore(
    useShallow((s) => ({
      doc: currentDoc(s),
      tabOrder: s.tabOrder,
      docs: s.docs,
      openDocInTab: s.openDocInTab,
      switchTab: s.switchTab,
      setMethodPathCollapsed: s.setMethodPathCollapsed,
    }))
  );

  // Map each diagram type to the first open tab of that type. Built in a memo,
  // NOT inside the selector: a fresh object returned from the selector defeats
  // `useShallow`'s top-level identity check and spins an infinite render loop
  // ("getSnapshot should be cached"). tabOrder/docs are stable store refs, so
  // this only recomputes when tabs actually change.
  const openByType = useMemo(() => {
    const map: Partial<Record<DiagramType, DocumentId>> = {};
    for (const id of tabOrder) {
      const t = docs[id]?.diagramType;
      if (t && !(t in map)) map[t] = id;
    }
    return map;
  }, [tabOrder, docs]);

  const current = doc.diagramType;
  const next = nextStepFor(doc);

  // Switch to the step's existing tab, or create + open a fresh one.
  const goTo = (dt: DiagramType): void => {
    const openId = openByType[dt];
    if (openId) switchTab(openId);
    else openDocInTab(createDocument(dt));
  };

  const Step = ({ dt, chevron }: { dt: DiagramType; chevron: boolean }) => {
    const isCurrent = dt === current;
    const isOpen = Boolean(openByType[dt]);
    return (
      <div className="flex shrink-0 items-center">
        <button
          type="button"
          onClick={() => goTo(dt)}
          title={
            isCurrent ? `${DIAGRAM_TYPE_LABEL[dt]} (current)` : `Open ${DIAGRAM_TYPE_LABEL[dt]}`
          }
          aria-current={isCurrent ? 'step' : undefined}
          className={clsx(
            'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-medium text-[11px] transition',
            isCurrent
              ? 'border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900'
              : isOpen
                ? 'border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300'
                : 'border-neutral-200 border-dashed text-neutral-400 hover:border-neutral-300 hover:text-neutral-600 dark:border-neutral-700 dark:text-neutral-500'
          )}
        >
          {isCurrent && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden />}
          {DIAGRAM_SHORT_LABEL[dt]}
        </button>
        {chevron && (
          <ChevronRight
            className="mx-0.5 h-3.5 w-3.5 shrink-0 text-neutral-300 dark:text-neutral-700"
            aria-hidden
          />
        )}
      </div>
    );
  };

  return (
    <div className="flex items-center gap-2 border-neutral-200 border-b bg-neutral-50/60 px-4 py-1 dark:border-neutral-800 dark:bg-neutral-900/40 print:hidden">
      <span className="flex shrink-0 items-center gap-1 font-medium text-[10px] text-neutral-400 uppercase tracking-wider dark:text-neutral-500">
        <Sparkles className="h-3 w-3" aria-hidden />
        <span className="hidden sm:inline">Method path</span>
      </span>
      <nav aria-label="TP method path" className="flex min-w-0 items-center gap-0 overflow-x-auto">
        {TP_METHOD_SEQUENCE.map((dt, i) => (
          <Step key={dt} dt={dt} chevron={i < TP_METHOD_SEQUENCE.length - 1} />
        ))}
        <span
          className="mx-2 shrink-0 text-[11px] text-neutral-300 dark:text-neutral-700"
          aria-hidden
        >
          +
        </span>
        {TP_GOAL_BRANCH.map((dt, i) => (
          <Step key={dt} dt={dt} chevron={i < TP_GOAL_BRANCH.length - 1} />
        ))}
      </nav>
      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        {next && (
          <button
            type="button"
            onClick={() => goTo(next.diagram)}
            className="hidden shrink-0 items-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1 font-medium text-[11px] text-indigo-700 transition hover:bg-indigo-100 lg:inline-flex dark:border-indigo-800/50 dark:bg-indigo-950/40 dark:text-indigo-300"
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            {next.label}
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </button>
        )}
        <button
          type="button"
          onClick={() => setMethodPathCollapsed(true)}
          title="Hide the method path — reopen it from the ⋮ menu"
          aria-label="Hide method path"
          className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-neutral-400 transition hover:bg-neutral-200/70 hover:text-neutral-700 dark:hover:bg-neutral-800/70 dark:hover:text-neutral-200"
        >
          <ChevronUp className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
    </div>
  );
}
