import { ENTITY_TYPE_META, PALETTE_BY_DIAGRAM } from '@/domain/entityTypeMeta';
import type { Warning } from '@/domain/types';
import { useEntity } from '@/hooks/useSelected';
import { confirmAndDeleteEntity } from '@/services/confirmations';
import { useDocumentStore } from '@/store';
import clsx from 'clsx';
import { Trash2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { AttachedEdgesList } from './AttachedEdgesList';
import { Field } from './Field';
import { WarningsList } from './WarningsList';

export function EntityInspector({
  entityId,
  warnings,
}: {
  entityId: string;
  warnings: Warning[];
}) {
  const entity = useEntity(entityId);
  const diagramType = useDocumentStore((s) => s.doc.diagramType);
  const updateEntity = useDocumentStore((s) => s.updateEntity);

  if (!entity) return null;

  const availableTypes = PALETTE_BY_DIAGRAM[diagramType];

  return (
    <div className="flex flex-col gap-4">
      <Field label="Title">
        <textarea
          className="w-full resize-none rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-sm text-neutral-900 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100"
          rows={3}
          value={entity.title}
          onChange={(e) => updateEntity(entityId, { title: e.target.value })}
        />
      </Field>

      <Field label="Type">
        <div className="grid grid-cols-2 gap-1.5">
          {availableTypes.map((type) => {
            const meta = ENTITY_TYPE_META[type];
            const selected = entity.type === type;
            return (
              <button
                key={type}
                type="button"
                onClick={() => updateEntity(entityId, { type })}
                className={clsx(
                  'flex items-center gap-2 rounded-md border px-2 py-1.5 text-left text-xs transition',
                  selected
                    ? 'border-indigo-400 bg-indigo-50 dark:border-indigo-500 dark:bg-indigo-950/40'
                    : 'border-neutral-200 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900'
                )}
              >
                <span
                  className="h-3 w-1 shrink-0 rounded"
                  style={{ backgroundColor: meta.stripeColor }}
                />
                <span className="truncate text-neutral-700 dark:text-neutral-200">
                  {meta.label}
                </span>
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="Description">
        <textarea
          className="w-full resize-y rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-sm text-neutral-900 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100"
          rows={4}
          placeholder="Optional notes…"
          value={entity.description ?? ''}
          onChange={(e) => updateEntity(entityId, { description: e.target.value })}
        />
      </Field>

      {entity.type === 'assumption' && <AttachedEdgesList assumptionId={entityId} />}

      <WarningsList warnings={warnings} />

      <Button
        variant="destructive"
        onClick={() => confirmAndDeleteEntity(entityId)}
        className="mt-2"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Delete entity
      </Button>
    </div>
  );
}
