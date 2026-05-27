import { buildEdge, buildEntity } from '../examples/shared';
import { newDocumentId } from '../ids';
import type { Edge, TPDocument } from '../types';

/**
 * Pattern: Incident response (Transition Tree).
 *
 * An operations TT walking from "alert fires" through the
 * structured response that gets a production service back to
 * healthy and produces a useful post-mortem. The chain models
 * the textbook on-call playbook — acknowledge, triage,
 * communicate, mitigate, verify, post-mortem — and surfaces the
 * canonical complaint that informal incident response misses:
 * communication and post-mortem aren't optional steps, they're
 * structural preconditions for the next time.
 *
 * Each step's outcome becomes the next step's precondition. The
 * verify step needs both a mitigation action AND fresh signal from
 * the alerting system to declare "healthy" — captured via the AND
 * junctor.
 */
export const buildPatternTTIncidentResponse = (): TPDocument => {
  const t = Date.now();

  const p1 = buildEntity('effect', 'High-severity alert fires from the production service', t, 1);

  const a1 = buildEntity(
    'action',
    'On-call engineer acknowledges the alert within five minutes',
    t,
    2,
    {
      ordering: 1,
    }
  );
  const a2 = buildEntity('action', 'On-call narrows the failure to a single subsystem', t, 3, {
    ordering: 2,
  });
  const a3 = buildEntity(
    'action',
    'On-call posts the impact and ETA to the incident channel every fifteen minutes',
    t,
    4,
    { ordering: 3 }
  );
  const a4 = buildEntity(
    'action',
    'On-call rolls back or feature-flags the offending change',
    t,
    5,
    { ordering: 4 }
  );
  const a5 = buildEntity('action', 'On-call writes a post-mortem within 48 hours', t, 6, {
    ordering: 5,
  });

  const o1 = buildEntity('effect', 'Alert acknowledged; PagerDuty escalation stops', t, 7);
  const o2 = buildEntity('effect', 'Failing subsystem is identified and named in chat', t, 8);
  const o3 = buildEntity(
    'effect',
    'Customer-facing stakeholders are kept informed at a steady cadence',
    t,
    9
  );
  const o4 = buildEntity('effect', 'Service-level error rate returns below alert threshold', t, 10);

  const de = buildEntity(
    'desiredEffect',
    'Service is healthy and a post-mortem is publishable',
    t,
    11
  );

  const g = (suffix: string): string => `and_pattern_tt_incident_${suffix}`;

  const entities = [p1, a1, a2, a3, a4, a5, o1, o2, o3, o4, de];
  const edges: Edge[] = [
    buildEdge(p1.id, o1.id, { andGroupId: g('s1') }),
    buildEdge(a1.id, o1.id, { andGroupId: g('s1') }),
    buildEdge(o1.id, o2.id, { andGroupId: g('s2') }),
    buildEdge(a2.id, o2.id, { andGroupId: g('s2') }),
    // Communication runs in parallel with mitigation — its precondition
    // is the identified subsystem, not the mitigation itself.
    buildEdge(o2.id, o3.id, { andGroupId: g('s3') }),
    buildEdge(a3.id, o3.id, { andGroupId: g('s3') }),
    // Mitigation step: identified subsystem + rollback action → service healthy.
    buildEdge(o2.id, o4.id, { andGroupId: g('s4') }),
    buildEdge(a4.id, o4.id, { andGroupId: g('s4') }),
    // Final step: healthy service + ongoing communication + post-mortem
    // action → publishable post-mortem.
    buildEdge(o4.id, de.id, { andGroupId: g('s5') }),
    buildEdge(o3.id, de.id, { andGroupId: g('s5') }),
    buildEdge(a5.id, de.id, { andGroupId: g('s5') }),
  ];

  return {
    id: newDocumentId(),
    diagramType: 'tt',
    title: 'Incident response TT',
    entities: Object.fromEntries(entities.map((e) => [e.id, e])),
    edges: Object.fromEntries(edges.map((e) => [e.id, e])),
    groups: {},
    resolvedWarnings: {},
    nextAnnotationNumber: 12,
    createdAt: t,
    updatedAt: t,
    schemaVersion: 8,
  };
};
