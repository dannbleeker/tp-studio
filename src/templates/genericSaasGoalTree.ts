import type { TemplateSpec } from './shared';

/**
 * Generic SaaS company Goal Tree. Anchored on a recurring-revenue
 * growth objective with three CSFs covering acquisition, expansion,
 * and retention — the trio most SaaS practitioners recognise.
 */
export const genericSaasGoalTree: TemplateSpec = {
  id: 'generic-saas-goal-tree',
  title: 'Generic SaaS company — Goal Tree',
  diagramType: 'goalTree',
  description:
    'A starter Goal Tree for a B2B SaaS business: durable recurring revenue growth, anchored on acquisition + expansion + retention CSFs with operational NCs under each.',
  entities: [
    { key: 'goal', type: 'goal', title: 'Grow ARR sustainably year over year' },
    {
      key: 'csf-acq',
      type: 'criticalSuccessFactor',
      title: 'Steady stream of qualified new customers',
    },
    {
      key: 'csf-exp',
      type: 'criticalSuccessFactor',
      title: 'Existing customers expand spend over time',
    },
    {
      key: 'csf-ret',
      type: 'criticalSuccessFactor',
      title: 'Annual gross retention ≥ 90%',
    },
    { key: 'nc-icp', type: 'necessaryCondition', title: 'ICP clearly articulated and shared' },
    {
      key: 'nc-funnel',
      type: 'necessaryCondition',
      title: 'Marketing → sales funnel converts at industry benchmark',
    },
    {
      key: 'nc-onboarding',
      type: 'necessaryCondition',
      title: 'First-30-day onboarding produces a measurable success event',
    },
    {
      key: 'nc-expansion-paths',
      type: 'necessaryCondition',
      title: 'Each customer has at least two paths to expand usage',
    },
    {
      key: 'nc-csm',
      type: 'necessaryCondition',
      title: 'CSM playbook covers proactive risk signals',
    },
  ],
  edges: [
    { source: 'csf-acq', target: 'goal' },
    { source: 'csf-exp', target: 'goal' },
    { source: 'csf-ret', target: 'goal' },
    { source: 'nc-icp', target: 'csf-acq' },
    { source: 'nc-funnel', target: 'csf-acq' },
    { source: 'nc-onboarding', target: 'csf-ret' },
    { source: 'nc-expansion-paths', target: 'csf-exp' },
    { source: 'nc-csm', target: 'csf-ret' },
  ],
};
