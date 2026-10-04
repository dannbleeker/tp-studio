---
name: gate
description: Run the full TP Studio verification gate on demand (tsc · biome · knip · vitest · build · bundle-size) and report PASS/FAIL per step — without committing. The mid-session "is everything green?" check; /session-end owns the commit ritual.
---

Run the full verification gate for TP Studio and report the result. This is a mid-session check — **do not commit or push** (that's `/session-end`).

Run from the repo root. On the workstation, if the session didn't start in `C:\devtools\tp-studio`, move into it once first; don't prefix each command with `cd`. Use the node entry points below. Run in this order; on the **first** failure, stop and diagnose from the real error rather than pushing past it:

1. `node ./node_modules/typescript/bin/tsc --noEmit`
2. `node ./node_modules/@biomejs/biome/bin/biome check <changed files>` (or `.` for everything; add `--write` to autofix, then re-check)
3. `node ./node_modules/knip/bin/knip.js --no-progress` (`knip.json` sets the files/exports/types/duplicates/enumMembers rules to `error`, so any unused file, export or type exits non-zero and fails the gate; dependency findings only warn)
4. `node ./node_modules/vitest/vitest.mjs run` (full suite, ~2.5 min)
5. `node ./node_modules/vite/bin/vite.js build`
6. `node scripts/check-bundle-size.mjs`

Notes:
- `node scripts/preflight.mjs` runs the same six steps in this order, fail-fast, in one command. Don't trust its exit code through a pipe (`| tail`): read its last success line or run it un-piped.
- Steps 4 + 5 are slow; you may run them in the background and continue once they report.
- Never launch two `vitest … --coverage` runs at once (shared `coverage/.tmp` → both crash). Plain `run` is fine to parallelize with non-vitest steps.

End with a one-line-per-gate summary and the vitest pass count. If all green, say so plainly. If anything failed, fix it before suggesting a commit.
