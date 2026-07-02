import { nanoid } from 'nanoid';
import { createEdge, createEntity } from '@/domain/factory';
import { newGroupId } from '@/domain/ids';
import type { Edge, Entity, Group, TPDocument } from '@/domain/types';
import { useDocumentStore } from '@/store';
import { currentDoc } from '@/store/selectors';

type ClipboardPayload = {
  entities: Entity[];
  /** Edges whose BOTH endpoints are in `entities`. */
  edges: Edge[];
};

let buffer: ClipboardPayload | null = null;

/**
 * Diagonal offset (px) applied to each pasted / duplicated copy so it doesn't
 * land exactly on top of its source. Repeated pastes of the SAME clipboard fan
 * out down-right via a cascade counter (reset on every fresh copy), so Ctrl+V,
 * Ctrl+V, Ctrl+V produces a visible stagger instead of one hidden stack. Only
 * affects manual-layout diagrams (EC / freeform / S&T) where the stored
 * `position` is honoured; auto-layout diagrams let dagre place the copies.
 */
const PASTE_STEP = 32;
let pasteCascade = 0;

/**
 * Snapshot the current entity multi-selection (and the edges entirely inside
 * it) into a payload. Shared by `copySelection` (which stashes it in the
 * module buffer) and `duplicateSelection` (which clones it immediately WITHOUT
 * disturbing the buffer). Returns null when the selection isn't a non-empty
 * entity selection.
 */
const payloadFromSelection = (): ClipboardPayload | null => {
  const state = useDocumentStore.getState();
  if (state.selection.kind !== 'entities') return null;
  const ids = state.selection.ids;
  if (ids.length === 0) return null;
  const idSet = new Set(ids);
  const doc = currentDoc(state);
  const entities = ids.map((id) => doc.entities[id]).filter((e): e is Entity => e !== undefined);
  if (entities.length === 0) return null;
  const edges = Object.values(doc.edges).filter(
    (e) => idSet.has(e.sourceId) && idSet.has(e.targetId)
  );
  return { entities, edges };
};

/**
 * Copy the current entity multi-selection (and the edges entirely inside it)
 * to a module-scoped buffer. Returns the number of entities captured — 0
 * means "nothing to do" so the caller can decide whether to swallow the key.
 * A fresh copy resets the paste cascade so the first paste offsets one step.
 */
