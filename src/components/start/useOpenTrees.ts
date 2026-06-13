import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { DocumentId, TPDocument } from '@/domain/types';
import { validate } from '@/domain/validators';
import { useDocumentStore } from '@/store';

export type OpenTree = {
  id: DocumentId;
  doc: TPDocument;
  /** Unresolved CLR reservations — the SAME pure `validate(doc)` the editor's
   *  Logic chip + inspector use, so a tree card's pill can never disagree. */
  openWarnings: number;
  isActive: boolean;
};

/**
 * Session 183 — the user's open trees for the Start galleries: every open tab,
 * most-recently-edited first, each tagged with its open-reservation count. The
 * model holds only open tabs (closed docs are forgotten), so "All trees" /
 * "Recent" / "Needs review" all read from here. `validate` is cached, and the
 * memo only recomputes when the docs / tab order / active doc change.
 */
export function useOpenTrees(): OpenTree[] {
  const { docs, tabOrder, activeDocId } = useDocumentStore(
    useShallow((s) => ({ docs: s.docs, tabOrder: s.tabOrder, activeDocId: s.activeDocId }))
  );
  return useMemo(
    () =>
      tabOrder
        .map((id) => docs[id])
        .filter((d): d is TPDocument => Boolean(d))
        .map((doc) => ({
          id: doc.id,
          doc,
          openWarnings: validate(doc).filter((w) => !w.resolved).length,
          isActive: doc.id === activeDocId,
        }))
        .sort((a, b) => b.doc.updatedAt - a.doc.updatedAt),
    [docs, tabOrder, activeDocId]
  );
}
