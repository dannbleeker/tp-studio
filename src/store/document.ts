import { nanoid } from 'nanoid';
import { create } from 'zustand';
import { createDocument, createEdge, createEntity } from '../domain/factory';
import { loadFromLocalStorage, saveToLocalStorage } from '../domain/persistence';
import type { DiagramType, Edge, Entity, EntityType, TPDocument } from '../domain/types';

export type Selection =
  | { kind: 'entity'; id: string }
  | { kind: 'edge'; id: string }
  | { kind: 'none' };

export type Theme = 'light' | 'dark';

export type ContextMenuTarget =
  | { kind: 'entity'; id: string }
  | { kind: 'edge'; id: string }
  | { kind: 'pane' };

export type ContextMenuState =
  | { open: true; x: number; y: number; target: ContextMenuTarget }
  | { open: false };

export type ToastKind = 'info' | 'success' | 'error';
export type Toast = { id: number; kind: ToastKind; message: string };

type HistoryEntry = {
  doc: TPDocument;
  coalesceKey?: string;
  t: number;
};

const HISTORY_LIMIT = 100;
const COALESCE_WINDOW_MS = 1000;

type DocumentState = {
  doc: TPDocument;
  selection: Selection;
  editingEntityId: string | null;
  paletteOpen: boolean;
  helpOpen: boolean;
  theme: Theme;
  contextMenu: ContextMenuState;
  toasts: Toast[];
  past: HistoryEntry[];
  future: HistoryEntry[];
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

  groupAsAnd: (edgeIds: string[]) => { ok: true; groupId: string } | { ok: false; reason: string };
  ungroupAnd: (edgeIds: string[]) => void;

  select: (sel: Selection) => void;
  beginEditing: (id: string) => void;
  endEditing: () => void;

  resolveWarning: (warningId: string) => void;
  unresolveWarning: (warningId: string) => void;

  openPalette: () => void;
  closePalette: () => void;
  togglePalette: () => void;

  openHelp: () => void;
  closeHelp: () => void;

  openContextMenu: (target: ContextMenuTarget, x: number, y: number) => void;
  closeContextMenu: () => void;

  showToast: (kind: ToastKind, message: string) => void;
  dismissToast: (id: number) => void;

  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;

  undo: () => void;
  redo: () => void;
};

export type DocumentStore = DocumentState & DocumentActions;

const touch = (doc: TPDocument): TPDocument => ({ ...doc, updatedAt: Date.now() });

const edgeExists = (doc: TPDocument, sourceId: string, targetId: string): boolean =>
  Object.values(doc.edges).some((e) => e.sourceId === sourceId && e.targetId === targetId);

const persist = (doc: TPDocument): void => {
  saveToLocalStorage(doc);
};

const STORAGE_THEME_KEY = 'tp-studio:theme';

const initialDoc = loadFromLocalStorage() ?? createDocument('crt');
const initialTheme: Theme =
  typeof globalThis.localStorage !== 'undefined'
    ? globalThis.localStorage.getItem(STORAGE_THEME_KEY) === 'dark'
      ? 'dark'
      : 'light'
    : 'light';

const pushHistory = (past: HistoryEntry[], entry: HistoryEntry): HistoryEntry[] => {
  const last = past[past.length - 1];
  if (
    entry.coalesceKey &&
    last?.coalesceKey === entry.coalesceKey &&
    entry.t - last.t < COALESCE_WINDOW_MS
  ) {
    return past;
  }
  return [...past, entry].slice(-HISTORY_LIMIT);
};

