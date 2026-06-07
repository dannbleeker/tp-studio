// stryker.mutation.config.mjs
//
// Session 180 — the config the weekly `.github/workflows/mutation.yml` (and the
// dashboard's `stats.quality.mutationScore`) use.
//
// It mutates the CLR validator suite (src/domain/validators) and checks each
// mutant against ONLY the pure-domain tests, via `vitest.mutation.config.ts`
// (include: tests/domain/**). The root `stryker.config.mjs` runs `related: false`
// against the FULL ~2900-test suite (~150 s) per mutant — which is why a full
// pass takes hours and can't sit in CI. Scoping the test set to the fast domain
// tests (the ones that actually kill domain mutants) drops that to seconds per
// mutant, making a real weekly pass viable.
//
// Emits a JSON report at reports/mutation/mutation.json — the stats pipeline
// (scripts/build-stats.mjs) reads it into stats.quality.mutationScore.

export default {
  plugins: ['@stryker-mutator/vitest-runner'],
  mutate: ['src/domain/validators/**/*.ts', '!src/domain/validators/**/*.d.ts'],
  testRunner: 'vitest',
  // Scoped, fast test set; related-filtering off (the `@/` alias breaks Vitest's
  // module-graph traversal — see the root stryker.config.mjs header).
  vitest: { configFile: 'vitest.mutation.config.ts', related: false },
  disableTypeChecks: 'src/**/*.{ts,tsx}',
  reporters: ['json', 'clear-text', 'progress'],
  tempDirName: 'node_modules/.stryker-tmp',
  ignoreStatic: true,
  checkers: [],
  concurrency: 4,
  thresholds: { high: 80, low: 60, break: null },
  dryRunTimeoutMinutes: 10,
};
