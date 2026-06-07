import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * Session 180 — fast Vitest config used ONLY by `stryker.mutation.config.mjs`.
 *
 * The main Stryker config runs `related: false` (the `@/` alias breaks Vitest's
 * `--related` module-graph traversal), so every mutant runs the ENTIRE ~2900-test
 * suite (~150 s) — which is why a full mutation pass takes hours and can't sit in
 * CI. This config narrows the test set to the pure-domain unit tests
 * (`tests/domain/**`): a `src/domain/**` mutant is killed by its domain tests, so
 * this is the correct test set for mutating domain code AND it runs in seconds,
 * making a real weekly mutation pass viable.
 */
export default defineConfig({
  resolve: { alias: { '@': path.join(here, 'src') } },
  test: {
    // jsdom (a handful of domain tests use browser globals like localStorage).
    // The real speed win is running ONLY tests/domain/** — a small, fast subset —
    // instead of the entire ~2900-test suite the root Stryker config runs per
    // mutant. Validator mutants are killed by their (pure) domain tests, so this
    // is both the correct and the fast test set for mutating src/domain.
    environment: 'jsdom',
    globals: false,
    include: ['tests/domain/**/*.test.ts', 'tests/domain/**/*.test.tsx'],
  },
});
