# TP Studio — Claude Code project primer

A short orientation file Claude reads at session start so it doesn't have to re-derive project shape every time. Recent per-session detail lives in `CHANGELOG.md`; this primer stays version-light so it doesn't re-stale.

## What this project is

A free, local-first web app for building Theory-of-Constraints diagrams (Goal Tree / Current Reality Tree / Future Reality Tree / Prerequisite Tree / Transition Tree / Evaporating Cloud / Strategy & Tactics / Negative Branch / Freeform). Single-page React **PWA** — no server, no auth. State lives in `localStorage` (debounced auto-save) with JSON + 2× PNG export for sharing, **multi-document tabs**, and optional **File System Access** ("Save to file…/Open from file…", Chromium-only — deliberately *not* a cloud/OneDrive API).

Owner: Dann Bleeker Pedersen. Repo: <https://github.com/dannbleeker/tp-studio>. Default branch: `main` (auto-deploys to GitHub Pages).

## Stack at a glance

- **React 19** + **Vite** + **TypeScript** strict (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`).
- **@xyflow/react** (React Flow) for the canvas. **dagre** for auto-layout (lazy-loaded) + a custom obstacle-aware edge router (`src/domain/edgeRouting.ts`).
- **Zustand 5** for state — split into sliced stores (see `src/store/` below).
- **Tailwind 4** + small custom design tokens in `src/domain/tokens.ts`.
- **Vitest** + **jsdom** for unit/component tests. **Playwright** for e2e (real Chromium). **Biome** lint + format (`biome.json`). **knip** for dead-code.
- **pnpm 10** / **Node 22+** — but in this environment **do not call `pnpm`/`npx`** (see Environment). `pnpm install` (to add deps) is the one exception.

## Directory shape

```
src/
  domain/         — pure data + algorithms (no React imports), unit-tested
    types/          — TPDocument / Entity / Edge / Group / Assumption shapes; SchemaVersion
    factory.ts      — createDocument / createEntity / createEdge (default state)
    persistence.ts  — barrel → persistenceJson (import/export) + persistenceStorage (localStorage + tab slots)
    migrations.ts   — schema v1 → v9 (current); CURRENT_SCHEMA_VERSION
    graph.ts        — barrel → graphCore (cached queries/indices) / graphReach / graphPrune
    edgeRouting.ts  — barrel → edgeGeometry / edgeBezier / edgeVisibilityGraph (visibility-graph + A*)
    validators/     — CLR rules per diagram type; patterns/ — the library diagrams
  store/          — Zustand sliced store
    index.ts        — composes slices; exports useDocumentStore + resetStoreForTest
    documentSlice/  — docMetaSlice, entities/, edgesSlice, groupsSlice (route through applyDocChange)
    uiSlice/        — selection, dialogs, contextMenu, preferences; historySlice, revisionsSlice
  components/     — canvas/ (Canvas + TPNode + TPEdge + overlays) · inspector/ · command-palette/ ·
                    toolbar/ · comments/ · settings/ · ui/
  services/       — side-effecting code: persistence schedule, exporters/, fileSystemAccess, logger.ts
  hooks/          — shared React hooks
tests/            — Vitest tests, mirroring src/
e2e/              — Playwright specs (+ Linux-only visual snapshots)
docs/             — guide/ (the practitioner book) + design notes
.claude/          — project-local Claude config (commands, hooks, agent, skill — see below)
```

## Conventions

- **Domain-first.** Data-model changes land in `src/domain/` first (types + factory + persistence + validator + test), then the store, then UI — never the other way around.
- **Additive-by-default.** New persisted fields are *optional* on `TPDocument` / `Entity` so old docs load unchanged — schema stays `9`, no migration. This discipline is what keeps the basic tools simple while features accrete.
- **One slice per concern.** Doc-touching actions live in `documentSlice/*` and route through `applyDocChange` so persistence + history happen automatically. UI-only state lives in `uiSlice/*`.
- **Strict TypeScript, no `any`** — prefer `unknown` + narrowing. The rare legitimate escape uses `// biome-ignore lint/suspicious/noExplicitAny: <reason>`.
- **Comments explain _why_, not _what_** — capture the decision, the trade-off, the alternative rejected. (The `session-reviewer` agent flags new comments that just narrate code.)
- **Logging goes through `src/services/logger.ts`** (`log.{info,warn,error}`), never raw `console.*` in committed source.
- **Docs stay in sync, same session as code:** CHANGELOG.md (always) · USER_GUIDE.md + README.md (user-facing) · NEXT_STEPS.md (backlog). The book is `docs/guide/*.md` — commit only the Markdown; a GH Actions workflow rebuilds the PDF/EPUB.

## The gate + session-end workflow (Dann's standing rules)

Run via the **`/session-end`** command, which encodes this without freelancing:

1. **First test round** — all must exit 0: `tsc --noEmit`, `biome check`, `vitest run`, `vite build`, `node scripts/check-bundle-size.mjs`. (knip too for dead-code passes.) Stop and fix on any red — don't refactor on a red diff.
2. **Maintainability refactor pass** via the `session-reviewer` subagent on the uncommitted diff. Skip only if Dann says so.
3. **Second test round** — same gates, catches refactor regressions.
4. **Commit** — Conventional Commits (`feat:`/`fix:`/`docs:`/`refactor:`/`chore:`/`test:`), **ask Dann first, don't commit silently**, one commit per session via heredoc. Footer:
   `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
5. **Push** to `origin/main`.
6. **Watch CI** — both `CI` (lint+types+tests+build) and `Deploy to GitHub Pages` must return `success` (`gh run watch <id> --exit-status`). **main must never stay red.**
7. **Goal-seek** failures from real evidence (`gh run view <id> --log-failed`, `gh run download <id> -n playwright-report`), not guesses. Fire `PushNotification` on a real blocker or on green.

A `PreToolUse` hook (`.claude/hooks/pre-bash-gate.cjs`) already blocks `git commit` unless tsc+biome pass and `git push origin main` unless `vite build` passes. **`/gate`** runs the whole gate on demand mid-session (no commit).

## Project tooling (in `.claude/`)

- **Commands:** `/session-end` (close-out ritual) · `/show-backlog` (NEXT_STEPS view) · `/gate` (on-demand full gate).
- **Subagent:** `session-reviewer` (haiku diff-reviewer for the refactor pass).
- **Skill:** `tp-studio-import` (seed a diagram into the running app).
- **Hooks:** `pre-bash-gate` (commit/push gate) + `post-bash-watch-ci` (CI nudge).

## Multi-area research — use parallel sub-agents

When the next step is "look at how X works here" and X spans 2+ modules/directories, send parallel sub-agents in a **single message** rather than searching serially — the per-prompt cost is far less than the conversation-context cost of inline grep round-trips. A single agent is fine when the question is scoped to one place. Rule of thumb: **about to do 2+ grep/glob round-trips in different areas → send parallel sub-agents instead.** (This pattern has paid off repeatedly — e.g. the 4-agent canvas sweeps in Sessions 168/172.)

## Plan mode for L-effort features

For **L (large)** features — multi-file, new module, design ambiguity, schema/migration, cross-cutting — pause and offer plan-mode review before coding:

> "This is L-effort with [these unknowns]. Want a 60-second plan first, or just code?"

The plan covers files to create/touch, signatures, test strategy, alternatives rejected, and cross-cutting concerns. For **S/M** items (single file, clear scope) skip it — the round-trip isn't worth it.

## Environment quirks (Windows + corporate AppLocker)

These bite often — work around them, don't fight them:

- **Working-directory drift (the #1 recurring tax).** This repo lives at `C:\dev\tp-studio` (off OneDrive). Bash commands — especially background ones — often start in the OneDrive session dir instead, so `git`, `node …/bin/…`, and Playwright fail with `Cannot find module C:\…\Desktop\node_modules\…` / "not a git repository". **Prefix every shell command with `cd /c/dev/tp-studio &&`** (or launch Claude from the repo). cwd *does* persist after a `cd …&&`, but stay explicit.
- **`pnpm` / `npx` are AppLocker-blocked** and PowerShell is in Constrained Language Mode (`npm.ps1`/`pnpm.ps1` break). Run tools via their node entry points:
  - `node ./node_modules/typescript/bin/tsc --noEmit`
  - `node ./node_modules/@biomejs/biome/bin/biome check [--write] <files>`
  - `node ./node_modules/knip/bin/knip.js` (passes on exit 0 even when it lists exports)
  - `node ./node_modules/vitest/vitest.mjs run [substring]` (`--coverage` for coverage)
  - `node ./node_modules/vite/bin/vite.js build`

  `gh` on PATH works (full path `"/c/Program Files/GitHub CLI/gh.exe"`).
- **Playwright runs locally** (Session 169): `node ./node_modules/vite/bin/vite.js preview --port 4173 --strictPort` (background) → `node ./node_modules/@playwright/test/cli.js test e2e/<spec> --reporter=list` (`reuseExistingServer` reuses the preview). `window.__TP_TEST__` (on `?test=1`) exposes `seed` / `selectNodeViaRF` / `loadPattern`. `visual-*` snapshots are Linux-only (fail on Windows); **CI's `e2e` job is authoritative**.
- **Coverage concurrency:** never run two `vitest … --coverage` processes at once — they share `coverage/.tmp` and both crash.
- **PWA stale cache:** `registerType:'prompt'` (vite.config.ts) → a plain reload (even Ctrl+Shift+R) can't beat the cached `sw.js`. Force a fresh build via Ctrl+K → "Check for updates" → "Refresh now", or DevTools → Application → Service Workers → Unregister → reload. The Pages CDN can briefly serve a stale `sw.js`, so the in-app update check can false-negative right after a deploy.

## Current state highlights

- **schemaVersion 9** — migrations registry handles v1 → v9 (`src/domain/migrations.ts`). New fields are optional, so most changes need no migration.
- **~2500+ Vitest** unit/component tests + a Playwright e2e suite. The full TP-completeness arc vs Cohen's *TP Basics* (Cloud progression + U-Shape + the smaller gaps) has shipped; recent work is rendering/UX polish + maintainability.
- **Bundle ceilings** are enforced by `node scripts/check-bundle-size.mjs` (part of the gate); CI fails on regressions.

## Where to look for "why was this built like this?"

`CHANGELOG.md` per-session entries explain decisions. `NEXT_STEPS.md` carries the live backlog + intentional-parking rationale. `docs/` holds design notes (e.g. `RENDER_ENGINE_NOTES.md`, `EDGE_ROUTING_PROPOSAL.md`).
