import type { TemplateSpec } from './shared';

/**
 * Small, approachable personal-productivity CRT. Single-person
 * scope; useful for new users to feel the CRT shape without a
 * domain context.
 */
export const personalProductivityCRT: TemplateSpec = {
  id: 'personal-productivity-crt',
  title: 'Personal productivity — Current Reality Tree',
  diagramType: 'crt',
  description:
    'A small, approachable CRT for a knowledge worker who feels behind. Three UDEs + two root causes — enough to feel the shape of a CRT, small enough to grok in five minutes.',
  entities: [
    {
      key: 'ude-late',
      type: 'ude',
      title: "I'm chronically behind on commitments I take seriously",
    },
    {
      key: 'ude-anxiety',
      type: 'ude',
      title: 'I feel anxious about my todo list at the end of every day',
    },
    { key: 'ude-deep', type: 'ude', title: 'I never get to the deep, meaningful work' },
    { key: 'eff-react', type: 'effect', title: 'I spend most of my day reacting to inbound' },
    {
      key: 'eff-context',
      type: 'effect',
      title: 'Every block of time gets cut by context-switching',
    },
    {
      key: 'rc-no-block',
      type: 'rootCause',
      title: "I haven't blocked time on my calendar for the work I care about",
    },
    {
      key: 'rc-no-list',
      type: 'rootCause',
      title: 'My commitments live in seven places at once',
    },
  ],
  edges: [
    { source: 'rc-no-block', target: 'eff-react' },
    { source: 'rc-no-list', target: 'eff-react' },
    { source: 'eff-react', target: 'eff-context' },
    { source: 'eff-context', target: 'ude-deep' },
    { source: 'eff-context', target: 'ude-late' },
    { source: 'rc-no-list', target: 'ude-anxiety' },
    { source: 'ude-late', target: 'ude-anxiety' },
  ],
};
