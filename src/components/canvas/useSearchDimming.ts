import { findMatches } from '@/domain/search';
import type { TPDocument } from '@/domain/types';
import { useDocumentStore } from '@/store';
import { useMemo } from 'react';
import type { AnyTPNode, TPEdge } from './flow-types';

/**
 * F4: when the find panel is open with a non-empty query that has matches,
 * dim non-matching nodes (and adjacent edges) so the search hits stand out
 * visually. Inspired by Kumu's "showcase" mode — translucent rather than
 * hidden, so the surrounding causal context stays readable.
 *
 * Returns the input arrays untouched when no search is active, so React
 * Flow's referential-equality node/edge cache stays warm. Only when a
 * highlight should apply do we map over and clone, attaching a `tp-dimmed`
 * className to non-matches.
 */
export const useSearchDimming = (
  doc: TPDocument,
  rawNodes: AnyTPNode[],
  rawEdges: TPEdge[]
): { nodes: AnyTPNode[]; edges: TPEdge[] } => {
  const searchOpen = useDocumentStore((s) => s.searchOpen);
  const searchQuery = useDocumentStore((s) => s.searchQuery);
  const searchOptions = useDocumentStore((s) => s.searchOptions);

  const matchedIds = useMemo(() => {
    if (!searchOpen || !searchQuery) return null;
    const hits = findMatches(doc, searchQuery, searchOptions);
    if (hits.length === 0) return null;
    return new Set(hits.map((h) => h.id));
  }, [doc, searchOpen, searchQuery, searchOptions]);

  const nodes = useMemo(() => {
    if (!matchedIds) return rawNodes;
    return rawNodes.map((n) =>
      matchedIds.has(n.id) ? n : { ...n, className: `${n.className ?? ''} tp-dimmed`.trim() }
    );
  }, [rawNodes, matchedIds]);

  const edges = useMemo(() => {
    if (!matchedIds) return rawEdges;
    return rawEdges.map((e) => {
      const sourceHit = matchedIds.has(e.source);
      const targetHit = matchedIds.has(e.target);
      const edgeHit = matchedIds.has(e.id);
      // Edges between two highlighted endpoints stay full-strength even if
      // the edge itself isn't a search hit — losing those visually would
      // break the causal structure the user is trying to read.
      if (edgeHit || (sourceHit && targetHit)) return e;
      return { ...e, className: `${e.className ?? ''} tp-dimmed`.trim() };
    });
  }, [rawEdges, matchedIds]);

  return { nodes, edges };
};
