import type { TemplateSpec } from './shared';

/**
 * Centralise vs Decentralise — org-design conflict that recurs at
 * every scaling stage.
 */
export const centraliseVsDecentraliseEC: TemplateSpec = {
  id: 'centralise-vs-decentralise-ec',
  title: 'Centralise vs Decentralise — Evaporating Cloud',
  diagramType: 'ec',
  description:
    'Should a function (data, platform, security, brand) be owned centrally — for consistency + economies of scale — or distributed to business units for speed + local fit?',
  entities: [
    {
      key: 'a',
      type: 'goal',
      title: 'The function serves the business well across all units',
      ecSlot: 'a',
    },
    {
      key: 'b',
      type: 'need',
      title: 'Consistency, standards, and economies of scale',
      ecSlot: 'b',
    },
    {
      key: 'c',
      type: 'need',
      title: 'Speed and local fit inside each business unit',
      ecSlot: 'c',
    },
    {
      key: 'd',
      type: 'want',
      title: 'Centralise the function in a single team',
      ecSlot: 'd',
    },
    {
      key: 'dPrime',
      type: 'want',
      title: 'Embed the function inside each business unit',
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
