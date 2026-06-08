/**
 * Core entity CRUD + per-entity feature fields. The biggest of the four
 * `entitiesSlice` sub-modules:
 *
 *   - add / update / delete (single + bulk)
 *   - cross-diagram import (`addImportedEntity`)
 *   - collapse / position / ordering
 *   - swap (rotate two entities' content while keeping ids pinned)
 *
 * Lives separately from the assumption / attribute / evidence actions
 * so each cluster reads at a glance instead of being buried in a
 * 600-line file.
 */

import { createEntity } from '@/domain/factory';
import {
  pruneAssumptions,
  pruneComments,
  pruneSingletonJunctors,
  removeEntityFromEdges,
} from '@/domain/graph';
import { saveDocToLocalStorage } from '@/domain/persistence';
import type { DocumentId, Entity, EntityState, EntityType, Patch } from '@/domain/types';
import { currentDoc } from '../../selectors';
import { entityPatch, prunedSpread, scrubFromGroups, touch } from '../docMutate';
import { stripMirrorLinks } from '../linkPrune';
import type { EntityFactoryDeps } from './shared';

export type EntityCrudActions = {
  addEntity: (params: { type: EntityType; title?: string; startEditing?: boolean }) => Entity;
  updateEntity: (id: string, patch: Patch<Omit<Entity, 'id' | 'createdAt'>>) => void;
  deleteEntity: (id: string) => void;
  toggleEntityCollapsed: (id: string) => void;
  setEntityPosition: (id: string, position: { x: number; y: number } | null) => void;
  clearAllEntityPositions: () => number;
  swapEntities: (aId: string, bId: string) => void;
  deleteEntitiesAndEdges: (entityIds: string[], edgeIds: string[]) => void;
  /** Session 137 / multi-doc Batch 1 — `sourceDocId` tightened from
   *  `string` to the branded `DocumentId` type so future cross-doc
   *  operations can't accidentally pass an EntityId / GroupId here.
   *  Call sites already pass `state.sourceDoc.id`, which is
   *  `TPDocument.id: DocumentId`. */
  addImportedEntity: (params: { sourceDocId: DocumentId; sourceEntity: Entity }) => Entity | null;
  /** Phase 1C — write a batch of entity `state` values in ONE history
   *  step. Used by `commitSpeculation` so reverting a committed what-if
   *  is a single undo, not one-per-entity. A `state` of `undefined`
   *  clears the field (back to "unknown"). No-ops on unknown ids and
   *  on entries whose state already matches. */
  setEntityStates: (entries: { id: string; state: EntityState | undefined }[]) => void;
};

