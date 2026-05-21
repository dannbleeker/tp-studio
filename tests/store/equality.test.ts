import { describe, expect, it } from 'vitest';
import { arrayShallowEqualByKeys, primitiveArrayEqual } from '@/store/equality';

/**
 * Session 135 / Perf #7+#8 — equality-helper tests.
 *
 * These helpers back `useDocumentStoreWith` and decide when a derived
 * selector's output is "the same" for re-render purposes. Getting
 * them right is load-bearing: a false-positive (treating different
 * outputs as equal) silently shows stale UI; a false-negative
 * (always returning false) just re-renders too often. Both failure
 * modes are corner cases the dev wouldn't notice until much later,
 * so unit tests guard the canonical behaviour here.
 */

describe('arrayShallowEqualByKeys', () => {
  type Entry = { id: string; sourceTitle: string; targetTitle: string };
  const eq = arrayShallowEqualByKeys<Entry>(['id', 'sourceTitle', 'targetTitle']);

  it('returns true for the same array reference', () => {
    const a: Entry[] = [{ id: '1', sourceTitle: 's', targetTitle: 't' }];
    expect(eq(a, a)).toBe(true);
  });

  it('returns true for empty arrays', () => {
    expect(eq([], [])).toBe(true);
  });

  it('returns true for distinct arrays with structurally identical items', () => {
    const a: Entry[] = [
      { id: '1', sourceTitle: 'cause', targetTitle: 'effect' },
      { id: '2', sourceTitle: 'a', targetTitle: 'b' },
    ];
    const b: Entry[] = [
      { id: '1', sourceTitle: 'cause', targetTitle: 'effect' },
      { id: '2', sourceTitle: 'a', targetTitle: 'b' },
    ];
    expect(eq(a, b)).toBe(true);
  });

  it('returns false on differing length', () => {
    const a: Entry[] = [{ id: '1', sourceTitle: 's', targetTitle: 't' }];
    const b: Entry[] = [
      { id: '1', sourceTitle: 's', targetTitle: 't' },
      { id: '2', sourceTitle: 'a', targetTitle: 'b' },
    ];
    expect(eq(a, b)).toBe(false);
  });

  it('returns false when one keyed value differs', () => {
    const a: Entry[] = [{ id: '1', sourceTitle: 'cause', targetTitle: 'effect' }];
    const b: Entry[] = [{ id: '1', sourceTitle: 'cause', targetTitle: 'EFFECT-RENAMED' }];
    expect(eq(a, b)).toBe(false);
  });

  it('ignores keys not in the keys list', () => {
    // Same entries by tracked keys, but with an "extra" property that
    // differs — the helper deliberately ignores the extra key. The
    // double-`unknown` cast is necessary because the entries carry a
    // property not declared on `Entry`; the test deliberately models
    // a "real-world record with more fields than the equality
    // contract tracks" scenario.
    const a = [{ id: '1', sourceTitle: 's', targetTitle: 't', extra: 'old' }] as unknown as Entry[];
    const b = [{ id: '1', sourceTitle: 's', targetTitle: 't', extra: 'new' }] as unknown as Entry[];
    expect(eq(a, b)).toBe(true);
  });

  it('treats `null`-itemed positions as not equal to populated ones', () => {
    const a: Entry[] = [{ id: '1', sourceTitle: 's', targetTitle: 't' }];
    // Force a null at index 0 to simulate a corrupt-input bail-out.
    const b = [null] as unknown as Entry[];
    expect(eq(a, b)).toBe(false);
    expect(eq(b, a)).toBe(false);
  });
});

describe('primitiveArrayEqual', () => {
  it('returns true for the same reference', () => {
    const a = ['x', 'y'];
    expect(primitiveArrayEqual(a, a)).toBe(true);
  });

  it('returns true for two arrays with the same primitive contents', () => {
    expect(primitiveArrayEqual(['a', 'b', 'c'], ['a', 'b', 'c'])).toBe(true);
    expect(primitiveArrayEqual([1, 2, 3], [1, 2, 3])).toBe(true);
  });

  it('returns false on differing length', () => {
    expect(primitiveArrayEqual([1, 2], [1, 2, 3])).toBe(false);
  });

  it('returns false on a single-element mismatch', () => {
    expect(primitiveArrayEqual(['a', 'b'], ['a', 'c'])).toBe(false);
  });

  it('treats `NaN === NaN` correctly (Object.is semantics)', () => {
    expect(primitiveArrayEqual([NaN], [NaN])).toBe(true);
  });
});
