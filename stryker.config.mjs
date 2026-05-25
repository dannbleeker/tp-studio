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
 * **First-pass scores (recorded for trend tracking):**
 *   - `paletteScore.ts` (Session 121): 30 / 34 mutants killed → **88.24%**
 *   - `actionEligibility.ts` (Session 135): 65 / 66 → **98.48%**
 *     (initial 54 / 66 → 81.82%; +6 tests + 1 assertion strengthen the
 *     na-guard, back-edge / mutex filters on both sides, orphan-edge
 *     `!src` guard, dedupe, and `every` vs `some` folding. One
 *     functionally-equivalent survivor on the self-source short-circuit
 *     accepted; documented inline.)
 *   - `statePropagation.ts` (Session 135): 200 / 228 → **88.16%**
 *     (initial 185 / 228 → 81.58%; +11 tests harden reducer mixed-state
 *     edge cases, junctor-id isolation, zero-weight-in-junctor inertness,
 *     and cache integrity across speculative + same-edges-different-
 *     entities calls. The remaining ~22 survivors + 5 no-coverage cluster
 *     around defensive `if (values.length === 0) return 'unknown'` guards
 *     in reducers — reachable only through closed call sites that already
 *     filter empties — and `'unknown'` ↔ `""` string-literal swaps inside
 *     a chain where the top-level reduceOr collapses both to `'unknown'`.
 *     These are functionally-equivalent at the public-API level; further
 *     gains would require exposing internal helpers or removing the
 *     defensive guards.)
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
    // Session 130 — `src/domain/types.ts` was split into the
    // `src/domain/types/` subfolder (per-concept files) plus
    // `src/domain/index.ts` (barrel re-export). All type-only, no
    // executable code worth mutating.
    '!src/domain/types/**',
    '!src/domain/index.ts',
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
  // Session 132 — the full vitest suite (1230+ tests across domain,
  // store, components, and a handful of integration files) now exceeds
  // Stryker's 5-min default dry-run cap on cold caches. Bump to 15 so
  // a cold first run completes; warm runs land much faster but the
  // baseline pass touches cold caches per file.
  dryRunTimeoutMinutes: 15,
  // Session 132 — measured per-file cost on `migrations/v7ToV8.ts`:
  // 8m55s dry run + ~9min static-mutant re-runs = ~25min for a tiny
  // 7-mutant file. Static mutants re-execute the full dry run each
  // (they're top-level state changes that can't be intercepted at the
  // test level). For our codebase 2 of 7 mutants in v7ToV8 were
  // static; ratio is likely similar across the rest of `domain/`.
  // `ignoreStatic` skips them entirely — practical impact: we lose
  // confidence in mutations at module-load time (rare in our pure
  // domain files) but per-file wall time drops from ~25min to ~9min,
  // making the spot-check workflow viable.
  ignoreStatic: true,
  // Skip checkers — Stryker's TypeScript checker can be flaky on
  // larger projects, and our existing tsc gate already covers
  // compilation. The mutation-survives-test loop is what we want.
  checkers: [],
};
