import { createEdge, createEntity } from '@/domain/factory';
import type { Edge, Entity } from '@/domain/types';
import { useDocumentStore } from '@/store';
import { currentDoc } from '@/store/selectors';

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
  const doc = currentDoc(state);
  const entities = ids.map((id) => doc.entities[id]).filter((e): e is Entity => e !== undefined);
  if (entities.length === 0) return 0;
  const edges = Object.values(doc.edges).filter(
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
  const doc = currentDoc(state);
  const startAnnotation = doc.nextAnnotationNumber;

  // Mint new entities, preserve the per-entity id mapping for edge remap.
  const idMap = new Map<string, string>();
  const newEntities: Entity[] = buffer.entities.map((src, i) => {
    const minted = createEntity({
      type: src.type,
      title: src.title,
      annotationNumber: startAnnotation + i,
    });
    // Carry ALL of the source entity's self-contained content (position,
    // attributes, evidence, span-of-control, styling, EC want/need text, …) onto
    // the fresh copy. Paste previously kept only `description`, so e.g. a
    // hand-positioned Evaporating Cloud box collapsed to (0,0) and any S&T /
    // custom attributes were silently lost. Re-mint the identity + timestamps,
    // and DROP the few fields that bind or refer OUTSIDE the entity — carrying
    // them verbatim would dangle, duplicate a singleton, or desync a back-ref:
    //   ecSlot       — binds the box to one of the EC's five fixed roles
    //   links        — cross-document references (back-links would go asymmetric)
    //   coreProblem  — the doc's single "core problem" designation
    //   importedFrom — provenance of the ORIGINAL; a paste is a fresh local copy
    const {
      id: _id,
      annotationNumber: _annotation,
      createdAt: _createdAt,
      updatedAt: _updatedAt,
      ecSlot: _ecSlot,
      links: _links,
      coreProblem: _coreProblem,
      importedFrom: _importedFrom,
      ...carried
    } = src;
    const next: Entity = {
      ...carried,
      id: minted.id,
      annotationNumber: minted.annotationNumber,
      createdAt: minted.createdAt,
      updatedAt: minted.updatedAt,
    };
    idMap.set(src.id, next.id);
    return next;
  });

  const newEdges: Edge[] = [];
  for (const src of buffer.edges) {
    const newSource = idMap.get(src.sourceId);
    const newTarget = idMap.get(src.targetId);
    if (!newSource || !newTarget) continue;
    // Carry the source edge's semantic `kind` (createEdge hard-codes
    // 'sufficiency', which would silently downgrade EC / Goal Tree / PRT
    // necessity edges) plus all its metadata. Conditional spreads keep
    // exactOptionalPropertyTypes happy (never assign `field: undefined`).
    // The junctor group ids (and/or/xorGroupId) are intentionally DROPPED:
    // they reference a cross-edge group, so pasting a subset would dangle or
    // alias the original group — the user can re-group after paste.
    const base = createEdge({ sourceId: newSource, targetId: newTarget });
    const next: Edge = {
      ...base,
      kind: src.kind,
      ...(src.weight !== undefined ? { weight: src.weight } : {}),
      ...(src.label !== undefined ? { label: src.label } : {}),
      ...(src.description !== undefined ? { description: src.description } : {}),
      ...(src.isBackEdge !== undefined ? { isBackEdge: src.isBackEdge } : {}),
      ...(src.isMutualExclusion !== undefined ? { isMutualExclusion: src.isMutualExclusion } : {}),
      ...(src.delay !== undefined ? { delay: src.delay } : {}),
      ...(src.loopName !== undefined ? { loopName: src.loopName } : {}),
      ...(src.loopNarrative !== undefined ? { loopNarrative: src.loopNarrative } : {}),
      ...(src.attributes !== undefined ? { attributes: src.attributes } : {}),
    };
    newEdges.push(next);
  }

  // Splice into the doc via setDocument (one history step, persistence flush).
  const nextDoc = {
    ...doc,
    entities: {
      ...doc.entities,
      ...Object.fromEntries(newEntities.map((e) => [e.id, e])),
    },
    edges: {
      ...doc.edges,
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
// Session 86 (#5) — dropped the dead `__getClipboardForTest` peek helper.
// No test ever called it (the live clipboard tests assert via the public
// `pasteAtOffset` / `cut` round-trip instead). Reintroduce as a typed seam
// if a future test truly needs to inspect the buffer without consuming it.
