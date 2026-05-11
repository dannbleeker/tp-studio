import { Trash2 } from 'lucide-react';
import type { Entity, Warning } from '../../domain/types';
import { useDocumentStore } from '../../store';
import { Button } from '../ui/Button';
import { EdgeAssumptions } from './EdgeAssumptions';
import { Field } from './Field';
import { WarningsList } from './WarningsList';

export function EdgeInspector({
  edgeId,
  warnings,
}: {
  edgeId: string;
  warnings: Warning[];
}) {
  const edge = useDocumentStore((s) => s.doc.edges[edgeId]);
  const source = useDocumentStore((s) => (edge ? s.doc.entities[edge.sourceId] : undefined));
  const target = useDocumentStore((s) => (edge ? s.doc.entities[edge.targetId] : undefined));
  const deleteEdge = useDocumentStore((s) => s.deleteEdge);
  const ungroupAnd = useDocumentStore((s) => s.ungroupAnd);
  const entities = useDocumentStore((s) => s.doc.entities);

  if (!edge) return null;

  const assumptions = (edge.assumptionIds ?? [])
    .map((id) => entities[id])
    .filter((e): e is Entity => e?.type === 'assumption');

  return (
    <div className="flex flex-col gap-4">
      <Field label="Cause">
        <p className="rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1.5 text-sm text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200">
          {source?.title || <span className="italic text-neutral-400">Untitled</span>}
        </p>
      </Field>
      <Field label="Effect">
        <p className="rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1.5 text-sm text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200">
          {target?.title || <span className="italic text-neutral-400">Untitled</span>}
        </p>
      </Field>
      <Field label="Kind">
        <p className="text-xs uppercase tracking-wider text-neutral-500">{edge.kind}</p>
      </Field>
      {edge.andGroupId && (
        <Field label="AND group">
          <div className="flex items-center justify-between gap-2">
            <p className="font-mono text-xs text-neutral-600 dark:text-neutral-300">
              {edge.andGroupId}
            </p>
            <Button variant="softViolet" size="sm" onClick={() => ungroupAnd([edgeId])}>
              Ungroup
            </Button>
          </div>
        </Field>
      )}

      <EdgeAssumptions edgeId={edgeId} assumptions={assumptions} />

      <WarningsList warnings={warnings} />

      <Button variant="destructive" onClick={() => deleteEdge(edgeId)} className="mt-2">
        <Trash2 className="h-3.5 w-3.5" />
        Delete edge
      </Button>
    </div>
  );
}
