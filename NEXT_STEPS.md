# Next Steps

A focused parking lot of open work — fresh items only. Historical context lives in CHANGELOG.md.

---

## Open major gaps from the spec analysis

Source: `toc_tp_software_requirements.docx` (Session 134 review). After Sessions 134–135, **five of ten** original major gaps remain. **AI-integration (spec §5)** explicitly out of scope — see won't-build section. **Closed:** #1 NBR, #5 risk register, #6 entity ownership + evidence, #7 task bridge (universal CSV — per-tracker formats follow if requested), #10 PowerPoint export.

### 🔴 #3 — Cross-diagram traceability *(highest leverage of what's left)*

Spec §6.2. Each `TPDocument` is standalone JSON; no entity/edge references across documents. The full chain (UDE → CRT core driver → Cloud conflict → assumptions → injections → FRT desired effects/negative branches → PRT obstacles/milestones → TT actions/owners) must be reconstructed manually. Spec considers this critical: *"Without traceability, each diagram becomes a standalone artifact and the TOC logic chain breaks."*

**Path:** `importedFrom: { docId, entityId }` ref on Entity + per-doc-store cross-ref index + UI affordances for "jump to source". Phase 1 could ship just the schema field + JSON round-trip; UI can layer on top.

**Effort:** ~2–3 sessions. Highest-leverage structural gap. Unlocks the portfolio-view pattern-library sub-item and the full TP chain.

### 🔴 #9 — Formal mode-switching *(most bounded of what's left)*

Spec §7.1. Lists Guided / Expert / Workshop / Presentation modes. TP Studio has guided prompts (method checklist) and walkthrough overlays, but no explicit mode-state, no facilitator-vs-contributor view, no presentation mode beyond exports.

**Path:** Introduce `ui.appMode: 'expert' | 'guided' | 'workshop' | 'presentation'` in the UI slice (defaults to `'expert'`). Per-mode: surface/hide chrome density, toggle the method-checklist prominence, gate canvas zoom controls. Presentation mode hides every chrome element except the canvas + a step-through control.

**Effort:** ~1–2 sessions.

### 🔴 #4 — Confidence / propagation simulation

Spec §3.4. No `Entity.state` enum (`true / false / unknown / disputed`), no propagation through AND/OR logic, no "what changes if this assumption is false?" simulation. Spec lists this as the FRT module's signature behaviour.

**Effort:** Schema-light (entity state enum + propagation function); the trickier part is the "what-if" UX. ~3 sessions.

### 🔴 #2 — Multi-user collaboration *(product-direction decision, not a sprint)*

Spec §4. Single-user local-only. Missing: real-time editing, comments, role-based participation, workshop voting + timeboxing, stakeholder sign-off, decision log.

**Status:** Intentionally deprioritised. Changes TP Studio from local-first to cloud-backed. Revisit only if a hosted product direction lands.

### 🔴 #8 — Enterprise integration *(tied to #2)*

Spec §8. No SSO/SAML/OIDC, no Microsoft 365 / Google Workspace / Slack / Teams / Confluence / SharePoint / Jira / Azure DevOps. TP Studio is browser-local PWA. Re-open with #2.

---

## Open medium gaps

- **Action quality checks** (control / influence / authority for TT actions). New `tt-action-locus-set` validator that fires on action entities without a `spanOfControl` set. Method checklist hints at it ("Test against your locus") but no enforcement. ~1 hour.
- **Roll-up validation for S&T** — sufficiency of subordinate tactics to support the parent. New `st-tactic-rollup-sufficiency` validator. ~1 hour.
- **S&T assumption sub-typing** — `Assumption.kind: 'necessary' | 'parallel' | 'sufficient'`. Schema + UI for the discriminator. ~1 session.
- **"Preserve rejected logic in collapsed groups"** — currently partial via revision branches. No archive-of-rejected concept on the live canvas. Would mean a `Group.archived?: true` flag + a "show archived" toggle. ~1 session.
- **Reactive vs proactive NBR mitigation distinction** — current NBR (Session 134) infers mitigation status from injection-reachability. Spec wants a formal `mitigation.kind` field. Re-open only if practitioners ask.
- **Action eligibility based on satisfied preconditions** — gated by #4.
- **Audit trail / GDPR / data retention** — gated by #2/#8.

---

## Open minor gaps

