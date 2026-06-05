import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  getHoveredJunctor,
  setHoveredJunctor,
} from '@/services/canvasRef';

/**
 * Additional canvasRef tests covering all three junctor kinds (OR + XOR)
 * and the set-overwrite / concurrent-write contract. The AND kind is
 * covered by canvasRefSelection.test.ts; this file adds OR and XOR so
 * every union branch of `HoveredJunctor.kind` has explicit coverage.
 */

beforeEach(() => setHoveredJunctor(null));
afterEach(() => setHoveredJunctor(null));

describe('HoveredJunctor — all three kinds', () => {
  it('stores and retrieves an OR junctor', () => {
    setHoveredJunctor({ groupId: 'g-or', kind: 'OR' });
    expect(getHoveredJunctor()).toEqual({ groupId: 'g-or', kind: 'OR' });
  });

  it('stores and retrieves an XOR junctor', () => {
    setHoveredJunctor({ groupId: 'g-xor', kind: 'XOR' });
    expect(getHoveredJunctor()).toEqual({ groupId: 'g-xor', kind: 'XOR' });
  });

  it('overwrites the previous junctor on a second set', () => {
    setHoveredJunctor({ groupId: 'first', kind: 'AND' });
    setHoveredJunctor({ groupId: 'second', kind: 'OR' });
    const v = getHoveredJunctor();
    expect(v?.groupId).toBe('second');
    expect(v?.kind).toBe('OR');
  });

  it('clears the junctor when set to null', () => {
    setHoveredJunctor({ groupId: 'g1', kind: 'XOR' });
    setHoveredJunctor(null);
    expect(getHoveredJunctor()).toBeNull();
  });

  it('returns null before any write in a fresh test', () => {
    expect(getHoveredJunctor()).toBeNull();
  });
});
