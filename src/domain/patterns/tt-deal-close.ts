import { buildEdge, buildEntity } from '../examples/shared';
import { newDocumentId } from '../ids';
import type { Edge, TPDocument } from '../types';

/**
 * Pattern: Closing an enterprise deal (Transition Tree).
 *
 * A sales-process TT walking from "qualified opportunity" to
 * "signed contract." Each step's outcome is a stakeholder state
 * (champion identified, security review passed, procurement engaged,
 * legal redlines resolved) — not the rep's task list — because TT
 * chains describe outcomes, not activity.
 *
 * The pattern is useful as a teaching template because every step
 * names a precondition the rep cannot create directly. The reality
 * of enterprise sales is that the deal moves when a buyer-side
 * stakeholder agrees to do something, not when the rep sends one
 * more email. The TT structure surfaces that dependency explicitly.
 */
export const buildPatternTTDealClose = (): TPDocument => {
  const t = Date.now();

  const p1 = buildEntity('effect', 'Inbound lead qualifies on budget, authority, and timing', t, 1);

  const a1 = buildEntity(
    'action',
    'Run a needs-discovery call with the product owner and the technical lead',
    t,
    2,
    { ordering: 1 }
  );
  const a2 = buildEntity(
    'action',
    "Deliver a scoped demo using two of the buyer's production data samples",
    t,
    3,
    { ordering: 2 }
  );
  const a3 = buildEntity(
    'action',
    "Walk the buyer's InfoSec team through the SOC 2 attestation",
    t,
    4,
    { ordering: 3 }
  );
  const a4 = buildEntity('action', "Submit pricing through procurement's vendor portal", t, 5, {
    ordering: 4,
  });
  const a5 = buildEntity(
    'action',
    'Counter-redline the master service agreement within five business days',
    t,
    6,
    {
      ordering: 5,
    }
  );

  const o1 = buildEntity(
    'effect',
    'A named buyer-side champion can articulate the business case',
    t,
    7
  );
  const o2 = buildEntity(
    'effect',
    'Champion has shared the demo with their CFO and is sponsoring the buy',
    t,
    8
  );
  const o3 = buildEntity('effect', 'InfoSec signs off; security is no longer the bottleneck', t, 9);
  const o4 = buildEntity(
    'effect',
    'Procurement has the pricing in its system and a PO is queued',
    t,
    10
  );

  const de = buildEntity('desiredEffect', 'Signed contract with first invoice issued', t, 11);

  const g = (suffix: string): string => `and_pattern_tt_deal_${suffix}`;

  const entities = [p1, a1, a2, a3, a4, a5, o1, o2, o3, o4, de];
  const edges: Edge[] = [
    buildEdge(p1.id, o1.id, { andGroupId: g('s1') }),
    buildEdge(a1.id, o1.id, { andGroupId: g('s1') }),
    buildEdge(o1.id, o2.id, { andGroupId: g('s2') }),
    buildEdge(a2.id, o2.id, { andGroupId: g('s2') }),
    buildEdge(o2.id, o3.id, { andGroupId: g('s3') }),
    buildEdge(a3.id, o3.id, { andGroupId: g('s3') }),
    buildEdge(o3.id, o4.id, { andGroupId: g('s4') }),
    buildEdge(a4.id, o4.id, { andGroupId: g('s4') }),
    buildEdge(o4.id, de.id, { andGroupId: g('s5') }),
    buildEdge(a5.id, de.id, { andGroupId: g('s5') }),
  ];

  return {
    id: newDocumentId(),
    diagramType: 'tt',
    title: 'Enterprise deal close TT',
    entities: Object.fromEntries(entities.map((e) => [e.id, e])),
    edges: Object.fromEntries(edges.map((e) => [e.id, e])),
    groups: {},
    resolvedWarnings: {},
    nextAnnotationNumber: 12,
    createdAt: t,
    updatedAt: t,
    schemaVersion: 9,
  };
};
