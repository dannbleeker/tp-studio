import clsx from 'clsx';
import { useMemo, useState } from 'react';
import { resolveEntityTypeMeta } from '@/domain/entityTypeMeta';
import { isNonCausal } from '@/domain/graph';
import type { Entity } from '@/domain/types';
import { useDocumentStore } from '@/store';
import { TextInput } from '../settings/formPrimitives';
import { CARD_FOCUS } from '../ui/focusClasses';
import { LargeDialog } from '../ui/LargeDialog';

/**
 * Session 135 / spec major gap #3 Phase 1B — entity-picker dialog
 * for cross-diagram imports.
 *
 * Opened by the "Import entity from another doc…" palette command
 * after the user has picked a TP Studio JSON file. The file gets
 * parsed up-front (so a malformed doc surfaces as an import error
 * via the shared `pickFile` toast) and the resulting `TPDocument` is
 * stashed on the slice. This dialog reads it back, lists every
 * causally-meaningful entity (drops notes + assumptions via
 * `isNonCausal`), and lets the user pick one.
 *
 * On pick: `addImportedEntity` mints a new entity in the current
 * doc with `importedFrom` set; the dialog closes; the new entity
 * becomes the active selection so the inspector immediately shows
 * the import-from badge.
 *
 * Filter box up top — most TP docs have 5-40 entities but a sprawly
 * CRT can exceed 100. Filter is case-insensitive substring on the
 * entity title.
 */
export function ImportEntityPickerDialog() {
  const state = useDocumentStore((s) => s.importEntityPicker);
  const close = useDocumentStore((s) => s.closeImportEntityPicker);
  const addImportedEntity = useDocumentStore((s) => s.addImportedEntity);
  const showToast = useDocumentStore((s) => s.showToast);
  const [filter, setFilter] = useState('');

  // Pre-compute the candidate list — flat array of causally-meaningful
  // entities, sorted by annotation number for stable ordering. Always
  // run the memo (even when `state` is null) to keep the hook order
  // unconditional; downstream code short-circuits on `null` itself.
  const candidates = useMemo<Entity[]>(() => {
    if (!state) return [];
    const out: Entity[] = [];
    for (const e of Object.values(state.sourceDoc.entities)) {
      if (isNonCausal(e)) continue;
      out.push(e);
    }
    return out.sort((a, b) => a.annotationNumber - b.annotationNumber);
  }, [state]);

  const visible = useMemo<Entity[]>(() => {
    if (filter.trim().length === 0) return candidates;
    const q = filter.trim().toLowerCase();
    return candidates.filter((e) => e.title.toLowerCase().includes(q));
  }, [candidates, filter]);

  if (!state) return null;

  const handlePick = (sourceEntity: Entity): void => {
    const minted = addImportedEntity({
      sourceDocId: state.sourceDoc.id,
      sourceEntity,
    });
    if (!minted) {
      showToast('error', 'Could not import the selected entity.');
      return;
    }
    showToast(
      'success',
      `Imported "${sourceEntity.title || '(untitled)'}" from ${state.sourceDoc.title}.`
    );
    close();
    // Reset the filter so a subsequent reopen starts fresh.
    setFilter('');
  };

  return (
    <LargeDialog
      open={true}
      onClose={() => {
        close();
        setFilter('');
      }}
      title={`Import entity from "${state.sourceDoc.title}"`}
      subtitle={`Pick one of the ${candidates.length} entities. The new entity in this doc will keep a back-reference to the source.`}
      closeAriaLabel="Close import-entity picker"
    >
      <div className="mb-3 flex flex-col gap-2">
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
            ? 'The source document has no causally-meaningful entities to import.'
            : `No entities match "${filter}".`}
        </p>
      ) : (
        <ul
          className="grid grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2"
          aria-label="Source-document entities"
        >
          {visible.map((entity) => {
            const meta = resolveEntityTypeMeta(entity.type, state.sourceDoc.customEntityClasses);
            return (
              <li key={entity.id}>
                <button
                  type="button"
                  data-component="import-entity-card"
                  onClick={() => handlePick(entity)}
                  aria-label={`Import ${entity.title || 'untitled entity'} (${meta.label})`}
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
                    {entity.title || <span className="text-neutral-400 italic">(untitled)</span>}
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
    </LargeDialog>
  );
}
