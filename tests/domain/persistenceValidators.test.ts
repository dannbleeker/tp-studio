import {
  validateLayoutConfig,
  validateMethodChecklist,
  validateSystemScope,
} from '@/domain/persistenceValidators';
import { describe, expect, it } from 'vitest';

/**
 * The "soft" persistence validators (the ones that drop bad fields
 * rather than throwing on invalid input) have a non-trivial contract:
 *
 *   - undefined / null / non-object → undefined
 *   - object with all bad fields → undefined (nothing survived)
 *   - object with one good + bad fields → keeps the good
 *
 * The strict validators (validateEntity / validateEdge / validateGroup)
 * are exercised exhaustively through `tests/domain/persistence.test.ts`
 * which runs the full importFromJSON happy + error paths; this file
 * covers the three soft validators directly because their drop-bad-field
 * behaviour is hard to test through importFromJSON without contriving
 * a partially-corrupt document.
 */

describe('validateLayoutConfig (soft)', () => {
  it('returns undefined for non-object / null / undefined', () => {
    expect(validateLayoutConfig(undefined)).toBeUndefined();
    expect(validateLayoutConfig(null)).toBeUndefined();
    expect(validateLayoutConfig('LR')).toBeUndefined();
    expect(validateLayoutConfig(42)).toBeUndefined();
    expect(validateLayoutConfig([])).toBeUndefined();
  });

  it('accepts a valid direction and drops invalid ones', () => {
    expect(validateLayoutConfig({ direction: 'BT' })).toEqual({ direction: 'BT' });
    expect(validateLayoutConfig({ direction: 'sideways' })).toBeUndefined();
  });

  it('accepts positive finite separation numbers', () => {
    expect(validateLayoutConfig({ nodesep: 50 })).toEqual({ nodesep: 50 });
    expect(validateLayoutConfig({ ranksep: 80 })).toEqual({ ranksep: 80 });
  });

  it('drops non-positive / infinite / non-number separations', () => {
    expect(validateLayoutConfig({ nodesep: 0 })).toBeUndefined();
    expect(validateLayoutConfig({ nodesep: -10 })).toBeUndefined();
    expect(validateLayoutConfig({ nodesep: Number.POSITIVE_INFINITY })).toBeUndefined();
    expect(validateLayoutConfig({ nodesep: '50' })).toBeUndefined();
  });

  it('keeps the good fields and drops the bad ones', () => {
    const result = validateLayoutConfig({
      direction: 'TB',
      nodesep: -5, // dropped
      ranksep: 100, // kept
      align: 'BOGUS', // dropped
    });
    expect(result).toEqual({ direction: 'TB', ranksep: 100 });
  });
});

describe('validateSystemScope (soft)', () => {
  it('returns undefined for non-object', () => {
    expect(validateSystemScope(undefined)).toBeUndefined();
    expect(validateSystemScope(null)).toBeUndefined();
    expect(validateSystemScope('goal')).toBeUndefined();
  });

  it('returns undefined when no valid fields survive', () => {
    expect(validateSystemScope({})).toBeUndefined();
    expect(validateSystemScope({ goal: '' })).toBeUndefined(); // empty strings drop
    expect(validateSystemScope({ goal: 42 })).toBeUndefined();
    expect(validateSystemScope({ random: 'value' })).toBeUndefined();
  });

  it('keeps non-empty string fields from the known keys', () => {
    const result = validateSystemScope({
      goal: 'Ship the thing',
      necessaryConditions: 'Get team buy-in',
      bogus: 'ignored',
    });
    expect(result).toEqual({
      goal: 'Ship the thing',
      necessaryConditions: 'Get team buy-in',
    });
  });
});

describe('validateMethodChecklist (soft)', () => {
  it('returns undefined for non-object', () => {
    expect(validateMethodChecklist(undefined)).toBeUndefined();
    expect(validateMethodChecklist(null)).toBeUndefined();
  });

  it('keeps only literal-true values', () => {
    expect(validateMethodChecklist({ a: true, b: false, c: 'true', d: 1 })).toEqual({
      a: true,
    });
  });

  it('returns undefined when nothing is literal-true', () => {
    expect(validateMethodChecklist({ a: false, b: 'true' })).toBeUndefined();
    expect(validateMethodChecklist({})).toBeUndefined();
  });
});
