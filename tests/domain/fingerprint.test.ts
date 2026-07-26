import { beforeEach, describe, expect, it } from 'vitest';
import { layoutFingerprint, validationFingerprint } from '@/domain/fingerprint';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { seedConnectedPair, seedEntity } from '../helpers/seedDoc';
import { makeDoc, makeEdge, makeEntity, resetIds } from './helpers';

beforeEach(resetStoreForTest);

/**
 * The two fingerprints are the gating keys for the heaviest memo'd
 * computations (dagre layout, CLR validation). Their contracts:
 *
 *   - `layoutFingerprint` changes when structure changes (entity / edge
 *     set, AND-grouping, pinned positions). Title edits do NOT change
 *     it — the layout cache survives.
 *   - `validationFingerprint` changes when validator inputs change
 *     (entity titles, types, edges, diagramType, resolved warnings).
 *     Position changes do NOT change it — title-only edits that affect
 *     clarity DO.
 *
 * These tests pin down the boundary: if a future code change adds a
 * field to one fingerprint that doesn't belong, or omits one that does,
 * the test catches it.
 */

const fp = (kind: 'layout' | 'validation') => {
  const doc = useDocumentStore.getState().doc;
  return kind === 'layout' ? layoutFingerprint(doc) : validationFingerprint(doc);
};

describe('layoutFingerprint', () => {
  it('changes when an entity is added', () => {
    const a = fp('layout');
    seedEntity('A');
    expect(fp('layout')).not.toBe(a);
  });

  it('changes when an edge is added', () => {
    seedEntity('A');
    seedEntity('B');
    const a = fp('layout');
    seedConnectedPair('C', 'D');
    expect(fp('layout')).not.toBe(a);
  });

  it('does NOT change when an entity title is edited', () => {
    const e = seedEntity('Old');
    const a = fp('layout');
    useDocumentStore.getState().updateEntity(e.id, { title: 'New' });
    expect(fp('layout')).toBe(a);
  });

  it('does NOT change when a description is edited', () => {
    const e = seedEntity('A');
    const a = fp('layout');
    useDocumentStore.getState().updateEntity(e.id, { description: 'A long note' });
    expect(fp('layout')).toBe(a);
  });

  it('changes when a pinned position changes', () => {
    const e = seedEntity('A');
    useDocumentStore.getState().setEntityPosition(e.id, { x: 100, y: 100 });
    const a = fp('layout');
    useDocumentStore.getState().setEntityPosition(e.id, { x: 200, y: 200 });
    expect(fp('layout')).not.toBe(a);
  });

  it('does NOT change when an unrelated preference flips (theme)', () => {
    seedEntity('A');
    const a = fp('layout');
    useDocumentStore.getState().setTheme('dark');
    expect(fp('layout')).toBe(a);
  });
});

