import { describe, expect, it } from 'vitest';
import {
  validateAttributes,
  validateEntityLinks,
  validateEvidenceArray,
  validateImportedFromRef,
} from '@/domain/persistenceFieldValidators';
import type { EntityLink, EvidenceItem } from '@/domain/types';

/** Assert the value is defined and cast it; mirrors `expect(v).toBeDefined()` but narrows the type. */
function assertDefined<T>(v: T | undefined | null): T {
  expect(v).toBeDefined();
  return v as T;
}

/**
 * Strict field-level validators for entity/edge sub-objects. Each validator
 * throws on the first invalid input (fail-fast contract) and returns undefined
 * for absent/null inputs where the spec allows it.
 *
 * Coverage target: every throw branch + every silent-drop + every valid
 * round-trip path in persistenceFieldValidators.ts.
 */

// ---------------------------------------------------------------------------
// validateAttributes
// ---------------------------------------------------------------------------
describe('validateAttributes', () => {
  it('returns undefined for absent / null input', () => {
    expect(validateAttributes(undefined, 'attrs')).toBeUndefined();
    expect(validateAttributes(null, 'attrs')).toBeUndefined();
  });

  it('throws when input is not an object', () => {
    expect(() => validateAttributes('string', 'attrs')).toThrow(/attrs/);
    expect(() => validateAttributes(42, 'attrs')).toThrow(/attrs/);
    expect(() => validateAttributes([], 'attrs')).toThrow(/attrs/);
  });

  it('returns undefined for an empty object', () => {
    expect(validateAttributes({}, 'attrs')).toBeUndefined();
  });

  it('round-trips a valid string attribute', () => {
    const result = validateAttributes({ name: { kind: 'string', value: 'hello' } }, 'attrs');
    expect(result).toEqual({ name: { kind: 'string', value: 'hello' } });
  });

  it('round-trips a valid int attribute', () => {
    const result = validateAttributes({ count: { kind: 'int', value: 42 } }, 'attrs');
    expect(result).toEqual({ count: { kind: 'int', value: 42 } });
  });

  it('round-trips a valid real attribute', () => {
    const result = validateAttributes({ pi: { kind: 'real', value: 3.14 } }, 'attrs');
    expect(result).toEqual({ pi: { kind: 'real', value: 3.14 } });
  });

  it('round-trips a valid bool attribute', () => {
    const result = validateAttributes({ flag: { kind: 'bool', value: true } }, 'attrs');
    expect(result).toEqual({ flag: { kind: 'bool', value: true } });
  });

  // AttrValue — invalid kind
  it('throws for an unknown attr kind', () => {
    expect(() => validateAttributes({ x: { kind: 'unknown', value: 'v' } }, 'attrs')).toThrow(
      /invalid kind/
    );
  });

  // AttrValue — non-object value container
  it('throws when an attr entry is not an object', () => {
    expect(() => validateAttributes({ x: 'not-an-object' }, 'attrs')).toThrow(/must be an object/);
  });

  // AttrValue — string kind with wrong value type
  it('throws for string attr with non-string value', () => {
    expect(() => validateAttributes({ x: { kind: 'string', value: 99 } }, 'attrs')).toThrow(
      /non-string value/
    );
  });

  // AttrValue — int kind with non-integer (float)
  it('throws for int attr with float value', () => {
    expect(() => validateAttributes({ x: { kind: 'int', value: 1.5 } }, 'attrs')).toThrow(
      /non-integer value/
    );
  });

  // AttrValue — int kind with non-number
  it('throws for int attr with non-number value', () => {
    expect(() => validateAttributes({ x: { kind: 'int', value: 'five' } }, 'attrs')).toThrow(
      /non-integer value/
    );
  });

  // AttrValue — real kind with non-finite
  it('throws for real attr with non-finite value (Infinity)', () => {
    expect(() =>
      validateAttributes({ x: { kind: 'real', value: Number.POSITIVE_INFINITY } }, 'attrs')
    ).toThrow(/non-finite-number value/);
  });

  // AttrValue — real kind with NaN
  it('throws for real attr with NaN value', () => {
    expect(() => validateAttributes({ x: { kind: 'real', value: Number.NaN } }, 'attrs')).toThrow(
      /non-finite-number value/
    );
  });

  // AttrValue — real kind with non-number
  it('throws for real attr with non-number value', () => {
    expect(() => validateAttributes({ x: { kind: 'real', value: 'pi' } }, 'attrs')).toThrow(
      /non-finite-number value/
    );
  });

  // AttrValue — bool kind with non-boolean
  it('throws for bool attr with non-boolean value', () => {
    expect(() => validateAttributes({ x: { kind: 'bool', value: 1 } }, 'attrs')).toThrow(
      /non-boolean value/
    );
  });
});

