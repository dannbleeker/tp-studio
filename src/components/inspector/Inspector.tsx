import clsx from 'clsx';
import { Trash2, X } from 'lucide-react';
import { useMemo } from 'react';
import { ENTITY_TYPE_META, PALETTE_BY_DIAGRAM } from '../../domain/entityTypeMeta';
import { validate } from '../../domain/validators';
import { confirmAndDeleteEntity } from '../../services/confirmations';
import { useDocumentStore } from '../../store';
import { WarningsList } from './WarningsList';

export function Inspector() {
  const selection = useDocumentStore((s) => s.selection);
  const doc = useDocumentStore((s) => s.doc);
  const select = useDocumentStore((s) => s.select);

  const open = selection.kind !== 'none';

  const warnings = useMemo(() => validate(doc), [doc]);

  return (
    <aside
      className={clsx(
        'absolute right-0 top-0 z-10 h-full w-[320px] transform transition-transform duration-200 ease-out',
        'border-l border-neutral-200 bg-white/95 backdrop-blur',
        'dark:border-neutral-800 dark:bg-neutral-950/95',
        open ? 'translate-x-0' : 'translate-x-full'
      )}
      aria-hidden={!open}
    >
      <div className="flex h-full flex-col">
        <header className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            {selection.kind === 'entity' ? 'Entity' : selection.kind === 'edge' ? 'Edge' : ''}
          </span>
          <button
            type="button"
            className="rounded p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
            onClick={() => select({ kind: 'none' })}
            aria-label="Close inspector"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-4">
          {selection.kind === 'entity' && (
            <EntityInspector
              entityId={selection.id}
              warnings={warnings.filter(
                (w) => w.target.kind === 'entity' && w.target.id === selection.id
              )}
            />
          )}
          {selection.kind === 'edge' && (
            <EdgeInspector
              edgeId={selection.id}
              warnings={warnings.filter(
                (w) => w.target.kind === 'edge' && w.target.id === selection.id
              )}
            />
          )}
        </div>
      </div>
    </aside>
  );
}

function EntityInspector({
  entityId,
  warnings,
}: {
  entityId: string;
  warnings: ReturnType<typeof validate>;
}) {
  const entity = useDocumentStore((s) => s.doc.entities[entityId]);
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

      <WarningsList warnings={warnings} />

      <button
        type="button"
        onClick={() => confirmAndDeleteEntity(entityId)}
        className="mt-2 inline-flex items-center justify-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-100 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Delete entity
      </button>
    </div>
  );
}

function EdgeInspector({
  edgeId,
  warnings,
}: {
  edgeId: string;
  warnings: ReturnType<typeof validate>;
}) {
  const edge = useDocumentStore((s) => s.doc.edges[edgeId]);
  const source = useDocumentStore((s) => (edge ? s.doc.entities[edge.sourceId] : undefined));
  const target = useDocumentStore((s) => (edge ? s.doc.entities[edge.targetId] : undefined));
  const deleteEdge = useDocumentStore((s) => s.deleteEdge);
  const ungroupAnd = useDocumentStore((s) => s.ungroupAnd);

  if (!edge) return null;

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
            <button
              type="button"
              onClick={() => ungroupAnd([edgeId])}
              className="rounded border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-700 transition hover:bg-violet-100 dark:border-violet-900/40 dark:bg-violet-950/40 dark:text-violet-300"
            >
              Ungroup
            </button>
          </div>
        </Field>
      )}

      <WarningsList warnings={warnings} />

      <button
        type="button"
        onClick={() => deleteEdge(edgeId)}
        className="mt-2 inline-flex items-center justify-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-100 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Delete edge
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
        {label}
      </span>
      {children}
    </div>
  );
}
