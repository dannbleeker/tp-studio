import { createDocument, createEdge, createEntity } from '@/domain/factory';
import { hasEdge, removeEntityFromEdges } from '@/domain/graph';
import { loadFromLocalStorage } from '@/domain/persistence';
import type {
  DiagramType,
  Edge,
  EdgeId,
  Entity,
  EntityId,
  EntityType,
  TPDocument,
} from '@/domain/types';
import { flushPersist, persistDebounced } from '@/services/persistDebounced';
import { nanoid } from 'nanoid';
import type { StateCreator } from 'zustand';
import { pushHistoryEntry } from './historySlice';
import type { RootStore } from './types';

export type DocumentSlice = {
  doc: TPDocument;
  setDocument: (doc: TPDocument) => void;
  newDocument: (diagramType: DiagramType) => void;
  setTitle: (title: string) => void;

  addEntity: (params: { type: EntityType; title?: string; startEditing?: boolean }) => Entity;
  updateEntity: (id: string, patch: Partial<Omit<Entity, 'id' | 'createdAt'>>) => void;
  deleteEntity: (id: string) => void;

  connect: (sourceId: string, targetId: string) => Edge | null;
  updateEdge: (id: string, patch: Partial<Omit<Edge, 'id'>>) => void;
  deleteEdge: (id: string) => void;

  groupAsAnd: (edgeIds: string[]) => { ok: true; groupId: string } | { ok: false; reason: string };
  ungroupAnd: (edgeIds: string[]) => void;

  addAssumptionToEdge: (edgeId: string, title?: string) => Entity | null;
  attachAssumption: (edgeId: string, assumptionId: string) => void;
  detachAssumption: (edgeId: string, assumptionId: string) => void;

  resolveWarning: (warningId: string) => void;
  unresolveWarning: (warningId: string) => void;
};

const touch = (doc: TPDocument): TPDocument => ({ ...doc, updatedAt: Date.now() });

const initialDoc = loadFromLocalStorage() ?? createDocument('crt');

/**
 * Data-only defaults for this slice. Used by resetStoreForTest in tests so
 * a new slice field doesn't require updating every test's setup.
 */
export const documentDefaults = (): Pick<DocumentSlice, 'doc'> => ({
  doc: createDocument('crt'),
});