export function createEntityCrudActions({
  get,
  set,
  applyDocChange,
}: EntityFactoryDeps): EntityCrudActions {
  // After deleting entities from the active doc, sweep the reciprocal cross-doc
  // links those entities had out of the OTHER open tabs (see `stripMirrorLinks`).
  // No-op unless a mirror actually matched; persists exactly the docs that
  // changed. Links are navigation metadata, so this rides OUTSIDE the delete's
  // history entry and never touches the active doc — same as `unlinkEntity`.
  const sweepMirrorLinks = (deletedIds: ReadonlySet<string>): void => {
    const { docs, activeDocId } = get();
    const result = stripMirrorLinks(docs, activeDocId, deletedIds);
    if (result.changed.length === 0) return;
    set({ docs: result.docs });
    for (const d of result.changed) saveDocToLocalStorage(d);
  };

  return {
    addEntity: ({ type, title, startEditing }) => {
      const annotationNumber = currentDoc(get()).nextAnnotationNumber;
      const entity = createEntity({ type, title, annotationNumber });
      applyDocChange((prev) =>
        touch({
          ...prev,
          entities: { ...prev.entities, [entity.id]: entity },
          nextAnnotationNumber: annotationNumber + 1,
        })
      );
      set({
        selection: { kind: 'entities', ids: [entity.id] },
        editingEntityId: startEditing ? entity.id : null,
      });
      return entity;
    },

    updateEntity: (id, patch) => {
      const patchKeys = Object.keys(patch).sort().join(',');
      applyDocChange((prev) => entityPatch(prev, id, patch), {
        coalesceKey: `entity:${id}:${patchKeys}`,
      });
    },

    addImportedEntity: ({ sourceDocId, sourceEntity }) => {
      // Session 135 / spec major gap #3 Phase 1B — mint an entity in the
      // current doc that points back to its origin. Copies type +
      // title + description so the new entity reads sensibly; the
      // `importedFrom` ref records the source. Selection moves to the
      // new entity so the user sees what they just imported.
      if (!sourceDocId || !sourceEntity?.id) return null;
      const annotationNumber = currentDoc(get()).nextAnnotationNumber;
      const base = createEntity({
        type: sourceEntity.type,
        title: sourceEntity.title,
        annotationNumber,
      });
      const entity: Entity = {
        ...base,
        ...(sourceEntity.description ? { description: sourceEntity.description } : {}),
        importedFrom: {
          docId: sourceDocId,
          entityId: sourceEntity.id,
          ...(sourceEntity.title ? { sourceTitle: sourceEntity.title } : {}),
          importedAt: new Date().toISOString(),
        },
      };
      applyDocChange((prev) =>
        touch({
          ...prev,
          entities: { ...prev.entities, [entity.id]: entity },
          nextAnnotationNumber: annotationNumber + 1,
        })
      );
      set({
        selection: { kind: 'entities', ids: [entity.id] },
        editingEntityId: null,
      });
      return entity;
    },

    deleteEntity: (id) => {
      // Cheap guard — almost no entity carries cross-doc links; capture before
      // the delete removes it so we can sweep its reciprocal mirrors after.
      const hadLinks = Boolean(currentDoc(get()).entities[id]?.links?.length);
      applyDocChange((prev) => {
        if (!prev.entities[id]) return prev;
        const { [id]: _removed, ...rest } = prev.entities;
        // Cascade the entity's edges away, then collapse any junctor group the
        // cascade left with a single input ("AND of one") back to a plain edge.
        const edges = pruneSingletonJunctors(removeEntityFromEdges(prev, id));
        // Prune assumptions whose host edge was just removed (the entity's
        // edges cascade away) and scrub the deleted entity from injection
        // back-links. Conditional spread keeps `assumptions` absent when the
        // doc never had any.
        const assumptions = pruneAssumptions(prev.assumptions, edges, rest);
        // Prune comments anchored to the removed entity or any cascaded edge.
        const comments = pruneComments(prev.comments, edges, rest);
        return touch({
          ...prev,
          entities: rest,
          edges,
          groups: scrubFromGroups(prev.groups, [id]),
          ...prunedSpread(prev, { assumptions, comments }),
        });
      });
      set({ selection: { kind: 'none' }, editingEntityId: null });
      if (hadLinks) sweepMirrorLinks(new Set([id]));
    },

    toggleEntityCollapsed: (id) => {
      const cur = currentDoc(get()).entities[id];
      if (!cur) return;
      applyDocChange((prev) =>
        entityPatch(prev, id, { collapsed: cur.collapsed ? undefined : true })
      );
    },

    /**
     * Persist a hand-positioned coordinate on an entity. Passing `null`
     * clears the field so the entity reverts to wherever the layout
     * strategy puts it (dagre output for `'auto'` diagrams, `{0,0}` for
     * `'manual'` diagrams that haven't been positioned yet).
     *
     * Coalesces by `pos:<id>` so React Flow's drag stream — which fires one
     * `set` per frame while the user holds the mouse — collapses into a
     * single undo entry per drag, not 60.
     */
    setEntityPosition: (id, position) => {
      applyDocChange((prev) => entityPatch(prev, id, { position: position ?? undefined }), {
        coalesceKey: `pos:${id}`,
      });
    },

    clearAllEntityPositions: () => {
      let cleared = 0;
      applyDocChange((prev) => {
        const nextEntities = { ...prev.entities };
        for (const [id, e] of Object.entries(prev.entities)) {
          if (e.position) {
            const { position: _drop, ...rest } = e;
            nextEntities[id] = { ...rest, updatedAt: Date.now() };
            cleared++;
          }
        }
        if (cleared === 0) return prev;
        return { ...prev, entities: nextEntities, updatedAt: Date.now() };
      });
      return cleared;
    },

    // Swap two entities' content (title, type, description, annotationNumber,
    // createdAt) while keeping their `id`s pinned in place. Edges stay
    // attached to the same ids, so the entity in slot A now reads as B's
    // payload but holds A's connections — and vice versa.
    swapEntities: (aId, bId) => {
      if (aId === bId) return;
      applyDocChange((prev) => {
        const a = prev.entities[aId];
        const b = prev.entities[bId];
        if (!a || !b) return prev;
        const now = Date.now();
        const nextA: Entity = {
          ...b,
          id: a.id,
          createdAt: a.createdAt,
          updatedAt: now,
        };
        const nextB: Entity = {
          ...a,
          id: b.id,
          createdAt: b.createdAt,
          updatedAt: now,
        };
        return touch({
          ...prev,
          entities: { ...prev.entities, [aId]: nextA, [bId]: nextB },
        });
      });
    },

    // Bulk delete: entities + standalone edges in one history step. Cascade
    // edges that touch any deleted entity (existing single-delete behavior).
    // Assumption ids are scrubbed by `removeEntityFromEdges`.
    deleteEntitiesAndEdges: (entityIds, edgeIds) => {
      if (entityIds.length === 0 && edgeIds.length === 0) return;
      const before = currentDoc(get());
      const hadLinks = entityIds.some((id) => before.entities[id]?.links?.length);
      applyDocChange((prev) => {
        let edges = prev.edges;
        const entities = { ...prev.entities };
        let changed = false;
        for (const id of entityIds) {
          if (entities[id]) {
            delete entities[id];
            edges = removeEntityFromEdges({ ...prev, edges }, id);
            changed = true;
          }
        }
        const explicitlyDeleted = { ...edges };
        for (const id of edgeIds) {
          if (explicitlyDeleted[id]) {
            delete explicitlyDeleted[id];
            changed = true;
          }
        }
        if (!changed) return prev;
        // Collapse any junctor group the cascade / explicit delete left with a
        // single input ("AND of one") back to a plain edge — matches what the
        // single-entity `deleteEntity` path does; the bulk path used to skip it,
        // leaving a survivor tagged with a now-vacuous and/or/xor group id.
        const nextEdges = pruneSingletonJunctors(explicitlyDeleted);
        const assumptions = pruneAssumptions(prev.assumptions, nextEdges, entities);
        const comments = pruneComments(prev.comments, nextEdges, entities);
        return touch({
          ...prev,
          entities,
          edges: nextEdges,
          groups: scrubFromGroups(prev.groups, entityIds),
          ...prunedSpread(prev, { assumptions, comments }),
        });
      });
      set({ selection: { kind: 'none' }, editingEntityId: null });
      if (hadLinks) sweepMirrorLinks(new Set(entityIds));
    },

    setEntityStates: (entries) => {
      if (entries.length === 0) return;
      applyDocChange((prev) => {
        let changed = false;
        const nextEntities = { ...prev.entities };
        for (const { id, state } of entries) {
          const cur = prev.entities[id];
          if (!cur) continue;
          // No-op per entity when the state already matches. An absent
          // optional field reads as `undefined`, so a plain `===` treats
          // absent === undefined (clearing a never-set field is a no-op too).
          if (cur.state === state) continue;
          // Emit-or-omit: clearing drops the field rather than storing
          // `state: undefined` (exactOptionalPropertyTypes + the
          // persist convention).
          const { state: _drop, ...rest } = cur;
          nextEntities[id] = state
            ? { ...cur, state, updatedAt: Date.now() }
            : { ...rest, updatedAt: Date.now() };
          changed = true;
        }
        if (!changed) return prev;
        return touch({ ...prev, entities: nextEntities });
      });
    },
  };
}
