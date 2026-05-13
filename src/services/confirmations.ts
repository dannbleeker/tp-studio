import { connectionCount } from '@/domain/graph';
import { guardWriteOrToast } from '@/services/browseLock';
import { useDocumentStore } from '@/store';

/**
 * Delete an entity, prompting first when it has connections so the user
 * sees the cascade size before agreeing. Returns a promise that
 * resolves once the deletion (or cancellation) is final; callers can
 * fire-and-forget — the original `window.confirm`-backed API was
 * synchronous-returning-`void`, and click handlers ignored that anyway.
 *
 * Short-circuits when Browse Lock is on. Showing a confirm dialog and
 * then refusing to delete would be a confusing UX — the lock toast
 * fires instead so the user immediately sees why nothing happened.
 */
export const confirmAndDeleteEntity = async (id: string): Promise<void> => {
  if (!guardWriteOrToast()) return;
  const state = useDocumentStore.getState();
  const entity = state.doc.entities[id];
  if (!entity) return;

  const connections = connectionCount(state.doc, id);
  if (connections > 0) {
    const title = entity.title.trim() || 'this entity';
    const plural = connections === 1 ? '' : 's';
    const ok = await state.confirm(`Delete "${title}" and ${connections} connection${plural}?`, {
      confirmLabel: 'Delete',
    });
    if (!ok) return;
  }
  // Re-read state so any concurrent mutation doesn't slip past us.
  useDocumentStore.getState().deleteEntity(id);
};

/**
 * Bulk-delete confirmation for the current selection. Falls back to the
 * single-entity helper when one entity is selected (preserves its smarter
 * "0 connections → no prompt" path). For ≥2 selected items, computes the
 * exact cascade size and shows one prompt.
 */
export const confirmAndDeleteSelection = async (): Promise<void> => {
  if (!guardWriteOrToast()) return;
  const state = useDocumentStore.getState();
  const sel = state.selection;
  if (sel.kind === 'none') return;

  if (sel.kind === 'entities') {
    if (sel.ids.length === 1 && sel.ids[0]) {
      await confirmAndDeleteEntity(sel.ids[0]);
      return;
    }
    const entityIds = sel.ids.filter((id) => state.doc.entities[id]);
    // Cascade: every edge that touches any selected entity goes too.
    const cascadingEdges = Object.values(state.doc.edges).filter(
      (e) => entityIds.includes(e.sourceId) || entityIds.includes(e.targetId)
    );
    const cascadeCount = cascadingEdges.length;
    const msg =
      cascadeCount > 0
        ? `Delete ${entityIds.length} entities and ${cascadeCount} connection${cascadeCount === 1 ? '' : 's'}?`
        : `Delete ${entityIds.length} entities?`;
    const ok = await state.confirm(msg, { confirmLabel: 'Delete' });
    if (!ok) return;
    useDocumentStore.getState().deleteEntitiesAndEdges(entityIds, []);
    return;
  }

  // edges
  const edgeIds = sel.ids.filter((id) => state.doc.edges[id]);
  if (edgeIds.length === 0) return;
  const msg = `Delete ${edgeIds.length} edge${edgeIds.length === 1 ? '' : 's'}?`;
  const ok = await state.confirm(msg, { confirmLabel: 'Delete' });
  if (!ok) return;
  useDocumentStore.getState().deleteEntitiesAndEdges([], edgeIds);
};