- **Stakeholder sign-off workflow** — gated by #2.
- **Pattern library sub-item C** (portfolio-view across multiple docs) — gated by #3.

---

## Infrastructure debt / refactor

From the Session 135 "30 code-improvement suggestions" audit. Items #1 / #2 / #4 / #5 / #6 / #7 already shipped (button class constants, Select primitive, chip palette, EdgeAssumptions deprecation, TextArea ref, TPNode split). Remaining:

- **File splits (Tier 2, #8–#15):** TPEdge.tsx (600 lines), entitiesSlice.ts (576), entityTypeMeta.ts (506), selectionVerbs.ts (541), CreationWizardPanel.tsx (550), dialogsSlice.ts (471), PrintPreviewDialog.tsx (500), ContextMenu.tsx (495). Each ~30–60 min. Take them as cleanup gaps between feature work.
- **Replace `as unknown as X` test casts** with typed mock builders (~21 instances, mostly in `useGraphMutations.test.tsx`). Small `tests/helpers/reactFlowFixtures.ts`. ~1 hour.
- **Migrate remaining inline `<input>` JSX to `<TextInput>`** — `DocumentInspector.tsx:133,144`, `PrintPreviewDialog.tsx:451,472`, `CustomEntityClassesSection.tsx:154–187`. ~30 min.
- **Migrate remaining inline button-class callers** to `SELECTED_BUTTON_CLASS_PLAIN` family — `CustomEntityClassesSection.tsx:213` icon picker, `formPrimitives.tsx:51` RadioGroup. ~15 min.
- **Custom-equality narrowing for `MultiInspector` + `GroupInspector`** — both still subscribe to whole `s.doc.entities` / `s.doc.edges` maps. Wrap with `useDocumentStoreWith` + `arrayShallowEqualByKeys` (the pattern landed for `AttachedEdgesList`). ~45 min.
- **TPNode coverage beyond 48% statements** — S&T 5-facet rows, hidden-descendant chip, custom-class icon resolution, zoom-up overlay, NodeToolbar conditional. ~1 hour.

---

## Open polish + quality items

- **UI review by expert agent.** Hand a built doc + the current screenshots to a design-focused subagent and ask for a top-N punch list across visual hierarchy, density, contrast, affordance clarity, and motion. The codebase has grown a lot of inspector surface, dialog chrome, and overlay layers; an outside pass is overdue. The `design:design-critique` skill (newly available) is the right vehicle.
- **Manual a11y keyboard walkthrough.** Automated portion done Session 121 (axe scans on Help / About / Settings dialogs + Esc-close pins). The fully-manual portion — Tab cycle on the canvas, focus order inside each dialog, Esc cascade priority, authoring a small CRT keyboard-only, palette discoverability — is worth a periodic ~1-hour walkthrough by the author.
  - Tab cycle on the canvas: every interactive element reachable without trapping?
  - Tab cycle inside each dialog: focus order matches reading order?
  - Esc cascade: closes the innermost surface first (palette → settings → help → selection)?
  - Author a small CRT keyboard-only: add 3 entities, connect them, edit titles, undo / redo, save. Does any step force a mouse?
  - Cmd+K palette: every action discoverable via search? Open palette, type "ude" / "core" / "snap" — is the right action surfaced?
- **PDF/UA tagged-PDF accessibility.** Open PDF item from Session 135 polish — `/MarkInfo` + `/StructTreeRoot` for screen-reader navigation. Requires a different toolchain (Pandoc-LaTeX). Lower priority now that EPUB ships for accessible reading.
- **Verify book on a real Kindle device.** EPUB build pipeline shipped Session 135; the round-trip "email → Kindle imports → reads natively" still needs author verification on actual hardware.

---

## Suggested priority order

If picking the next thing up:

1. **#9 formal mode-switching** (~1–2 sessions) — most bounded remaining spec gap. Guided / Expert / Workshop / Presentation modes. Phase 1: introduce `ui.appMode` + chrome-density toggles. Phase 2: presentation mode.
2. **#3 cross-diagram traceability** (~2–3 sessions) — highest leverage, larger unit. Unlocks portfolio-view pattern-library and the full TP chain.
3. **#4 confidence / state propagation** (~3 sessions) — FRT signature behaviour per spec.
4. **Medium gaps as filler** — single-session validator additions (action-locus, S&T roll-up). Good "between bigger units" work.
5. **Infrastructure debt** — file splits + inline-input migration as cleanup-between-features.

#2 collab and #8 enterprise stay deprioritised — both are product-direction decisions, not sprints.

---

## Out of scope — won't build

Items explicitly dropped, in addition to the brief's own out-of-scope list:

- Real-time multi-user collab; cloud sync, accounts, auth (revisit with #2 product decision)
- Project management, calendars, resources, MS Project export
- Bayesian / evidence-based propagation
- Course-of-action (COA) analysis features
- Mobile-first design (responsive down to 480 px is the practical floor)
- Print stylesheets (delivered minimally via `src/styles/print.css`; full one-page print designs not in scope)
- i18n (English only)
- **H5 confidence-weighted what-if** — depended on `Entity.confidence` + `Edge.weight` (Bucket C), dropped Session 71. Moved to won't-build Session 84.
- **AI integration (spec §5)** — problem-to-tool router, UDE extraction, statement rewrites, CLR objection generation, assumption extraction, injection brainstorming, NBR detection, obstacle/milestone suggestions, TT action decomposition, executive summary, workshop facilitation prompts. Explicitly dropped Session 134. TP Studio stays deterministic and offline-first. Re-open only if a product direction genuinely needs it.
- **Entity grammar rewrite suggestions**, **Coaching/router mode**, **Pattern library sub-item B** (embeddings-based pattern recognition) — all depended on AI integration above.
- **FL-EX8 multi-document tabs** — explored Session 91, cancelled. Single-document by design.
- **FL-CO2 cross-document hyperlinks** — depended on FL-EX8.
- **FL-IN5 tabs per element type** — sectioned inspector groups properties cleanly; tabs add a click without exposing more information.
- **FL-AN4 styled text in titles** — titles stay plain by design.

---

## Known environment quirks

Specific to the Windows + corporate-AppLocker environment this was built on. Applies to anyone hitting the same constraints.

- **`pnpm dlx` is blocked** by Group Policy / AppLocker in the corporate environment. `pnpm install` from `package.json` works; one-off `pnpm dlx <pkg>` from the npm cache temp dir is denied.
- **PowerShell Constrained Language Mode** breaks `npm.ps1`. Invoke npm/pnpm from Bash, via `.cmd` shims, or directly through `node corepack/dist/pnpm.js …`.
- **`vite preview` blocked by AppLocker** on the local dev box — production-build smoke / perf-trace specs can't run locally; CI handles them via the manual `Perf trace` and `Update visual snapshots` workflows.
- **OneDrive sync + `node_modules`** is slow and occasionally lock-prone. Project lives at `C:\dev\tp-studio` for that reason.
- **`pnpm-workspace.yaml`** is autogenerated with anomalous content by pnpm 11 in some environments. If `pnpm add` silently fails to update `package.json`, check for and delete that file.
- **Lazy-loaded dependency chunks** (only pay their cost on demand): `html-to-image` (PNG / JPEG / SVG export), `dagre` + `@/domain/layout` (Session 81; `tests/build/dagreLazyLoadBoundary.test.ts` guards against accidental static imports), `jspdf` + `svg2pdf.js` + `html2canvas` peer (Session 80), `pptxgenjs` (Session 134), `PrintAppendix` (Session 105), `CommandPalette` (Session 88), `MarkdownPreview` + DOMPurify (Session 115).

---

## When picking this up next

1. **Pull the project state.** `cd C:\dev\tp-studio && git status` — should be clean. `pnpm install` (preinstall verifies Node `>=22.22.1` + pnpm `^10`). `pnpm dev` to start. `pnpm test` should report 1500+ tests passing.
2. **Open the durable docs** — [README.md](README.md) for architecture, [USER_GUIDE.md](USER_GUIDE.md) for the feature surface, [CHANGELOG.md](CHANGELOG.md) for the history, [SECURITY.md](SECURITY.md) for the threat model + Session 98 audit.
3. **Pick a candidate from above** — major gaps first if you want strategic moves, medium gaps for single-session wins, infrastructure debt for "cleanup between features", polish + quality for the things that pay back across every future iteration.
4. **Build in vertical slices** — one demo-able feature per commit.

Domain-first remains the right discipline: anything new that the data model needs lands in `src/domain/` first, with tests, before any UI work.
