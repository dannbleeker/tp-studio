import { beforeEach, describe, expect, it } from 'vitest';
import { EXAMPLE_BY_DIAGRAM } from '@/domain/examples';
import { patternsForDiagram } from '@/domain/patterns';
import { validate } from '@/domain/validators';
import { makeDoc, makeEdge, makeEntity, resetIds } from './helpers';

/**
 * Session 181 — NBR shape rules (`nbrBranchIntegrity.ts`). The canonical NBR
 * walks injection → forward chain → UDEs; these rules verify the two
 * structurally-checkable halves. Driven through `validate()` so the registry
 * wiring (nbr-only registration, existence tier) is covered too.
 */

beforeEach(() => {
  resetIds();
});

const rules = (warnings: ReturnType<typeof validate>, ruleId: string) =>
  warnings.filter((w) => w.ruleId === ruleId);

describe('nbr-no-negative-branch', () => {
  it('fires once tracing has started but no UDE exists', () => {
    const inj = makeEntity({ type: 'injection', title: 'Add a QA gate' });
    const eff = makeEntity({ type: 'effect', title: 'Releases slow down' });
    const warnings = validate(makeDoc([inj, eff], [makeEdge(inj.id, eff.id)], 'nbr'));
    const hits = rules(warnings, 'nbr-no-negative-branch');
    expect(hits).toHaveLength(1);
    // Anchored on the injection (no document-level warning target exists).
    expect(hits[0]!.target).toEqual({ kind: 'entity', id: inj.id });
    expect(hits[0]!.tier).toBe('existence');
  });

  it('stays silent while the injection has no outgoing edges (predicted-effect-existence owns that moment)', () => {
    const inj = makeEntity({ type: 'injection', title: 'Add a QA gate' });
    const warnings = validate(makeDoc([inj], [], 'nbr'));
    expect(rules(warnings, 'nbr-no-negative-branch')).toHaveLength(0);
    // The sibling rule covers the un-traced injection instead.
    expect(rules(warnings, 'predicted-effect-existence')).toHaveLength(1);
  });

  it('stays silent once a UDE exists', () => {
    const inj = makeEntity({ type: 'injection', title: 'Add a QA gate' });
    const eff = makeEntity({ type: 'effect', title: 'Cycle stretches' });
    const ude = makeEntity({ type: 'ude', title: 'Competitor ships first' });
    const warnings = validate(
      makeDoc([inj, eff, ude], [makeEdge(inj.id, eff.id), makeEdge(eff.id, ude.id)], 'nbr')
    );
    expect(rules(warnings, 'nbr-no-negative-branch')).toHaveLength(0);
  });

  it('stays silent when the doc has no injection at all', () => {
    const a = makeEntity({ type: 'effect', title: 'A' });
    const b = makeEntity({ type: 'effect', title: 'B' });
    const warnings = validate(makeDoc([a, b], [makeEdge(a.id, b.id)], 'nbr'));
    expect(rules(warnings, 'nbr-no-negative-branch')).toHaveLength(0);
  });

  it('does not fire on a non-NBR diagram (FRT with the same shape)', () => {
    const inj = makeEntity({ type: 'injection', title: 'Add a QA gate' });
    const eff = makeEntity({ type: 'effect', title: 'Releases slow down' });
    const warnings = validate(makeDoc([inj, eff], [makeEdge(inj.id, eff.id)], 'frt'));
    expect(rules(warnings, 'nbr-no-negative-branch')).toHaveLength(0);
  });
});

