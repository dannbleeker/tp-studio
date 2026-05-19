import { useReactFlow, useStore as useRFStore } from '@xyflow/react';
import { useMemo } from 'react';
import { entitiesOfType } from '@/domain/graph';
import { useDocumentStore } from '@/store';

/**
 * Session 133 — visualise the "this assumption pertains to that edge"
 * link as a dashed line on the canvas.
 *
 * Schema model (since v7): every assumption-typed entity may be
 * anchored to one or more edges via `Edge.assumptionIds: EntityId[]`.
 * Before this overlay, that link was discoverable only through the
 * Edge Inspector's Assumption Well or the small "A" badge on the
 * affected edge. EC practitioners (where assumption work is heaviest)
 * asked for the link to be visible directly on the canvas.
 *
 * Render: for each (assumption-entity, anchor-edge) pair, draw a
 * thin dashed grey line from the centre of the assumption node to
 * the midpoint of the anchor edge (approximated as the midpoint of
 * the line from source-node-centre to target-node-centre — exact
 * enough for the visual cue; not used for hit-testing). Pointer
 * events are off so the dashed line doesn't compete with the actual
 * edge for clicks.
 *
 * Diagram-agnostic by design: assumption entities exist in any
 * diagram type, and the schema link is the same everywhere. Most-used
 * on EC (where the canvas is a 5-box layout with assumptions
 * deliberately positioned beside the diagram) but the overlay shows
 * up wherever someone uses it.
 *
 * Lives inside `<ReactFlow>` so it pans / zooms with the viewport.
 * Implementation mirrors `JunctorOverlay` — same SVG + transform
 * pattern.
 */
export function AssumptionAnchorOverlay() {
  const edgesMap = useDocumentStore((s) => s.doc.edges);
  // entitiesOfType is WeakMap-cached so the subscription only rebuilds
  // when the entities map gets a new reference (Tier 3 #28).
  const assumptions = useDocumentStore((s) => entitiesOfType(s.doc, 'assumption'));
  const flow = useReactFlow();
  const transform = useRFStore((s) => s.transform);

  // Index assumption entities by id so the per-edge anchor lookup is
  // O(1). Edges with no `assumptionIds` are skipped early.
  const anchors = useMemo(() => {
    if (assumptions.length === 0) return [];
    const assumptionById = new Map(assumptions.map((a) => [a.id, a]));
    const out: { key: string; assumptionId: string; edgeId: string }[] = [];
    for (const edge of Object.values(edgesMap)) {
      if (!edge.assumptionIds?.length) continue;
      for (const aid of edge.assumptionIds) {
        if (!assumptionById.has(aid)) continue;
        out.push({ key: `${edge.id}::${aid}`, assumptionId: aid, edgeId: edge.id });
      }
    }
    return out;
  }, [edgesMap, assumptions]);

  const [tx, ty, scale] = transform;

  // Per render, compute screen-space line endpoints from the live
  // React Flow instance. The instance is the source of truth for node
  // positions (especially during dagre animations); a cached snapshot
  // would lag the viewport.
  const lines: { key: string; x1: number; y1: number; x2: number; y2: number }[] = [];
  for (const a of anchors) {
    const edge = edgesMap[a.edgeId];
    if (!edge) continue;
    const aNode = flow.getInternalNode(a.assumptionId);
    const sNode = flow.getInternalNode(edge.sourceId);
    const tNode = flow.getInternalNode(edge.targetId);
    if (!aNode || !sNode || !tNode) continue;
    const centre = (n: typeof aNode) => ({
      x: n.internals.positionAbsolute.x + (n.measured?.width ?? 0) / 2,
      y: n.internals.positionAbsolute.y + (n.measured?.height ?? 0) / 2,
    });
    const ac = centre(aNode);
    const sc = centre(sNode);
    const tc = centre(tNode);
    lines.push({
      key: a.key,
      x1: ac.x,
      y1: ac.y,
      x2: (sc.x + tc.x) / 2,
      y2: (sc.y + tc.y) / 2,
    });
  }

  if (lines.length === 0) return null;

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      style={{ overflow: 'visible' }}
      role="presentation"
      aria-hidden="true"
    >
      <title>Assumption anchors</title>
      <g style={{ transform: `translate(${tx}px, ${ty}px) scale(${scale})` }}>
        {lines.map((l) => (
          <line
            key={l.key}
            x1={l.x1}
            y1={l.y1}
            x2={l.x2}
            y2={l.y2}
            stroke="#a3a3a3"
            strokeWidth={1}
            strokeDasharray="4 4"
            opacity={0.6}
          />
        ))}
      </g>
    </svg>
  );
}
