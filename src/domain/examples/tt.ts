import { newDocumentId } from '../ids';
import type { Edge, TPDocument } from '../types';
import { buildEdge, buildEntity } from './shared';

/**
 * Example Transition Tree.
 *
 * Each "step" in a TT is the book's structural triple — `Outcome ← Precondition
 * + Action`, joined at the Outcome via an AND junctor. The Action is the
 * do-something; the Precondition is the existing condition or reality that
 * (together with the Action) sufficient-cause-produces the Outcome.
 *
 * This example deliberately shows the proper triple structure rather than a
 * flat action-chain — the flat form was previously the example but it
 * trips the TT-specific Complete-Step rule (every Action without a paired
 * Precondition is structurally incomplete). The richer form here both
 * reads correctly to a TOC practitioner and demonstrates what the rule is
 * checking for.
 *
 * Layout note: TT uses dagre auto-layout, so we don't pre-position the
 * entities; dagre lays the (precondition, action) pair feeding each
 * outcome onto sensible levels automatically.
 *
 * One step's precondition is intentionally left as an Unspecified
 * placeholder (`?` glyph, empty title) so the example also surfaces the
 * `Entity.unspecified` flag in its natural habitat: "we know there's an
 * enabling condition here, we just haven't named it yet."
 */
export const buildExampleTT = (): TPDocument => {
  const t = Date.now();

  // Preconditions (the existing reality each step builds on).
  const p1 = buildEntity('effect', "Today's intake categorization is opaque to leadership", t, 1);
  // Each outcome of one step becomes the precondition of the next, so we
  // declare them once and reuse — o1, o2, o3 play double duty as outcomes
  // and as the next step's precondition.

  // Actions (the do-something steps).
  const a1 = buildEntity('action', 'Audit current customer-support intake', t, 2, { ordering: 1 });
  const a2 = buildEntity('action', 'Draft a triage rubric with the support lead', t, 3, {
    ordering: 2,
  });
  const a3 = buildEntity('action', 'Pilot the rubric with two agents for a week', t, 4, {
    ordering: 3,
  });
  const a4 = buildEntity('action', 'Roll the rubric out to the whole team', t, 5, {
    ordering: 4,
  });
  const a5 = buildEntity('action', 'Add a weekly metrics review with the support lead', t, 6, {
    ordering: 5,
  });

  // Outcomes (each is the new state produced by the preceding step's AND).
  const o1 = buildEntity('effect', 'We know which support categories cluster', t, 7);
  const o2 = buildEntity('effect', 'We have a written triage rubric', t, 8);
  const o3 = buildEntity('effect', 'We have one week of real-world rubric data', t, 9);
  const o4 = buildEntity('effect', 'The whole team is using the rubric', t, 10);

  // Step 5's precondition stays *unspecified* — the user knows a
  // condition is required ("there's bandwidth somewhere on the team to
  // run this review") but doesn't want to commit to its exact shape
  // until the rollout lands. The Complete-Step rule treats this as
  // filling the precondition slot, so no warning fires.
  const p5 = buildEntity('effect', '', t, 11, { unspecified: true });

  // Final desired effect.
  const de = buildEntity('desiredEffect', 'Customer wait time drops below 4 hours', t, 12);

  // Each step's two incoming edges share an `andGroupId` so they render
  // as an explicit junctor — the visual cue the book uses for the
  // Outcome ← (Action + Precondition) structure. The id format mirrors
  // groupAsAnd's runtime convention (`and_<nanoid>`).
  const g = (suffix: string): string => `and_example_tt_${suffix}`;

  const entities = [p1, a1, a2, a3, a4, a5, o1, o2, o3, o4, p5, de];
  const edges: Edge[] = [
    // Step 1: p1 + a1 → o1
    buildEdge(p1.id, o1.id, { andGroupId: g('s1') }),
    buildEdge(a1.id, o1.id, { andGroupId: g('s1') }),
    // Step 2: o1 + a2 → o2 (the previous outcome becomes the precondition)
    buildEdge(o1.id, o2.id, { andGroupId: g('s2') }),
    buildEdge(a2.id, o2.id, { andGroupId: g('s2') }),
    // Step 3: o2 + a3 → o3
    buildEdge(o2.id, o3.id, { andGroupId: g('s3') }),
    buildEdge(a3.id, o3.id, { andGroupId: g('s3') }),
    // Step 4: o3 + a4 → o4
    buildEdge(o3.id, o4.id, { andGroupId: g('s4') }),
    buildEdge(a4.id, o4.id, { andGroupId: g('s4') }),
    // Step 5: p5 (unspecified) + a5 → desiredEffect
    buildEdge(p5.id, de.id, { andGroupId: g('s5') }),
    buildEdge(a5.id, de.id, { andGroupId: g('s5') }),
    // Bridge: o4 also feeds the final desired effect — without the team
    // using the rubric, the metrics review can't measure the right thing.
    // Joined into step 5's AND so all three combine into the final outcome.
    buildEdge(o4.id, de.id, { andGroupId: g('s5') }),
  ];

  return {
    id: newDocumentId(),
    diagramType: 'tt',
    title: 'Support-triage Transition Tree',
    entities: Object.fromEntries(entities.map((e) => [e.id, e])),
    edges: Object.fromEntries(edges.map((e) => [e.id, e])),
    groups: {},
    resolvedWarnings: {},
    nextAnnotationNumber: 13,
    createdAt: t,
    updatedAt: t,
    schemaVersion: 8,
  };
};
