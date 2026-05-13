import { createEntity } from '@/domain/factory';
import { removeEntityFromEdges } from '@/domain/graph';
import type { AttrValue, Edge, Entity, EntityId, EntityType } from '@/domain/types';
import type { StateCreator } from 'zustand';
import type { RootStore } from '../types';
import { entityPatch, makeApplyDocChange, scrubFromGroups, touch } from './docMutate';

/**
 * Entity-level mutations: add / update / delete plus per-entity feature
 * fields (collapse, position, ordering, etc.), bulk delete that scrubs
 * downstream edges/groups, swap of two entities' content, and the
 * assumption-on-edge helpers (which create new assumption entities and
 * attach them to existing edges — primary mutation is on the entities
 * map plus the edge's `assumptionIds`).
 */
export type EntitiesSlice = {
  addEntity: (params: { type: EntityType; title?: string; startEditing?: boolean }) => Entity;
  updateEntity: (id: string, patch: Partial<Omit<Entity, 'id' | 'createdAt'>>) => void;
  deleteEntity: (id: string) => void;
  /** F7: toggle the per-entity disclosure-triangle collapse state. */
  toggleEntityCollapsed: (id: string) => void;
  setEntityPosition: (id: string, position: { x: number; y: number } | null) => void;
  /** LA5 (Session 63): clear every entity's `position` in one operation.
   *  On manual-layout diagrams (EC) this resets the geometry to the
   *  origin; on auto-layout diagrams it un-pins everything so dagre takes
   *  over the entire canvas. Exposed as the "Reset layout" palette
   *  command — the escape hatch when a CRT/FRT pin pile has gotten
   *  unreadable. */
  clearAllEntityPositions: () => number;
  swapEntities: (aId: string, bId: string) => void;
  deleteEntitiesAndEdges: (entityIds: string[], edgeIds: string[]) => void;

  addAssumptionToEdge: (edgeId: string, title?: string) => Entity | null;
  attachAssumption: (edgeId: string, assumptionId: string) => void;
  detachAssumption: (edgeId: string, assumptionId: string) => void;

  /** B7 — set (or replace) a single attribute on an entity. The
   *  `value` is fully typed so the discriminator + value-shape match;
   *  changing kind requires removing then re-adding. No-ops when the
   *  entity doesn't exist or when the attribute already has this
   *  exact value (preserving the no-mutation contract that
   *  `applyDocChange` relies on for history coalescing). */
  setEntityAttribute: (id: string, key: string, value: AttrValue) => void;
  /** B7 — remove one attribute key from an entity. No-op when the
   *  entity has no attributes or when the key is absent. */
  removeEntityAttribute: (id: string, key: string) => void;
};

export const createEntitiesSlice: StateCreator<RootStore, [], [], EntitiesSlice> = (set, get) => {
  const applyDocChange = makeApplyDocChange(get, set);

  return {
    addEntity: ({ type, title, startEditing }) => {
      const annotationNumber = get().doc.nextAnnotationNumber;
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

    deleteEntity: (id) => {
      applyDocChange((prev) => {
        if (!prev.entities[id]) return prev;
        const { [id]: _removed, ...rest } = prev.entities;
        return touch({
          ...prev,
          entities: rest,
          edges: removeEntityFromEdges(prev, id),
          groups: scrubFromGroups(prev.groups, [id]),
        });
      });
      set({ selection: { kind: 'none' }, editingEntityId: null });
    },

    toggleEntityCollapsed: (id) => {
      const cur = get().doc.entities[id];
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
      // `position: undefined` means "clear the field". The no-op check
      // inside `entityPatch` treats two undefined positions as equal and
      // the same-coords case as equal.
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
        const nextEdges = { ...edges };
        for (const id of edgeIds) {
          if (nextEdges[id]) {
            delete nextEdges[id];
            changed = true;
          }
        }
        if (!changed) return prev;
        return touch({
          ...prev,
          entities,
          edges: nextEdges,
          groups: scrubFromGroups(prev.groups, entityIds),
        });
      });
      set({ selection: { kind: 'none' }, editingEntityId: null });
    },

    addAssumptionToEdge: (edgeId, title) => {
      const edge = get().doc.edges[edgeId];
      if (!edge) return null;
      const annotationNumber = get().doc.nextAnnotationNumber;
      const entity = createEntity({ type: 'assumption', title, annotationNumber });
      applyDocChange((prev) => {
        const e = prev.edges[edgeId];
        if (!e) return prev;
        const current = e.assumptionIds ?? [];
        const nextEdge: Edge = { ...e, assumptionIds: [...current, entity.id] };
        return touch({
          ...prev,
          entities: { ...prev.entities, [entity.id]: entity },
          edges: { ...prev.edges, [edgeId]: nextEdge },
          nextAnnotationNumber: annotationNumber + 1,
        });
      });
      return entity;
    },

    attachAssumption: (edgeId, assumptionId) => {
      applyDocChange((prev) => {
        const edge = prev.edges[edgeId];
        const assumption = prev.entities[assumptionId];
        if (!edge || !assumption) return prev;
        const branded = assumptionId as EntityId;
        const current = edge.assumptionIds ?? [];
        if (current.includes(branded)) return prev;
        const nextEdge: Edge = { ...edge, assumptionIds: [...current, branded] };
        return touch({ ...prev, edges: { ...prev.edges, [edgeId]: nextEdge } });
      });
    },

    detachAssumption: (edgeId, assumptionId) => {
      applyDocChange((prev) => {
        const edge = prev.edges[edgeId];
        const branded = assumptionId as EntityId;
        if (!edge?.assumptionIds?.includes(branded)) return prev;
        const filtered = edge.assumptionIds.filter((a) => a !== branded);
        const nextEdge: Edge = {
          ...edge,
          assumptionIds: filtered.length ? filtered : undefined,
        };
        return touch({ ...prev, edges: { ...prev.edges, [edgeId]: nextEdge } });
      });
    },

    // ── B7: user-defined attributes ─────────────────────────────────
    setEntityAttribute: (id, key, value) => {
      applyDocChange((prev) => {
        const cur = prev.entities[id];
        if (!cur) return prev;
        const existing = cur.attributes?.[key];
        // No-op guard: same kind + same value primitive → don't churn
        // history. This is the contract `applyDocChange` relies on.
        if (existing && existing.kind === value.kind && existing.value === value.value) {
          return prev;
        }
        const nextAttrs: Record<string, AttrValue> = { ...(cur.attributes ?? {}), [key]: value };
        const nextEntity: Entity = {
          ...cur,
          attributes: nextAttrs,
          updatedAt: Date.now(),
        };
        return touch({ ...prev, entities: { ...prev.entities, [id]: nextEntity } });
      });
    },

    removeEntityAttribute: (id, key) => {
      applyDocChange((prev) => {
        const cur = prev.entities[id];
        if (!cur || !cur.attributes || !(key in cur.attributes)) return prev;
        const { [key]: _drop, ...rest } = cur.attributes;
        const nextEntity: Entity = {
          ...cur,
          // Empty map collapses to undefined so the entity doesn't
          // carry a useless `attributes: {}` after the last key is
          // removed.
          attributes: Object.keys(rest).length > 0 ? rest : undefined,
          updatedAt: Date.now(),
        };
        return touch({ ...prev, entities: { ...prev.entities, [id]: nextEntity } });
      });
    },
  };
};
