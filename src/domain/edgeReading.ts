import type { CausalityLabel } from '@/store/uiSlice/types';
import { isAssumption, structuralEntities } from './graph';
import type { DiagramType, Edge, Entity, TPDocument } from './types';

/**
 * Resolve the causality reading word for a given diagram-type + global
 * preference. Pulled out of TPEdge so the Read-through overlay and any
 * text-output exporter can produce the same verbalization without
 * duplicating the mode-resolution logic.
 *
 * Returns `undefined` when the user has explicitly opted out (`'none'`)
 * or when the resolved label is empty for any other reason.
 */
export const resolveCausalityWord = (
  causalityLabel: CausalityLabel,
  diagramType: DiagramType
): string | undefined => {
  if (causalityLabel === 'none') return undefined;
  if (causalityLabel === 'auto') {
    return diagramType === 'prt' || diagramType === 'ec' ? 'in order to' : 'because';
  }
  if (causalityLabel === 'in-order-to') return 'in order to';
  return causalityLabel;
};

/**
 * Render a single edge as a complete English sentence using the source
 * and target entity titles. Honors the diagram's natural causality
 * direction:
 *
 *   - **`because`** — "[Effect] *because* [Cause]." (bottom-up reading)
 *   - **`therefore`** — "[Cause], *therefore* [Effect]." (top-down reading)
 *   - **`in order to`** — "*In order to* obtain [Effect], we must [Cause]."
 *     (PRT/EC necessity reading)
 *
 * Used by the Read-through walkthrough overlay and by future text-output
 * exporters. The `connector` argument lets callers override the word if
 * the user has set a per-edge label.
 */
export const renderEdgeSentence = (
  source: Entity,
  target: Entity,
  connector: string | undefined
): string => {
  const src = source.title.trim() || 'Untitled entity';
  const tgt = target.title.trim() || 'Untitled entity';
  if (!connector) return `${src} → ${tgt}`;
  if (connector === 'in order to') {
    return `In order to obtain "${tgt}", "${src}" must hold.`;
  }
  if (connector === 'therefore') {
    return `"${src}", therefore "${tgt}".`;
  }
  // Default "because" (and any other connector the user has configured).
  return `"${tgt}" ${connector} "${src}".`;
};

/**
 * Compute a topological order over structural edges (skipping assumption
 * entities and AND-junctor edges treated as the structural path). Returns
 * edge ids in causal order: an edge from a leaf root cause toward a
 * terminal UDE will come before edges further up the chain.
 *
 * The implementation does a Kahn-style sort over entities, then groups
 * edges by source so the output reads root-cause-first. Cycles fall back
 * to creation-order for the offending edges so the walkthrough still
 * makes progress rather than stalling.
 */
export const topologicalEdgeOrder = (doc: TPDocument): string[] => {
  const entities = structuralEntities(doc);
  const edges = Object.values(doc.edges).filter((e) => {
    const src = doc.entities[e.sourceId];
    const tgt = doc.entities[e.targetId];
    return src && tgt && !isAssumption(src) && !isAssumption(tgt);
  });

  // In-degree per entity.
  const inDegree = new Map<string, number>();
  for (const e of entities) inDegree.set(e.id, 0);
  for (const edge of edges) {
    inDegree.set(edge.targetId, (inDegree.get(edge.targetId) ?? 0) + 1);
  }

  // Kahn's BFS layer-by-layer; ties broken by annotation number.
  const ready: Entity[] = [];
  for (const [id, d] of inDegree) {
    if (d === 0) {
      const e = doc.entities[id];
      if (e) ready.push(e);
    }
  }
  ready.sort((a, b) => a.annotationNumber - b.annotationNumber);

  const visited = new Set<string>();
  const out: string[] = [];

  while (ready.length > 0) {
    const next = ready.shift();
    if (!next) break;
    visited.add(next.id);
    // Edges leaving this entity, sorted by target annotation for stability.
    const outgoing = edges
      .filter((e) => e.sourceId === next.id)
      .sort((a, b) => {
        const at = doc.entities[a.targetId]?.annotationNumber ?? 0;
        const bt = doc.entities[b.targetId]?.annotationNumber ?? 0;
        return at - bt;
      });
    for (const edge of outgoing) {
      out.push(edge.id);
      const target = doc.entities[edge.targetId];
      if (!target || visited.has(target.id)) continue;
      const remaining = (inDegree.get(target.id) ?? 0) - 1;
      inDegree.set(target.id, remaining);
      if (remaining <= 0) ready.push(target);
    }
    // Re-sort whenever new entries land (cheap on small ranges).
    ready.sort((a, b) => a.annotationNumber - b.annotationNumber);
  }

  // Append any edges that weren't reached (cycles): keep creation order
  // so the walkthrough still touches them rather than dropping silently.
  if (out.length < edges.length) {
    const seen = new Set(out);
    for (const e of edges) {
      if (!seen.has(e.id)) out.push(e.id);
    }
  }

  return out;
};

/**
 * Resolve a single edge's display label for verbalization — per-edge
 * `Edge.label` wins, else the global causality word, else undefined.
 */
export const resolveEdgeConnector = (
  edge: Edge,
  causalityLabel: CausalityLabel,
  diagramType: DiagramType
): string | undefined => {
  if (edge.label?.trim()) return edge.label.trim();
  return resolveCausalityWord(causalityLabel, diagramType);
};
