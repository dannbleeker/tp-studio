import { ST_FACET_KEYS, isStNodeFormat } from '@/domain/graph';
import { describe, expect, it } from 'vitest';
import { makeEntity, resetIds } from './helpers';

/**
 * Session 76 — first-class S&T 5-facet rendering trigger. Any
 * `injection` entity carrying one of the four reserved facet
 * attributes renders as a multi-row card on the canvas.
 */

describe('isStNodeFormat', () => {
  it('returns false for an injection with no facet attributes', () => {
    resetIds();
    const e = makeEntity({ type: 'injection', title: 'plain tactic' });
    expect(isStNodeFormat(e)).toBe(false);
  });

  it('returns true when only the Strategy facet is set', () => {
    resetIds();
    const e = makeEntity({
      type: 'injection',
      title: 'tactic',
      attributes: {
        [ST_FACET_KEYS.strategy]: { kind: 'string', value: 'Grow recurring revenue 20%' },
      },
    });
    expect(isStNodeFormat(e)).toBe(true);
  });

  it('returns true when only the NA facet is set (partial fills still trigger)', () => {
    resetIds();
    const e = makeEntity({
      type: 'injection',
      title: 'tactic',
      attributes: {
        [ST_FACET_KEYS.necessaryAssumption]: { kind: 'string', value: 'must reach scale' },
      },
    });
    expect(isStNodeFormat(e)).toBe(true);
  });

  it('returns false for non-injection entities even when the attributes are set', () => {
    resetIds();
    const e = makeEntity({
      type: 'goal',
      title: 'not a tactic',
      attributes: {
        [ST_FACET_KEYS.strategy]: { kind: 'string', value: 'whatever' },
      },
    });
    expect(isStNodeFormat(e)).toBe(false);
  });

  it('exposes the four reserved keys via ST_FACET_KEYS', () => {
    expect(ST_FACET_KEYS.strategy).toBe('stStrategy');
    expect(ST_FACET_KEYS.necessaryAssumption).toBe('stNecessaryAssumption');
    expect(ST_FACET_KEYS.parallelAssumption).toBe('stParallelAssumption');
    expect(ST_FACET_KEYS.sufficiencyAssumption).toBe('stSufficiencyAssumption');
  });
});
