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
 *
 * Session 116 — bumped Storybook 8 → 10 in prep for the React 19
 * migration session. Storybook 10's peer-deps explicitly include
 * React 19 so future-self can flip the version without a parallel
 * Storybook bump. The bump also surfaced a Vite-plugin issue:
 * Storybook reuses the project's `vite.config.ts` by default, which
 * includes `vite-plugin-pwa`. The PWA plugin tries to generate a
 * service worker for the Storybook build — wrong context, wrong
 * config, throws. `viteFinal` below strips the PWA plugin from
 * Storybook's Vite plugin chain. The main app's `pnpm build` is
 * unaffected (it doesn't pass through Storybook).
 */
const config: StorybookConfig = {
  stories: ['../src/**/*.stories.tsx'],
  addons: [],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  viteFinal: async (cfg) => {
    // Strip any plugin whose name contains "pwa" — vite-plugin-pwa
    // registers several sub-plugins under different names (build,
    // dev, manifest), and any of them tripping on Storybook's output
    // breaks the build. We don't want SW behavior in Storybook
    // anyway. Walk both flat and nested arrays (Vite plugin arrays
    // can nest).
    const stripPwa = (plugins: unknown): unknown => {
      if (!Array.isArray(plugins)) return plugins;
      return plugins.map(stripPwa).filter((p) => {
        if (Array.isArray(p)) return p.length > 0;
        if (!p || typeof p !== 'object') return true;
        const name = (p as { name?: string }).name?.toLowerCase() ?? '';
        return !name.includes('pwa') && !name.includes('workbox');
      });
    };
    if (cfg.plugins) cfg.plugins = stripPwa(cfg.plugins) as typeof cfg.plugins;
    return cfg;
  },
};

export default config;
