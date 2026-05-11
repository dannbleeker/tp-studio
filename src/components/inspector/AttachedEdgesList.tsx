import type { EntityId } from '@/domain/types';
import { useDocumentStore } from '@/store';
import { ArrowUpRight } from 'lucide-react';
import { Field } from './Field';

export function AttachedEdgesList({ assumptionId }: { assumptionId: string }) {
  const edges = useDocumentStore((s) => s.doc.edges);
  const entities = useDocumentStore((s) => s.doc.entities);
  const select = useDocumentStore((s) => s.select);

  const branded = assumptionId as EntityId;
  const attached = Object.values(edges).filter((e) => e.assumptionIds?.includes(branded));

  return (
    <Field label={`Attached to (${attached.length})`}>
      {attached.length === 0 ? (
        <p className="text-xs italic text-neutral-400">Not attached to any edge.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {attached.map((edge) => {
            const source = entities[edge.sourceId];
            const target = entities[edge.targetId];
            return (
              <li key={edge.id}>
                <button
                  type="button"
                  onClick={() => select({ kind: 'edge', id: edge.id })}
                  className="group flex w-full items-center justify-between gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1.5 text-left text-xs text-neutral-700 transition hover:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
                >
                  <span className="truncate">
                    {source?.title || 'Untitled'}
                    <span className="mx-1 text-neutral-400">→</span>
                    {target?.title || 'Untitled'}
                  </span>
                  <ArrowUpRight className="h-3 w-3 shrink-0 opacity-60 transition group-hover:opacity-100" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Field>
  );
}
