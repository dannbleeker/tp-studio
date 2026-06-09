import { buildEdge, buildEntity } from '../examples/shared';
import { newDocumentId } from '../ids';
import type { Edge, TPDocument } from '../types';

/**
 * Pattern: Drum-buffer-rope scheduling adoption (Future Reality Tree).
 *
 * A manufacturing FRT in the spirit of Goldratt's production-systems
 * applications: subordinate every workstation's schedule to the
 * constraint resource, install a time buffer ahead of it, and rope
 * the release of new work to the rate the constraint can absorb.
 * The cascade of desirable effects is the classic TOC textbook list:
 * fewer expedites, faster turn-around, a lower (not higher!) total
 * inventory, and a measurable lift in throughput.
 *
 * The chain runs longer than the WIP-cap FRT because DBR touches
 * three distinct sub-systems (release, buffer, sequence), so its
 * downstream effects fan more widely.
 */
export const buildPatternFRTDbrScheduling = (): TPDocument => {
  const t = Date.now();

  const injection = buildEntity(
    'injection',
    'Subordinate the plant schedule to the heat-treat constraint with a 24-hour buffer',
    t,
    1
  );

  const effRopeRelease = buildEntity(
    'effect',
    'Material release pulses match the constraint cadence',
    t,
    2
  );
  const effBuffer = buildEntity(
    'effect',
    'A visible time buffer protects the constraint from upstream variation',
    t,
    3
  );
  const effFewerExpedites = buildEntity(
    'effect',
    'Floor-supervisor expedites drop from daily to occasional',
    t,
    4
  );
  const effLowerWip = buildEntity(
    'effect',
    'Average WIP between cells falls ~30% without throughput loss',
    t,
    5
  );
  const effShorterTurn = buildEntity(
    'effect',
    'Order-to-ship turn-around shortens by half a week',
    t,
    6
  );

  const de = buildEntity(
    'desiredEffect',
    'Plant throughput climbs 15% on the same headcount and capital',
    t,
    7
  );

  const entities = [
    injection,
    effRopeRelease,
    effBuffer,
    effFewerExpedites,
    effLowerWip,
    effShorterTurn,
    de,
  ];
  const edges: Edge[] = [
    // The injection installs the rope (release rule) and the buffer
    // (sequence + safety).
    buildEdge(injection.id, effRopeRelease.id),
    buildEdge(injection.id, effBuffer.id),
    // The two together drain WIP between cells.
    buildEdge(effRopeRelease.id, effLowerWip.id),
    buildEdge(effBuffer.id, effLowerWip.id),
    // The buffer also smooths variation, reducing the need for
    // expediting.
    buildEdge(effBuffer.id, effFewerExpedites.id),
    // Lower WIP + fewer expedites together shorten the turn.
    buildEdge(effLowerWip.id, effShorterTurn.id),
    buildEdge(effFewerExpedites.id, effShorterTurn.id),
    // Shorter turn + the constraint running at its real cadence
    // produce the throughput lift.
    buildEdge(effShorterTurn.id, de.id),
  ];

  return {
    id: newDocumentId(),
    diagramType: 'frt',
    title: 'Drum-buffer-rope scheduling FRT',
    entities: Object.fromEntries(entities.map((e) => [e.id, e])),
    edges: Object.fromEntries(edges.map((e) => [e.id, e])),
    groups: {},
    resolvedWarnings: {},
    nextAnnotationNumber: 8,
    createdAt: t,
    updatedAt: t,
    schemaVersion: 10,
  };
};
