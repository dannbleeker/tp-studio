# Next Steps

A focused parking lot of open work — fresh items only. Historical context lives in CHANGELOG.md.

---

## Open major gaps from the spec analysis

Source: `toc_tp_software_requirements.docx` (Session 134 review). Seven of ten major gaps still open after this session's run. **AI-integration (spec §5) explicitly out of scope** — moved to the won't-build section below.

### 🔴 #2 — Multi-user collaboration

Spec §4. Single-user local-only. Missing: real-time multi-user editing, comments on entities/edges, role-based participation (facilitator / contributor / reviewer / decision owner), workshop mode with voting + timeboxing, stakeholder sign-off on critical assumptions, decision log.

**Effort:** Largest scope item. Changes TP Studio from local-first to cloud-backed — a product-direction decision, not a sprint.

### 🔴 #3 — Cross-diagram traceability

Spec §6.2. Each `TPDocument` is standalone JSON; no entity/edge references across documents. The full chain (UDE → CRT core driver → Cloud conflict → assumptions → injections → FRT desired effects/negative branches → PRT obstacles/milestones → TT actions/owners) must be reconstructed manually. Spec considers this critical: *"Without traceability, each diagram becomes a standalone artifact and the TOC logic chain breaks."*

**Path:** `importedFrom: { docId, entityId }` ref on Entity + per-doc-store cross-ref index + UI affordances for "jump to source".

**Effort:** ~2–3 sessions. Highest-leverage structural gap.

### 🔴 #4 — Confidence / propagation simulation

Spec §3.4. No `Entity.state` enum (`true / false / unknown / disputed`), no propagation through AND/OR logic, no "what changes if this assumption is false?" simulation. Spec lists this as the FRT module's signature behaviour.

**Effort:** Schema-light (entity state enum + propagation function); the trickier part is the "what-if" UX. ~3 sessions.

### 🔴 #6 — Entity ownership + first-class evidence model — *partial done Session 134*

Spec §§5.2, 6.1. **Owner field shipped Session 134:** dedicated `entity.owner?: string` (replaces the legacy `attributes.owner.value` path with a real first-class typed field); Inspector field block with a "Mark validated" / "Re-validate" button that stamps `entity.lastValidatedAt`; risk-register CSV exporter prefers the dedicated field. **Still open:** the structured `entity.evidence?: EvidenceItem[]` array (source-type taxonomy: `observed fact / stakeholder assertion / metric / policy / assumption`; strength rating; URL refs; per-evidence validation date + owner). UI list editor for add/edit/remove.

**Effort:** ~1 session.

### 🔴 #7 — Task / execution bridge

Spec §§2.6, 8. TT actions don't flow into a task tracker. Spec wants TT actions → tasks with owner / due date / dependencies / status / success criteria, exportable to Jira / Trello / Planner / Asana, plus a "buy-in narrative" generator per action. TP Studio exports TT as Markdown / Flying Logic only today.

**Path:** add an "Export to task tracker" panel building on the existing reasoning-export Markdown. Start with CSV (universally importable) before per-tracker formats.

**Effort:** ~1–2 sessions.

### 🔴 #8 — Enterprise integration