export const createDocumentSlice: StateCreator<RootStore, [], [], DocumentSlice> = (set, get) => {
  // Internal helper: wraps a mutator with persistence + history-push + future-clear.
  // Bails out if the mutator returns the same reference (no-op).
  const applyDocChange = (
    mutator: (prev: TPDocument) => TPDocument,
    opts: { coalesceKey?: string } = {}
  ): void => {
    const prev = get().doc;
    const next = mutator(prev);
    if (next === prev) return;
    persistDebounced(next);
    set({
      doc: next,
      past: pushHistoryEntry(get().past, {
        doc: prev,
        coalesceKey: opts.coalesceKey,
        t: Date.now(),
      }),
      future: [],
    });
  };

  return {
    doc: initialDoc,

    setDocument: (doc) => {
      const prev = get().doc;
      // Document swap is explicit user intent — persist synchronously.
      persistDebounced(doc);
      flushPersist();
      set({
        doc,
        selection: { kind: 'none' },
        editingEntityId: null,
        past: pushHistoryEntry(get().past, { doc: prev, t: Date.now() }),
        future: [],
      });
    },

    newDocument: (diagramType) => {
      const prev = get().doc;
      const doc = createDocument(diagramType);
      persistDebounced(doc);
      flushPersist();
      set({
        doc,
        selection: { kind: 'none' },
        editingEntityId: null,
        past: pushHistoryEntry(get().past, { doc: prev, t: Date.now() }),
        future: [],
      });
    },

    setTitle: (title) => {
      applyDocChange((prev) => touch({ ...prev, title }), { coalesceKey: 'doc-title' });
    },

    addEntity: ({ type, title, startEditing }) => {
      const entity = createEntity({ type, title });
      applyDocChange((prev) =>
        touch({ ...prev, entities: { ...prev.entities, [entity.id]: entity } })
      );
      set({
        selection: { kind: 'entity', id: entity.id },
        editingEntityId: startEditing ? entity.id : null,
      });
      return entity;
    },

    updateEntity: (id, patch) => {
      const patchKeys = Object.keys(patch).sort().join(',');
      applyDocChange(
        (prev) => {
          const current = prev.entities[id];
          if (!current) return prev;
          const next: Entity = { ...current, ...patch, id: id as EntityId, updatedAt: Date.now() };
          return touch({ ...prev, entities: { ...prev.entities, [id]: next } });
        },
        { coalesceKey: `entity:${id}:${patchKeys}` }
      );
    },

    deleteEntity: (id) => {
      applyDocChange((prev) => {
        if (!prev.entities[id]) return prev;
        const { [id]: _removed, ...rest } = prev.entities;
        return touch({
          ...prev,
          entities: rest,
          edges: removeEntityFromEdges(prev, id),
        });
      });
      set({ selection: { kind: 'none' }, editingEntityId: null });
    },

    connect: (sourceId, targetId) => {
      if (sourceId === targetId) return null;
      const { doc } = get();
      if (!doc.entities[sourceId] || !doc.entities[targetId]) return null;
      if (hasEdge(doc, sourceId, targetId)) return null;
      const edge = createEdge({ sourceId, targetId });
      applyDocChange((prev) => touch({ ...prev, edges: { ...prev.edges, [edge.id]: edge } }));
      return edge;
    },

    updateEdge: (id, patch) => {
      applyDocChange((prev) => {
        const current = prev.edges[id];
        if (!current) return prev;
        const next: Edge = { ...current, ...patch, id: id as EdgeId };
        return touch({ ...prev, edges: { ...prev.edges, [id]: next } });
      });
    },

    deleteEdge: (id) => {
      applyDocChange((prev) => {
        if (!prev.edges[id]) return prev;
        const { [id]: _removed, ...rest } = prev.edges;
        return touch({ ...prev, edges: rest });
      });
      set({ selection: { kind: 'none' } });
    },

    groupAsAnd: (edgeIds) => {
      if (edgeIds.length < 2) {
        return { ok: false, reason: 'Select at least two edges to group as AND.' };
      }
      const { doc } = get();
      const edges = edgeIds.map((id) => doc.edges[id]).filter((e): e is Edge => Boolean(e));
      if (edges.length !== edgeIds.length || edges.length === 0) {
        return { ok: false, reason: 'One or more selected edges no longer exist.' };
      }
      const targetId = edges[0]!.targetId;
      if (!edges.every((e) => e.targetId === targetId)) {
        return { ok: false, reason: 'AND-grouped edges must share the same target.' };
      }
      const existingGroup = edges.find((e) => e.andGroupId)?.andGroupId;
      const groupId = existingGroup ?? nanoid(8);
      applyDocChange((prev) => {
        const nextEdges = { ...prev.edges };
        for (const id of edgeIds) {
          const e = nextEdges[id];
          if (e) nextEdges[id] = { ...e, andGroupId: groupId };
        }
        return touch({ ...prev, edges: nextEdges });
      });
      return { ok: true, groupId };
    },

    ungroupAnd: (edgeIds) => {
      applyDocChange((prev) => {
        const nextEdges = { ...prev.edges };
        let changed = false;
        for (const id of edgeIds) {
          const e = nextEdges[id];
          if (e?.andGroupId) {
            const { andGroupId: _, ...rest } = e;
            nextEdges[id] = rest;
            changed = true;
          }
        }
        return changed ? touch({ ...prev, edges: nextEdges }) : prev;
      });
    },

    addAssumptionToEdge: (edgeId, title) => {
      const edge = get().doc.edges[edgeId];
      if (!edge) return null;
      const entity = createEntity({ type: 'assumption', title });
      applyDocChange((prev) => {
        const e = prev.edges[edgeId];
        if (!e) return prev;
        const current = e.assumptionIds ?? [];
        const nextEdge: Edge = { ...e, assumptionIds: [...current, entity.id] };
        return touch({
          ...prev,
          entities: { ...prev.entities, [entity.id]: entity },
          edges: { ...prev.edges, [edgeId]: nextEdge },
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

    resolveWarning: (warningId) => {
      applyDocChange((prev) =>
        touch({
          ...prev,
          resolvedWarnings: { ...prev.resolvedWarnings, [warningId]: true },
        })
      );
    },

    unresolveWarning: (warningId) => {
      applyDocChange((prev) => {
        if (!prev.resolvedWarnings[warningId]) return prev;
        const { [warningId]: _removed, ...rest } = prev.resolvedWarnings;
        return touch({ ...prev, resolvedWarnings: rest });
      });
    },
  };
};
