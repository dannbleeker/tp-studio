import type { StateCreator } from 'zustand';
import type { RootStore } from '../types';
import { type DocMetaSlice, createDocMetaSlice, docMetaDefaults } from './docMetaSlice';
import { type EdgesSlice, createEdgesSlice } from './edgesSlice';
import { type EntitiesSlice, createEntitiesSlice } from './entitiesSlice';
import { type GroupsSlice, createGroupsSlice } from './groupsSlice';

// Re-export the shared helpers so external consumers (e.g. `quickCapture`
// service which does its own `applyDocChange`-style flow) keep working.
export { makeApplyDocChange, touch, entityPatch, edgePatch, scrubFromGroups } from './docMutate';
export type { ApplyDocChange } from './docMutate';

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
 * Data-only defaults. The doc field is the only piece of state here; the
 * sub-slices are action-only beyond that. Used by `resetStoreForTest`.
 */
export const documentDefaults = (): Pick<DocumentSlice, 'doc'> => docMetaDefaults();

export const createDocumentSlice: StateCreator<RootStore, [], [], DocumentSlice> = (...args) => ({
  ...createDocMetaSlice(...args),
  ...createEntitiesSlice(...args),
  ...createEdgesSlice(...args),
  ...createGroupsSlice(...args),
});
