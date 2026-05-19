import { useMemo } from 'react';
import { edgesArray } from '@/domain/graph';
import type { TPDocument } from '@/domain/types';
import { useDocumentStore } from '@/store';
import type { AnyTPNode, TPEdge } from '../edges/flow-types';

/**
 * Session 133 — selection-anchored dimming.
 *
 * When the user selects exactly one entity or edge, dim everything
 * else on the canvas to ~50% so the focus pops without losing the
 * surrounding causal context. The "focus" set always includes the
 * selected item itself; for entity selections it also keeps the
 * directly-connected edges (and their other endpoint) at full
 * strength so the immediate neighbourhood reads as a unit.
 *
 * Skipped when:
 *
 *   - Nothing is selected.
 *   - Multi-select (≥ 2 entities or ≥ 2 edges). The selection
 *     itself is already the signal; dimming would either hide most
 *     of the canvas or read as noise.
 *   - Search-dimming is already active (the search "showcase" mode
 *     is the dominant signal in that moment).
 *
 * Returns the input arrays untouched when not dimming, so React
 * Flow's referential-equality node/edge cache stays warm. Mirrors
 * the shape of `useSearchDimming` exactly — the two hooks compose
 * cleanly: search-dim runs first, then selection-dim, and the
 * `tp-dimmed` class from search wins visually (0.18) over the
 * milder `tp-focus-dim` (0.5).
 */
export const useSelectionDimming = (
  doc: TPDocument,
  rawNodes: AnyTPNode[],
  rawEdges: TPEdge[]
): { nodes: AnyTPNode[]; edges: TPEdge[] } => {
  const selection = useDocumentStore((s) => s.selection);
  const searchOpen = useDocumentStore((s) => s.searchOpen);
  const searchQuery = useDocumentStore((s) => s.searchQuery);

  /**
   * Build the "focus" set of node ids + edge ids that should NOT
   * receive the dim class. Returns `null` when dimming should be
   * skipped entirely (no-selection, multi-select, search-active).
   */
  const focusIds = useMemo(() => {
    if (searchOpen && searchQuery) return null;
    if (selection.kind === 'none') return null;
    if (selection.ids.length !== 1) return null;
    const focusNodeIds = new Set<string>();
    const focusEdgeIds = new Set<string>();
    const selectedId = selection.ids[0];
    if (!selectedId) return null;

    if (selection.kind === 'entities') {
      focusNodeIds.add(selectedId);
      // Include the 1-hop neighbourhood: every edge that touches the
      // selected entity, and the other endpoint of each such edge.
      for (const edge of edgesArray(doc)) {
        if (edge.sourceId === selectedId) {
          focusEdgeIds.add(edge.id);
          focusNodeIds.add(edge.targetId);
        } else if (edge.targetId === selectedId) {
          focusEdgeIds.add(edge.id);
          focusNodeIds.add(edge.sourceId);
        }
      }
    } else if (selection.kind === 'edges') {
      const edge = doc.edges[selectedId];
      if (edge) {
        focusEdgeIds.add(edge.id);
        focusNodeIds.add(edge.sourceId);
        focusNodeIds.add(edge.targetId);
      }
    } else if (selection.kind === 'groups') {
      // Group selection: keep every member entity (recursive groups
      // resolved via `memberIds`) at full strength so the group reads
      // as a unit. Edges between two group members also stay bright.
      const group = doc.groups?.[selectedId];
      if (group) {
        focusNodeIds.add(selectedId);
        for (const memberId of group.memberIds) focusNodeIds.add(memberId);
        for (const edge of edgesArray(doc)) {
          if (focusNodeIds.has(edge.sourceId) && focusNodeIds.has(edge.targetId)) {
            focusEdgeIds.add(edge.id);
          }
        }
      }
    }

    return { nodes: focusNodeIds, edges: focusEdgeIds };
  }, [doc, selection, searchOpen, searchQuery]);

  const nodes = useMemo(() => {
    if (!focusIds) return rawNodes;
    return rawNodes.map((n) =>
      focusIds.nodes.has(n.id) ? n : { ...n, className: `${n.className ?? ''} tp-focus-dim`.trim() }
    );
  }, [rawNodes, focusIds]);

  const edges = useMemo(() => {
    if (!focusIds) return rawEdges;
    return rawEdges.map((e) =>
      focusIds.edges.has(e.id) ? e : { ...e, className: `${e.className ?? ''} tp-focus-dim`.trim() }
    );
  }, [rawEdges, focusIds]);

  return { nodes, edges };
};
