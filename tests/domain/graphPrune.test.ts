import { describe, expect, it } from 'vitest';
import { pruneSingletonJunctors } from '@/domain/graph';
import type { Edge } from '@/domain/types';

/**
 * Session 171 — `pruneSingletonJunctors` enforces the "a junctor needs ≥2
 * inputs" invariant: a group left with a single member is logically vacuous
 * ("AND of one"), so its lone edge is ungrouped back to a plain direct edge.
 */

const edge = (id: string, src: string, tgt: string, extra: Partial<Edge> = {}): Edge =>
  ({ id, sourceId: src, targetId: tgt, ...extra }) as Edge;

describe('pruneSingletonJunctors', () => {
  it('keeps a 2-member junctor group intact (same ref, unchanged)', () => {
    const edges = {
      e1: edge('e1', 'A', 'T', { andGroupId: 'g1' }),
      e2: edge('e2', 'B', 'T', { andGroupId: 'g1' }),
    };
    const out = pruneSingletonJunctors(edges);
    expect(out).toBe(edges);
    expect(out.e1?.andGroupId).toBe('g1');
    expect(out.e2?.andGroupId).toBe('g1');
  });

  it('ungroups a single-member group — omits the field, not sets it undefined', () => {
    const edges = {
      e1: edge('e1', 'A', 'T', { andGroupId: 'solo' }),
      e2: edge('e2', 'C', 'D'), // unrelated plain edge
    };
    const out = pruneSingletonJunctors(edges);
    expect(out).not.toBe(edges); // changed → new ref
    expect(out.e1?.andGroupId).toBeUndefined();
    expect(Object.hasOwn(out.e1 ?? {}, 'andGroupId')).toBe(false);
    expect(out.e2).toBe(edges.e2); // untouched edge kept by reference
  });

  it('handles OR and XOR the same way', () => {
    const edges = {
      o: edge('o', 'A', 'T', { orGroupId: 'g1' }),
      x: edge('x', 'B', 'U', { xorGroupId: 'g2' }),
    };
    const out = pruneSingletonJunctors(edges);
    expect(out.o?.orGroupId).toBeUndefined();
    expect(out.x?.xorGroupId).toBeUndefined();
  });

  it('collapses only the under-2 group when groups coexist', () => {
    const edges = {
      a1: edge('a1', 'A', 'T', { andGroupId: 'keep' }),
      a2: edge('a2', 'B', 'T', { andGroupId: 'keep' }),
      lonely: edge('lonely', 'C', 'U', { andGroupId: 'solo' }),
    };
    const out = pruneSingletonJunctors(edges);
    expect(out.a1?.andGroupId).toBe('keep');
    expect(out.a2?.andGroupId).toBe('keep');
    expect(out.lonely?.andGroupId).toBeUndefined();
  });

  it('returns the same reference when there are no junctor groups', () => {
    const edges = { e1: edge('e1', 'A', 'B') };
    expect(pruneSingletonJunctors(edges)).toBe(edges);
  });
});
