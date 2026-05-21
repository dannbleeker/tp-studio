import { ArrowUpRight } from 'lucide-react';
import type { EntityId } from '@/domain/types';
import { useDocumentStore } from '@/store';
import { arrayShallowEqualByKeys } from '@/store/equality';
import { useDocumentStoreWith } from '@/store/useDocumentStoreWithEquality';
import { Field } from './Field';

type AttachedEntry = { id: string; sourceTitle: string; targetTitle: string };

// Session 135 / Perf #7 — equality fn skips re-renders when the
// derived triple list is logically the same. Re-derived per snapshot
// (cheap — one edge-map scan) but the component re-renders only when
// the filtered set or endpoint titles actually change.
const attachedEqual = arrayShallowEqualByKeys<AttachedEntry>(['id', 'sourceTitle', 'targetTitle']);

export function AttachedEdgesList({ assumptionId }: { assumptionId: string }) {
  const selectEdge = useDocumentStore((s) => s.selectEdge);

  // Replace whole-map subscriptions to `s.doc.edges` + `s.doc.entities`
  // with a single derived selector + custom equality. The selector
  // still walks the edges to filter, but the component re-renders
  // only when the *result* changes (an attached edge appears /
  // disappears, or one of its endpoint titles is edited). Unrelated
  // edge / entity mutations are now free.
  const attached = useDocumentStoreWith((s) => {
    const branded = assumptionId as EntityId;
    const out: AttachedEntry[] = [];
    for (const edge of Object.values(s.doc.edges)) {
      if (!edge.assumptionIds?.includes(branded)) continue;
      out.push({
        id: edge.id,
        sourceTitle: s.doc.entities[edge.sourceId]?.title ?? '',
        targetTitle: s.doc.entities[edge.targetId]?.title ?? '',
      });
    }
    return out;
  }, attachedEqual);

  return (
    <Field label={`Attached to (${attached.length})`}>
      {attached.length === 0 ? (
        <p className="text-neutral-400 text-xs italic">Not attached to any edge.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {attached.map((edge) => (
            <li key={edge.id}>
              <button
                type="button"
                onClick={() => selectEdge(edge.id)}
                className="group flex w-full items-center justify-between gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1.5 text-left text-neutral-700 text-xs transition hover:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
              >
                <span className="truncate">
                  {edge.sourceTitle || 'Untitled'}
                  <span className="mx-1 text-neutral-400">→</span>
                  {edge.targetTitle || 'Untitled'}
                </span>
                <ArrowUpRight className="h-3 w-3 shrink-0 opacity-60 transition group-hover:opacity-100" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Field>
  );
}
