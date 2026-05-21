# Next Steps

A focused parking lot of open work — fresh items only. Historical context lives in CHANGELOG.md.

---

## Open major gaps from the spec analysis

Source: `toc_tp_software_requirements.docx` (Session 134 review). After Sessions 134–135, **four of ten** original major gaps remain. **AI-integration (spec §5)** explicitly out of scope — see won't-build section. **Closed:** #1 NBR, #5 risk register, #6 entity ownership + evidence, #7 task bridge (universal CSV — per-tracker formats follow if requested), #9 formal mode-switching, #10 PowerPoint export.

### 🔴 #3 — Cross-diagram traceability *(Phase 1A done Session 135 — UI layers next)*

Spec §6.2. **Phase 1A shipped:** `ImportedFromRef` type + `entity.importedFrom?: ImportedFromRef` field with strict persistence validation. The schema carries `docId`, `entityId`, optional `sourceTitle` snapshot, optional `importedAt` ISO timestamp. Persisted across JSON export + share-link reload. 2 new tests cover the round-trip + malformed-ref rejection.

**Phase 1B (next):** UI affordances.
- "Imported from <doc> → <entity>" badge on the entity inspector (clickable; opens the source doc if it's in localStorage, otherwise toasts "source doc not available").
- New "Import from another doc…" command in the palette (open a doc-picker → entity-picker → mint a new entity in the current doc with `importedFrom` set + `title` copied from the source).
- Filter / search on `importedFrom`-bearing entities so a user can audit "what came from where" across a portfolio.

**Phase 1C (later):** cross-doc store + auto-resolution.
- A separate `documentsSlice` that holds open docs by id with their `TPDocument` payload.
- "Jump to source" affordance that opens the source doc in a new tab / pane (depends on FL-EX8 multi-doc tabs — currently out of scope per the won't-build list).
- Reverse-lookup index so an entity can also surface "imported INTO" pointers (who's referenced this entity from elsewhere?).

**Effort remaining:** Phase 1B ~1 session; Phase 1C ~2 sessions (and gated on multi-doc).

### ~~🔴 #9 — Formal mode-switching~~ — *done Session 135*

Spec §7.1. **Closed Session 135 across Phases 1A / 1B / 1C.** All four modes have visible, distinct behaviour:

- **Expert** (default) — every affordance, no overrides.
- **Guided** — creation wizards force-shown on `newDocument` regardless of the dismissed-by-default suppress flags (`showGoalTreeWizard` / `showECWizard`).
- **Workshop** — `.app-mode-workshop` body class bumps `--text-node` 15px → 18px + line-height 1.4 for projected-canvas readability.
- **Presentation** — `App.tsx` + `Canvas.tsx` hide `TitleBadge` / `TopBar` / `SelectionToolbar` / `Inspector` / `CanvasNav`; `setAppMode('presentation')` auto-engages Browse Lock; new `PresentationStepThrough` overlay (bottom-centre chip with Prev/Next + position label; arrow-key bindings) walks entities by ordering then annotation, `fitView`-focuses on each step.

State + palette commands persist across reloads via `StoredPrefs.appMode`. 12 tests cover state, persistence, command registry, Browse Lock auto-engage, wizard force-show.

**Deferred extras** (re-open if a concrete use-case lands):
- Workshop session timer — UX choices too open-ended without a facilitator use-case
- Workshop auto-engage high-contrast edge palette — stateful restore on leave adds complexity
- Guided method-checklist auto-open — heavy modal on every new doc is intrusive

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

- ~~**Action quality checks** (control / influence / authority for TT actions).~~ ✅ Done Session 135 — `tt-action-locus-unset` validator wired into the TT diagram registry. Fires on action entities without `spanOfControl` set; tier `clarity`. 9 tests cover positive + every non-firing case.
- ~~**Roll-up validation for S&T**~~ ✅ Done Session 135 — `st-tactic-rollup` validator wired into the S&T diagram registry. Fires on non-apex `injection` tactics that lack child tactics; tier `sufficiency`. 8 tests cover the apex / intermediate / leaf shapes.
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

From the Session 135 "30 code-improvement suggestions" audit. Items #1 / #2 / #4 / #5 / #6 / #7 already shipped (button class constants, Select primitive, chip palette, EdgeAssumptions deprecation, TextArea ref, TPNode split). **Plus the infra-debt batch (Session 135):** custom-equality narrowing for `MultiInspector` + `GroupInspector`, `DocumentInspector` inline-input migration, `RadioGroup` button-class migration, `reactFlowFixtures.ts` typed builders + biggest-test-cast-cleanup file migration. Remaining:

- **File splits (Tier 2, #8–#15):** TPEdge.tsx (600 lines, tightly-coupled JSX — forced split low value), entitiesSlice.ts (576, clean section boundaries — natural unit), entityTypeMeta.ts (506), selectionVerbs.ts (541), CreationWizardPanel.tsx (550), dialogsSlice.ts (471), PrintPreviewDialog.tsx (500), ContextMenu.tsx (495). Each ~30–60 min. Take them as cleanup gaps between feature work; `entitiesSlice.ts` is the highest-value first pick (clean assumption / attribute / evidence sections → composable StateCreator pattern).
- **Continue `as unknown as X` test-cast cleanup.** `useGraphMutations.test.tsx` migrated to `reactFlowFixtures.ts` builders (15 casts → 0). Other 9 files have 1-3 casts each — mechanical follow-up, extend `reactFlowFixtures.ts` for additional shapes as needed. ~30 min total.
- **Remaining inline `<input>` migrations.** `PrintPreviewDialog.tsx:451,472` and `CustomEntityClassesSection.tsx:154–187` deliberately kept inline this session — they're intentionally smaller (`text-xs py-1`) for dense-dialog packing. Adopting `<TextInput>` would shift visual size unless `formPrimitives.tsx` grows a `size: 'sm' | 'md'` prop. Combined ~45 min.
- **Icon-picker button-class migration** in `CustomEntityClassesSection.tsx:213`. The current shade (`text-indigo-700` for icon currentColor) intentionally differs from `SELECTED_BUTTON_CLASS`'s `text-indigo-900` (text). Adopt either by adding a third sister constant or accept the visual shift. ~15 min.
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

1. **#3 cross-diagram traceability** (~2–3 sessions) — now the largest open spec gap. Highest leverage. Unlocks portfolio-view pattern-library and the full TP chain.
2. **#4 confidence / state propagation** (~3 sessions) — FRT signature behaviour per spec.
3. **Medium gaps as filler** — single-session validator additions (action-locus, S&T roll-up). Good "between bigger units" work.
4. **Infrastructure debt** — file splits + inline-input migration as cleanup-between-features.

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
