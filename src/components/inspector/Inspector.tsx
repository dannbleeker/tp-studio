import { validationFingerprint } from '@/domain/fingerprint';
import type { Warning } from '@/domain/types';
import { validate } from '@/domain/validators';
import { useFingerprintMemo } from '@/hooks/useFingerprintMemo';
import { useSelectionShape } from '@/hooks/useSelectionShape';
import { useDocumentStore } from '@/store';
import clsx from 'clsx';
import { X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '../ui/Button';
import { EdgeInspector } from './EdgeInspector';
import { EntityInspector } from './EntityInspector';
import { GroupInspector } from './GroupInspector';
import { InjectionWorkbench } from './InjectionWorkbench';
import { MultiInspector } from './MultiInspector';
import { VerbalisationStrip } from './VerbalisationStrip';

type ECTab = 'inspector' | 'verbalisation' | 'injections';

const EMPTY: Warning[] = [];

export function Inspector() {
  const doc = useDocumentStore((s) => s.doc);
  const clearSelection = useDocumentStore((s) => s.clearSelection);
  const { selection, open, singleId, isSingleGroup, isMulti, headerLabel } = useSelectionShape();
  // Session 77 — EC-only tab bar. The "Inspector" tab is the existing
  // selection-driven content; the two others are doc-level (always
  // visible on any selection so the user can swap views freely).
  const [ecTab, setECTab] = useState<ECTab>('inspector');
  const isEC = doc.diagramType === 'ec';

  // Run CLR rules only when something validation-relevant changes (titles,
  // types, edges, resolutions). Pure UI churn doesn't trigger re-validation.
  const warnings = useFingerprintMemo(() => validate(doc), validationFingerprint(doc));

  // Index warnings by target id once instead of filtering N times on each
  // render. O(N) build, O(1) lookup per inspector mount.
  const warningsByTarget = useMemo(() => {
    const entityMap = new Map<string, Warning[]>();
    const edgeMap = new Map<string, Warning[]>();
    for (const w of warnings) {
      const bucket = w.target.kind === 'entity' ? entityMap : edgeMap;
      const list = bucket.get(w.target.id);
      if (list) list.push(w);
      else bucket.set(w.target.id, [w]);
    }
    return { entityMap, edgeMap };
  }, [warnings]);

  const selectionWarnings: Warning[] =
    selection.kind === 'entities' && singleId
      ? (warningsByTarget.entityMap.get(singleId) ?? EMPTY)
      : selection.kind === 'edges' && singleId
        ? (warningsByTarget.edgeMap.get(singleId) ?? EMPTY)
        : EMPTY;

  return (
    <>
      {/* Narrow-viewport backdrop. At < md the inspector covers most of the
          canvas (85 vw); a tap-to-dismiss surface behind it gives the user
          a generous click target rather than forcing them to hit the small
          X in the inspector header. Hidden at md+ where the inspector and
          canvas comfortably coexist. The backdrop is a button (rather than
          a div with role="button") so it's natively focusable and the
          Biome a11y rules stay clean. */}
      {open && (
        <button
          type="button"
          aria-label="Dismiss inspector"
          tabIndex={-1}
          className="absolute inset-0 z-10 cursor-default bg-neutral-900/20 backdrop-blur-[1px] md:hidden"
          onClick={clearSelection}
        />
      )}
      <aside
        className={clsx(
          // The inspector takes its full 320 px from md upward. On narrower
          // viewports it caps at 85 vw so a phone-sized canvas still has room
          // to breathe behind it; the slide-off when closed is unchanged.
          'inspector-aside absolute top-0 right-0 z-20 h-full w-[min(85vw,320px)] transform md:w-[320px]',
          'border-neutral-200 border-l bg-white/95 backdrop-blur',
          'dark:border-neutral-800 dark:bg-neutral-950/95',
          // 200 ms slide-in / slide-out so the panel doesn't snap. `ease-out`
          // feels right for entering (decelerates into position); the same
          // curve plays in reverse on close (accelerating off-screen),
          // which reads as natural to most users.
          'transition-transform duration-200 ease-out',
          open ? 'translate-x-0' : 'translate-x-full'
        )}
        aria-hidden={!open}
        // The `inert` attribute removes the panel from sequential focus and from
        // assistive-tech navigation while it's animated off-screen. React types
        // don't carry it on aside yet, hence the cast.
        {...({ inert: !open ? '' : undefined } as Record<string, string | undefined>)}
      >
        <div className="flex h-full flex-col">
          <header className="flex items-center justify-between border-neutral-200 border-b px-4 py-3 dark:border-neutral-800">
            <span className="font-semibold text-[11px] text-neutral-500 uppercase tracking-wider dark:text-neutral-400">
              {headerLabel}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={clearSelection}
              aria-label="Close inspector"
            >
              <X className="h-4 w-4" />
            </Button>
          </header>
          {isEC && (
            <div
              role="tablist"
              aria-label="Evaporating Cloud inspector views"
              className="flex border-neutral-200 border-b px-2 dark:border-neutral-800"
            >
              {(
                [
                  { id: 'inspector' as const, label: 'Inspector' },
                  { id: 'verbalisation' as const, label: 'Verbalisation' },
                  { id: 'injections' as const, label: 'Injections' },
                ] satisfies { id: ECTab; label: string }[]
              ).map((tab) => {
                const active = ecTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setECTab(tab.id)}
                    className={clsx(
                      'flex-1 px-2 py-1.5 font-semibold text-[11px] uppercase tracking-wide transition',
                      active
                        ? 'border-indigo-500 border-b-2 text-indigo-700 dark:border-indigo-400 dark:text-indigo-300'
                        : 'border-transparent border-b-2 text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200'
                    )}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          )}
          <div className="flex-1 overflow-y-auto p-4">
            {isEC && ecTab === 'verbalisation' && <VerbalisationStrip compact={false} />}
            {isEC && ecTab === 'injections' && <InjectionWorkbench />}
            {(!isEC || ecTab === 'inspector') && (
              <>
                {isMulti && selection.kind === 'entities' && (
                  <MultiInspector kind="entities" ids={selection.ids} />
                )}
                {isMulti && selection.kind === 'edges' && (
                  <MultiInspector kind="edges" ids={selection.ids} />
                )}
                {isSingleGroup && singleId && <GroupInspector groupId={singleId} />}
                {selection.kind === 'entities' && singleId && !isSingleGroup && (
                  <EntityInspector entityId={singleId} warnings={selectionWarnings} />
                )}
                {selection.kind === 'edges' && singleId && (
                  <EdgeInspector edgeId={singleId} warnings={selectionWarnings} />
                )}
              </>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
