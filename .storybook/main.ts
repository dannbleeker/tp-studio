import type { StorybookConfig } from '@storybook/react-vite';

/**
 * Session 81 — minimal Storybook setup for TP Studio's UI primitives.
 *
 * Stories live alongside the components they document (`*.stories.tsx`
 * next to `*.tsx`). Keeps the primitive + its story / fixtures together
 * so a tweak to one is impossible to miss the other.
 *
 * Addons intentionally minimal — no `addon-essentials`, no `addon-docs`,
 * no `addon-a11y`. The point of Storybook here is a quick visual
 * playground for the six handful of primitives, not a full design-system
 * portal. Add addons when the primitive count or contributor count
 * grows; until then the lean install keeps the dev-dep footprint
 * defensible.
 */
const config: StorybookConfig = {
  stories: ['../src/**/*.stories.tsx'],
  addons: [],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
};

export default config;
