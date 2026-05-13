import { radialLayout } from '@/domain/radialLayout';
import { describe, expect, it } from 'vitest';

const node = (id: string) => ({ id, width: 220, height: 72 });

describe('radialLayout', () => {
  it('returns an empty map when there are no nodes', () => {
    expect(radialLayout([], [])).toEqual({});
  });

  it('positions a single node at the origin', () => {
    expect(radialLayout([node('a')], [])).toEqual({ a: { x: 0, y: 0 } });
  });

  it('places each level on a larger ring than the previous one (apex closest to ring center)', () => {
    // a → b → c, c → d: d is the only sink (apex). a/b/c sit on progressively
    // outer rings. The radial layout normalizes the bbox top-left to (0, 0),
    // so the apex is NOT at the normalized coordinate origin — it's at the
    // layout's *ring center*, which depending on bbox asymmetry can sit at
    // the edge of the bounding box. What's invariant across normalizations
    // is the relative ring distance: a node N levels away from the apex
    // sits ~N × RING_STEP further from the apex than a node N-1 levels
    // away. The chain a→b→c→d gives one node per level, so each step
    // strictly increases the distance.
    const nodes = [node('a'), node('b'), node('c'), node('d')];
    const edges = [
      { sourceId: 'a', targetId: 'b' },
      { sourceId: 'b', targetId: 'c' },
      { sourceId: 'c', targetId: 'd' },
    ];
    const positions = radialLayout(nodes, edges);
    expect(Object.keys(positions).sort()).toEqual(['a', 'b', 'c', 'd']);
    const apex = positions.d;
    if (!apex) throw new Error('apex position missing');
    const distFromApex = (id: string): number => {
      const p = positions[id];
      if (!p) return Number.POSITIVE_INFINITY;
      return Math.hypot(p.x - apex.x, p.y - apex.y);
    };
    // Strict ring ordering: deeper nodes sit further from the apex.
    expect(distFromApex('d')).toBe(0);
    expect(distFromApex('c')).toBeGreaterThan(distFromApex('d'));
    expect(distFromApex('b')).toBeGreaterThan(distFromApex('c'));
    expect(distFromApex('a')).toBeGreaterThan(distFromApex('b'));
  });

  it('places multiple sinks on an inner ring rather than overlapping', () => {
    // Two disconnected sinks. They share level 0 → inner ring.
    const positions = radialLayout([node('a'), node('b')], []);
    expect(positions.a).toBeDefined();
    expect(positions.b).toBeDefined();
    const dx = (positions.a?.x ?? 0) - (positions.b?.x ?? 0);
    const dy = (positions.a?.y ?? 0) - (positions.b?.y ?? 0);
    expect(Math.hypot(dx, dy)).toBeGreaterThan(0);
  });

  it('handles disconnected nodes by parking them at level 0', () => {
    // a → b (small chain), plus an orphan c.
    const nodes = [node('a'), node('b'), node('c')];
    const edges = [{ sourceId: 'a', targetId: 'b' }];
    const positions = radialLayout(nodes, edges);
    expect(Object.keys(positions).sort()).toEqual(['a', 'b', 'c']);
    // Each node has a defined position. The orphan doesn't crash the layout.
    for (const p of Object.values(positions)) {
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.y)).toBe(true);
    }
  });

  it('normalizes so the layout bbox top-left sits at (0, 0)', () => {
    const nodes = [node('a'), node('b'), node('c'), node('d')];
    const edges = [
      { sourceId: 'a', targetId: 'd' },
      { sourceId: 'b', targetId: 'd' },
      { sourceId: 'c', targetId: 'd' },
    ];
    const positions = radialLayout(nodes, edges);
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    for (const p of Object.values(positions)) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
    }
    expect(minX).toBe(0);
    expect(minY).toBe(0);
  });

  it('falls back to a single center when the visible graph is fully cyclic', () => {
    // a → b → a: no sink. The fallback picks the first node and the layout
    // still terminates.
    const positions = radialLayout(
      [node('a'), node('b')],
      [
        { sourceId: 'a', targetId: 'b' },
        { sourceId: 'b', targetId: 'a' },
      ]
    );
    expect(Object.keys(positions).sort()).toEqual(['a', 'b']);
  });

  it('children stay angularly close to their parent (Session 76 polish)', () => {
    // Two branches feeding a single apex; each branch has two children.
    // Pre-polish: all four grandchildren land on a single ring distributed
    // uniformly — grandchildren of b1 could land on the opposite side of
    // the ring from b1. Post-polish: each parent's children share its
    // angular slice, so grandchildren stay near their parent.
    //
    //            apex
    //           /    \
    //         b1     b2
    //        /  \   /  \
    //       c1  c2 c3  c4
    //
    const nodes = [
      node('apex'),
      node('b1'),
      node('b2'),
      node('c1'),
      node('c2'),
      node('c3'),
      node('c4'),
    ];
    const edges = [
      { sourceId: 'b1', targetId: 'apex' },
      { sourceId: 'b2', targetId: 'apex' },
      { sourceId: 'c1', targetId: 'b1' },
      { sourceId: 'c2', targetId: 'b1' },
      { sourceId: 'c3', targetId: 'b2' },
      { sourceId: 'c4', targetId: 'b2' },
    ];
    const positions = radialLayout(nodes, edges);
    const apex = positions.apex;
    if (!apex) throw new Error('apex missing');
    const angleFromApex = (id: string): number => {
      const p = positions[id];
      if (!p) throw new Error(`${id} missing`);
      return Math.atan2(p.y - apex.y, p.x - apex.x);
    };
    // c1 + c2 are b1's children → they should be on the same side of the
    // ring as b1. Measure: |angle(c1) - angle(b1)| should be small.
    const angDiff = (a: number, b: number): number => {
      let d = Math.abs(a - b);
      if (d > Math.PI) d = 2 * Math.PI - d;
      return d;
    };
    const b1Angle = angleFromApex('b1');
    const b2Angle = angleFromApex('b2');
    expect(angDiff(angleFromApex('c1'), b1Angle)).toBeLessThan(Math.PI / 2);
    expect(angDiff(angleFromApex('c2'), b1Angle)).toBeLessThan(Math.PI / 2);
    expect(angDiff(angleFromApex('c3'), b2Angle)).toBeLessThan(Math.PI / 2);
    expect(angDiff(angleFromApex('c4'), b2Angle)).toBeLessThan(Math.PI / 2);
    // Grandchildren of b1 should be on the opposite side from grandchildren
    // of b2 (or at least farther from them than from their own parent).
    expect(angDiff(angleFromApex('c1'), b2Angle)).toBeGreaterThan(
      angDiff(angleFromApex('c1'), b1Angle)
    );
  });
});
