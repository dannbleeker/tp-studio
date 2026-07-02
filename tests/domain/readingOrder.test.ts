import { describe, expect, it } from 'vitest';
import { RANK_BAND_PX, readingOrder } from '@/domain/readingOrder';

describe('readingOrder', () => {
  it('orders top-to-bottom then left-to-right', () => {
    const positions = {
      bl: { x: 0, y: 200 }, // bottom-left
      tr: { x: 300, y: 0 }, // top-right
      tl: { x: 0, y: 0 }, // top-left
      br: { x: 300, y: 200 }, // bottom-right
    };
    expect(readingOrder(['bl', 'tr', 'tl', 'br'], positions)).toEqual(['tl', 'tr', 'bl', 'br']);
  });

  it('orders nodes sharing a rank (same y, as dagre aligns them) left-to-right', () => {
    const positions = {
      right: { x: 500, y: 0 },
      left: { x: 10, y: 0 }, // same rank as `right`
      belowLeft: { x: 0, y: RANK_BAND_PX * 4 }, // clearly a later rank
    };
    expect(readingOrder(['right', 'belowLeft', 'left'], positions)).toEqual([
      'left',
      'right',
      'belowLeft',
    ]);
  });

  it('sinks nodes without a resolved position to the end, stably', () => {
    const positions = { a: { x: 0, y: 0 }, c: { x: 0, y: 100 } } as Record<
      string,
      { x: number; y: number } | undefined
    >;
    // `b` and `d` have no position → keep their relative order, after positioned.
    expect(readingOrder(['c', 'b', 'a', 'd'], positions)).toEqual(['a', 'c', 'b', 'd']);
  });

  it('is a valid total order over a full grid — rank ascending, x ascending within rank', () => {
    // dagre-style grid: 5 ranks × 4 columns, each rank sharing one y. Feed it
    // shuffled and assert the output is a clean permutation walked in reading
    // order (no dropped/duplicated ids, ranks non-decreasing, x non-decreasing
    // within a rank).
    const positions: Record<string, { x: number; y: number }> = {};
    const ids: string[] = [];
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 4; c++) {
        const id = `r${r}c${c}`;
        ids.push(id);
        positions[id] = { x: c * 100, y: r * 100 };
      }
    }
    const out = readingOrder([...ids].reverse(), positions);
    expect(out).toHaveLength(20);
    expect(new Set(out).size).toBe(20);
    const rankOf = (id: string) => Math.round(positions[id]!.y / RANK_BAND_PX);
    for (let i = 1; i < out.length; i++) {
      const prevRank = rankOf(out[i - 1]!);
      const rank = rankOf(out[i]!);
      expect(rank).toBeGreaterThanOrEqual(prevRank);
      // Same rank → x must not go backwards.
      if (rank === prevRank) {
        expect(positions[out[i]!]!.x).toBeGreaterThanOrEqual(positions[out[i - 1]!]!.x);
      }
    }
  });
});