Spec §8. No SSO/SAML/OIDC, no Microsoft 365 / Google Workspace, no Slack/Teams, no Confluence/SharePoint, no Jira/Azure DevOps. TP Studio is browser-local PWA. Tied to collaboration scope decision (#2).

### 🔴 #9 — Formal mode-switching

Spec §7.1. Lists Guided / Expert / Workshop / Presentation modes. TP Studio has guided prompts (method checklist) and walkthrough overlays, but no explicit mode-state, no facilitator-vs-contributor view, no presentation mode beyond exports.

**Effort:** ~1–2 sessions.

---

## Open medium gaps

- **"Preserve rejected logic in collapsed groups"** — partial via revision branches; no archive-of-rejected concept on the live canvas.
- **Action quality checks (control / influence / authority for TT actions)** — method checklist hints at it ("Test against your locus — control / influence / external") but not enforced per-action validator. Could be a new `tt-action-locus-set` validator.
- **Action eligibility based on satisfied preconditions** — depends on confidence/state propagation (#4).
- **Roll-up validation for S&T** (sufficiency of subordinate tactics to support the parent) — standard CLR only; no tactic-roll-up-sufficiency validator. Spec considers this an S&T-specific need.
- **Sufficiency / parallel / necessary assumption distinction for S&T** — method checklist labels mention NA/PA/SA but the data model doesn't sub-type assumptions. Would need `Assumption.kind: 'necessary' | 'parallel' | 'sufficient'`.
- **Audit trail / GDPR / data retention** — local-only sidesteps GDPR; no audit log of assumption-acceptance / injection-acceptance / decision-resolution. Enterprise feature, tied to #2/#8.
- **Reactive vs proactive NBR mitigation distinction** — current NBR implementation (Session 134) infers mitigation status from injection-reachability; spec wants a formal `mitigation.kind: 'reactive' | 'proactive'` field. Re-open if practitioners ask for the distinction.

---

## Open minor gaps

- **Stakeholder sign-off workflow** — depends on multi-user collaboration (#2).
- **Pattern library — sub-item C.** Sub-item A (reusable domain templates) shipped Session 134. Sub-item C (portfolio of improvement initiatives across multiple docs) gated by cross-diagram traceability (#3) + entity ownership/evidence (#6). Sub-item B (benchmarking / pattern recognition via embeddings) is dropped along with AI integration.

---

## Session 134 loose-end follow-ups

- **TPNode.tsx statement-coverage tooling quirk.** Coverage-v8 reports `TPNode.tsx` at 27% statements even after 13 new render tests landed in round 3. The tests pass — every entity-type branch (note / ude / injection / want), reach-badge branch, diff-status colour cue, selected/unselected ring, and pin-position render is exercised. But v8 doesn't credit `TPNodeImpl`'s body lines (141-561), most likely because of how React 19's `memo()` + the React Compiler's auto-memoization opt-out interact with the vitest 4 / coverage-v8 source-map step. Branch coverage moved 29% → 40% even though statement coverage shows stuck at 27%. Try again when the tooling matures (React Compiler stable + coverage-v8 update); current real coverage is meaningfully above what the report shows.

- ~~**PPTX export e2e Playwright spec.**~~ ✅ **Done (Session 134).** New `e2e/pptx-export.spec.ts` seeds a CRT with distinctive cause / effect titles + a distinctive doc title, opens the Export… picker via two new test hooks (`setDocTitle` + `openExportPicker`), clicks the **PowerPoint deck (.pptx)** card, catches the synthetic-anchor download via `page.waitForEvent('download')`, saves to the test-info output path, then unzips the `.pptx` (it's a ZIP of XML) via `jszip` and walks every `ppt/slides/slideN.xml`. Asserts the doc title + both endpoint titles appear in the concatenated slide text — covering both the cover slide and the reasoning slides. Bonus assertion on `docProps/app.xml` validates the pptxgenjs metadata-write pathway. Filename slug assertion catches the title → slug → suggested-filename pipeline. Runs on every push via the CI workflow's e2e job.

- **Manual a11y keyboard walkthrough.** Automated portion done Session 121 (axe scans on Help / About / Settings dialogs + Esc-close pins). The fully-manual portion — Tab cycle on the canvas, focus order inside each dialog, Esc cascade priority, authoring a small CRT keyboard-only, palette discoverability — is worth a periodic ~1-hour walkthrough by the author. Checklist:
  - Tab cycle on the canvas: every interactive element reachable without trapping?
  - Tab cycle inside each dialog: focus order matches reading order?
  - Esc cascade: closes the innermost surface first (palette → settings → help → selection)?
  - Author a small CRT keyboard-only: add 3 entities, connect them, edit titles, undo / redo, save. Does any step force a mouse?
  - Cmd+K palette: every action discoverable via search? Open palette, type "ude" / "core" / "snap" — is the right action surfaced?

---

## Suggested priority order

If picking the next thing up:

1. **#6 evidence array** (~1 session) — finishes the entity-ownership story started this session. Visible UI immediately.
2. **#3 cross-diagram traceability** (~2–3 sessions) — most foundational structural gap. Unlocks the portfolio-view pattern-library sub-item, NBR linking back to FRT, and the full TP chain.
3. **#7 task bridge** (~1–2 sessions) — mechanical export work. Start with TT → CSV; per-tracker formats follow.
4. **#9 formal mode-switching** (~1–2 sessions) — Guided / Expert / Workshop / Presentation modes.
5. **#4 confidence / state propagation** (~3 sessions) — adds the "what-if" behaviour the spec considers the FRT module's signature.

Collaboration (#2) and enterprise integration (#8) intentionally deprioritised — both are product-direction decisions rather than sprints.

---

## Out of scope — won't build

These come straight from the brief's explicit out-of-scope list, plus items closed during this project's history:

- Real-time multi-user collab (revisit if a hosted product direction lands)
- Cloud sync, accounts, auth (same)
- Project management, calendars, resources, MS Project export
- Bayesian / evidence-based propagation
- Course-of-action (COA) analysis features
- Mobile-first design (responsive down to 480 px is the practical floor)
- Print stylesheets (delivered minimally via `src/styles/print.css`; full one-page print designs not in scope)
- i18n (English only)
- **H5 confidence-weighted what-if** — depended on Bucket C (`Entity.confidence` + `Edge.weight`); Bucket C was excluded by user direction in Iteration 2 and schema-confidence was dropped in Session 71. With no signal to scale, H5 has nothing to compute on. Dann moved it to "won't build" in Session 84.
- **AI integration (spec §5)** — problem-to-tool router, UDE extraction from notes/transcripts, statement rewrite into TOC-compliant grammar, CLR objection generator, assumption extraction from cloud edges, injection brainstorming, negative-branch detection, obstacle/milestone suggestions, TT action decomposition, executive summary generator, workshop facilitation prompts. Explicitly dropped by Dann in Session 134. TP Studio stays deterministic and offline-first; analytical thinking is the practitioner's job, not the tool's. Re-open only if a product direction lands that genuinely needs it.
- **Entity grammar rewrite suggestions** — depended on AI integration above.
- **Coaching/router mode** ("messy problem → pick the right tool") — depended on AI integration above.
- **Pattern library sub-item B** (benchmarking / pattern recognition via embeddings) — depended on AI integration above.
- **FL-EX8 multi-document tabs** — explored on a preview branch Session 91; cancelled before merge. TP Studio stays single-document.
- **FL-CO2 cross-document hyperlinks** — depended on FL-EX8.
- **FL-IN5 tabs per element type** — sectioned inspector groups properties cleanly; tabs add a click without exposing more information.
- **FL-AN4 styled text in titles** — titles stay plain by design.

---

## Known environment quirks

These are specific to the Windows + corporate-AppLocker environment this was built on, but apply to anyone hitting the same constraints.

- **`pnpm dlx` is blocked** in the corporate environment used to scaffold this. `pnpm install` from a `package.json` works; one-off `pnpm dlx <pkg>` from the npm cache temp dir is denied by Group Policy / AppLocker.
- **PowerShell Constrained Language Mode** breaks `npm.ps1` — npm/pnpm commands must be invoked from Bash or via `.cmd` shims, not via PowerShell scripts.
- **`vite preview` blocked by AppLocker** on the local dev box — production-build smoke / perf-trace specs can't run locally; CI handles them via the manual `Perf trace` and `Update visual snapshots` workflows.
- **OneDrive sync + `node_modules`** is slow and occasionally lock-prone. The project lives at `C:\dev\tp-studio` for that reason.
- **`pnpm-workspace.yaml`** is autogenerated with anomalous content by pnpm 11 in some environments. If `pnpm add` silently fails to update `package.json`, check for and delete that file.
- **Lazy-loaded dependency chunks** that only pay their cost on demand: `html-to-image` (PNG / JPEG / SVG export), `dagre` + `@/domain/layout` (Session 81; `tests/build/dagreLazyLoadBoundary.test.ts` guards against accidental static imports), `jspdf` + `svg2pdf.js` + `html2canvas` peer (Session 80), `pptxgenjs` (Session 134), `PrintAppendix` (Session 105), `CommandPalette` (Session 88), `MarkdownPreview` + DOMPurify (Session 115).

---

## When picking this up next

1. **Pull the project state.** `cd C:\dev\tp-studio && git status` — should be clean. `pnpm install` (preinstall verifies Node `>=22.22.1` + pnpm `^10`). `pnpm dev` to start. `pnpm test` should report 1500+ tests passing.
2. **Open the durable docs** — [README.md](README.md) for architecture, [USER_GUIDE.md](USER_GUIDE.md) for the feature surface, [CHANGELOG.md](CHANGELOG.md) for the history, [SECURITY.md](SECURITY.md) for the threat model + Session 98 audit.
3. **Pick a candidate from above** — major gaps first if you want strategic moves; the loose-end follow-ups if you want quick closes.
4. **Build in vertical slices** — one demo-able feature per commit.

Domain-first remains the right discipline: anything new that the data model needs lands in `src/domain/` first, with tests, before any UI work.
