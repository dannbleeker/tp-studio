import { validationFingerprint } from '@/domain/fingerprint';
import type { Warning } from '@/domain/types';
import { validate } from '@/domain/validators';
import { useDocumentStore } from '@/store';
import clsx from 'clsx';
import { X } from 'lucide-react';
import { useMemo } from 'react';
import { Button } from '../ui/Button';
import { EdgeInspector } from './EdgeInspector';
import { EntityInspector } from './EntityInspector';

const EMPTY: Warning[] = [];

export function Inspector() {
  const selection = useDocumentStore((s) => s.selection);
  const doc = useDocumentStore((s) => s.doc);
  const select = useDocumentStore((s) => s.select);

  const open = selection.kind !== 'none';

  // Run CLR rules only when something validation-relevant changes (titles,
  // types, edges, resolutions). Pure UI churn doesn't trigger re-validation.
  const fp = validationFingerprint(doc);
  // biome-ignore lint/correctness/useExhaustiveDependencies: doc is read through `fp` deliberately.
  const warnings = useMemo(() => validate(doc), [fp]);

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

  const selectionWarnings: Warning[] = (() => {
    if (selection.kind === 'entity') {
      return warningsByTarget.entityMap.get(selection.id) ?? EMPTY;
    }
    if (selection.kind === 'edge') {
      return warningsByTarget.edgeMap.get(selection.id) ?? EMPTY;
    }
    return EMPTY;
  })();

  return (
    <aside
      className={clsx(
        'absolute right-0 top-0 z-10 h-full w-[320px] transform transition-transform duration-200 ease-out',
        'border-l border-neutral-200 bg-white/95 backdrop-blur',
        'dark:border-neutral-800 dark:bg-neutral-950/95',
        open ? 'translate-x-0' : 'translate-x-full'
      )}
      aria-hidden={!open}
      // The `inert` attribute removes the panel from sequential focus and from
      // assistive-tech navigation while it's animated off-screen. React types
      // don't carry it on aside yet, hence the cast.
      {...({ inert: !open ? '' : undefined } as Record<string, string | undefined>)}
    >
      <div className="flex h-full flex-col">
        <header className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            {selection.kind === 'entity' ? 'Entity' : selection.kind === 'edge' ? 'Edge' : ''}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => select({ kind: 'none' })}
            aria-label="Close inspector"
          >
            <X className="h-4 w-4" />
          </Button>
        </header>
        <div className="flex-1 overflow-y-auto p-4">
          {selection.kind === 'entity' && (
            <EntityInspector entityId={selection.id} warnings={selectionWarnings} />
          )}
          {selection.kind === 'edge' && (
            <EdgeInspector edgeId={selection.id} warnings={selectionWarnings} />
          )}
        </div>
      </div>
    </aside>
  );
}
