import type { TemplateSpec } from './shared';

/**
 * Retail operations Goal Tree, BESTSELLER-flavoured. Anchored on
 * customer preference (the brief's "first choice in our category"
 * framing) with three CSFs covering range, availability, and
 * service.
 */
export const retailOpsGoalTree: TemplateSpec = {
  id: 'retail-ops-goal-tree',
  title: 'Retail operations — Goal Tree',
  diagramType: 'goalTree',
  description:
    "A Goal Tree for a multi-channel retail business: become the customer's first choice in the category, with CSFs covering range, on-shelf availability, and end-to-end service quality.",
  entities: [
    {
      key: 'goal',
      type: 'goal',
      title: "Be the customer's first choice in our category",
    },
    {
      key: 'csf-range',
      type: 'criticalSuccessFactor',
      title: 'Range covers ≥80% of relevant customer intent',
    },
    {
      key: 'csf-avail',
      type: 'criticalSuccessFactor',
      title: 'On-shelf availability ≥98% on top SKUs',
    },
    {
      key: 'csf-service',
      type: 'criticalSuccessFactor',
      title: 'Service experience earns customer trust end-to-end',
    },
    {
      key: 'nc-merch',
      type: 'necessaryCondition',
      title: 'Merchandising plan refreshes seasonally with margin guardrails',
    },
    {
      key: 'nc-supply',
      type: 'necessaryCondition',
      title: 'Supply chain replenishment cycle ≤ 7 days for top SKUs',
    },
    {
      key: 'nc-returns',
      type: 'necessaryCondition',
      title: 'Returns close out within 48h, 90% of the time',
    },
    {
      key: 'nc-store-staff',
      type: 'necessaryCondition',
      title: 'Store staff trained on the top complaint categories',
    },
  ],
  edges: [
    { source: 'csf-range', target: 'goal' },
    { source: 'csf-avail', target: 'goal' },
    { source: 'csf-service', target: 'goal' },
    { source: 'nc-merch', target: 'csf-range' },
    { source: 'nc-supply', target: 'csf-avail' },
    { source: 'nc-returns', target: 'csf-service' },
    { source: 'nc-store-staff', target: 'csf-service' },
  ],
};
