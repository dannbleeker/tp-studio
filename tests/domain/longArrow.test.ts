import { beforeEach, describe, expect, it } from 'vitest';
import { validate } from '@/domain/validators';
import { longArrowRule } from '@/domain/validators/longArrow';
import { runWarningAction } from '@/services/warningActions';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { makeDoc, makeEdge, makeEntity, resetIds } from './helpers';

/**
 * Session 180 (E5) — long-arrow / missing-step reservation. A sufficiency
 * edge that jumps past ≥ 2 causal levels (a longer chain to the same effect
 * exists) is flagged, EXISTENCE tier, with an `insert-step` remedy.
 */
beforeEach(resetIds);

/** r → a → b → ude (a 3-level chain) plus a direct r → ude shortcut. */
const longArrowDoc = (shortcutOverrides = {}) => {
  const r = makeEntity({ title: 'Root cause' });
  const a = makeEntity({ title: 'Step A' });
  const b = makeEntity({ title: 'Step B' });
  const ude = makeEntity({ type: 'ude', title: 'The UDE' });
  const shortcut = makeEdge(r.id, ude.id, shortcutOverrides);
  return {
    r,
    a,
    b,
    ude,
    shortcut,
    doc: makeDoc(
      [r, a, b, ude],
      [makeEdge(r.id, a.id), makeEdge(a.id, b.id), makeEdge(b.id, ude.id), shortcut],
      'crt'
    ),
  };
};

describe('longArrowRule', () => {
  it('flags the shortcut edge that skips two levels', () => {
    const { shortcut, doc } = longArrowDoc();
    const w = longArrowRule(doc);
    expect(w).toHaveLength(1);
    expect(w[0]?.target).toEqual({ kind: 'edge', id: shortcut.id });
    expect(w[0]?.message).toMatch(/spans 3 causal levels/);
    expect(w[0]?.message).toMatch(/Root cause/);
    expect(w[0]?.action?.actionId).toBe('insert-step');
  });

  it('does not flag a single skipped step (span 2)', () => {
    // r → a → ude plus a direct r → ude: the shortcut bypasses only one level.
    const r = makeEntity({ title: 'r' });
    const a = makeEntity({ title: 'a' });
    const ude = makeEntity({ type: 'ude', title: 'ude' });
    const doc = makeDoc(
      [r, a, ude],
      [makeEdge(r.id, a.id), makeEdge(a.id, ude.id), makeEdge(r.id, ude.id)],
      'crt'
    );
    expect(longArrowRule(doc)).toEqual([]);
  });

  it('does not flag a plain chain with no shortcut', () => {
    const r = makeEntity();
    const a = makeEntity();
    const b = makeEntity();
    const ude = makeEntity({ type: 'ude' });
    const doc = makeDoc(
      [r, a, b, ude],
      [makeEdge(r.id, a.id), makeEdge(a.id, b.id), makeEdge(b.id, ude.id)],
      'crt'
    );
    expect(longArrowRule(doc)).toEqual([]);
  });

  it('only considers sufficiency edges — a necessity shortcut is ignored', () => {
    const { doc } = longArrowDoc({ kind: 'necessity' });
    expect(longArrowRule(doc)).toEqual([]);
  });

  it('terminates on a feedback loop (back-edges excluded)', () => {
    // 3-cycle a → b → c → a — no long arrow, must not hang.
    const a = makeEntity();
    const b = makeEntity();
    const c = makeEntity();
    const doc = makeDoc(
      [a, b, c],
      [makeEdge(a.id, b.id), makeEdge(b.id, c.id), makeEdge(c.id, a.id)],
      'crt'
    );
    expect(longArrowRule(doc)).toEqual([]);
  });

  it('reports the actual span in the message (deeper chain → bigger number)', () => {
    // r → a → b → c → ude (4 levels) plus a direct r → ude.
    const r = makeEntity({ title: 'r' });
    const a = makeEntity();
    const b = makeEntity();
    const c = makeEntity();
    const ude = makeEntity({ type: 'ude' });
    const doc = makeDoc(
      [r, a, b, c, ude],
      [
        makeEdge(r.id, a.id),
        makeEdge(a.id, b.id),
        makeEdge(b.id, c.id),
        makeEdge(c.id, ude.id),
        makeEdge(r.id, ude.id),
      ],
      'crt'
    );
    const w = longArrowRule(doc);
    expect(w).toHaveLength(1);
    expect(w[0]?.message).toMatch(/spans 4 causal levels/);
  });

  it('honours the resolvedWarnings escape hatch', () => {
    const { shortcut, doc } = longArrowDoc();
    const id = `long-arrow:edge:${shortcut.id}`;
    const resolvedDoc = { ...doc, resolvedWarnings: { [id]: true as const } };
    expect(longArrowRule(resolvedDoc)[0]?.resolved).toBe(true);
  });
});

describe('long-arrow registration', () => {
  it('runs on a CRT via validate()', () => {
    const { doc } = longArrowDoc();
    expect(validate(doc).some((w) => w.ruleId === 'long-arrow')).toBe(true);
  });

  it('is NOT registered on a Goal Tree (necessity logic)', () => {
    // Same sufficiency shape, but on a goalTree the rule isn't in the set.
    const { doc } = longArrowDoc();
    const goalTreeDoc = { ...doc, diagramType: 'goalTree' as const };
    expect(validate(goalTreeDoc).some((w) => w.ruleId === 'long-arrow')).toBe(false);
  });

  it('stamps the EXISTENCE tier', () => {
    const { doc } = longArrowDoc();
    const w = validate(doc).find((x) => x.ruleId === 'long-arrow');
    expect(w?.tier).toBe('existence');
  });
});

describe('insert-step action', () => {
  beforeEach(resetStoreForTest);

  it('splices a new step into the flagged edge', () => {
    const s = useDocumentStore.getState();
    s.newDocument('crt');
    const a = s.addEntity({ type: 'effect', title: 'cause' });
    const b = s.addEntity({ type: 'ude', title: 'effect' });
    const edge = s.connect(a.id, b.id);
    expect(edge).toBeTruthy();

    const before = useDocumentStore.getState().doc;
    const entitiesBefore = Object.keys(before.entities).length;
    const edgesBefore = Object.keys(before.edges).length;

    const ran = runWarningAction(useDocumentStore.getState(), useDocumentStore.getState().doc, {
      id: `long-arrow:edge:${edge!.id}`,
      ruleId: 'long-arrow',
      message: 'x',
      target: { kind: 'edge', id: edge!.id },
      resolved: false,
      tier: 'existence',
      action: { actionId: 'insert-step', label: 'Insert a step' },
    });

    expect(ran).toBe(true);
    const after = useDocumentStore.getState().doc;
    expect(Object.keys(after.entities).length).toBe(entitiesBefore + 1);
    expect(Object.keys(after.edges).length).toBeGreaterThan(edgesBefore);
  });

  it('is a no-op when the target is not an edge', () => {
    const s = useDocumentStore.getState();
    s.newDocument('crt');
    const a = s.addEntity({ type: 'effect', title: 'x' });
    const entitiesBefore = Object.keys(useDocumentStore.getState().doc.entities).length;

    runWarningAction(useDocumentStore.getState(), useDocumentStore.getState().doc, {
      id: `long-arrow:entity:${a.id}`,
      ruleId: 'long-arrow',
      message: 'x',
      target: { kind: 'entity', id: a.id },
      resolved: false,
      tier: 'existence',
      action: { actionId: 'insert-step', label: 'Insert a step' },
    });

    expect(Object.keys(useDocumentStore.getState().doc.entities).length).toBe(entitiesBefore);
  });
});
