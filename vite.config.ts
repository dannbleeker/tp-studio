/// <reference types="vitest" />
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import autoprefixer from 'autoprefixer';
import tailwindcss from 'tailwindcss';
import { defineConfig } from 'vite';
import tailwindConfig from './tailwind.config';

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.join(here, 'src'),
    },
  },
  css: {
    postcss: {
      plugins: [tailwindcss(tailwindConfig), autoprefixer()],
    },
  },
  build: {
    // Split heavy vendor libs into their own chunks so a feature commit
    // only invalidates one chunk's cache, and html-to-image (only used by
    // the PNG exporter) ships as a separate chunk that loads on demand.
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          flow: ['@xyflow/react'],
          icons: ['lucide-react'],
          // Session 81 — `dagre` removed from the `flow` chunk so it can
          // be code-split. `useGraphPositions` now lazy-loads
          // `@/domain/layout` via `await import()`, which lets Rollup
          // place dagre in its own chunk that only loads when an
          // auto-layout diagram (non-EC) is first laid out. ~25 KB gzip
          // off the eager critical path.
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: false,
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx', 'src/**/*.test.ts', 'src/**/*.test.tsx'],
    // Session 84 — persist Vitest's transform cache across runs so the
    // dev-loop `pnpm test:watch` and the explicit `pnpm test` skip
    // recompiling unchanged files. ~50s cold run drops to ~5–10s warm.
    // The cache dir is gitignored alongside `dist/` and `coverage/`.
    cache: { dir: 'node_modules/.cache/vitest' },
    coverage: {
      // V8 is the bundled provider — no extra dep to install. JSON + text
      // covers both human reading and tooling consumers (codecov etc.).
      provider: 'v8',
      // `json-summary` produces `coverage/coverage-summary.json`, which
      // `scripts/pin-coverage-thresholds.mjs` reads to update the
      // measured floor. The plain `json` reporter (full details) is
      // kept for IDE consumers / external tools.
      reporter: ['text', 'json', 'json-summary', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.test.{ts,tsx}',
        'src/main.tsx', // entry shim — covered transitively
        'src/vite-env.d.ts',
      ],
      // Coverage thresholds are deliberately a *floor* — they fail CI
      // if coverage drops below these numbers. Workflow for tightening:
      //
      //   1. Run `pnpm test:coverage` locally.
      //   2. Read the bottom-of-output summary table (per-metric %).
      //   3. Replace the numbers below with (measured % − 2) so future
      //      drift is caught while leaving 2% slop for noise.
      //   4. Commit; CI now guards the new floor.
      //
      // Today's numbers are the conservative starting set — actual
      // measured coverage on a green run should exceed them. Bump after
      // the first CI run with `@vitest/coverage-v8` installed reports
      // the real baseline.
      thresholds: {
        // Session 81 re-pin. Session 80's `pdfExport.ts` added ~170
        // lines of DOM/canvas-touching code that jsdom can't exercise
        // (the pure helpers got their 13 unit tests; the rest is
        // covered by the Playwright e2e suite). Per the workflow
        // comment below — re-pinned at (measured − 2) for ~2% slop.
        lines: 65,
        statements: 65,
        functions: 63,
        branches: 76,
      },
    },
  },
});
