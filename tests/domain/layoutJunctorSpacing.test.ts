import { describe, expect, it } from 'vitest';
import { LAYOUT_RANK_SEPARATION_JUNCTOR_MIN } from '@/domain/constants';
import { computeLayout, type EdgeRef, type NodeBox } from '@/domain/layout';

/**
 * Junctor occlusion fix — the AND/OR/XOR circle renders below its target node,
 * so the rank gap beneath a junctor target must clear the circle or it draws
 * behind the cause cards (the "AND doesn't render" / occlusion report). When
 * any edge is a junctor member, `computeLayout` floors `rankSep` to
 * LAYOUT_RANK_SEPARATION_JUNCTOR_MIN. Pure-geometry guard so the floor can't
 * silently regress.
 */

const H = 72;
const nodes = (): NodeBox[] => [
  { id: 'E', width: 220, height: H },
  { id: 'A', width: 220, height: H },
  { id: 'B', width: 220, height: H },
];
// Edge-to-edge vertical gap between the target rank (E) and the cause rank (A/B)
// in a BT layout. Top-to-top distance minus one node height == the rank gap.
const rankGap = (pos: Record<string, { x: number; y: number }>) =>
  Math.abs((pos.E?.y ?? 0) - (pos.A?.y ?? 0)) - H;

describe('junctor rank floor (occlusion fix)', () => {
  it('reserves room below a junctor target so the circle clears the cause rank', () => {
    const edges: EdgeRef[] = [
      { sourceId: 'A', targetId: 'E', isJunctor: true },
      { sourceId: 'B', targetId: 'E', isJunctor: true },
    ];
    const pos = computeLayout(nodes(), edges, { direction: 'BT' });
    expect(rankGap(pos)).toBeGreaterThanOrEqual(LAYOUT_RANK_SEPARATION_JUNCTOR_MIN - 1);
  });

  it('does NOT inflate spacing for the same shape without junctors', () => {
    const edges: EdgeRef[] = [
      { sourceId: 'A', targetId: 'E' },
      { sourceId: 'B', targetId: 'E' },
    ];
    const pos = computeLayout(nodes(), edges, { direction: 'BT' });
    expect(rankGap(pos)).toBeLessThan(LAYOUT_RANK_SEPARATION_JUNCTOR_MIN);
  });
});
