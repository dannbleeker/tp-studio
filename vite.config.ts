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
          flow: ['@xyflow/react', 'dagre'],
          icons: ['lucide-react'],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: false,
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx', 'src/**/*.test.ts', 'src/**/*.test.tsx'],
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
        lines: 70,
        statements: 70,
        functions: 65,
        branches: 70,
      },
    },
  },
});
