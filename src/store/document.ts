import { create } from 'zustand';
import { createDocument, createEdge, createEntity } from '../domain/factory';
import { loadFromLocalStorage, saveToLocalStorage } from '../domain/persistence';
import type { DiagramType, Edge, Entity, EntityType, TPDocument } from '../domain/types';

export type Selection =
  | { kind: 'entity'; id: string }
  | { kind: 'edge'; id: string }
  | { kind: 'none' };

type DocumentState = {
  doc: TPDocument;
  selection: Selection;
  editingEntityId: string | null;
};

type DocumentActions = {
  setDocument: (doc: TPDocument) => void;
  newDocument: (diagramType: DiagramType) => void;
  setTitle: (title: string) => void;

  addEntity: (params: { type: EntityType; title?: string; startEditing?: boolean }) => Entity;
  updateEntity: (id: string, patch: Partial<Omit<Entity, 'id' | 'createdAt'>>) => void;
  deleteEntity: (id: string) => void;

  connect: (sourceId: string, targetId: string) => Edge | null;
  updateEdge: (id: string, patch: Partial<Omit<Edge, 'id'>>) => void;
  deleteEdge: (id: string) => void;

  select: (sel: Selection) => void;
  beginEditing: (id: string) => void;
  endEditing: () => void;

  resolveWarning: (warningId: string) => void;
  unresolveWarning: (warningId: string) => void;
};

export type DocumentStore = DocumentState & DocumentActions;

const touch = (doc: TPDocument): TPDocument => ({ ...doc, updatedAt: Date.now() });

const edgeExists = (doc: TPDocument, sourceId: string, targetId: string): boolean =>
  Object.values(doc.edges).some((e) => e.sourceId === sourceId && e.targetId === targetId);

const persist = (doc: TPDocument): void => {
  saveToLocalStorage(doc);
};

const initialDoc = loadFromLocalStorage() ?? createDocument('crt');

export const useDocumentStore = create<DocumentStore>((set, get) => ({
  doc: initialDoc,
  selection: { kind: 'none' },
  editingEntityId: null,

  setDocument: (doc) => {
    persist(doc);
    set({ doc, selection: { kind: 'none' }, editingEntityId: null });
  },

  newDocument: (diagramType) => {
    const doc = createDocument(diagramType);
    persist(doc);
    set({ doc, selection: { kind: 'none' }, editingEntityId: null });
  },

  setTitle: (title) => {
    const doc = touch({ ...get().doc, title });
    persist(doc);
    set({ doc });
  },

  addEntity: ({ type, title, startEditing }) => {
    const entity = createEntity({ type, title });
    const doc = touch({
      ...get().doc,
      entities: { ...get().doc.entities, [entity.id]: entity },
    });
    persist(doc);
    set({
      doc,
      selection: { kind: 'entity', id: entity.id },
      editingEntityId: startEditing ? entity.id : null,
    });
    return entity;
  },

  updateEntity: (id, patch) => {
    const current = get().doc.entities[id];
    if (!current) return;
    const next: Entity = { ...current, ...patch, id, updatedAt: Date.now() };
    const doc = touch({
      ...get().doc,
      entities: { ...get().doc.entities, [id]: next },
    });
    persist(doc);
    set({ doc });
  },

  deleteEntity: (id) => {
    const { [id]: _removed, ...rest } = get().doc.entities;
    const edges = Object.fromEntries(
      Object.entries(get().doc.edges).filter(([, e]) => e.sourceId !== id && e.targetId !== id)
    );
    const doc = touch({ ...get().doc, entities: rest, edges });
    persist(doc);
    set({ doc, selection: { kind: 'none' } });
  },

  connect: (sourceId, targetId) => {
    if (sourceId === targetId) return null;
    const { doc } = get();
    if (!doc.entities[sourceId] || !doc.entities[targetId]) return null;
    if (edgeExists(doc, sourceId, targetId)) return null;
    const edge = createEdge({ sourceId, targetId });
    const nextDoc = touch({ ...doc, edges: { ...doc.edges, [edge.id]: edge } });
    persist(nextDoc);
    set({ doc: nextDoc });
    return edge;
  },

  updateEdge: (id, patch) => {
    const current = get().doc.edges[id];
    if (!current) return;
    const next: Edge = { ...current, ...patch, id };
    const doc = touch({ ...get().doc, edges: { ...get().doc.edges, [id]: next } });
    persist(doc);
    set({ doc });
  },

  deleteEdge: (id) => {
    const { [id]: _removed, ...rest } = get().doc.edges;
    const doc = touch({ ...get().doc, edges: rest });
    persist(doc);
    set({ doc, selection: { kind: 'none' } });
  },

  select: (selection) => set({ selection }),
  beginEditing: (id) => set({ editingEntityId: id, selection: { kind: 'entity', id } }),
  endEditing: () => set({ editingEntityId: null }),

  resolveWarning: (warningId) => {
    const doc = touch({
      ...get().doc,
      resolvedWarnings: { ...get().doc.resolvedWarnings, [warningId]: true },
    });
    persist(doc);
    set({ doc });
  },

  unresolveWarning: (warningId) => {
    const { [warningId]: _removed, ...rest } = get().doc.resolvedWarnings;
    const doc = touch({ ...get().doc, resolvedWarnings: rest });
    persist(doc);
    set({ doc });
  },
}));