// ---------------------------------------------------------------------------
// validateEvidenceArray
// ---------------------------------------------------------------------------

const validEvidenceItem = {
  id: 'ev1',
  description: 'desc',
  source: 'observed',
  strength: 'strong',
  createdAt: 1000,
  updatedAt: 2000,
};

describe('validateEvidenceArray', () => {
  it('returns undefined for absent / null input', () => {
    expect(validateEvidenceArray(undefined, 'evidence')).toBeUndefined();
    expect(validateEvidenceArray(null, 'evidence')).toBeUndefined();
  });

  it('throws when input is not an array', () => {
    expect(() => validateEvidenceArray('string', 'evidence')).toThrow(/evidence/);
    expect(() => validateEvidenceArray({}, 'evidence')).toThrow(/evidence/);
  });

  it('returns undefined for an empty array', () => {
    expect(validateEvidenceArray([], 'evidence')).toBeUndefined();
  });

  it('round-trips a valid minimal evidence item', () => {
    const result = validateEvidenceArray([validEvidenceItem], 'evidence');
    const items = assertDefined(result) as EvidenceItem[];
    expect(items).toHaveLength(1);
    const first = items[0]!;
    expect(first.id).toBe('ev1');
    expect(first.source).toBe('observed');
    expect(first.strength).toBe('strong');
  });

  it('round-trips all valid evidence sources', () => {
    const sources = ['observed', 'stakeholder', 'metric', 'policy', 'assumption'] as const;
    for (const source of sources) {
      const result = validateEvidenceArray([{ ...validEvidenceItem, source }], 'ev');
      expect((assertDefined(result) as EvidenceItem[])[0]!.source).toBe(source);
    }
  });

  it('round-trips all valid evidence strengths', () => {
    const strengths = ['weak', 'moderate', 'strong'] as const;
    for (const strength of strengths) {
      const result = validateEvidenceArray([{ ...validEvidenceItem, strength }], 'ev');
      expect((assertDefined(result) as EvidenceItem[])[0]!.strength).toBe(strength);
    }
  });

  // EvidenceItem — not an object
  it('throws when an evidence item is not an object', () => {
    expect(() => validateEvidenceArray(['not-an-object'], 'evidence')).toThrow(/must be an object/);
  });

  // EvidenceItem — missing/bad id
  it('throws when evidence item has no string id', () => {
    expect(() => validateEvidenceArray([{ ...validEvidenceItem, id: 99 }], 'evidence')).toThrow(
      /has no id/
    );
  });

  // EvidenceItem — bad description
  it('throws when evidence item has non-string description', () => {
    expect(() =>
      validateEvidenceArray([{ ...validEvidenceItem, description: 5 }], 'evidence')
    ).toThrow(/non-string description/);
  });

  // EvidenceItem — invalid source
  it('throws when evidence item has invalid source', () => {
    expect(() =>
      validateEvidenceArray([{ ...validEvidenceItem, source: 'rumour' }], 'evidence')
    ).toThrow(/invalid source/);
  });

  // EvidenceItem — invalid strength
  it('throws when evidence item has invalid strength', () => {
    expect(() =>
      validateEvidenceArray([{ ...validEvidenceItem, strength: 'very-strong' }], 'evidence')
    ).toThrow(/invalid strength/);
  });

  // EvidenceItem — present but non-string url
  it('throws when evidence item url is present but not a string', () => {
    expect(() => validateEvidenceArray([{ ...validEvidenceItem, url: 42 }], 'evidence')).toThrow(
      /non-string url/
    );
  });

  // EvidenceItem — url with unsafe scheme is dropped silently
  it('drops a url with a dangerous scheme (javascript:)', () => {
    const result = validateEvidenceArray(
      [{ ...validEvidenceItem, url: 'javascript:alert(1)' }],
      'evidence'
    );
    expect((assertDefined(result) as EvidenceItem[])[0]!.url).toBeUndefined();
  });

  // EvidenceItem — url with safe scheme is kept
  it('keeps a url with a safe https scheme', () => {
    const result = validateEvidenceArray(
      [{ ...validEvidenceItem, url: 'https://example.com' }],
      'evidence'
    );
    expect((assertDefined(result) as EvidenceItem[])[0]!.url).toBe('https://example.com');
  });

  // EvidenceItem — present but non-number validatedAt
  it('throws when validatedAt is present but not a number', () => {
    expect(() =>
      validateEvidenceArray([{ ...validEvidenceItem, validatedAt: 'today' }], 'evidence')
    ).toThrow(/non-number validatedAt/);
  });

  // EvidenceItem — present but non-string validatedBy
  it('throws when validatedBy is present but not a string', () => {
    expect(() =>
      validateEvidenceArray([{ ...validEvidenceItem, validatedBy: 99 }], 'evidence')
    ).toThrow(/non-string validatedBy/);
  });

  // EvidenceItem — bad createdAt
  it('throws when createdAt is not a number', () => {
    expect(() =>
      validateEvidenceArray([{ ...validEvidenceItem, createdAt: 'now' }], 'evidence')
    ).toThrow(/non-number createdAt/);
  });

  // EvidenceItem — bad updatedAt
  it('throws when updatedAt is not a number', () => {
    expect(() =>
      validateEvidenceArray([{ ...validEvidenceItem, updatedAt: 'now' }], 'evidence')
    ).toThrow(/non-number updatedAt/);
  });

  // Optional fields absent → not included in output
  it('omits optional fields when absent', () => {
    const result = validateEvidenceArray([validEvidenceItem], 'evidence');
    const first = (assertDefined(result) as EvidenceItem[])[0]!;
    expect(first.url).toBeUndefined();
    expect(first.validatedAt).toBeUndefined();
    expect(first.validatedBy).toBeUndefined();
  });

  // Optional fields present → included in output
  it('includes optional fields when validly present', () => {
    const item = {
      ...validEvidenceItem,
      url: 'https://example.com',
      validatedAt: 9999,
      validatedBy: 'alice',
    };
    const result = validateEvidenceArray([item], 'evidence');
    const first = (assertDefined(result) as EvidenceItem[])[0]!;
    expect(first.url).toBe('https://example.com');
    expect(first.validatedAt).toBe(9999);
    expect(first.validatedBy).toBe('alice');
  });
});

