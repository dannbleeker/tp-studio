import { type InternalNode, useStore as useRFStore } from '@xyflow/react';
import { arrayShallowEqualByKeys } from '@/store/equality';
import { currentDoc } from '@/store/selectors';
import { useDocumentStoreWith } from '@/store/useDocumentStoreWithEquality';

/**
 * Session 133 — visualise the "this assumption pertains to that edge"
 * link as a dashed line on the canvas.
 *
 * Schema model: each first-class assumption record in `doc.assumptions`
 * names its host edge via `edgeId`; this overlay draws that link.
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
type AnchorTriple = {
  key: string;
  assumptionId: string;
  sourceId: string;
  targetId: string;
};

// Session 135 / Perf #7 — equality fn so this overlay re-renders only
// when the anchor set actually changes (assumption attached / detached
// / endpoint rewired). Unrelated edge mutations (label, weight,
// attestation) no longer trigger a re-render here.
const anchorTriplesEqual = arrayShallowEqualByKeys<AnchorTriple>([
  'key',
  'assumptionId',
  'sourceId',
  'targetId',
]);

type LineSeg = { key: string; x1: number; y1: number; x2: number; y2: number };

const centreOf = (n: InternalNode): { x: number; y: number } => ({
  x: n.internals.positionAbsolute.x + (n.measured?.width ?? 0) / 2,
  y: n.internals.positionAbsolute.y + (n.measured?.height ?? 0) / 2,
});

/**
 * Build the dashed assumption→edge link segments from the live node geometry.
 * Takes a node getter (over React Flow's `nodeLookup`) so it can run INSIDE a
 * `useRFStore` selector — mirroring `JunctorOverlay` — making the lines react
 * to node-position changes (dagre re-layout) rather than only refreshing on a
 * pan/zoom re-render.
 */
const computeAnchorLines = (
  anchors: AnchorTriple[],
  getNode: (id: string) => InternalNode | undefined
): LineSeg[] => {
  const lines: LineSeg[] = [];
  for (const a of anchors) {
    const aNode = getNode(a.assumptionId);
    const sNode = getNode(a.sourceId);
    const tNode = getNode(a.targetId);
    if (!aNode || !sNode || !tNode) continue;
    const ac = centreOf(aNode);
    const sc = centreOf(sNode);
    const tc = centreOf(tNode);
    lines.push({ key: a.key, x1: ac.x, y1: ac.y, x2: (sc.x + tc.x) / 2, y2: (sc.y + tc.y) / 2 });
  }
  return lines;
};

// Re-render only when the computed segments actually change (endpoint moved /
// anchor added / removed), not on every React Flow store write.
const anchorLinesEqual = arrayShallowEqualByKeys<LineSeg>(['key', 'x1', 'y1', 'x2', 'y2']);

export function AssumptionAnchorOverlay() {
  const transform = useRFStore((s) => s.transform);

  // Derive (assumptionId, sourceId, targetId) triples up-front. The
  // selector walks edges + filters but the custom equality skips the
  // component re-render when the triple list is unchanged.
  const anchors = useDocumentStoreWith((s) => {
    const doc = currentDoc(s);
    if (!doc.assumptions) return [];
    const out: AnchorTriple[] = [];
    // Record-canonical: each assumption record names its host edge directly
    // (`record.edgeId`); resolve it to the edge's endpoints for the dashed line.
    // The assumption's node position is still looked up by its (shared) id below.
    for (const a of Object.values(doc.assumptions)) {
      const edge = doc.edges[a.edgeId];
      if (!edge) continue;
      out.push({
        key: `${edge.id}::${a.id}`,
        assumptionId: a.id,
        sourceId: edge.sourceId,
        targetId: edge.targetId,
      });
    }
    return out;
  }, anchorTriplesEqual);

  // Reactive line geometry: subscribe to `nodeLookup` (gated by
  // `anchorLinesEqual`) so the dashed links follow nodes during dagre
  // re-layout animations, not just on pan/zoom. The equality gate keeps
  // unrelated store writes from re-rendering this overlay.
  const lines = useRFStore(
    (s) => computeAnchorLines(anchors, (id) => s.nodeLookup.get(id)),
    anchorLinesEqual
  );

  const [tx, ty, scale] = transform;

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
