import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { listSavedDocIds, loadSavedDoc } from '@/domain/persistence';
import type { DocumentId, TPDocument } from '@/domain/types';
import { validate } from '@/domain/validators';
import { useDocumentStore } from '@/store';

export type SavedTree = {
  id: DocumentId;
  doc: TPDocument;
  /** Unresolved CLR reservations — the SAME pure `validate(doc)` the editor's
   *  Logic chip + inspector use, so a tree card's pill can never disagree. */
  openWarnings: number;
  /** True when the tree is currently open in a tab (vs closed-but-saved). */
  isOpen: boolean;
};

/**
 * Session 184 — the user's saved trees for the Start galleries: EVERY tree in
 * storage, open tabs AND closed ones, most-recently-edited first. Closing a tab
 * no longer deletes its body, so "All trees" is a real library, not just the
 * open set. Open docs use the live store version (fresh title + edits); closed
 * docs are loaded from storage. `validate` is cached, and the memo only
 * recomputes when the open set or `savedDocsVersion` (a delete / forget)
 * changes.
 */
export function useSavedTrees(): SavedTree[] {
  const { docs, tabOrder, savedDocsVersion } = useDocumentStore(
    useShallow((s) => ({
      docs: s.docs,
      tabOrder: s.tabOrder,
      savedDocsVersion: s.savedDocsVersion,
    }))
  );
  return useMemo(() => {
    // `savedDocsVersion` is a re-scan trigger — bumped on a delete / "Forget
    // closed documents" so the localStorage scan below re-runs to drop the gone
    // tree. Read it so it counts as a genuine dependency.
    void savedDocsVersion;
    const openSet = new Set<string>(tabOrder);
    const out: SavedTree[] = [];
    const seen = new Set<string>();
    const add = (id: DocumentId, doc: TPDocument): void => {
      if (seen.has(id)) return;
      seen.add(id);
      out.push({
        id,
        doc,
        openWarnings: validate(doc).filter((w) => !w.resolved).length,
        isOpen: openSet.has(id),
      });
    };
    // Prefer the live store doc for open tabs (it has unsaved edits); fall back
    // to the persisted body for closed trees.
    for (const id of listSavedDocIds()) {
      const doc = docs[id] ?? loadSavedDoc(id);
      if (doc) add(id, doc);
    }
    // Belt-and-suspenders: an open doc not yet flushed to storage still shows.
    for (const id of tabOrder) {
      const doc = docs[id];
      if (doc) add(id, doc);
    }
    return out.sort((a, b) => b.doc.updatedAt - a.doc.updatedAt);
  }, [docs, tabOrder, savedDocsVersion]);
}
