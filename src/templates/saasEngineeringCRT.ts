import type { TemplateSpec } from './shared';

/**
 * Generic SaaS-engineering symptom set — echoes the *Phoenix
 * Project* dynamic: tight deadlines + insufficient capacity + no
 * shared visibility produce a chain of UDEs.
 */
export const saasEngineeringCRT: TemplateSpec = {
  id: 'saas-engineering-crt',
  title: 'SaaS engineering symptoms — Current Reality Tree',
  diagramType: 'crt',
  description:
    'A starter CRT for a SaaS engineering org under sustained delivery pressure. UDEs cover missed commitments, on-call burn, and tech debt; root causes trace back to capacity + visibility decisions.',
  entities: [
    { key: 'ude-missed', type: 'ude', title: 'We miss customer-facing commitments every quarter' },
    { key: 'ude-oncall', type: 'ude', title: 'On-call rotation burns the team out' },
    { key: 'ude-debt', type: 'ude', title: 'Tech debt grows faster than we pay it down' },
    {
      key: 'eff-rework',
      type: 'effect',
      title: 'Half of our work is unplanned interrupt-driven rework',
    },
    {
      key: 'eff-prio',
      type: 'effect',
      title: 'Priority calls happen on Slack, not in the planning forum',
    },
    {
      key: 'eff-shortcut',
      type: 'effect',
      title: 'Engineers ship shortcuts to make the date',
    },
    {
      key: 'rc-capacity',
      type: 'rootCause',
      title: 'Capacity planning ignores on-call + support load',
    },
    {
      key: 'rc-visibility',
      type: 'rootCause',
      title: 'No single board shows in-flight + queued work',
    },
    {
      key: 'rc-roadmap',
      type: 'rootCause',
      title: 'Roadmap dates are committed before engineering scope is reviewed',
    },
  ],
  edges: [
    { source: 'rc-capacity', target: 'eff-rework' },
    { source: 'rc-visibility', target: 'eff-rework' },
    { source: 'eff-rework', target: 'ude-oncall' },
    { source: 'rc-visibility', target: 'eff-prio' },
    { source: 'eff-prio', target: 'ude-missed' },
    { source: 'rc-roadmap', target: 'eff-shortcut' },
    { source: 'eff-shortcut', target: 'ude-debt' },
    { source: 'eff-shortcut', target: 'ude-missed' },
    { source: 'ude-debt', target: 'ude-oncall' },
  ],
};
