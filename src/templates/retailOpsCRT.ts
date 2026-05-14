import type { TemplateSpec } from './shared';

/**
 * Retail-operations symptom set — a plausible CRT showing how a
 * handful of root causes propagate into the most common chain-store
 * UDEs (stockouts, slow service, unhappy customers).
 */
export const retailOpsCRT: TemplateSpec = {
  id: 'retail-ops-crt',
  title: 'Retail operations symptoms — Current Reality Tree',
  diagramType: 'crt',
  description:
    'Generic retail-store UDEs traced back to a small set of root causes. Useful as a starting frame when a chain is debugging why store-level service quality has slipped.',
  entities: [
    {
      key: 'ude-churn',
      type: 'ude',
      title: 'Repeat customers visit less often',
      description: 'Loyalty cohort frequency down 18% YoY in our top 50 stores.',
    },
    { key: 'ude-stockout', type: 'ude', title: 'Customers leave empty-handed on top SKUs' },
    { key: 'ude-slow', type: 'ude', title: 'Service feels slow at the till and on returns' },
    {
      key: 'eff-shelf',
      type: 'effect',
      title: 'Top SKU on-shelf availability sits at 88%',
    },
    {
      key: 'eff-mistakes',
      type: 'effect',
      title: 'Order pick / pack mistakes affect 6% of online orders',
    },
    {
      key: 'eff-train',
      type: 'effect',
      title: 'Newly-hired store staff handle complaints poorly',
    },
    { key: 'rc-forecast', type: 'rootCause', title: 'Demand forecast is rebuilt only quarterly' },
    {
      key: 'rc-replenishment',
      type: 'rootCause',
      title: 'Replenishment cycle on top SKUs is 14 days, not 7',
    },
    {
      key: 'rc-onboarding',
      type: 'rootCause',
      title: 'Store onboarding skips complaint scenarios',
    },
    { key: 'rc-tooling', type: 'rootCause', title: 'Picking app has no SKU-confirm step' },
  ],
  edges: [
    { source: 'rc-forecast', target: 'eff-shelf' },
    { source: 'rc-replenishment', target: 'eff-shelf' },
    { source: 'eff-shelf', target: 'ude-stockout' },
    { source: 'rc-tooling', target: 'eff-mistakes' },
    { source: 'eff-mistakes', target: 'ude-slow' },
    { source: 'rc-onboarding', target: 'eff-train' },
    { source: 'eff-train', target: 'ude-slow' },
    { source: 'ude-stockout', target: 'ude-churn' },
    { source: 'ude-slow', target: 'ude-churn' },
  ],
};
