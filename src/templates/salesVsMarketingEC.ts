import type { TemplateSpec } from './shared';

/**
 * Sales vs Marketing budget allocation — a classic mid-stage SaaS
 * conflict the brief calls out. Both sides want the budget; the
 * shared goal is profitable growth.
 */
export const salesVsMarketingEC: TemplateSpec = {
  id: 'sales-vs-marketing-budget-ec',
  title: 'Sales vs Marketing budget — Evaporating Cloud',
  diagramType: 'ec',
  description:
    'The recurring fight over who gets the next dollar. Sales wants more headcount to close pipeline now; Marketing wants more spend to fill the top of the funnel for next quarter.',
  entities: [
    {
      key: 'a',
      type: 'goal',
      title: 'Hit our growth target this year',
      ecSlot: 'a',
    },
    {
      key: 'b',
      type: 'need',
      title: 'Close enough pipeline this quarter',
      ecSlot: 'b',
    },
    {
      key: 'c',
      type: 'need',
      title: 'Build enough pipeline for next quarter',
      ecSlot: 'c',
    },
    {
      key: 'd',
      type: 'want',
      title: 'Hire two more AEs and a sales engineer',
      ecSlot: 'd',
    },
    {
      key: 'dPrime',
      type: 'want',
      title: 'Double demand-gen spend across paid channels',
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
