# TP Studio — Claude Code project primer

A short orientation file Claude reads at session start so it doesn't have to re-derive project shape every time.

## What this project is

A local web app for building Theory-of-Constraints diagrams (Goal Tree / Current Reality Tree / Future Reality Tree / Prerequisite Tree / Transition Tree / Evaporating Cloud / Strategy & Tactics / Freeform). Single-page React app. **Offline-first** — no server, no auth, no sync. All state in `localStorage` + a JSON-export round-trip for sharing.

Owner: Dann Bleeker Pedersen. Repo: <https://github.com/dannbleeker/tp-studio>. Default branch: `main`.

## Stack at a glance

- **React 18** + **Vite 5** + **TypeScript** (strict).
- **@xyflow/react** (React Flow) for the canvas. **dagre** for auto-layout (lazy-loaded since Session 81).
- **Zustand** for state — split into sliced stores (see `src/store/` layout below).
- **Tailwind CSS** + small custom design tokens in `src/domain/tokens.ts`.
- **Vitest** + **jsdom** for unit tests. **Playwright** for e2e smoke tests against `vite preview`. **Storybook** (minimal) for UI primitives.
- **Biome** for lint + format (strict rules — see `biome.json`).
- **pnpm** as the package manager, pinned to a specific version via `packageManager` field.

## Directory shape

```
src/
  domain/         — pure data + algorithms (no React imports)
    types.ts        — TPDocument / Entity / Edge / Group / Assumption shapes; SchemaVersion
    factory.ts      — createDocument / createEntity / createEdge (default state)
    persistence.ts  — importFromJSON / saveToLocalStorage + migrations dispatch
    migrations.ts   — schema v1 → v7 (current); CURRENT_SCHEMA_VERSION
    layout.ts       — dagre wrapper + per-component memoization (Session 83)
    validators/     — CLR rules per diagram type
    entityTypeMeta.ts, layoutStrategy.ts, graph.ts (graph queries)
  store/          — Zustand sliced store
    index.ts        — composes all slices; exports useDocumentStore
    documentSlice/  — docMetaSlice, entitiesSlice, edgesSlice, groupsSlice
    uiSlice/        — selectionSlice, dialogsSlice, contextMenuSlice, preferencesSlice
    historySlice.ts, revisionsSlice.ts, types.ts
  components/
    canvas/         — Canvas + TPNode + TPEdge + useGraphView (3-stage hook split)
    inspector/      — EntityInspector / EdgeInspector / GroupInspector / DocumentInspector + Field + MarkdownField
    command-palette/  — palette + per-group command files
    toolbar/        — TopBar + TitleBadge + KebabMenu
    print/          — PrintPreviewDialog + PrintAppendix
    templates/      — TemplatePickerDialog (curated specs in src/templates/)
    history/        — RevisionPanel + SideBySideDialog
    ui/             — Button, Modal, ConfirmDialog, MarkdownPreview, ErrorBoundary
  services/       — side-effecting code (persistence schedule, exporters, share-link, etc.)
    exporters/      — image / markup / text / Flying Logic XML
    pdfExport.ts    — true vector PDF via jspdf + svg2pdf.js (Session 80)
    testHook.ts     — window.__TP_TEST__ for Playwright (?test=1 opt-in; Session 82)
    systemScopeNudge.ts — Session 83 CRT nudge watcher
  hooks/          — shared React hooks (useFocusTrap, useFingerprintMemo, useZoomLevel, ...)
  styles/         — index.css (Tailwind entry) + print.css

tests/            — Vitest unit tests, mirroring src/ tree
e2e/              — Playwright smoke specs + Linux baselines under *-snapshots/
docs/             — guide/ (practitioner book), decisions/ (ADRs), ui-review-*, distribution-pwa-scoping
.github/workflows/ — ci.yml + update-visual-snapshots.yml
.claude/          — hooks, agents, commands (project-local Claude config)
```

## Conventions

- **Domain-first.** New data model changes land in `src/domain/` first (types + factory + persistence + validator + test), then the store, then UI. Never the other way around.
- **One slice per concern.** When a store action would touch the doc, it lives in a `documentSlice/*Slice.ts` file and routes through `makeApplyDocChange` so persistence + history happen automatically. UI-only state lives in `uiSlice/*Slice.ts`.
- **Strict TypeScript.** `noUnusedLocals`, `noUnusedParameters`, `noUncheckedIndexedAccess`. No `any` — prefer `unknown` + narrowing. The few legitimate escapes use `// biome-ignore lint/suspicious/noExplicitAny: <reason>`.
- **Pure-function preference.** Everything in `src/domain/` and most of `src/services/` is plain functions. Hooks + components are the only React-aware code.
- **No mutating actions.** Store actions return new doc references; the `applyDocChange` wrapper handles immutability + history push.
- **Comments explain *why*, not *what*.** Code says what; comments capture the decision behind it (the trade-off, the alternative considered, the session number for context).
- **CHANGELOG / NEXT_STEPS / USER_GUIDE updated in the same session as code edits** (see memory: `feedback_tp_studio_docs.md`).

## Session-end workflow (Dann's standing rules)