// ---------------------------------------------------------------------------
// validateImportedFromRef
// ---------------------------------------------------------------------------
describe('validateImportedFromRef', () => {
  it('returns undefined for absent / null input', () => {
    expect(validateImportedFromRef(undefined, 'importedFrom')).toBeUndefined();
    expect(validateImportedFromRef(null, 'importedFrom')).toBeUndefined();
  });

  it('throws when input is not an object', () => {
    expect(() => validateImportedFromRef('string', 'importedFrom')).toThrow(/must be an object/);
    expect(() => validateImportedFromRef(42, 'importedFrom')).toThrow(/must be an object/);
  });

  it('throws when docId is missing', () => {
    expect(() => validateImportedFromRef({ entityId: 'e1' }, 'importedFrom')).toThrow(/docId/);
  });

  it('throws when docId is an empty string', () => {
    expect(() => validateImportedFromRef({ docId: '', entityId: 'e1' }, 'importedFrom')).toThrow(
      /docId/
    );
  });

  it('throws when docId is not a string', () => {
    expect(() => validateImportedFromRef({ docId: 99, entityId: 'e1' }, 'importedFrom')).toThrow(
      /docId/
    );
  });

  it('throws when entityId is missing', () => {
    expect(() => validateImportedFromRef({ docId: 'd1' }, 'importedFrom')).toThrow(/entityId/);
  });

  it('throws when entityId is an empty string', () => {
    expect(() => validateImportedFromRef({ docId: 'd1', entityId: '' }, 'importedFrom')).toThrow(
      /entityId/
    );
  });

  it('throws when entityId is not a string', () => {
    expect(() => validateImportedFromRef({ docId: 'd1', entityId: 99 }, 'importedFrom')).toThrow(
      /entityId/
    );
  });

  it('throws when sourceTitle is present but not a string', () => {
    expect(() =>
      validateImportedFromRef({ docId: 'd1', entityId: 'e1', sourceTitle: 42 }, 'importedFrom')
    ).toThrow(/sourceTitle/);
  });

  it('throws when importedAt is present but not a string', () => {
    expect(() =>
      validateImportedFromRef({ docId: 'd1', entityId: 'e1', importedAt: 12345 }, 'importedFrom')
    ).toThrow(/importedAt/);
  });

  it('round-trips minimal valid input', () => {
    const result = validateImportedFromRef({ docId: 'd1', entityId: 'e1' }, 'importedFrom');
    expect(result).toEqual({ docId: 'd1', entityId: 'e1' });
  });

  it('round-trips valid input with all optional fields', () => {
    const result = validateImportedFromRef(
      { docId: 'd1', entityId: 'e1', sourceTitle: 'My Doc', importedAt: '2024-01-01' },
      'importedFrom'
    );
    expect(result).toEqual({
      docId: 'd1',
      entityId: 'e1',
      sourceTitle: 'My Doc',
      importedAt: '2024-01-01',
    });
  });

  it('omits sourceTitle and importedAt when they are empty strings', () => {
    const result = validateImportedFromRef(
      { docId: 'd1', entityId: 'e1', sourceTitle: '', importedAt: '' },
      'importedFrom'
    );
    expect(result).toEqual({ docId: 'd1', entityId: 'e1' });
  });
});

