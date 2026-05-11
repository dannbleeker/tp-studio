import { computeLayout } from '@/domain/layout';
import { describe, expect, it } from 'vitest';

const box = (id: string) => ({ id, width: 200, height: 80 });

describe('computeLayout', () => {
  it('returns an empty result for an empty graph', () => {
    expect(computeLayout([], [])).toEqual({});
  });

  it('positions a single node deterministically', () => {
    const result = computeLayout([box('a')], []);
    expect(result.a).toBeDefined();
    expect(typeof result.a!.x).toBe('number');
    expect(typeof result.a!.y).toBe('number');
  });

  it('lays out cause below effect with default BT direction', () => {
    const result = computeLayout(
      [box('cause'), box('effect')],
      [{ sourceId: 'cause', targetId: 'effect' }]
    );
    // BT: bottom-to-top → cause (source) sits lower (greater y) than effect (target).
    expect(result.cause!.y).toBeGreaterThan(result.effect!.y);
  });

  it('respects an alternate direction', () => {
    const result = computeLayout([box('a'), box('b')], [{ sourceId: 'a', targetId: 'b' }], {
      direction: 'LR',
    });
    // LR: source on the left → a.x < b.x
    expect(result.a!.x).toBeLessThan(result.b!.x);
  });

  it('ignores edges that reference unknown nodes', () => {
    const result = computeLayout([box('a')], [{ sourceId: 'a', targetId: 'ghost' }]);
    expect(Object.keys(result)).toEqual(['a']);
  });
});
