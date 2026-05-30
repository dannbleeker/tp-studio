import { describe, expect, it } from 'vitest';
import { type CentroidBuf, populateCentroidsInto } from '@/components/canvas/centroids';

describe('populateCentroidsInto', () => {
  it('computes the centre from position + measured size', () => {
    const out = populateCentroidsInto({}, [
      { id: 'a', position: { x: 10, y: 20 }, measured: { width: 100, height: 40 } },
    ]);
    expect(out.a).toEqual({ x: 60, y: 40 }); // 10+50, 20+20
  });

  it('defaults missing measured dimensions to 0 (top-left becomes the centre)', () => {
    const out = populateCentroidsInto({}, [{ id: 'a', position: { x: 5, y: 7 } }]);
    expect(out.a).toEqual({ x: 5, y: 7 });
  });

  it('prunes stale keys when the node set shrinks between calls', () => {
    const buf: CentroidBuf = {};
    populateCentroidsInto(buf, [
      { id: 'a', position: { x: 0, y: 0 } },
      { id: 'b', position: { x: 0, y: 0 } },
    ]);
    expect(Object.keys(buf).sort()).toEqual(['a', 'b']);
    populateCentroidsInto(buf, [{ id: 'a', position: { x: 0, y: 0 } }]);
    expect(Object.keys(buf)).toEqual(['a']);
  });

  it('reuses the same buffer + mutates existing centroid objects in place', () => {
    const buf: CentroidBuf = {};
    const out1 = populateCentroidsInto(buf, [{ id: 'a', position: { x: 0, y: 0 } }]);
    const innerA = out1.a;
    const out2 = populateCentroidsInto(buf, [{ id: 'a', position: { x: 10, y: 10 } }]);
    expect(out2).toBe(buf); // same buffer reference
    expect(out2.a).toBe(innerA); // same inner object, mutated (no re-alloc)
    expect(out2.a).toEqual({ x: 10, y: 10 });
  });
});