// ---------------------------------------------------------------------------
// validateEntityLinks
// ---------------------------------------------------------------------------
describe('validateEntityLinks', () => {
  it('returns undefined for absent / null input', () => {
    expect(validateEntityLinks(undefined, 'links')).toBeUndefined();
    expect(validateEntityLinks(null, 'links')).toBeUndefined();
  });

  it('throws when input is not an array', () => {
    expect(() => validateEntityLinks('string', 'links')).toThrow(/links/);
    expect(() => validateEntityLinks({}, 'links')).toThrow(/links/);
    expect(() => validateEntityLinks(42, 'links')).toThrow(/links/);
  });

  it('returns undefined for an empty array', () => {
    expect(validateEntityLinks([], 'links')).toBeUndefined();
  });

  it('returns undefined when all entries are malformed (no valid entries survive)', () => {
    // Non-object entries are silently skipped
    expect(validateEntityLinks(['not-an-object', 42, null], 'links')).toBeUndefined();
    // Objects missing required fields are skipped
    expect(validateEntityLinks([{ docId: 'd1' }], 'links')).toBeUndefined();
    expect(validateEntityLinks([{ entityId: 'e1' }], 'links')).toBeUndefined();
    expect(validateEntityLinks([{ docId: '', entityId: 'e1' }], 'links')).toBeUndefined();
    expect(validateEntityLinks([{ docId: 'd1', entityId: '' }], 'links')).toBeUndefined();
  });

  it('round-trips a valid link', () => {
    const result = validateEntityLinks([{ docId: 'd1', entityId: 'e1' }], 'links');
    expect(result).toEqual([{ docId: 'd1', entityId: 'e1' }]);
  });

  it('keeps valid entries and silently drops malformed entries', () => {
    const result = validateEntityLinks(
      [
        { docId: 'd1', entityId: 'e1' }, // valid
        { docId: '', entityId: 'e1' }, // dropped: empty docId
        'not-an-object', // dropped: not an object
        { docId: 'd2', entityId: 'e2' }, // valid
        { docId: 'd3', entityId: '' }, // dropped: empty entityId
      ],
      'links'
    );
    expect(result).toEqual([
      { docId: 'd1', entityId: 'e1' },
      { docId: 'd2', entityId: 'e2' },
    ]);
  });

  it('round-trips multiple valid links', () => {
    const links = [
      { docId: 'doc-a', entityId: 'ent-1' },
      { docId: 'doc-b', entityId: 'ent-2' },
    ];
    const result = validateEntityLinks(links, 'links');
    const items = assertDefined(result) as EntityLink[];
    expect(items).toHaveLength(2);
    expect(items[0]!).toEqual({ docId: 'doc-a', entityId: 'ent-1' });
    expect(items[1]!).toEqual({ docId: 'doc-b', entityId: 'ent-2' });
  });
});
