import { buildEdge, buildEntity } from '../examples/shared';
import { newDocumentId } from '../ids';
import type { Edge, TPDocument } from '../types';

/**
 * Pattern: Single-team-OKR adoption (Future Reality Tree).
 *
 * A focus-first FRT showing the downstream effects of cutting from
 * a portfolio of seven team objectives to two — the canonical
 * "limit work in progress at the goal layer" injection that Dettmer
 * uses as an example of a high-leverage policy change. The chain
 * ends at a desired effect that's hard for management to dismiss
 * ("the team ships the two outcomes the company actually needed
 * this quarter") and includes the deliberate side-effect of fewer
 * mid-cycle pivots, since one of the loudest objections to focus
 * is "but we have to respond to opportunities."
 */
export const buildPatternFRTTeamOkrs = (): TPDocument => {
  const t = Date.now();

  const injection = buildEntity(
    'injection',
    'Cut to two team objectives per quarter, dropping the other five',
    t,
    1
  );

  const effClarity = buildEntity(
    'effect',
    'Every engineer can name the two objectives unprompted',
    t,
    2
  );
  const effFewerPivots = buildEntity(
    'effect',
    'Mid-quarter "urgent" requests drop because the team has a defensible no',
    t,
    3
  );
  const effDeepWork = buildEntity(
    'effect',
    'Average uninterrupted-time blocks lengthen from 30 to 90 minutes',
    t,
    4
  );
  const effProgressReview = buildEntity(
    'effect',
    'Weekly review converges on two stories instead of jumping between seven',
    t,
    5
  );

  const de = buildEntity(
    'desiredEffect',
    'The team ships the two outcomes the company actually needed this quarter',
    t,
    6
  );

  const entities = [injection, effClarity, effFewerPivots, effDeepWork, effProgressReview, de];
  const edges: Edge[] = [
    // The injection drives clarity, the defensible-no behaviour, and
    // the shorter review meeting in parallel.
    buildEdge(injection.id, effClarity.id),
    buildEdge(injection.id, effFewerPivots.id),
    buildEdge(injection.id, effProgressReview.id),
    // Clarity + fewer pivots together produce the deep-work pattern —
    // each one alone wouldn't (a clear goal still gets interrupted; a
    // quiet calendar without a goal doesn't move work forward).
    buildEdge(effClarity.id, effDeepWork.id),
    buildEdge(effFewerPivots.id, effDeepWork.id),
    // Deep work + the focused review together produce the shipped
    // outcomes.
    buildEdge(effDeepWork.id, de.id),
    buildEdge(effProgressReview.id, de.id),
  ];

  return {
    id: newDocumentId(),
    diagramType: 'frt',
    title: 'Single-team-OKR adoption FRT',
    entities: Object.fromEntries(entities.map((e) => [e.id, e])),
    edges: Object.fromEntries(edges.map((e) => [e.id, e])),
    groups: {},
    resolvedWarnings: {},
    nextAnnotationNumber: 7,
    createdAt: t,
    updatedAt: t,
    schemaVersion: 8,
  };
};
