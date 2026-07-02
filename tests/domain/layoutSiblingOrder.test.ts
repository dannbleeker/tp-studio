/**
 * Session 193 — manual sibling ordering (`reorderManualSiblings` in layout.ts).
 *
 * dagre has no per-node sibling-order input, so the layout honours
 * `NodeBox.ordering` as a post-dagre pass: for a rank whose nodes ALL carry an
 * ordering, it permutes them into ascending order using their own free-axis
 * slots (rank + spacing untouched). It must be a strict no-op when no node is
 * ordered, and skip partially-ordered ranks. A / B / C below are siblings (all
 * causes of a common target T), so they share one rank.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import type { Position } from '@/domain/layout';
import { clearLayoutCacheForTests, computeLayout } from '@/domain/layout';

beforeEach(clearLayoutCacheForTests);

const node = (id: string, ordering?: number) => ({
  id,
  width: 200,
  height: 80,
  ...(ordering !== undefined ? { ordering } : {}),
});

const EDGES = [
  { sourceId: 'A', targetId: 'T' },
  { sourceId: 'B', targetId: 'T' },
  { sourceId: 'C', targetId: 'T' },
];

const slotSet = (pos: Record<string, Position>, axis: 'x' | 'y'): number[] =>
  ['A', 'B', 'C'].map((id) => pos[id]![axis]).sort((m, n) => m - n);

describe('computeLayout — manual sibling ordering', () => {
  it('permutes same-rank siblings into ascending ordering along the free axis (BT)', () => {
    const pos = computeLayout([node('T'), node('A', 3), node('B', 1), node('C', 2)], EDGES, {
      direction: 'BT',
    });
    // ascending ordering (B=1 < C=2 < A=3) → ascending x.
    expect(pos.B!.x).toBeLessThan(pos.C!.x);
    expect(pos.C!.x).toBeLessThan(pos.A!.x);
  });

  it('orders on the Y free axis for an LR layout', () => {
    const pos = computeLayout([node('T'), node('A', 3), node('B', 1), node('C', 2)], EDGES, {
      direction: 'LR',
    });
    expect(pos.B!.y).toBeLessThan(pos.C!.y);
    expect(pos.C!.y).toBeLessThan(pos.A!.y);
  });

  it('is a strict no-op when no node carries ordering', () => {
    const a = computeLayout([node('T'), node('A'), node('B'), node('C')], EDGES, {
      direction: 'BT',
    });
    clearLayoutCacheForTests();
    const b = computeLayout([node('T'), node('A'), node('B'), node('C')], EDGES, {
      direction: 'BT',
    });
    for (const id of ['A', 'B', 'C', 'T']) {
      expect(a[id]!.x).toBe(b[id]!.x);
      expect(a[id]!.y).toBe(b[id]!.y);
    }
  });

  it('leaves a rank untouched when only some of its nodes are ordered', () => {
    const partial = computeLayout([node('T'), node('A', 1), node('B', 2), node('C')], EDGES, {
      direction: 'BT',
    });
    clearLayoutCacheForTests();
    const plain = computeLayout([node('T'), node('A'), node('B'), node('C')], EDGES, {
      direction: 'BT',
    });
    for (const id of ['A', 'B', 'C']) {
      expect(partial[id]!.x).toBe(plain[id]!.x);
    }
  });

  it('reuses the exact free-axis slots — reordering only permutes positions', () => {
    const plain = computeLayout([node('T'), node('A'), node('B'), node('C')], EDGES, {
      direction: 'BT',
    });
    clearLayoutCacheForTests();
    const reordered = computeLayout([node('T'), node('A', 3), node('B', 2), node('C', 1)], EDGES, {
      direction: 'BT',
    });
    expect(slotSet(reordered, 'x')).toEqual(slotSet(plain, 'x'));
  });
});
