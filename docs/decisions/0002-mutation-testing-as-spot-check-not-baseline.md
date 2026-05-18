# 0002. Mutation testing as a spot-check tool, not a per-module baseline

- **Status**: Accepted
- **Date**: 2026-05-18
- **Session**: 132 (Tier 3 #11)
- **Tags**: `testing stryker mutation-testing ci`

## Context

Tier 3 #11 (from the 40-improvement menu, Session 130) proposed building a per-module mutation-testing baseline across `src/domain/` — record the surviving-mutant score for each file in a `MUTATION_BASELINE.md` table, then use that as a CI gate so future test-quality regressions trip an alarm.

Session 121 had landed the Stryker config (`stryker.config.mjs`) and gathered one data point: `paletteScore.ts` → 88.24% (30 of 34 mutants killed). The plan was to extend that to every module.

Session 132 measured the actual per-file cost on a deliberately small target (`src/domain/migrations/v7ToV8.ts` — 7 mutants, ~20 LOC):

| Phase | Time (default config) | Time (ignoreStatic: true) |
|---|---|---|
| Stryker startup + worker pool spawn | ~10 s | ~10 s |
| Initial dry run (1232 tests, full suite) | **8 m 55 s** | **8 m 40 s** |
| Per-mutant testing | < 1 s each | < 1 s each |
| Static-mutant re-runs (2 of 7) | ~9 min each | _skipped_ |
| **Total wall time per file** | **~25 min** | **9 m 01 s** (measured) |

Score on the post-`ignoreStatic` run: **80.00%** (4 killed, 1 survived). The surviving mutant flipped `if (!isPlainObject(raw)) return raw;` → `if (false) return raw;` — every v1→v8 migration fixture happens to be a plain object, so the early-return path is never exercised. Not worth a test (would mean passing `42` or `null` as a doc to assert the migration is a no-op).

The dry run is mostly transform / module-resolution overhead — actual test execution is 23.7 s, the rest is the 511 s of overhead Stryker reports. Static mutants compound the cost by re-executing the full dry-run cycle each.

Across ~50 mutate-eligible files in `src/domain/`, the projected baseline pass is 12–25 hours of wall time. That's beyond what fits in any interactive session and outside the maintenance budget for a tool whose feedback rarely changes the test list more than the obvious cases.

## Decision

Treat Stryker mutation testing as an **on-demand spot-check tool**, not a continuous baseline. Specifically:

1. `stryker.config.mjs` keeps `ignoreStatic: true` so the per-file run is bounded by dry-run + non-static mutants (~9 min instead of ~25 min).
2. There is **no** committed `MUTATION_BASELINE.md` and **no** CI gate enforcing a mutation-score floor.
3. The workflow is documented in `README.md` under "Mutation testing": run `pnpm mutation --mutate <file>` on a module you're actively tightening; read the HTML report at `reports/mutation/index.html`; write tests for the highest-value surviving mutants. Don't chase 100% — diminishing returns set in past ~80%.
4. The per-module score is **not** recorded between runs. If we later want trend tracking, add a tiny `scripts/record-mutation-score.mjs` that appends to a CSV — but only after we've actually run the tool more than twice.

## Alternatives considered

- **Full baseline + CI gate.** The original Tier 3 #11 proposal. Rejected: ~12–25h wall time per baseline pass, ~9 min added to every CI run if scoped down to one file. The fail-on-regression contract assumes baselines stable across PRs, but our `vitest.related = false` setup means even unrelated PRs would invalidate static-mutant counts.
- **Nightly CI job that does the full baseline.** Would solve the wall-time problem (it's a robot, it can wait). Rejected for now because: (a) no consumer of the result yet — nobody reads the score regularly; (b) sets up a maintenance obligation on the workflow (timeouts, runner cost, flake recovery) without a forcing function for the data; (c) when we *do* want it, the data flow is `pnpm mutation > scores.json` + CSV-append, which is an afternoon of work.
- **Per-PR Stryker on changed files only.** Stryker's `mutate` glob can be set per-invocation, so `pnpm mutation --mutate $(git diff --name-only main src/domain)` would scope a PR run. Rejected: even one changed file is 9 min of CI overhead, and most PRs don't touch `src/domain/`. Manually-triggered (`workflow_dispatch`) coverage would give the same value without the per-PR tax.

## Consequences

**Good:**

- We keep Stryker as a usable tool — `pnpm mutation --mutate <file>` works when you want it, with a documented cost.
- No CI flake exposure from a long, expensive baseline pass.
- The HTML report (already generated under `reports/mutation/`) tells you exactly which mutants survived — the actionable artefact is preserved.
- `ignoreStatic: true` makes per-file runs tractable as a quick check.

**Bad:**

- No trend data on test-quality drift. If a refactor weakens the test suite, we won't notice through this channel.
- The `paletteScore.ts` data point from Session 121 (88.24%) stays orphaned — not part of a tracked baseline.
- A future "we should know how good our tests are" instinct will hit this wall again. Anyone reading this ADR in that situation: the answer is probably a nightly CI job that writes scores to a CSV, not building a full table by hand.

## References

- `stryker.config.mjs` — config with `ignoreStatic: true` + `dryRunTimeoutMinutes: 15` + the exclusion list.
- `NEXT_STEPS.md` — Tier 3 #11 (mutation baseline) — superseded by this ADR; the planning text there is now stale.
- `CHANGELOG.md` Session 121 — the original Stryker dial-in pass + the 88.24% data point.
- `CHANGELOG.md` Session 132 — this ADR.