export const useDocumentStore = create<DocumentStore>((set, get) => {
  const applyDocChange = (
    mutator: (prev: TPDocument) => TPDocument,
    opts: { coalesceKey?: string } = {}
  ): void => {
    const prev = get().doc;
    const next = mutator(prev);
    if (next === prev) return;
    persist(next);
    set({
      doc: next,
      past: pushHistory(get().past, {
        doc: prev,
        coalesceKey: opts.coalesceKey,
        t: Date.now(),
      }),
      future: [],
    });
  };

  return {
    doc: initialDoc,
    selection: { kind: 'none' },
    editingEntityId: null,
    paletteOpen: false,
    helpOpen: false,
    theme: initialTheme,
    contextMenu: { open: false },
    toasts: [],
    past: [],
    future: [],

    setDocument: (doc) => {
      const prev = get().doc;
      persist(doc);
      set({
        doc,
        selection: { kind: 'none' },
        editingEntityId: null,
        past: pushHistory(get().past, { doc: prev, t: Date.now() }),
        future: [],
      });
    },

    newDocument: (diagramType) => {
      const prev = get().doc;
      const doc = createDocument(diagramType);
      persist(doc);
      set({
        doc,
        selection: { kind: 'none' },
        editingEntityId: null,
        past: pushHistory(get().past, { doc: prev, t: Date.now() }),
        future: [],
      });
    },

    setTitle: (title) => {
      applyDocChange((prev) => touch({ ...prev, title }), {
        coalesceKey: 'doc-title',
      });
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
          const next: Entity = { ...current, ...patch, id, updatedAt: Date.now() };
          return touch({ ...prev, entities: { ...prev.entities, [id]: next } });
        },
        { coalesceKey: `entity:${id}:${patchKeys}` }
      );
    },

    deleteEntity: (id) => {
      applyDocChange((prev) => {
        if (!prev.entities[id]) return prev;
        const { [id]: _removed, ...rest } = prev.entities;
        const edges = Object.fromEntries(
          Object.entries(prev.edges).filter(([, e]) => e.sourceId !== id && e.targetId !== id)
        );
        return touch({ ...prev, entities: rest, edges });
      });
      set({ selection: { kind: 'none' }, editingEntityId: null });
    },

    connect: (sourceId, targetId) => {
      if (sourceId === targetId) return null;
      const { doc } = get();
      if (!doc.entities[sourceId] || !doc.entities[targetId]) return null;
      if (edgeExists(doc, sourceId, targetId)) return null;
      const edge = createEdge({ sourceId, targetId });
      applyDocChange((prev) => touch({ ...prev, edges: { ...prev.edges, [edge.id]: edge } }));
      return edge;
    },

    updateEdge: (id, patch) => {
      applyDocChange((prev) => {
        const current = prev.edges[id];
        if (!current) return prev;
        const next: Edge = { ...current, ...patch, id };
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
      if (edges.length !== edgeIds.length) {
        return { ok: false, reason: 'One or more selected edges no longer exist.' };
      }
      const targetId = edges[0].targetId;
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

    select: (selection) => set({ selection }),
    beginEditing: (id) => set({ editingEntityId: id, selection: { kind: 'entity', id } }),
    endEditing: () => set({ editingEntityId: null }),

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

    openPalette: () => set({ paletteOpen: true }),
    closePalette: () => set({ paletteOpen: false }),
    togglePalette: () => set({ paletteOpen: !get().paletteOpen }),

    openHelp: () => set({ helpOpen: true }),
    closeHelp: () => set({ helpOpen: false }),

    openContextMenu: (target, x, y) => set({ contextMenu: { open: true, target, x, y } }),
    closeContextMenu: () => set({ contextMenu: { open: false } }),

    showToast: (kind, message) => {
      const id = Date.now() + Math.floor(Math.random() * 1000);
      set({ toasts: [...get().toasts, { id, kind, message }] });
      setTimeout(() => {
        set({ toasts: get().toasts.filter((t) => t.id !== id) });
      }, 2200);
    },
    dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),

    setTheme: (theme) => {
      if (typeof globalThis.localStorage !== 'undefined') {
        globalThis.localStorage.setItem(STORAGE_THEME_KEY, theme);
      }
      set({ theme });
    },
    toggleTheme: () => {
      const next: Theme = get().theme === 'dark' ? 'light' : 'dark';
      if (typeof globalThis.localStorage !== 'undefined') {
        globalThis.localStorage.setItem(STORAGE_THEME_KEY, next);
      }
      set({ theme: next });
    },

    undo: () => {
      const { past, doc, future } = get();
      if (past.length === 0) return;
      const last = past[past.length - 1];
      persist(last.doc);
      set({
        doc: last.doc,
        past: past.slice(0, -1),
        future: [...future, { doc, t: Date.now() }],
        editingEntityId: null,
      });
    },

    redo: () => {
      const { future, doc, past } = get();
      if (future.length === 0) return;
      const next = future[future.length - 1];
      persist(next.doc);
      set({
        doc: next.doc,
        future: future.slice(0, -1),
        past: [...past, { doc, t: Date.now() }],
        editingEntityId: null,
      });
    },
  };
});