export const copySelection = (): number => {
  const payload = payloadFromSelection();
  if (!payload) return 0;
  buffer = payload;
  pasteCascade = 0;
  return payload.entities.length;
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
 * Splice a payload's entities + edges into the active document at a diagonal
 * `offset` (px, applied to any hand-positioned coordinate). Mints fresh IDs
 * for every entity, remaps edge endpoints, and gives each copy the next
 * annotation number. Junctor group ids and cross-entity binding fields are
 * dropped so the doc stays consistent. One history step; selects the copies.
 * Shared by `pasteClipboard` and `duplicateSelection`.
 */
const cloneIntoDoc = (payload: ClipboardPayload, offset: number): PasteResult => {
  const state = useDocumentStore.getState();
  const doc = currentDoc(state);
  const startAnnotation = doc.nextAnnotationNumber;

  // Mint new entities, preserve the per-entity id mapping for edge remap.
  const idMap = new Map<string, string>();
  const newEntities: Entity[] = payload.entities.map((src, i) => {
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
      // Offset the hand-positioned coordinate so the copy is visible rather
      // than stacked exactly on the source (manual-layout diagrams only; the
      // conditional spread keeps exactOptionalPropertyTypes happy — never
      // assign `position: undefined`).
      ...(carried.position
        ? { position: { x: carried.position.x + offset, y: carried.position.y + offset } }
        : {}),
      id: minted.id,
      annotationNumber: minted.annotationNumber,
      createdAt: minted.createdAt,
      updatedAt: minted.updatedAt,
    };
    idMap.set(src.id, next.id);
    return next;
  });

  const newEdges: Edge[] = [];
  for (const src of payload.edges) {
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

/**
 * Paste a previously-captured buffer back into the document. Mints fresh IDs
 * for every entity, remaps edge endpoints, and gives each pasted entity the
 * next annotation number from the doc. Edge assumption references that point
 * at non-copied entities are dropped — the doc stays consistent.
 *
 * Pasting twice produces two independent copies because the IDs are minted
 * each call; each successive paste of the same buffer offsets one step further
 * so repeated pastes fan out instead of stacking on one spot.
 */
export const pasteClipboard = (): PasteResult => {
  if (!buffer || buffer.entities.length === 0) return { ok: false };
  pasteCascade += 1;
  return cloneIntoDoc(buffer, PASTE_STEP * pasteCascade);
};

/**
 * Duplicate the current entity selection in place (offset one step). Unlike
 * copy-then-paste this does NOT touch the shared clipboard buffer — a
 * duplicate never clobbers what the user previously copied. Returns
 * `{ ok: false }` when there's no non-empty entity selection.
 */
export const duplicateSelection = (): PasteResult => {
  const payload = payloadFromSelection();
  if (!payload) return { ok: false };
  return cloneIntoDoc(payload, PASTE_STEP);
};

/**
 * Session 193 — merge a WHOLE source document's subgraph (every entity, edge,
 * junctor group, and entity group) into the active document. Powers the Pattern
 * Library's "Insert into current diagram" action: unlike a clipboard paste of a
 * partial selection — which drops junctor groups because they'd dangle — a
 * pattern is a complete, self-consistent subgraph, so its AND/OR/XOR logic and
 * groups are carried over with FRESH ids (remapped so they never collide with
 * the host doc's). Entities get fresh ids + continuing annotation numbers, and
 * a small diagonal offset keeps hand-positioned (manual-layout) diagrams from
 * landing exactly on existing content. One history step; selects the insert.
 *
 * Cross-binding / singleton entity fields (`ecSlot`, `links`, `coreProblem`,
 * `importedFrom`) are dropped for the same reason paste drops them — they refer
 * outside the subgraph or designate a per-doc singleton.
 */
const MERGE_OFFSET = 48;

export const mergeDocIntoActive = (source: TPDocument): { entities: number; edges: number } => {
  const state = useDocumentStore.getState();
  const doc = currentDoc(state);
  const startAnnotation = doc.nextAnnotationNumber;

  const idMap = new Map<string, string>();
  const newEntities: Entity[] = Object.values(source.entities).map((src, i) => {
    const minted = createEntity({
      type: src.type,
      title: src.title,
      annotationNumber: startAnnotation + i,
    });
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
      ...(carried.position
        ? {
            position: {
              x: carried.position.x + MERGE_OFFSET,
              y: carried.position.y + MERGE_OFFSET,
            },
          }
        : {}),
      id: minted.id,
      annotationNumber: minted.annotationNumber,
      createdAt: minted.createdAt,
      updatedAt: minted.updatedAt,
    };
    idMap.set(src.id, next.id);
    return next;
  });

  // Remap junctor group ids so a set of edges that shared one junctor in the
  // source still share ONE (fresh) junctor in the host — and never collide with
  // a junctor id already in the host doc.
  const junctorMap = new Map<string, string>();
  const remapJunctor = (gid: string | undefined): string | undefined => {
    if (gid === undefined) return undefined;
    let mapped = junctorMap.get(gid);
    if (!mapped) {
      mapped = nanoid();
      junctorMap.set(gid, mapped);
    }
    return mapped;
  };

  const newEdges: Edge[] = [];
  for (const src of Object.values(source.edges)) {
    const newSource = idMap.get(src.sourceId);
    const newTarget = idMap.get(src.targetId);
    if (!newSource || !newTarget) continue;
    const base = createEdge({ sourceId: newSource, targetId: newTarget });
    const andGroupId = remapJunctor(src.andGroupId);
    const orGroupId = remapJunctor(src.orGroupId);
    const xorGroupId = remapJunctor(src.xorGroupId);
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
      ...(andGroupId !== undefined ? { andGroupId } : {}),
      ...(orGroupId !== undefined ? { orGroupId } : {}),
      ...(xorGroupId !== undefined ? { xorGroupId } : {}),
    };
    newEdges.push(next);
  }

  // Carry entity groups with fresh ids + remapped member ids (drop empties —
  // a group whose members didn't come across would be a phantom).
  const newGroups: Record<string, Group> = {};
  for (const g of Object.values(source.groups ?? {})) {
    const memberIds = g.memberIds
      .map((mid) => idMap.get(mid))
      .filter((x): x is string => x !== undefined);
    if (memberIds.length === 0) continue;
    const gid = newGroupId();
    newGroups[gid] = { ...g, id: gid, memberIds };
  }

  const nextDoc: TPDocument = {
    ...doc,
    entities: {
      ...doc.entities,
      ...Object.fromEntries(newEntities.map((e) => [e.id, e])),
    },
    edges: {
      ...doc.edges,
      ...Object.fromEntries(newEdges.map((e) => [e.id, e])),
    },
    groups: { ...doc.groups, ...newGroups },
    nextAnnotationNumber: startAnnotation + newEntities.length,
    updatedAt: Date.now(),
  };
  state.setDocument(nextDoc);
  state.selectEntities(newEntities.map((e) => e.id));
  return { entities: newEntities.length, edges: newEdges.length };
};

/** Test seam — clears the in-memory clipboard. */
export const __clearClipboardForTest = (): void => {
  buffer = null;
  pasteCascade = 0;
};
// Session 86 (#5) — dropped the dead `__getClipboardForTest` peek helper.
// No test ever called it (the live clipboard tests assert via the public
// `pasteAtOffset` / `cut` round-trip instead). Reintroduce as a typed seam
// if a future test truly needs to inspect the buffer without consuming it.
