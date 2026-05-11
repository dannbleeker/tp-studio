import { COALESCE_WINDOW_MS, HISTORY_LIMIT } from '@/domain/constants';
import type { TPDocument } from '@/domain/types';
import { persistDebounced } from '@/services/persistDebounced';
import type { StateCreator } from 'zustand';
import type { RootStore } from './types';

export type HistoryEntry = {
  doc: TPDocument;
  coalesceKey?: string;
  t: number;
};

export type HistorySlice = {
  past: HistoryEntry[];
  future: HistoryEntry[];
  undo: () => void;
  redo: () => void;
};

/**
 * Pure helper. Returns a new past stack with `entry` appended, except when
 * `entry.coalesceKey` matches the last entry and falls within the coalesce
 * window — in that case the existing "before" snapshot is kept so a burst of
 * same-field edits collapses into one undo step.
 */
export const pushHistoryEntry = (past: HistoryEntry[], entry: HistoryEntry): HistoryEntry[] => {
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

/**
 * Data-only defaults for this slice. Used by resetStoreForTest.
 */
export const historyDefaults = (): Pick<HistorySlice, 'past' | 'future'> => ({
  past: [],
  future: [],
});

export const createHistorySlice: StateCreator<RootStore, [], [], HistorySlice> = (set, get) => ({
  past: [],
  future: [],

  undo: () => {
    const { past, doc, future } = get();
    const last = past[past.length - 1];
    if (!last) return;
    persistDebounced(last.doc);
    set({
      doc: last.doc,
      past: past.slice(0, -1),
      future: [...future, { doc, t: Date.now() }],
      editingEntityId: null,
    });
  },

  redo: () => {
    const { future, doc, past } = get();
    const next = future[future.length - 1];
    if (!next) return;
    persistDebounced(next.doc);
    set({
      doc: next.doc,
      future: future.slice(0, -1),
      past: [...past, { doc, t: Date.now() }],
      editingEntityId: null,
    });
  },
});