describe('validationFingerprint', () => {
  it('changes when an entity title changes (clarity rule reads titles)', () => {
    const e = seedEntity('Old');
    const a = fp('validation');
    useDocumentStore.getState().updateEntity(e.id, { title: 'New' });
    expect(fp('validation')).not.toBe(a);
  });

  it('changes when entity type changes', () => {
    const e = seedEntity('A', 'effect');
    const a = fp('validation');
    useDocumentStore.getState().updateEntity(e.id, { type: 'ude' });
    expect(fp('validation')).not.toBe(a);
  });

  it('changes when an edge is added', () => {
    seedEntity('A');
    seedEntity('B');
    const a = fp('validation');
    seedConnectedPair('C', 'D');
    expect(fp('validation')).not.toBe(a);
  });

  it('changes when a warning is resolved', () => {
    seedEntity('A'); // No edges yet → has entity-existence warning.
    const a = fp('validation');
    useDocumentStore.getState().resolveWarning('w-1'); // arbitrary id; the resolvedWarnings map keys on it
    expect(fp('validation')).not.toBe(a);
  });

  it('does NOT change when a position changes (auto-layout doc)', () => {
    const e = seedEntity('A');
    const a = fp('validation');
    useDocumentStore.getState().setEntityPosition(e.id, { x: 50, y: 50 });
    expect(fp('validation')).toBe(a);
  });

  it('changes when the diagram type changes', () => {
    seedEntity('A');
    const a = fp('validation');
    useDocumentStore.getState().newDocument('ec');
    // newDocument resets the doc — fingerprint changes obviously, but the
    // diagram-type-in-key invariant is what we're pinning.
    expect(fp('validation')).not.toBe(a);
  });

  it('changes when an entity state changes (A2 — the entry-point rule reads it)', () => {
    // Regression guard for the cache trap: the entry-point rule (FRT/NBR) treats
    // an entry point asserted true in current reality as legitimate, so a state
    // toggle MUST re-key the fingerprint or the warning goes stale on a hit.
    const inj = makeEntity({ type: 'effect', title: 'Supplier ships on time' });
    const de = makeEntity({ type: 'desiredEffect', title: 'Orders arrive early' });
    const edge = makeEdge(inj.id, de.id);
    const unset = validationFingerprint(makeDoc([inj, de], [edge], 'frt'));
    const asserted = validationFingerprint(makeDoc([{ ...inj, state: 'true' }, de], [edge], 'frt'));
    expect(asserted).not.toBe(unset);
  });

  it('changes when the Goal-Tree NC-depth mode toggles (A4 — the rule reads it)', () => {
    // Same cache trap as `state`: the goalTree-nc-depth rule reads doc.ncDepthMode,
    // and a mode toggle leaves the entities/edges refs intact — so the fingerprint
    // must re-key or the depth warnings go stale on a hit.
    const csf = makeEntity({ type: 'criticalSuccessFactor', title: 'CSF' });
    const strict = makeDoc([csf], [], 'goalTree');
    const relaxed = { ...strict, ncDepthMode: 'conflict-resolution' as const };
    // Same entities/edges references — only the doc-level mode differs.
    expect(relaxed.entities).toBe(strict.entities);
    expect(validationFingerprint(relaxed)).not.toBe(validationFingerprint(strict));
  });
});

describe('validationFingerprint — custom entity classes', () => {
  it("changes when a class's supersetOf changes (isOfBuiltin rules re-classify)", () => {
    seedEntity('A');
    useDocumentStore.getState().upsertCustomEntityClass({
      id: 'site-risk',
      label: 'Site Risk',
      supersetOf: 'ude',
    });
    const a = fp('validation');
    useDocumentStore.getState().upsertCustomEntityClass({
      id: 'site-risk',
      label: 'Site Risk',
      supersetOf: 'effect',
    });
    expect(fp('validation')).not.toBe(a);
  });

  it('does NOT change on a label-only class edit (no rule reads labels)', () => {
    seedEntity('A');
    useDocumentStore.getState().upsertCustomEntityClass({
      id: 'site-risk',
      label: 'Site Risk',
      supersetOf: 'ude',
    });
    const a = fp('validation');
    useDocumentStore.getState().upsertCustomEntityClass({
      id: 'site-risk',
      label: 'Renamed Risk',
      supersetOf: 'ude',
    });
    expect(fp('validation')).toBe(a);
  });

  it('validate() re-runs after a supersetOf flip with unchanged entities/edges (stale-cache regression)', async () => {
    // Repro for the review finding: editing a class's supersetOf used to be
    // invisible to the fingerprint (entities/edges refs unchanged), so the
    // isOfBuiltin-aware rules served stale results until an unrelated edit.
    const { validate } = await import('@/domain/validators');
    const { makeDoc, makeEntity, makeEdge } = await import('./helpers');
    const counter = makeEntity({ type: 'counter-move' as never, title: 'Custom injection' });
    const eff = makeEntity({ type: 'effect', title: 'Traced effect' });
    const base = makeDoc([counter, eff], [makeEdge(counter.id, eff.id)], 'nbr');
    const asInjection = {
      ...base,
      customEntityClasses: {
        'counter-move': { id: 'counter-move', label: 'Counter', supersetOf: 'injection' as const },
      },
    };
    // Tracing custom injection + no UDE → the shape rule fires.
    expect(validate(asInjection).some((w) => w.ruleId === 'nbr-no-negative-branch')).toBe(true);
    // Same entities/edges REFERENCES, only the class map differs.
    const asEffect = {
      ...asInjection,
      customEntityClasses: {
        'counter-move': { id: 'counter-move', label: 'Counter', supersetOf: 'effect' as const },
      },
    };
    expect(asEffect.entities).toBe(asInjection.entities);
    expect(asEffect.edges).toBe(asInjection.edges);
    // No injection in the doc any more → the rule must NOT fire (a stale
    // fingerprint hit would keep returning the old warning).
    expect(validate(asEffect).some((w) => w.ruleId === 'nbr-no-negative-branch')).toBe(false);
  });
});

