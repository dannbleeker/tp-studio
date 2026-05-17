/**
 * Session 121 — Stryker mutation-testing config, dial-in landed.
 *
 * Mutation testing introduces small synthetic bugs (mutants) into the
 * source and checks whether the test suite catches each one. Unkilled
 * mutants indicate weak coverage even when line coverage is high.
 *
 * **The Session 115 blocker.** Stryker's vitest runner uses `vitest
 * --related <files>` to filter tests per mutant, but our tests import
 * source via `@/` path aliases which don't show up in vitest's
 * source-relationship graph (known issue:
 * https://stryker-mutator.io/docs/stryker-js/troubleshooting/#vitest-failed-to-find-test-files-related-to-mutated-files).
 * Result was "Vitest failed to find test files related to mutated
 * files" + Stryker exiting with "No tests were executed."
 *
 * **Session 121 dial-in.** `vitest.related = false` (per Stryker's own
 * recommended fallback) bypasses related-test filtering entirely;
 * every mutant runs the full 1200-test suite. Per-mutant wall time on
 * a 4-runner config: ~7 s in steady state. A focused first-pass on a
 * single small domain file (≤ 50 LOC) completes in ~5 min; per
 * `src/domain/**` file the cost scales linearly with the mutant count.
 *
 * **Running it.**
 *   `pnpm mutation --mutate src/domain/paletteScore.ts`  — single file
 *   `pnpm mutation`                                      — all of `src/domain/` (hours)
 *
 * The unbounded run still takes hours; the per-file recipe above is
 * the practical reporting tool. Use it on a module you're actively
 * strengthening tests for — the HTML report tells you exactly which
 * mutants survived so you can write the missing tests.
 *
 * **First-pass scores (Session 121, recorded for trend tracking):**
 *   - `paletteScore.ts`: 30 / 34 mutants killed → **88.24%**
 *
 * Output: HTML report at `reports/mutation/index.html` — gitignored,
 * ad-hoc inspection like the bundle-stats treemap. Mutation score
 * summaries land in CHANGELOG when shipping a report.
 */
export default {
  // pnpm's non-hoisted layout means Stryker's auto-discovery can't
  // find peer plugins without an explicit list. The vitest runner is
  // a separate package we installed alongside the core.
  plugins: ['@stryker-mutator/vitest-runner'],
  mutate: [
    'src/domain/**/*.ts',
    '!src/domain/**/*.d.ts',
    '!src/domain/examples/**',
    '!src/domain/types.ts',
    '!src/domain/tokens.ts',
    '!src/domain/zLayers.ts',
    '!src/domain/constants.ts',
  ],
  testRunner: 'vitest',
  vitest: {
    configFile: 'vite.config.ts',
    // Bypass `vitest --related` — our `@/` alias imports break its
    // module-graph traversal (see header). Each mutant runs whatever
    // tests vitest picks up under the project root.
    related: false,
  },
  disableTypeChecks: 'src/**/*.{ts,tsx}',
  reporters: ['html', 'clear-text', 'progress'],
  htmlReporter: { fileName: 'reports/mutation/index.html' },
  tempDirName: 'node_modules/.stryker-tmp',
  // Don't fail on any specific threshold for this first pass — output
  // is the deliverable. A future run could pin the threshold once we
  // know the baseline.
  thresholds: { high: 80, low: 60, break: null },
  // Keep concurrency reasonable on a laptop; on CI we'd bump this.
  concurrency: 4,
  // Skip checkers — Stryker's TypeScript checker can be flaky on
  // larger projects, and our existing tsc gate already covers
  // compilation. The mutation-survives-test loop is what we want.
  checkers: [],
};
