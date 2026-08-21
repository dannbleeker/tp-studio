# Hand-off — parking TP Studio after Session 209

Written when the project was deliberately put down for a while. Read this before
`NEXT_STEPS.md`: this note says what state things are in and what to do first;
`NEXT_STEPS.md` says what is left to build.

## Where things stand

The app is complete against its own brief. The TP-completeness arc vs Cohen's
*TP Basics* shipped long ago, and the last two sessions were about the seams
underneath rather than new capability:

- **Session 209 — multi-language architecture, English only.** Every seam a
  second locale needs exists and is compile-checked. **No language picker is
  shown** — `SELECTABLE_LOCALES` holds one entry and the Settings row is gated
  on there being more than one, so users are never offered a choice of one.
  Nothing about the app changed for a user. The contract is `docs/I18N.md`;
  read that before touching anything under `src/i18n/`.
- **Session 209b — an app-wide bug program.** A review of persistence, store,
  graph and exporters turned up 26 confirmed defects, most of them silent: ways
  to lose a document, or to be told the wrong thing about one. All fixed, each
  with a regression test. `CHANGELOG.md` has the full list with the reasoning.

## Start here when you come back

1. `git status` (clean), `pnpm install`, `pnpm dev`.
2. The gate is one command: **`node scripts/preflight.mjs`** — tsc, biome, knip,
   the full test suite, build, bundle size. Add `--coverage` for CI's gated
   thresholds and `--e2e` for Playwright (not in the default run).
3. Read `CHANGELOG.md` from the top. It is the home of record for *why*
   something is the way it is; `NEXT_STEPS.md` carries only what is NOT shipped.
   Sessions 1–149 moved to `docs/CHANGELOG-archive.md` in Session 211 — same
   format, nothing edited — so grep both when chasing an older decision.

## Three things worth knowing before you decide anything

**The backlog is mostly decisions, not tasks.** `NEXT_STEPS.md` is deliberately
near-empty of buildable items. Most entries are deferrals with a stated reason,
parked designs waiting on an explicit ask, or declined calls kept so they are not
re-litigated. If an item reads like it "just needs doing", check whether the
entry explains why it doesn't — several survive re-derivation attempts precisely
because the rationale is written down.

**The i18n work is finished as an architecture, not as a translation.** ~635
strings are in the catalogue and twelve surfaces are guarded by the pseudo-locale
test. What is left is concentrated in the *working* surface (canvas, inspector,
command palette) rather than the chrome, and three items need a design decision
rather than extraction — the lazy catalogue segment for pattern metadata, the
toast key seam, and per-locale sentence templates for generated prose. None of it
buys anything until a second locale actually exists. If a second locale is the
goal, the highest-value block is `ENTITY_TYPE_META` (the TP vocabulary itself),
and it has to move as one piece.

**The bug program closed everything it confirmed, and recorded what it could
not.** `NEXT_STEPS.md` under *Known bugs* lists the findings that were traced to
a mechanism but never triggered. The one that matters most is not a bug at all:
**there is no cross-browser-tab coordination anywhere in `src/`** — no
`BroadcastChannel`, no `storage` listener. Two windows share one tab manifest and
the same per-doc slots, last-writer-wins. Decide whether multi-window is
supported before building anything that assumes either answer.

## Environment, briefly

Windows box with corporate AppLocker; the repo lives at `C:\devtools\tp-studio`
(off OneDrive) because that path is allow-listed. Run tools via their node entry
points — `CLAUDE.md` has the specifics and the recurring traps, including the
working-directory drift that costs more time than anything else here.

One rule worth repeating because it is easy to get wrong: **never commit a
locally-rendered visual baseline.** This environment cannot match the CI runner.
Refresh snapshots via the `Update visual snapshots` workflow and cherry-pick only
the affected PNGs.

## What is deliberately NOT done

Nothing is half-built and left. Where a piece of work stopped, it stopped at a
decision point and the decision is written down — in `NEXT_STEPS.md` for backlog
items, in `docs/I18N.md` for the i18n boundaries, and in the code comment at the
site for anything that would otherwise look like an oversight.
