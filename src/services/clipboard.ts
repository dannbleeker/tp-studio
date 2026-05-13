import { createEdge, createEntity } from '@/domain/factory';
import type { Edge, Entity } from '@/domain/types';
import { useDocumentStore } from '@/store';

type ClipboardPayload = {
  entities: Entity[];
  /** Edges whose BOTH endpoints are in `entities`. */
  edges: Edge[];
};

let buffer: ClipboardPayload | null = null;

/**
 * Copy the current entity multi-selection (and the edges entirely inside it)
 * to a module-scoped buffer. Returns the number of entities captured — 0
 * means "nothing to do" so the caller can decide whether to swallow the key.
 */
export const copySelection = (): number => {
  const state = useDocumentStore.getState();
  if (state.selection.kind !== 'entities') return 0;
  const ids = state.selection.ids;
  if (ids.length === 0) return 0;
  const idSet = new Set(ids);
  const entities = ids
    .map((id) => state.doc.entities[id])
    .filter((e): e is Entity => e !== undefined);
  if (entities.length === 0) return 0;
  const edges = Object.values(state.doc.edges).filter(
    (e) => idSet.has(e.sourceId) && idSet.has(e.targetId)
  );
  buffer = { entities, edges };
  return entities.length;
};

/**
 * Copy + delete the entity multi-selection. Cascade edges are dropped by the
 * existing delete pipeline.
 */
export const cutSelection = (): number => {
  const n = copySelection();
  if (n === 0) return 0;
  const state = useDocumentStore.getState();
  if (state.selection.kind !== 'entities') return 0;
  state.deleteEntitiesAndEdges(state.selection.ids, []);
  return n;
};

type PasteResult = { ok: true; entities: number; edges: number } | { ok: false };

/**
 * Paste a previously-captured buffer back into the document. Mints fresh IDs
 * for every entity, remaps edge endpoints, and gives each pasted entity the
 * next annotation number from the doc. Edge assumption references that point
 * at non-copied entities are dropped — the doc stays consistent.
 *
 * Pasting twice produces two independent copies because the IDs are minted
 * each call.
 */
export const pasteClipboard = (): PasteResult => {
  if (!buffer || buffer.entities.length === 0) return { ok: false };
  const state = useDocumentStore.getState();
  const startAnnotation = state.doc.nextAnnotationNumber;

  // Mint new entities, preserve the per-entity id mapping for edge remap.
  const idMap = new Map<string, string>();
  const newEntities: Entity[] = buffer.entities.map((src, i) => {
    const e = createEntity({
      type: src.type,
      title: src.title,
      annotationNumber: startAnnotation + i,
    });
    const next: Entity = {
      ...e,
      description: src.description,
    };
    idMap.set(src.id, next.id);
    return next;
  });

  const newEdges: Edge[] = [];
  for (const src of buffer.edges) {
    const newSource = idMap.get(src.sourceId);
    const newTarget = idMap.get(src.targetId);
    if (!newSource || !newTarget) continue;
    newEdges.push(createEdge({ sourceId: newSource, targetId: newTarget }));
  }

  // Splice into the doc via setDocument (one history step, persistence flush).
  const nextDoc = {
    ...state.doc,
    entities: {
      ...state.doc.entities,
      ...Object.fromEntries(newEntities.map((e) => [e.id, e])),
    },
    edges: {
      ...state.doc.edges,
      ...Object.fromEntries(newEdges.map((e) => [e.id, e])),
    },
    nextAnnotationNumber: startAnnotation + newEntities.length,
    updatedAt: Date.now(),
  };
  state.setDocument(nextDoc);
  state.selectEntities(newEntities.map((e) => e.id));
  return { ok: true, entities: newEntities.length, edges: newEdges.length };
};

/** Test seam — clears the in-memory clipboard. */
export const __clearClipboardForTest = (): void => {
  buffer = null;
};

/** Test seam — peek at the current buffer without mutating it. */
export const __getClipboardForTest = (): ClipboardPayload | null => buffer;
