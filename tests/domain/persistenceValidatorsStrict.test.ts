import { describe, expect, it } from 'vitest';
import {
  validateAssumption,
  validateComment,
  validateEdge,
  validateEntity,
  validateGroup,
  validateRecord,
} from '@/domain/persistenceValidators';

// Strict member validators: each rejects the first invalid field (fail-fast) and
// returns the narrowed value. The existing persistenceValidators.test.ts covers the
// soft validators + entity finite-number guards; this pins the rest of the
// hostile-input boundary (validateEdge/Assumption/Comment/Group/Record + the entity
// enum/optional-field branches), including the prototype-pollution rejection.

const entity = {
  id: 'e1',
  type: 'effect',
  title: 'E',
  annotationNumber: 1,
  createdAt: 1,
  updatedAt: 1,
};
const edge = { id: 'x1', sourceId: 'a', targetId: 'b', kind: 'sufficiency' };
const assumption = {
  id: 'a1',
  edgeId: 'x1',
  text: 'because',
  status: 'unexamined',
  createdAt: 1,
  updatedAt: 1,
};
const comment = {
  id: 'c1',
  anchor: { kind: 'document' },
  body: 'b',
  author: 'me',
  createdAt: 1,
  updatedAt: 1,
};
const group = {
  id: 'g1',
  title: 'G',
  color: 'indigo',
  memberIds: ['e1'],
  collapsed: false,
  createdAt: 1,
  updatedAt: 1,
};

describe('validateEntity — optional-field + enum guards', () => {
  it('accepts and emits a fully-populated entity', () => {
    const full = {
      ...entity,
      description: 'd',
      titleSize: 'lg',
      collapsed: true,
      coreProblem: true,
      ordering: 2,
      position: { x: 1, y: 2 },
      attestation: 'att',
      need: 'n',
      workingAssumption: 'wa',
      owner: 'o',
      lastValidatedAt: 5,
      unspecified: true,
      state: 'disputed',
      spanOfControl: 'influence',
      ecSlot: 'dPrime',
    };
    const out = validateEntity(full, 'e');
    expect(out.titleSize).toBe('lg');
    expect(out.state).toBe('disputed');
    expect(out.spanOfControl).toBe('influence');
    expect(out.ecSlot).toBe('dPrime');
    expect(out.coreProblem).toBe(true);
    expect(out.position).toEqual({ x: 1, y: 2 });
  });

  it('rejects a non-object / missing id / bad type / non-string title', () => {
    expect(() => validateEntity(null, 'e')).toThrow(/object/);
    expect(() => validateEntity({ ...entity, id: 5 }, 'e')).toThrow(/id/);
    expect(() => validateEntity({ ...entity, type: 'nope' }, 'e')).toThrow(/type/);
    expect(() => validateEntity({ ...entity, title: 5 }, 'e')).toThrow(/title/);
  });

  it('rejects invalid enum values', () => {
    expect(() => validateEntity({ ...entity, titleSize: 'huge' }, 'e')).toThrow(/titleSize/);
    expect(() => validateEntity({ ...entity, state: 'maybe' }, 'e')).toThrow(/state/);
    expect(() => validateEntity({ ...entity, spanOfControl: 'cosmic' }, 'e')).toThrow(
      /spanOfControl/
    );
    expect(() => validateEntity({ ...entity, ecSlot: 'z' }, 'e')).toThrow(/ecSlot/);
  });

  it('rejects wrong-typed optional fields', () => {
    expect(() => validateEntity({ ...entity, collapsed: 'yes' }, 'e')).toThrow(/collapsed/);
    expect(() => validateEntity({ ...entity, coreProblem: 1 }, 'e')).toThrow(/coreProblem/);
    expect(() => validateEntity({ ...entity, ordering: Number.NaN }, 'e')).toThrow(/ordering/);
    expect(() => validateEntity({ ...entity, description: 5 }, 'e')).toThrow(/description/);
    expect(() => validateEntity({ ...entity, owner: 5 }, 'e')).toThrow(/owner/);
    expect(() => validateEntity({ ...entity, lastValidatedAt: 'x' }, 'e')).toThrow(
      /lastValidatedAt/
    );
    expect(() => validateEntity({ ...entity, unspecified: 'no' }, 'e')).toThrow(/unspecified/);
    expect(() => validateEntity({ ...entity, need: 5 }, 'e')).toThrow(/need/);
    expect(() => validateEntity({ ...entity, attestation: 5 }, 'e')).toThrow(/attestation/);
  });
});

