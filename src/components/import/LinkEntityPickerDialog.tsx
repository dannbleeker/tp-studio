import clsx from 'clsx';
import { useMemo, useState } from 'react';
import { resolveEntityTypeMeta } from '@/domain/entityTypeMeta';
import { isNonCausal } from '@/domain/graph';
import type { DocumentId, Entity } from '@/domain/types';
import { useDocumentStore } from '@/store';
import { TextInput } from '../settings/formPrimitives';
import { CARD_FOCUS } from '../ui/focusClasses';
import { LargeDialog } from '../ui/LargeDialog';

/**
 * Phase 2a (TP completeness #2 — U-Shape linkage) — pick an entity in ANOTHER
 * open tab to link the currently-selected entity to. Mirrors
 * `ImportEntityPickerDialog`, but the source is a live open tab (not a parsed
 * file) and picking creates a reciprocal *navigable link* rather than a copy.
 *
 * Opened by the "Link to entity in another tab…" palette command (which guards:
 * one entity selected + ≥2 tabs open). A tab selector at the top chooses which
 * other open document to thread into; the grid lists that tab's
 * causally-meaningful entities (notes + assumptions dropped via `isNonCausal`).
 */
export function LinkEntityPickerDialog() {
  const open = useDocumentStore((s) => s.linkEntityPickerOpen);
  const close = useDocumentStore((s) => s.closeLinkEntityPicker);
  const docs = useDocumentStore((s) => s.docs);
  const tabOrder = useDocumentStore((s) => s.tabOrder);
  const activeDocId = useDocumentStore((s) => s.activeDocId);
  const selection = useDocumentStore((s) => s.selection);
  const linkSelectedEntityTo = useDocumentStore((s) => s.linkSelectedEntityTo);

  const otherTabIds = useMemo(
    () => tabOrder.filter((id) => id !== activeDocId && docs[id]),
    [tabOrder, activeDocId, docs]
  );
  const [targetTabId, setTargetTabId] = useState<DocumentId | null>(null);
  const [filter, setFilter] = useState('');

  // The effective target tab: the explicit choice if still open, else the first
  // other tab. (Local state may be null on first open or stale after a close.)
  const effectiveTargetId =
    targetTabId && otherTabIds.includes(targetTabId) ? targetTabId : otherTabIds[0];
  const targetDoc = effectiveTargetId ? docs[effectiveTargetId] : undefined;

  const candidates = useMemo<Entity[]>(() => {
    if (!targetDoc) return [];
    const out: Entity[] = [];
    for (const e of Object.values(targetDoc.entities)) {
      if (isNonCausal(e)) continue;
      out.push(e);
    }
    return out.sort((a, b) => a.annotationNumber - b.annotationNumber);
  }, [targetDoc]);

  const visible = useMemo<Entity[]>(() => {
    if (filter.trim().length === 0) return candidates;
    const q = filter.trim().toLowerCase();
    return candidates.filter((e) => e.title.toLowerCase().includes(q));
  }, [candidates, filter]);

  if (!open) return null;

  const sourceId =
    selection.kind === 'entities' && selection.ids.length === 1 ? selection.ids[0] : undefined;
  const selectedEntity = sourceId ? docs[activeDocId]?.entities[sourceId] : undefined;

  const onClose = (): void => {
    close();
    setFilter('');
    setTargetTabId(null);
  };

  const handlePick = (entity: Entity): void => {
    if (!effectiveTargetId) return;
    linkSelectedEntityTo(effectiveTargetId, entity.id);
    onClose();
  };

  return (
    <LargeDialog
      open={true}
      onClose={onClose}
      title="Link to entity in another tab"
      subtitle={
        selectedEntity
          ? `Linking "${selectedEntity.title || '(untitled)'}". Pick a document, then an entity to thread it to.`
          : 'Pick a document, then an entity to link to.'
      }
      closeAriaLabel="Close link-entity picker"
    >
      {otherTabIds.length === 0 || !targetDoc ? (
        <p className="px-1 py-6 text-center text-neutral-500 text-sm dark:text-neutral-400">
          Open another document in a second tab to link across.
        </p>
      ) : (
        <>
          <div className="mb-3 flex flex-col gap-2">
            {otherTabIds.length > 1 && (
              <div className="flex flex-col gap-1">
                <span className="font-medium text-[11px] text-neutral-500 uppercase tracking-wider dark:text-neutral-400">
                  Document to link into
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {otherTabIds.map((id) => {
                    const d = docs[id];
                    if (!d) return null;
                    const active = id === effectiveTargetId;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setTargetTabId(id)}
                        aria-pressed={active}
                        className={clsx(
                          'max-w-[20ch] truncate rounded-full border px-2.5 py-1 font-medium text-xs transition',
                          active
                            ? 'border-indigo-400 bg-indigo-50 text-indigo-700 dark:border-indigo-500 dark:bg-indigo-950/50 dark:text-indigo-300'
                            : 'border-neutral-200 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-800'
                        )}
                      >
                        {d.title || '(untitled)'}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <TextInput
              value={filter}
              onChange={setFilter}
              placeholder="Filter by title…"
              ariaLabel="Filter entities by title"
            />
          </div>

          {visible.length === 0 ? (
            <p className="px-1 py-6 text-center text-neutral-500 text-sm dark:text-neutral-400">
              {candidates.length === 0
                ? `"${targetDoc.title}" has no causally-meaningful entities to link to.`
                : `No entities match "${filter}".`}
            </p>
          ) : (
            <ul
              className="grid grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2"
              aria-label={`Entities in ${targetDoc.title}`}
            >
              {visible.map((entity) => {
                const meta = resolveEntityTypeMeta(entity.type, targetDoc.customEntityClasses);
                return (
                  <li key={entity.id}>
                    <button
                      type="button"
                      data-component="link-entity-card"
                      onClick={() => handlePick(entity)}
                      aria-label={`Link to ${entity.title || 'untitled entity'} (${meta.label})`}
                      className={clsx(
                        'group flex h-full w-full flex-col gap-1.5 rounded-md border border-neutral-200 bg-white p-3 text-left transition',
                        'hover:border-indigo-400 hover:bg-indigo-50/40',
                        CARD_FOCUS,
                        'dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-indigo-500 dark:hover:bg-indigo-950/40'
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className="h-3 w-1 shrink-0 rounded-sm"
                          style={{ backgroundColor: meta.stripeColor }}
                          aria-hidden
                        />
                        <span className="font-semibold text-[10px] text-neutral-500 uppercase tracking-wider dark:text-neutral-400">
                          {meta.label}
                        </span>
                        <span className="font-mono text-[10px] text-neutral-400 dark:text-neutral-500">
                          #{entity.annotationNumber}
                        </span>
                      </span>
                      <span className="line-clamp-3 text-neutral-900 text-sm leading-snug dark:text-neutral-100">
                        {entity.title || (
                          <span className="text-neutral-400 italic">(untitled)</span>
                        )}
                      </span>
                      {entity.description && (
                        <span className="line-clamp-2 text-[11px] text-neutral-500 dark:text-neutral-400">
                          {entity.description}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </LargeDialog>
  );
}
