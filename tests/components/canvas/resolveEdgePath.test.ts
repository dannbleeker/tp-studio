import { describe, expect, it } from 'vitest';
import { resolveEdgePath } from '@/components/canvas/edges/resolveEdgePath';

const bezier = { path: 'BEZIER', labelX: 1, labelY: 2 };

describe('resolveEdgePath', () => {
  it('mutex overrides everything', () => {
    expect(
      resolveEdgePath({
        mutex: { path: 'MUTEX', labelX: 10, labelY: 20 },
        radial: { path: 'RADIAL', labelX: 30, labelY: 40 },
        routedPath: 'ROUTED',
        bezier,
      })
    ).toEqual({ path: 'MUTEX', labelX: 10, labelY: 20 });
  });

  it('radial wins when there is no mutex', () => {
    expect(
      resolveEdgePath({
        mutex: null,
        radial: { path: 'RADIAL', labelX: 30, labelY: 40 },
        routedPath: 'ROUTED',
        bezier,
      })
    ).toEqual({ path: 'RADIAL', labelX: 30, labelY: 40 });
  });

  it('the routed path wins next, borrowing the bezier label anchor', () => {
    expect(resolveEdgePath({ mutex: null, radial: null, routedPath: 'ROUTED', bezier })).toEqual({
      path: 'ROUTED',
      labelX: 1,
      labelY: 2,
    });
  });

  it('falls back to the bezier when nothing else applies', () => {
    expect(resolveEdgePath({ mutex: null, radial: null, routedPath: undefined, bezier })).toEqual(
      bezier
    );
  });

  it('keeps an empty routed-path string rather than falling through (matches the ?? chain)', () => {
    expect(resolveEdgePath({ mutex: null, radial: null, routedPath: '', bezier })).toEqual({
      path: '',
      labelX: 1,
      labelY: 2,
    });
  });
});
