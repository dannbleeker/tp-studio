import { nanoid } from 'nanoid';
import { buildEdge, buildEntity } from '../examples/shared';
import { newDocumentId } from '../ids';
import type { Edge, TPDocument } from '../types';

/**
 * Pattern: Why a promising change doesn't stick (Current Reality Tree).
 *
 * The "uptake problem" diagnosis from the *TOC Handbook* (Ch. 5, "Making Change
 * Stick", Newbold), abstracted from its worked case: with no urgency (the
 * system doesn't look broken), adoption stays half-hearted, resources stay
 * scarce, and no one takes ownership — so momentum never builds and the old
 * ways reassert themselves, leaving the organisation convinced the approach
 * "doesn't work here." A recognisable onboarding meta-example about TP Studio's
 * own reason for being: it doubles as a demonstration of an AND junctor (three
 * causes jointly kill momentum) and a skepticism sub-branch. Node text is
 * original; no company names.
 */
export const buildPatternCRTWhyChangeStalls = (): TPDocument => {
  const t = Date.now();

  const rcNoUrgency = buildEntity(
    'rootCause',
    "People feel no urgency to change — the current system doesn't look broken",
    t,
    1
  );
  const effHalf = buildEntity(
    'effect',
    'Attempts to adopt the new approach stay half-hearted',
    t,
    2
  );
  const effScarce = buildEntity('effect', 'Time and resources for the change stay scarce', t, 3);
  const effNoOwnership = buildEntity(
    'effect',
    'Key people never take ownership of the change',
    t,
    4
  );
  const effMomentum = buildEntity('effect', 'Momentum toward the change never builds', t, 5);
  const udeOldWays = buildEntity(
    'ude',
    'Sooner or later the old ways reassert themselves and the early gains are lost',
    t,
    6
  );
  const udeCynicism = buildEntity(
    'ude',
    'The organisation concludes the approach "doesn\'t work here", making the next change even harder',
    t,
    7
  );
  const effSkeptical = buildEntity(
    'effect',
    'Past initiatives that fizzled leave people skeptical of the next one',
    t,
    8
  );
  const effFence = buildEntity(
    'effect',
    'People hedge — they sit on the fence and wait to see',
    t,
    9
  );

  const entities = [
    rcNoUrgency,
    effHalf,
    effScarce,
    effNoOwnership,
    effMomentum,
    udeOldWays,
    udeCynicism,
    effSkeptical,
    effFence,
  ];

  const andMomentum = nanoid(8);
  const edges: Edge[] = [
    // No urgency drives all three momentum-killers.
    buildEdge(rcNoUrgency.id, effHalf.id),
    buildEdge(rcNoUrgency.id, effScarce.id),
    buildEdge(rcNoUrgency.id, effNoOwnership.id),
    // Half-hearted AND scarce AND no-ownership jointly kill momentum.
    buildEdge(effHalf.id, effMomentum.id, { andGroupId: andMomentum }),
    buildEdge(effScarce.id, effMomentum.id, { andGroupId: andMomentum }),
    buildEdge(effNoOwnership.id, effMomentum.id, { andGroupId: andMomentum }),
    // No momentum → the old ways return → cynicism about the next attempt.
    buildEdge(effMomentum.id, udeOldWays.id),
    buildEdge(udeOldWays.id, udeCynicism.id),
    // The skepticism sub-branch feeds back into half-hearted adoption.
    buildEdge(effSkeptical.id, effFence.id),
    buildEdge(effFence.id, effHalf.id),
  ];

  return {
    id: newDocumentId(),
    diagramType: 'crt',
    title: "Why a promising change doesn't stick",
    entities: Object.fromEntries(entities.map((e) => [e.id, e])),
    edges: Object.fromEntries(edges.map((e) => [e.id, e])),
    groups: {},
    resolvedWarnings: {},
    nextAnnotationNumber: 10,
    createdAt: t,
    updatedAt: t,
    schemaVersion: 10,
  };
};
