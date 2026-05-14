import type { TemplateSpec } from './shared';

/**
 * Build vs Buy — the recurring strategy conflict whenever a new
 * capability is needed.
 */
export const buildVsBuyEC: TemplateSpec = {
  id: 'build-vs-buy-ec',
  title: 'Build vs Buy — Evaporating Cloud',
  diagramType: 'ec',
  description:
    'When a new capability is needed: do we build it in-house (control + fit, but cost + time) or buy a vendor solution (faster + cheaper, but dependency + worse fit)?',
  entities: [
    {
      key: 'a',
      type: 'goal',
      title: 'Get the capability into production within the year, sustainably',
      ecSlot: 'a',
    },
    {
      key: 'b',
      type: 'need',
      title: 'Maintain long-term control of a strategic capability',
      ecSlot: 'b',
    },
    {
      key: 'c',
      type: 'need',
      title: 'Deliver value to customers as fast as possible',
      ecSlot: 'c',
    },
    {
      key: 'd',
      type: 'want',
      title: 'Build the capability in-house',
      ecSlot: 'd',
    },
    {
      key: 'dPrime',
      type: 'want',
      title: 'Buy a vendor solution',
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
