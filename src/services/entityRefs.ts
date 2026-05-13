import { ancestorChain } from '@/domain/groups';
import { useDocumentStore } from '@/store';

/**
 * Resolve an entity reference string to a concrete entity id.
 * Accepts:
 *   - a raw entity id  →  matched against `doc.entities` directly
 *   - `#42` style       →  matched against `entity.annotationNumber`
 *
 * Returns null if nothing matches.
 */
export const resolveEntityRef = (ref: string): string | null => {
  const doc = useDocumentStore.getState().doc;
  if (ref.startsWith('#')) {
    const n = Number.parseInt(ref.slice(1), 10);
    if (Number.isNaN(n)) return null;
    const hit = Object.values(doc.entities).find((e) => e.annotationNumber === n);
    return hit?.id ?? null;
  }
  return doc.entities[ref] ? ref : null;
};

/**
 * Jump to an entity: expand collapsed ancestor groups, unhoist if needed,
 * then select. Used by the markdown link click delegator (FL-AN5) and the
 * search panel.
 */
export const navigateToEntity = (id: string): void => {
  const state = useDocumentStore.getState();
  const ancestors = ancestorChain(state.doc, id);
  for (const a of ancestors) {
    if (a.collapsed) state.toggleGroupCollapsed(a.id);
  }
  if (state.hoistedGroupId) {
    const inHoist = ancestors.some((a) => a.id === state.hoistedGroupId);
    if (!inHoist) state.unhoist();
  }
  state.selectEntity(id);
};
