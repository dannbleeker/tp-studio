import { describe, expect, it } from 'vitest';
import { findNeighborInDirection } from '@/components/canvas/hooks/useArrowKeyNodeNav';
import type { TPDocument } from '@/domain/types';
import { makeDoc, makeEdge, makeEntity, resetIds } from '../../domain/helpers';

/**
 * Session 135 — canvas a11y slice 4. The scoring rules driving arrow-key
 * navigation between connected nodes; the hook wiring (DOM focus, RF
 * setNodes) is exercised end-to-end via e2e + the manual checklist.
 *
 * Coordinate frame matches the post-layout absolute positions React Flow
 * hands us through `getInternalNode(id).internals.positionAbsolute`:
 *   - x grows right
 *   - y grows DOWN (so "up" is dy < 0)
 *
 * The mock flow returns `positionAbsolute` + a measured size; the helper
 * derives each node's center from those.
 */

type FakeNode = { x: number; y: number; w?: number; h?: number };

// `findNeighborInDirection` takes a `FlowLookup` — the minimal structural
// type around `getInternalNode` — so the mock satisfies it directly. The
// real `useReactFlow()` return is a strict superset.
const mockFlow = (positions: Record<string, FakeNode>) => ({
  getInternalNode: (id: string) => {
    const p = positions[id];
    if (!p) return undefined;
    return {
      internals: { positionAbsolute: { x: p.x, y: p.y } },
      measured: { width: p.w ?? 220, height: p.h ?? 72 },
    };
  },
});

/** Build a fan-of-4 around a centre entity, each at a cardinal direction. */
const buildFanDoc = () => {
  resetIds();
  const c = makeEntity({ title: 'center' });
  const u = makeEntity({ title: 'up' });
  const d = makeEntity({ title: 'down' });
  const l = makeEntity({ title: 'left' });
  const r = makeEntity({ title: 'right' });
  const doc = makeDoc(
    [c, u, d, l, r],
    [makeEdge(c.id, u.id), makeEdge(c.id, d.id), makeEdge(c.id, l.id), makeEdge(c.id, r.id)]
  );
  const flow = mockFlow({
    [c.id]: { x: 0, y: 0 },
    [u.id]: { x: 0, y: -200 },
    [d.id]: { x: 0, y: 200 },
    [l.id]: { x: -300, y: 0 },
    [r.id]: { x: 300, y: 0 },
  });
  return { doc, flow, c, u, d, l, r };
};

describe('findNeighborInDirection — cardinal cases', () => {
  it('picks the up neighbour for ArrowUp', () => {
    const { doc, flow, c, u } = buildFanDoc();
    expect(findNeighborInDirection(c.id, 'up', doc, flow)).toBe(u.id);
  });
  it('picks the down neighbour for ArrowDown', () => {
    const { doc, flow, c, d } = buildFanDoc();
    expect(findNeighborInDirection(c.id, 'down', doc, flow)).toBe(d.id);
  });
  it('picks the left neighbour for ArrowLeft', () => {
    const { doc, flow, c, l } = buildFanDoc();
    expect(findNeighborInDirection(c.id, 'left', doc, flow)).toBe(l.id);
  });
  it('picks the right neighbour for ArrowRight', () => {
    const { doc, flow, c, r } = buildFanDoc();
    expect(findNeighborInDirection(c.id, 'right', doc, flow)).toBe(r.id);
  });
});

describe('findNeighborInDirection — selection rules', () => {
  it('returns null when no connected neighbour qualifies', () => {
    resetIds();
    const a = makeEntity();
    const b = makeEntity();
    const doc = makeDoc([a, b], [makeEdge(a.id, b.id)]);
    const flow = mockFlow({
      [a.id]: { x: 0, y: 0 },
      [b.id]: { x: 0, y: 200 }, // b is below
    });
    // From a, "up" → no connected neighbour above → null.
    expect(findNeighborInDirection(a.id, 'up', doc, flow)).toBe(null);
  });

  it('walks BOTH incoming and outgoing edges as candidates', () => {
    resetIds();
    const a = makeEntity({ title: 'a' });
    const b = makeEntity({ title: 'b' });
    // Edge from b -> a; a has only an incoming edge, no outgoing.
    const doc = makeDoc([a, b], [makeEdge(b.id, a.id)]);
    const flow = mockFlow({
      [a.id]: { x: 0, y: 0 },
      [b.id]: { x: -300, y: 0 },
    });
    // From a, ArrowLeft must still find b (the source of the incoming edge).
    expect(findNeighborInDirection(a.id, 'left', doc, flow)).toBe(b.id);
  });

  it('ignores unconnected nodes even if they sit in the direction', () => {
    resetIds();
    const a = makeEntity();
    const b = makeEntity();
    const stranger = makeEntity({ title: 'stranger' });
    // Only a-b connected; stranger sits between them but no edge.
    const doc: TPDocument = makeDoc([a, b, stranger], [makeEdge(a.id, b.id)]);
    const flow = mockFlow({
      [a.id]: { x: 0, y: 0 },
      [stranger.id]: { x: 150, y: 0 },
      [b.id]: { x: 300, y: 0 },
    });
    // Stranger is geometrically closer to the right, but unconnected.
    // We must skip stranger and return b.
    expect(findNeighborInDirection(a.id, 'right', doc, flow)).toBe(b.id);
  });

  it('skips back-edges + mutex edges (non-causal)', () => {
    resetIds();
    const a = makeEntity();
    const b = makeEntity();
    const doc = makeDoc([a, b], [makeEdge(a.id, b.id, { isBackEdge: true })]);
    const flow = mockFlow({
      [a.id]: { x: 0, y: 0 },
      [b.id]: { x: 300, y: 0 },
    });
    expect(findNeighborInDirection(a.id, 'right', doc, flow)).toBe(null);
  });

  it('prefers the closer neighbour when two are in the same direction', () => {
    resetIds();
    const a = makeEntity();
    const near = makeEntity({ title: 'near' });
    const far = makeEntity({ title: 'far' });
    const doc = makeDoc([a, near, far], [makeEdge(a.id, near.id), makeEdge(a.id, far.id)]);
    const flow = mockFlow({
      [a.id]: { x: 0, y: 0 },
      [near.id]: { x: 200, y: 0 },
      [far.id]: { x: 500, y: 0 },
    });
    expect(findNeighborInDirection(a.id, 'right', doc, flow)).toBe(near.id);
  });

  it('drops candidates whose perpendicular delta exceeds the primary axis', () => {
    resetIds();
    const a = makeEntity();
    const b = makeEntity({ title: 'mostly-right' });
    // b is far more to the right than up — ArrowUp should reject it.
    const doc = makeDoc([a, b], [makeEdge(a.id, b.id)]);
    const flow = mockFlow({
      [a.id]: { x: 0, y: 0 },
      [b.id]: { x: 400, y: -50 },
    });
    expect(findNeighborInDirection(a.id, 'up', doc, flow)).toBe(null);
  });

  it('returns null when the focused node has no known position', () => {
    resetIds();
    const a = makeEntity();
    const b = makeEntity();
    const doc = makeDoc([a, b], [makeEdge(a.id, b.id)]);
    const flow = mockFlow({
      [b.id]: { x: 0, y: -200 }, // 'a' missing from the layout
    });
    expect(findNeighborInDirection(a.id, 'up', doc, flow)).toBe(null);
  });
});
