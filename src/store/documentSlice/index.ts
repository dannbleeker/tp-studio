import type { StateCreator } from 'zustand';
import type { RootStore } from '../types';
import { createDocMetaSlice, type DocMetaSlice, docMetaDefaults } from './docMetaSlice';
import { createEdgesSlice, type EdgesSlice } from './edgesSlice';
import { createEntitiesSlice, type EntitiesSlice } from './entitiesSlice';
import { createGroupsSlice, type GroupsSlice } from './groupsSlice';

export type { ApplyDocChange } from './docMutate';
// Re-export the shared helpers so external consumers (e.g. `quickCapture`
// service which does its own `applyDocChange`-style flow) keep working.
export { edgePatch, entityPatch, makeApplyDocChange, scrubFromGroups, touch } from './docMutate';

/**
 * Document slice as the consumer-facing union of four sub-slices. Each
 * sub-slice owns a cohesive part of the document model:
 *
 *   - `DocMetaSlice` — the `doc` field itself + setDocument / newDocument /
 *     setTitle / setDocumentMeta + CLR warning resolve / unresolve.
 *   - `EntitiesSlice` — addEntity / updateEntity / deleteEntity, per-entity
 *     toggles (collapse / position), bulk delete, swap, and the assumption
 *     helpers that create assumption entities + attach them to edges.
 *   - `EdgesSlice` — connect / updateEdge / deleteEdge / reverseEdge plus
 *     AND grouping.
 *   - `GroupsSlice` — create / delete / rename / recolor / membership /
 *     collapse toggle for the entity-grouping feature.
 *
 * The four are concatenated into one object at slice-creation time. The
 * shared mutation helpers live in `./docMutate` so each sub-slice can
 * build its own `applyDocChange` closure bound to the same `get` / `set`.
 */
export type DocumentSlice = DocMetaSlice & EntitiesSlice & EdgesSlice & GroupsSlice;

/**
 * Data-only defaults. Batch 2.1 — the document slice now carries the
 * multi-doc state fields (`docs` / `activeDocId` / `tabOrder`) alongside
 * `doc`; `docMetaDefaults()` builds all four around one fresh document so
 * `resetStoreForTest` lands a consistent single-tab state.
 */
export const documentDefaults = (): Pick<
  DocumentSlice,
  'doc' | 'docs' | 'activeDocId' | 'tabOrder'
> => docMetaDefaults();

export const createDocumentSlice: StateCreator<RootStore, [], [], DocumentSlice> = (...args) => ({
  ...createDocMetaSlice(...args),
  ...createEntitiesSlice(...args),
  ...createEdgesSlice(...args),
  ...createGroupsSlice(...args),
});