describe('nbr-ude-disconnected', () => {
  it('flags a wired-up UDE that does not trace back to any injection', () => {
    const inj = makeEntity({ type: 'injection', title: 'Add a QA gate' });
    const effA = makeEntity({ type: 'effect', title: 'On the injection chain' });
    const effB = makeEntity({ type: 'effect', title: 'Floating root' });
    const ude = makeEntity({ type: 'ude', title: 'Morale drops' });
    const warnings = validate(
      makeDoc(
        [inj, effA, effB, ude],
        // ude hangs off effB, which nothing connects to the injection.
        [makeEdge(inj.id, effA.id), makeEdge(effB.id, ude.id)],
        'nbr'
      )
    );
    const hits = rules(warnings, 'nbr-ude-disconnected');
    expect(hits).toHaveLength(1);
    expect(hits[0]!.target).toEqual({ kind: 'entity', id: ude.id });
    expect(hits[0]!.tier).toBe('existence');
  });

  it('stays silent when the UDE is forward-reachable from an injection', () => {
    const inj = makeEntity({ type: 'injection', title: 'Add a QA gate' });
    const eff = makeEntity({ type: 'effect', title: 'Cycle stretches' });
    const ude = makeEntity({ type: 'ude', title: 'Competitor ships first' });
    const warnings = validate(
      makeDoc([inj, eff, ude], [makeEdge(inj.id, eff.id), makeEdge(eff.id, ude.id)], 'nbr')
    );
    expect(rules(warnings, 'nbr-ude-disconnected')).toHaveLength(0);
  });

  it('skips a UDE with no incoming edges (additional-cause owns that gap)', () => {
    const inj = makeEntity({ type: 'injection', title: 'Add a QA gate' });
    const eff = makeEntity({ type: 'effect', title: 'Cycle stretches' });
    const ude = makeEntity({ type: 'ude', title: 'Unwired UDE' });
    const warnings = validate(makeDoc([inj, eff, ude], [makeEdge(inj.id, eff.id)], 'nbr'));
    expect(rules(warnings, 'nbr-ude-disconnected')).toHaveLength(0);
    // The causeless UDE is still surfaced — by the widened additional-cause.
    expect(
      rules(warnings, 'additional-cause').some(
        (w) => w.target.kind === 'entity' && w.target.id === ude.id
      )
    ).toBe(true);
  });

  it('stays silent when the doc has no injection (checklist step 1 owns that moment)', () => {
    const eff = makeEntity({ type: 'effect', title: 'Some root' });
    const ude = makeEntity({ type: 'ude', title: 'Morale drops' });
    const warnings = validate(makeDoc([eff, ude], [makeEdge(eff.id, ude.id)], 'nbr'));
    expect(rules(warnings, 'nbr-ude-disconnected')).toHaveLength(0);
  });

  it('one warning per disconnected UDE, none for the connected one', () => {
    const inj = makeEntity({ type: 'injection', title: 'Add a QA gate' });
    const eff = makeEntity({ type: 'effect', title: 'On-chain effect' });
    const goodUde = makeEntity({ type: 'ude', title: 'On the branch' });
    const floatA = makeEntity({ type: 'effect', title: 'Float A' });
    const badUde1 = makeEntity({ type: 'ude', title: 'Off-branch 1' });
    const badUde2 = makeEntity({ type: 'ude', title: 'Off-branch 2' });
    const warnings = validate(
      makeDoc(
        [inj, eff, goodUde, floatA, badUde1, badUde2],
        [
          makeEdge(inj.id, eff.id),
          makeEdge(eff.id, goodUde.id),
          makeEdge(floatA.id, badUde1.id),
          makeEdge(floatA.id, badUde2.id),
        ],
        'nbr'
      )
    );
    const hits = rules(warnings, 'nbr-ude-disconnected');
    expect(hits.map((w) => (w.target.kind === 'entity' ? w.target.id : '')).sort()).toEqual(
      [badUde1.id, badUde2.id].sort()
    );
  });

  it('shipped NBR content (example + patterns) is clean of both shape warnings', () => {
    const docs = [EXAMPLE_BY_DIAGRAM.nbr(), ...patternsForDiagram('nbr').map((p) => p.build())];
    expect(docs.length).toBeGreaterThan(1); // example + at least one pattern
    for (const doc of docs) {
      const hits = validate(doc).filter(
        (w) => w.ruleId === 'nbr-no-negative-branch' || w.ruleId === 'nbr-ude-disconnected'
      );
      expect(hits, `"${doc.title}" trips an NBR shape rule`).toHaveLength(0);
    }
  });

  it('does not fire on a non-NBR diagram (same disconnected shape on FRT)', () => {
    const inj = makeEntity({ type: 'injection', title: 'Add a QA gate' });
    const effA = makeEntity({ type: 'effect', title: 'On-chain' });
    const effB = makeEntity({ type: 'effect', title: 'Floating root' });
    const ude = makeEntity({ type: 'ude', title: 'Off-chain UDE' });
    const warnings = validate(
      makeDoc([inj, effA, effB, ude], [makeEdge(inj.id, effA.id), makeEdge(effB.id, ude.id)], 'frt')
    );
    expect(rules(warnings, 'nbr-ude-disconnected')).toHaveLength(0);
  });

  it('survives a cycle on the injection chain (BFS is cycle-safe)', () => {
    const inj = makeEntity({ type: 'injection', title: 'Add a QA gate' });
    const a = makeEntity({ type: 'effect', title: 'A' });
    const b = makeEntity({ type: 'effect', title: 'B' });
    const ude = makeEntity({ type: 'ude', title: 'Reachable through the loop' });
    const warnings = validate(
      makeDoc(
        [inj, a, b, ude],
        [
          makeEdge(inj.id, a.id),
          makeEdge(a.id, b.id),
          makeEdge(b.id, a.id), // a ↔ b cycle
          makeEdge(b.id, ude.id),
        ],
        'nbr'
      )
    );
    expect(rules(warnings, 'nbr-ude-disconnected')).toHaveLength(0);
  });
});

