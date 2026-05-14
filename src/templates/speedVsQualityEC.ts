import type { TemplateSpec } from './shared';

/**
 * Speed vs Quality in software delivery. One of the most common
 * structural conflicts in engineering orgs.
 */
export const speedVsQualityEC: TemplateSpec = {
  id: 'speed-vs-quality-ec',
  title: 'Speed vs Quality in delivery — Evaporating Cloud',
  diagramType: 'ec',
  description:
    'The constant tension between shipping features fast and keeping the codebase + product reliable. The shared goal is a successful product; the conflict is between throughput and durability.',
  entities: [
    {
      key: 'a',
      type: 'goal',
      title: 'Ship a successful, durable product',
      ecSlot: 'a',
    },
    {
      key: 'b',
      type: 'need',
      title: 'Hit roadmap commitments customers are waiting on',
      ecSlot: 'b',
    },
    {
      key: 'c',
      type: 'need',
      title: 'Keep production reliable and the code maintainable',
      ecSlot: 'c',
    },
    {
      key: 'd',
      type: 'want',
      title: 'Cut review time + ship features as soon as they pass tests',
      ecSlot: 'd',
    },
    {
      key: 'dPrime',
      type: 'want',
      title: 'Insist on extensive review + hardening before every release',
      ecSlot: 'dPrime',
    },
  ],
  edges: [
    { source: 'b', target: 'a' },
    { source: 'c', target: 'a' },
    { source: 'd', target: 'b' },
    { source: 'dPrime', target: 'c' },
    { source: 'd', target: 'dPrime', isMutualExclusion: true },
  ],
};
