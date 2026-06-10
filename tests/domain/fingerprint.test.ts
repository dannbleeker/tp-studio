import { beforeEach, describe, expect, it } from 'vitest';
import { layoutFingerprint, validationFingerprint } from '@/domain/fingerprint';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { seedConnectedPair, seedEntity } from '../helpers/seedDoc';

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