describe('custom entity classes (supersetOf) participate in both rules', () => {
  const CLASSES = {
    'site-risk': { id: 'site-risk', label: 'Site Risk', supersetOf: 'ude' as const },
    'counter-move': { id: 'counter-move', label: 'Counter Move', supersetOf: 'injection' as const },
  };

  it('a custom-class UDE suppresses nbr-no-negative-branch (the branch exists)', () => {
    const inj = makeEntity({ type: 'injection', title: 'Add a QA gate' });
    const risk = makeEntity({ type: 'site-risk' as never, title: 'Custom UDE' });
    const doc = {
      ...makeDoc([inj, risk], [makeEdge(inj.id, risk.id)], 'nbr'),
      customEntityClasses: CLASSES,
    };
    expect(rules(validate(doc), 'nbr-no-negative-branch')).toHaveLength(0);
  });

  it('a disconnected custom-class UDE is flagged by nbr-ude-disconnected', () => {
    const inj = makeEntity({ type: 'injection', title: 'Add a QA gate' });
    const effA = makeEntity({ type: 'effect', title: 'On-chain' });
    const effB = makeEntity({ type: 'effect', title: 'Floating root' });
    const risk = makeEntity({ type: 'site-risk' as never, title: 'Custom off-chain UDE' });
    const doc = {
      ...makeDoc(
        [inj, effA, effB, risk],
        [makeEdge(inj.id, effA.id), makeEdge(effB.id, risk.id)],
        'nbr'
      ),
      customEntityClasses: CLASSES,
    };
    const hits = rules(validate(doc), 'nbr-ude-disconnected');
    expect(hits).toHaveLength(1);
    expect(hits[0]!.target).toEqual({ kind: 'entity', id: risk.id });
  });

  it('a custom-class injection seeds reachability and the tracing guard', () => {
    const counter = makeEntity({ type: 'counter-move' as never, title: 'Custom injection' });
    const eff = makeEntity({ type: 'effect', title: 'Traced effect' });
    const ude = makeEntity({ type: 'ude', title: 'Reached UDE' });
    const doc = {
      ...makeDoc(
        [counter, eff, ude],
        [makeEdge(counter.id, eff.id), makeEdge(eff.id, ude.id)],
        'nbr'
      ),
      customEntityClasses: CLASSES,
    };
    const warnings = validate(doc);
    // Reachable from the custom injection → no disconnected warning; a UDE
    // exists → no no-negative-branch warning.
    expect(rules(warnings, 'nbr-ude-disconnected')).toHaveLength(0);
    expect(rules(warnings, 'nbr-no-negative-branch')).toHaveLength(0);
  });
});
