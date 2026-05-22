# Next Steps

A focused parking lot of open work — fresh items only. Historical context lives in CHANGELOG.md.

---

## Open major gaps from the spec analysis

Source: `toc_tp_software_requirements.docx` (Session 134 review). After Sessions 134–135, **one of ten** original major gaps remains open (#4 confidence / propagation Phase 1C). **Out of scope** per Dann's call (Session 135): #2 multi-user collab, #8 enterprise integration, plus AI integration (spec §5) — see won't-build section. **Closed:** #1 NBR, #3 cross-diagram traceability, #5 risk register, #6 entity ownership + evidence, #7 task bridge (universal CSV — per-tracker formats follow if requested), #9 formal mode-switching, #10 PowerPoint export.

### ~~🔴 #3 — Cross-diagram traceability~~ — *done Session 135*

Spec §6.2. **Closed Session 135 across Phases 1A + 1B.** The schema (`ImportedFromRef` type + `entity.importedFrom?` field with strict persistence validation) ships alongside the UI flow:

- **Palette command** `Import entity from another doc…` (Cmd+K) — opens a file picker, parses the source TP Studio JSON, hands the entity picker the parsed doc.
- **Entity-picker dialog** — filterable list of causally-meaningful entities in the source doc, per-entity cards with type chip / annotation number / title / description. Click → mint copy.
- **`addImportedEntity` store action** — mints a fresh entity in the current doc with `type`/`title`/`description` copied + `importedFrom` set + ISO timestamp captured at mint time.
- **Inspector badge** — "Imported from <sourceTitle> · doc <id> · imported <date>" indigo-tinted card on entities with `importedFrom` set.

9 new tests across persistence round-trip (`tests/domain/persistenceRoundTrip.test.ts`) + store action (`tests/store/importEntity.test.ts`).

**Phase 1C left as future-iteration parking lot:** cross-doc store + reverse-lookup + jump-to-source. Gated on multi-doc tabs (currently out of scope per the won't-build list). Re-open when a concrete portfolio-view use case lands.

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

### 🟡 #4 — Confidence / propagation simulation *(Phase 1A + 1B done, Phase 1C open)*

Spec §3.4. The FRT module's signature behaviour: every entity carries a state value, propagation flows through AND/OR/XOR logic on edges, and the user can ask "what changes if this assumption is false?" without committing the change.

**Phase 1A — schema (done Session 135).** `EntityState = 'true' | 'false' | 'unknown' | 'disputed'` + `entity.state?: EntityState` + strict persistence validation (unknown values throw on import, emit-or-omit on export).

**Phase 1B — engine + inspector (done Session 135).** Pure `propagateStates(doc): Record<EntityId, EntityState>` with full edge-weight (`'negative'` flips, `'zero'` skips), junctor (AND / OR / XOR), and cycle handling. `effectiveState(entity, derived)` is the canonical merge helper. Inspector exposes a 4-button state picker + a propagation caption that turns amber on conflict. 41 new tests.

**Phase 1B follow-up (~30 min):**
- **Node-chrome state badge.** A small chip on TPNode showing the effective state (manual ?? derived) at a glance, so review meetings don't have to open the inspector to read state. Likely sits in the top-right of TPNode next to the annotation number, colour-coded (green=true, red=false, amber=disputed, neutral=unknown). Defer until TPNode's pending visual review (see Open polish + quality) so the visual hierarchy stays coherent.

**Phase 1C — what-if UX (open).** A "speculate" mode: user clicks an entity, picks a hypothetical state, and the canvas shows the downstream cascade without persisting. Likely a Zustand-side `speculationOverlay: Map<EntityId, EntityState>` that runs through the same `propagateStates` engine with manual values overlaid, plus a banner offering "commit" / "revert". Spec language: "what changes if this assumption is false?"

The engine + `effectiveState` merge helper was designed for 1C: the speculation overlay reads as "a layer of manual overrides", and the engine's pure-function shape means propagation under the overlay is a single recomputation.

**Effort remaining:** Phase 1C ~1–2 sessions.

---

## Open medium gaps

- ~~**Action quality checks** (control / influence / authority for TT actions).~~ ✅ Done Session 135 — `tt-action-locus-unset` validator wired into the TT diagram registry. Fires on action entities without `spanOfControl` set; tier `clarity`. 9 tests cover positive + every non-firing case.
- ~~**Roll-up validation for S&T**~~ ✅ Done Session 135 — `st-tactic-rollup` validator wired into the S&T diagram registry. Fires on non-apex `injection` tactics that lack child tactics; tier `sufficiency`. 8 tests cover the apex / intermediate / leaf shapes.
- ~~**S&T assumption sub-typing**~~ ✅ Done Session 135 — `AssumptionKind = 'necessary' | 'parallel' | 'sufficient'` + optional `Assumption.kind` field + strict persistence + `setAssumptionKind` action + a cycling kind chip in AssumptionWell (—/N/P/S). 9 tests.
- **"Preserve rejected logic in collapsed groups"** — currently partial via revision branches. No archive-of-rejected concept on the live canvas. Would mean a `Group.archived?: true` flag + a "show archived" toggle. ~1 session.
- **Reactive vs proactive NBR mitigation distinction** — current NBR (Session 134) infers mitigation status from injection-reachability. Spec wants a formal `mitigation.kind` field. Re-open only if practitioners ask.
- **Action eligibility based on satisfied preconditions** — gated by #4 (Phase 1B engine unblocked it; Phase 1C lands the speculation surface this would build on).

---

## Infrastructure debt / refactor

From the Session 135 "30 code-improvement suggestions" audit. Items #1 / #2 / #4 / #5 / #6 / #7 already shipped (button class constants, Select primitive, chip palette, EdgeAssumptions deprecation, TextArea ref, TPNode split). **Plus the infra-debt batch (Session 135):** custom-equality narrowing for `MultiInspector` + `GroupInspector`, `DocumentInspector` inline-input migration, `RadioGroup` button-class migration, `reactFlowFixtures.ts` typed builders + biggest-test-cast-cleanup file migration. Remaining:

- **File splits (Tier 2):** remaining sprawl — TPEdge.tsx (600 lines, tightly-coupled JSX — forced split low value), entityTypeMeta.ts (506), selectionVerbs.ts (541), CreationWizardPanel.tsx (550), dialogsSlice.ts (471), PrintPreviewDialog.tsx (500), ContextMenu.tsx (495). Each ~30–60 min. Take them as cleanup gaps between feature work. ~~entitiesSlice.ts~~ ✅ split Session 135 (621 → 40-line composer + 4 factories under `entities/`).
- ~~**`as unknown as X` test-cast cleanup**~~ ✅ Done Session 135 — `useGraphMutations.test.tsx` (15 casts) plus 5 more across `equality` / `TPNode` / `useGraphPositions` / `pwaInstall` / `dragSplice` migrated to `reactFlowFixtures.ts` builders or single-casts. The remaining casts are legitimate (corrupt-input equality tests, browser-native event mocks) and documented as keep.
- ~~**Inline `<input>` migrations**~~ ✅ Done Session 135 — added `size: 'sm' | 'md'` to `TextInput`; migrated PrintPreviewDialog header/footer + CustomEntityClassesSection text inputs. The `type="color"` input stays inline (TextInput doesn't support that type — legitimate exception).
- ~~**Icon-picker button-class migration**~~ ✅ Done Session 135 — moved the bespoke icon-button palette into `SELECTED_BUTTON_CLASS_ICON` / `UNSELECTED_BUTTON_CLASS_ICON` sister constants in `buttonClasses.ts` (lighter `text-indigo-700` reads better at Lucide glyph size).
- ~~**TPNode coverage beyond 48% statements**~~ ✅ Done Session 135 — added 7 tests for S&T 5-facet rows (full + partial fill + non-injection guard), hidden-descendant chip (count + zero-omit), and custom-class slug resolution (in-map + fallback). Zoom-up NodeToolbar branch documented as not jsdom-testable (NodeToolbar with `isVisible={false}` renders no children).

---

## Open polish + quality items

- **UI review by expert agent** — *audit done Session 135; fixes not yet actioned.* A code-level design pass over every inspector / dialog / overlay / shared primitive produced [docs/DESIGN_AUDIT_SESSION_135.md](DESIGN_AUDIT_SESSION_135.md) — 25 ranked findings. Highest-impact: `<Field>` renders an unlinked `<span>` instead of `<label htmlFor>` (accessible-name gap across ~30 controls); three "uppercase eyebrow" label sizes for one role; toggle-button padding drift across 4+ pickers (begs a `<ButtonGroup>`); six "tinted inset card" recipes (begs an `<InsetCard tone>`). The doc closes with a 3-batch action ordering. Pick up a batch as cleanup-between-features.
- **Manual a11y keyboard walkthrough** — *checklist ready; needs Dann's hands.* Automated portion done Session 121 (axe scans on Help / About / Settings dialogs + Esc-close pins). The fully-manual portion can't be scripted — a printable ~1-hour checklist lives at [docs/MANUAL_A11Y_WALKTHROUGH.md](MANUAL_A11Y_WALKTHROUGH.md): canvas Tab reachability, per-dialog focus order, Esc cascade priority, keyboard-only CRT authoring, palette discoverability, optional screen-reader spot-check. Two known candidates baked in from the design audit: unlabeled inspector fields (`<Field>` gap) and whether edge-connect has any non-mouse path. Run it, log results in the doc.
- **PDF/UA tagged-PDF accessibility** — *investigated Session 135; recommendation: defer.* See [docs/PDF_UA_INVESTIGATION_SESSION_135.md](PDF_UA_INVESTIGATION_SESSION_135.md). The Chromium `page.pdf()` + pdf-lib pipeline **cannot** emit `/StructTreeRoot` (Skia has no tagging backend; pdf-lib has no tagging API) — tagging requires swapping the HTML→PDF renderer, a 1–2 session migration that throws away the current pixel-accurate screenshot placement + book CSS. EPUB already covers accessible reading. If pursued: **Typst** (single binary, tagging maturing fastest), added as a separate `book:pdf-tagged` target — *not* the Pandoc-LaTeX route originally guessed (LaTeX tagging is still experimental + multi-GB install). We already emit `/Lang` + navigable outlines + full metadata.
- **Verify book on a real Kindle device** — *steps ready; needs Dann's hardware.* EPUB build pipeline shipped Session 135; the round-trip "email → Kindle imports → reads natively" can't be done by Claude. Send-to-Kindle steps + a device-verification checklist live at [docs/KINDLE_VERIFICATION.md](KINDLE_VERIFICATION.md). The `.epub` artifact (~707 KB) is committed at `docs/guide/Causal-Thinking-with-TP-Studio.epub`.

---

## Suggested priority order

If picking the next thing up:

1. **#4 confidence / state propagation Phase 1C** (~1–2 sessions) — what-if speculation overlay. Phase 1A schema + Phase 1B engine + inspector landed Session 135. Next slice is a `speculationOverlay` store slice + canvas-wide preview + commit/revert banner.
2. **Medium gaps as filler** — S&T assumption sub-typing (`Assumption.kind`), "preserve rejected logic in collapsed groups", reactive-vs-proactive NBR mitigation, action eligibility on satisfied preconditions (rides on Phase 1C). Each ~1 hour.
3. **Design-audit fixes** — the [Session 135 design audit](DESIGN_AUDIT_SESSION_135.md) has a 3-batch action ordering (the `<Field>` label gap is the highest-impact a11y fix). Good cleanup-between-features work.
4. **Remaining file splits** — TPEdge / entityTypeMeta / selectionVerbs / CreationWizardPanel / dialogsSlice / PrintPreviewDialog / ContextMenu. Mechanical, low-risk.

---

## Out of scope — won't build

Items explicitly dropped, in addition to the brief's own out-of-scope list:

- **#2 Multi-user collaboration (spec §4)** — out of scope for this version (Dann, Session 135). Real-time editing, comments, role-based participation, workshop voting + timeboxing, stakeholder sign-off, decision log. Would flip TP Studio from local-first to cloud-backed. Not a permanent "never" — parked until a hosted product direction is on the table; revisit then.
- **#8 Enterprise integration (spec §8)** — dropped Session 135 (tied to #2). SSO/SAML/OIDC, M365 / Google Workspace / Slack / Teams / Confluence / SharePoint / Jira / Azure DevOps. TP Studio is a browser-local PWA.
- **Audit trail / GDPR / data retention** — dropped Session 135 (depended on #2/#8 server-side identity model). No backend, no audit trail; persistence is local-storage + user-managed export files.
- **Stakeholder sign-off workflow** — dropped Session 135 (depended on #2 multi-user model).
- **Pattern library sub-item C — portfolio-view across multiple docs** — dropped Session 135 (depended on FL-EX8 multi-document tabs, which is already won't-build).
- Cloud sync, accounts, auth (covered by #2 above)
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