describe('validateEdge', () => {
  it('round-trips a minimal edge + optional fields', () => {
    const out = validateEdge(
      { ...edge, weight: 'negative', label: 'L', isBackEdge: true, assumptionIds: ['a1'] },
      'x'
    );
    expect(out.kind).toBe('sufficiency');
    expect(out.weight).toBe('negative');
    expect(out.isBackEdge).toBe(true);
    expect(out.assumptionIds).toEqual(['a1']);
  });

  it('collapses conflicting junctor groups (AND > OR > XOR)', () => {
    const out = validateEdge({ ...edge, andGroupId: 'g1', orGroupId: 'g2', xorGroupId: 'g3' }, 'x');
    expect(out.andGroupId).toBe('g1');
    expect(out.orGroupId).toBeUndefined();
    expect(out.xorGroupId).toBeUndefined();
  });

  it('rejects bad core + optional fields', () => {
    expect(() => validateEdge({ ...edge, sourceId: 5 }, 'x')).toThrow(/sourceId/);
    expect(() => validateEdge({ ...edge, targetId: 5 }, 'x')).toThrow(/targetId/);
    expect(() => validateEdge({ ...edge, kind: 'nope' }, 'x')).toThrow(/kind/);
    expect(() => validateEdge({ ...edge, weight: 'huge' }, 'x')).toThrow(/weight/);
    expect(() => validateEdge({ ...edge, assumptionIds: 'a1' }, 'x')).toThrow(/assumptionIds/);
    expect(() => validateEdge({ ...edge, isBackEdge: 'yes' }, 'x')).toThrow(/isBackEdge/);
    expect(() => validateEdge({ ...edge, isMutualExclusion: 1 }, 'x')).toThrow(/isMutualExclusion/);
  });
});

describe('validateAssumption', () => {
  it('round-trips a valid assumption', () => {
    const out = validateAssumption(
      { ...assumption, kind: 'necessary', resolved: true, source: 'user', injectionIds: ['e1'] },
      'a'
    );
    expect(out.status).toBe('unexamined');
    expect(out.kind).toBe('necessary');
    expect(out.resolved).toBe(true);
  });

  it('rejects bad fields', () => {
    expect(() => validateAssumption({ ...assumption, status: 'nope' }, 'a')).toThrow(/status/);
    expect(() => validateAssumption({ ...assumption, kind: 'nope' }, 'a')).toThrow(/kind/);
    expect(() => validateAssumption({ ...assumption, injectionIds: 'x' }, 'a')).toThrow(
      /injectionIds/
    );
    expect(() => validateAssumption({ ...assumption, source: 'bot' }, 'a')).toThrow(/source/);
    expect(() => validateAssumption({ ...assumption, createdAt: 'x' }, 'a')).toThrow(/createdAt/);
  });
});

describe('validateComment', () => {
  it('round-trips each anchor kind', () => {
    expect(validateComment(comment, 'c').anchor).toEqual({ kind: 'document' });
    const ent = validateComment({ ...comment, anchor: { kind: 'entity', entityId: 'e1' } }, 'c');
    expect(ent.anchor).toEqual({ kind: 'entity', entityId: 'e1' });
    const edg = validateComment({ ...comment, anchor: { kind: 'edge', edgeId: 'x1' } }, 'c');
    expect(edg.anchor).toEqual({ kind: 'edge', edgeId: 'x1' });
    const pt = validateComment({ ...comment, anchor: { kind: 'point', x: 1, y: 2 } }, 'c');
    expect(pt.anchor).toEqual({ kind: 'point', x: 1, y: 2 });
  });

  it('rejects a bad anchor + wrong-typed fields', () => {
    expect(() => validateComment({ ...comment, anchor: { kind: 'bogus' } }, 'c')).toThrow(/anchor/);
    expect(() => validateComment({ ...comment, body: 5 }, 'c')).toThrow(/body/);
    expect(() => validateComment({ ...comment, author: 5 }, 'c')).toThrow(/author/);
    expect(() => validateComment({ ...comment, parentId: 5 }, 'c')).toThrow(/parentId/);
  });
});

describe('validateGroup', () => {
  it('round-trips a valid group', () => {
    const out = validateGroup({ ...group, archived: true }, 'g');
    expect(out.color).toBe('indigo');
    expect(out.archived).toBe(true);
  });

  it('rejects bad fields', () => {
    expect(() => validateGroup({ ...group, color: 'teal' }, 'g')).toThrow(/color/);
    expect(() => validateGroup({ ...group, memberIds: 'e1' }, 'g')).toThrow(/memberIds/);
    expect(() => validateGroup({ ...group, collapsed: 'no' }, 'g')).toThrow(/collapsed/);
    expect(() => validateGroup({ ...group, archived: 1 }, 'g')).toThrow(/archived/);
  });
});

describe('validateRecord', () => {
  it('validates each value + returns a keyed record', () => {
    const out = validateRecord({ e1: entity }, validateEntity, 'entities');
    expect(out.e1.id).toBe('e1');
  });

  it('rejects a non-object', () => {
    expect(() => validateRecord(null, validateEntity, 'r')).toThrow(/object/);
  });

  it('rejects reserved prototype-pollution keys', () => {
    expect(() => validateRecord({ constructor: entity }, validateEntity, 'r')).toThrow(/reserved/);
    expect(() => validateRecord({ prototype: entity }, validateEntity, 'r')).toThrow(/reserved/);
    const proto = JSON.parse('{"__proto__": {}}');
    expect(() => validateRecord(proto, validateEntity, 'r')).toThrow(/reserved/);
  });
});
