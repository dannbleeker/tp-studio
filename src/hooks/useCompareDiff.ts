import { type DetailedRevisionDiff, computeDetailedRevisionDiff } from '@/domain/revisions';
import { useDocumentStore } from '@/store';
import { useMemo } from 'react';

/**
 * H2 visual-diff plumbing. When `compareRevisionId` is set, return the
 * detailed ID-level diff between that revision's doc and the live doc.
 * Otherwise return `null`.
 *
 * Memoized on the doc and revision identities — switching tabs or making
 * edits invalidates the diff; toggling the compare mode off and back on
 * recomputes once. The hook lives at the React-hook layer (not the
 * graph-view pipeline) because the diff is also consumed by
 * `SideBySideDialog` (H4), which doesn't go through `useGraphView`.
 */
export const useCompareDiff = (): DetailedRevisionDiff | null => {
  const compareRevisionId = useDocumentStore((s) => s.compareRevisionId);
  const revisions = useDocumentStore((s) => s.revisions);
  const liveDoc = useDocumentStore((s) => s.doc);

  return useMemo(() => {
    if (!compareRevisionId) return null;
    const rev = revisions.find((r) => r.id === compareRevisionId);
    if (!rev) return null;
    return computeDetailedRevisionDiff(rev.doc, liveDoc);
  }, [compareRevisionId, revisions, liveDoc]);
};
