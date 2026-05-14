import type { TemplateSpec } from './shared';

/**
 * Maker vs Manager schedule — Paul Graham's framing, captured as an
 * EC so the user can surface the assumptions on each arrow.
 */
export const makerVsManagerEC: TemplateSpec = {
  id: 'maker-vs-manager-ec',
  title: 'Maker vs Manager schedule — Evaporating Cloud',
  diagramType: 'ec',
  description:
    'The classic mismatch between work that requires long uninterrupted focus blocks and work that requires coordination + frequent meetings.',
  entities: [
    {
      key: 'a',
      type: 'goal',
      title: 'Both individual deep work and team alignment happen well',
      ecSlot: 'a',
    },
    {
      key: 'b',
      type: 'need',
      title: 'Protected blocks of uninterrupted focus time',
      ecSlot: 'b',
    },
    {
      key: 'c',
      type: 'need',
      title: 'Tight coordination across the team',
      ecSlot: 'c',
    },
    {
      key: 'd',
      type: 'want',
      title: 'Refuse meetings inside the day (focus mornings + afternoons)',
      ecSlot: 'd',
    },
    {
      key: 'dPrime',
      type: 'want',
      title: 'Schedule check-ins and reviews throughout the day',
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