1. **First test round**: `tsc --noEmit`, `biome check`, `vitest run`, `vite build`, `node scripts/check-bundle-size.mjs`. All green before proceeding.
2. **Maintainability refactor pass** on what was touched this session. Skip only if Dann explicitly says so.
3. **Second test round** — same suite, catches refactor regressions.
4. **Commit** in Conventional Commits format (`feat: …`, `fix: …`, `docs: …`, `refactor: …`); ask Dann first, don't commit silently.
5. **Push to `origin/main`**.
6. **Watch CI via `gh` CLI** — both Lint+types+tests+build and Playwright e2e must return success. Goal-seek on failure via `gh run view <id> --log-failed` + `gh run download <id> -n playwright-report` (real evidence beats guessing).
7. **PushNotification** when CI lands green, or on a real blocker.

Memory entries that codify this: `feedback_commit_workflow.md`, `feedback_ci_refactor_workflow.md`, `feedback_notifications.md`, `feedback_tp_studio_docs.md`, `feedback_subagents.md`.

## Multi-area research — use parallel sub-agents

When the next step is "look at how X works in this codebase" and X spans 2+ modules / directories, send parallel sub-agents in a **single message** rather than searching serially. Examples that paid off:

- **Session 99** — parallel `Explore` agents for `radial layout + edge rendering` and `dagre import chain`. Both returned structured reports with code excerpts in <1 min; the implementation phase needed zero follow-up greps.
- **Session 95** — parallel agents per investigation area saved 4-5 grep round-trips on the SelectionToolbar Phase-1 prep.
- **Session 93 / EC PPT comparison** — three parallel agents (current state / template / gap) produced a 7-item punch list in one round-trip vs. an estimated 8-10 serial greps.

A single agent is fine when the question is scoped to one place. The amplifier rule: **if you're about to do 2+ grep/glob round-trips in different areas, send parallel sub-agents instead.** The `Agent` tool's per-prompt cost is far less than the conversation-context cost of doing it inline.

Send them via multiple `Agent` tool-use blocks in **one assistant message** — that's what makes them run concurrently. Sequential `Agent` calls across separate messages is just slow grep.

## Plan mode for L-effort features

For new features in the **L (large)** effort bucket — multi-file, new module, design ambiguity, cross-cutting impact — pause and request plan-mode review before writing code:

> "This is L-effort with [these unknowns]. Want me to enter plan mode and write a 60-second plan first, or just code?"

The plan covers: file paths to create / touch, function signatures, test strategy, the alternatives considered + rejected, and any cross-cutting concern (schema, migration, store wiring). Dann reviews, approves or course-corrects, then plan-mode exits and implementation begins.

For **S / M** items (single file, clear scope, well-trodden ground), skip plan mode — the round-trip isn't worth it. Rule of thumb: if Dann would otherwise interrupt mid-implementation to ask "what's your plan?", that's a plan-mode signal.

Items historically worth plan-mode review (from the backlog): radial edge routing (Session 99 — skipped plan mode, would've been worth ~5 min review), Bundle 10 diagram-type additions, schema-version migrations, anything that adds a new domain concept.

## Environment quirks (Windows + corporate AppLocker)

These have bitten us multiple times — work around them, don't fight them:

- **`pnpm dlx` is blocked.** `pnpm install` from package.json works; one-off `pnpm dlx <pkg>` is denied by Group Policy.
- **PowerShell Constrained Language Mode** breaks `npm.ps1` / `pnpm.ps1`. Invoke binaries directly via Bash + `.cmd` shims, or use full paths like `"/c/Program Files/GitHub CLI/gh.exe"`.
- **OneDrive + `node_modules`** is slow and lock-prone. Project lives at `C:\dev\tp-studio` deliberately, off OneDrive.
- **`pnpm-workspace.yaml`** is autogenerated with anomalous `allowBuilds:` content. Keep `core-js: false` in there so `ERR_PNPM_IGNORED_BUILDS` doesn't trip CI.
- **Playwright** can't run locally because `vite preview` is blocked by AppLocker. Use `gh run download` to grab the report from CI failures instead.
- **Local Node is 24.x.** CI runs on Node 22 (lint-staged 17 requires ≥22.22.1). `engines.node: ">=22.22.1"`.
- **pnpm pin**: `pnpm@10.33.4`. Don't bump to 11.x without bumping CI Node to 22.13+.

## Current state highlights

- **schemaVersion**: 7. Migrations registry handles v1 → v7. Future bumps live in `src/domain/migrations.ts`.
- **Tests**: ~990+ unit, ~6 Playwright e2e smoke (one or two skipped on CI by design).
- **Bundle ceilings** (`bundle-budget.json`): flow 110 KB gz, index 115 KB gz, icons 12.5 KB gz. CI fails if exceeded by >10%.
- **Latest sessions**: 77 (brief v3 alignment), 78 (creation wizards), 79 (templates + multi-goal warning), 80 (vector PDF), 81 (lazy dagre + Storybook), 82 (e2e test hook), 83 (nudge / mobile / layout-memo / drag-splice / visual baselines).

## Where to look for "why was this built like this?"

`CHANGELOG.md` per-session entries explain decisions. `NEXT_STEPS.md` carries the live backlog + intentional-parking rationale. `docs/decisions/` (Session 84) has ADR-style records for the non-obvious cross-cutting calls.