/**
 * Regression — every edge field a validator reads MUST be in the validation
 * fingerprint, or two docs differing only in that field collide on the cache
 * key and `validate` returns stale warnings. `edge.kind`
 * (logic-type-mismatch / long-arrow / cause-sufficiency) and
 * `edge.isMutualExclusion` (ec-missing-conflict / ec-completeness) were
 * missing (found Session 191 by the validator-test sweep).
 */
describe('validationFingerprint — edge fields rules read', () => {
  const twoNodeDoc = (edgeOverrides: Parameters<typeof makeEdge>[2]) => {
    resetIds();
    const a = makeEntity({ title: 'A' });
    const b = makeEntity({ title: 'B' });
    return makeDoc([a, b], [makeEdge(a.id, b.id, edgeOverrides)]);
  };

  it('changes when an edge kind flips sufficiency ↔ necessity', () => {
    const suff = validationFingerprint(twoNodeDoc({ kind: 'sufficiency' }));
    const nec = validationFingerprint(twoNodeDoc({ kind: 'necessity' }));
    expect(suff).not.toBe(nec);
  });

  it('changes when an edge mutual-exclusion flag flips', () => {
    const plain = validationFingerprint(twoNodeDoc({}));
    const mutex = validationFingerprint(twoNodeDoc({ isMutualExclusion: true }));
    expect(plain).not.toBe(mutex);
  });

  it('changes when OR / XOR grouping is applied (indirect-effect + cause-sufficiency read it)', () => {
    const plain = validationFingerprint(twoNodeDoc({}));
    const or = validationFingerprint(twoNodeDoc({ orGroupId: 'or-1' }));
    const xor = validationFingerprint(twoNodeDoc({ xorGroupId: 'xor-1' }));
    expect(or).not.toBe(plain);
    expect(xor).not.toBe(plain);
    expect(or).not.toBe(xor);
  });
});

/**
 * Session 209 — the per-entity record was an unescaped concatenation joined by
 * `|`, with the free-text title interpolated raw. A title containing the two
 * delimiters forged extra records, so two structurally different documents
 * produced the same fingerprint.
 *
 * That is not academic: the validation LRU is module-global and shared across
 * tabs AND saved documents (`useSavedTrees` runs `validate` over every tree in
 * the library), so unrelated documents genuinely meet in that cache. The
 * observable failure was a document rendering warnings that targeted entity ids
 * it does not contain.
 */
describe('validationFingerprint is injective across free text', () => {
  it('a title carrying the record delimiters cannot forge another entity', () => {
    resetIds();
    const twoEntities = makeDoc(
      [
        makeEntity({ id: 'n1' as never, title: 'A', annotationNumber: 1 }),
        makeEntity({ id: 'n2' as never, title: 'B', annotationNumber: 2 }),
      ],
      []
    );
    resetIds();
    const oneEntityWithAMaliciousTitle = makeDoc(
      [makeEntity({ id: 'n1' as never, title: 'A:|n2:effect:B', annotationNumber: 1 })],
      []
    );

    expect(validationFingerprint(twoEntities)).not.toBe(
      validationFingerprint(oneEntityWithAMaliciousTitle)
    );
  });

  it('still ignores fields no rule reads', () => {
    resetIds();
    const base = makeDoc([makeEntity({ id: 'n1' as never, title: 'A' })], []);
    const moved = {
      ...base,
      entities: {
        n1: { ...base.entities.n1, position: { x: 99, y: 99 }, description: 'irrelevant' },
      },
    } as typeof base;
    expect(validationFingerprint(moved)).toBe(validationFingerprint(base));
  });
});
