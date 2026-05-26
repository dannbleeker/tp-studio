# Next Steps

A focused parking lot of open work — fresh items only. Historical context lives in CHANGELOG.md.

---

## Open major gaps from the spec analysis

Source: `toc_tp_software_requirements.docx` (Session 134 review). After Sessions 134–135, **zero of ten** original major gaps remain open — every one is closed or explicitly out of scope. **Out of scope** per Dann's call (Session 135): #2 multi-user collab, #8 enterprise integration, plus AI integration (spec §5) — see won't-build section. **Closed:** #1 NBR, #3 cross-diagram traceability, **#4 confidence / propagation (Phases 1A + 1B + 1C)**, #5 risk register, #6 entity ownership + evidence, #7 task bridge (universal CSV — per-tracker formats follow if requested), #9 formal mode-switching, #10 PowerPoint export.

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

### ~~🔴 #4 — Confidence / propagation simulation~~ — *done Session 135 (Phases 1A + 1B + 1C)*

Spec §3.4 — the FRT module's signature behaviour. **Fully closed.**

- **Phase 1A — schema.** `EntityState = 'true' | 'false' | 'unknown' | 'disputed'` + `entity.state?` + strict persistence.
- **Phase 1B — engine + inspector.** Pure `propagateStates(doc)` with edge-weight (`'negative'` flips, `'zero'` skips), junctors (AND / OR / XOR), cycle handling; `effectiveState` merge helper; inspector 4-button picker + conflict caption.
- **Phase 1C — what-if speculation.** `propagateStates(doc, overrides?)` overlay-aware engine + UI-only `speculationSlice` (begin / set / clear / revert / commit; commit is one undo step via bulk `setEntityStates`). Canvas state badges (the deferred 1B node chip — green T / red F / amber ?, dashed ring when speculative), `SpeculationBanner` (Commit / Revert / Esc), inspector picker speculation mode, 3 palette commands. +28 tests.

---

## Open medium gaps

- ~~**Action quality checks** (control / influence / authority for TT actions).~~ ✅ Done Session 135 — `tt-action-locus-unset` validator wired into the TT diagram registry. Fires on action entities without `spanOfControl` set; tier `clarity`. 9 tests cover positive + every non-firing case.
- ~~**Roll-up validation for S&T**~~ ✅ Done Session 135 — `st-tactic-rollup` validator wired into the S&T diagram registry. Fires on non-apex `injection` tactics that lack child tactics; tier `sufficiency`. 8 tests cover the apex / intermediate / leaf shapes.
- ~~**S&T assumption sub-typing**~~ ✅ Done Session 135 — `AssumptionKind = 'necessary' | 'parallel' | 'sufficient'` + optional `Assumption.kind` field + strict persistence + `setAssumptionKind` action + a cycling kind chip in AssumptionWell (—/N/P/S). 9 tests.
- ~~**"Preserve rejected logic in collapsed groups"**~~ ✅ Done Session 135 — `Group.archived?` flag + `showArchivedGroups` pref + projection hides archived groups & members unless revealed. GroupInspector Archive/Unarchive button (auto-reveals on archive) + 2 palette commands + dimmed canvas treatment. 8 tests.
- **Reactive vs proactive NBR mitigation distinction** — current NBR (Session 134) infers mitigation status from injection-reachability. Spec wants a formal `mitigation.kind` field. Re-open only if practitioners ask.
- ~~**Action eligibility based on satisfied preconditions**~~ ✅ Done Session 135 — `actionEligibility(doc, derived, actionId, overrides?)` folds a TT Action's preconditions' effective states into eligible / blocked / pending / na; surfaced as an inspector "Eligibility" readout (emerald / rose / amber, via `<InsetCard>`). Overlay-aware (speculation re-derives it). 10 tests.

---

## Infrastructure debt / refactor

From the Session 135 "30 code-improvement suggestions" audit. Items #1 / #2 / #4 / #5 / #6 / #7 already shipped (button class constants, Select primitive, chip palette, EdgeAssumptions deprecation, TextArea ref, TPNode split). **Plus the infra-debt batch (Session 135):** custom-equality narrowing for `MultiInspector` + `GroupInspector`, `DocumentInspector` inline-input migration, `RadioGroup` button-class migration, `reactFlowFixtures.ts` typed builders + biggest-test-cast-cleanup file migration. Remaining:

- ~~**File splits (Tier 2)**~~ ✅ Done Session 135 — all seven split: `entitiesSlice` (621→40 + 4 factories), `entityTypeMeta` (→ meta / icons / palettes), `selectionVerbs` (→ single-entity builder), `dialogsSlice` (→ toasts + confirm sibling slices), `ContextMenu` (→ list renderer + verb helpers), `PrintPreviewDialog` (→ mode thumbnails), `CreationWizardPanel` (→ `useDraggablePanel` hook), `TPEdge` (→ `TPEdgeBadges`). Each landed as its own commit; tsc + biome + per-file tests green throughout. TPEdge's path-geometry/store-read body stays inline (the documented "tightly-coupled" core); only the self-contained badge JSX extracted.
- ~~**`as unknown as X` test-cast cleanup**~~ ✅ Done Session 135 — `useGraphMutations.test.tsx` (15 casts) plus 5 more across `equality` / `TPNode` / `useGraphPositions` / `pwaInstall` / `dragSplice` migrated to `reactFlowFixtures.ts` builders or single-casts. The remaining casts are legitimate (corrupt-input equality tests, browser-native event mocks) and documented as keep.
- ~~**Inline `<input>` migrations**~~ ✅ Done Session 135 — added `size: 'sm' | 'md'` to `TextInput`; migrated PrintPreviewDialog header/footer + CustomEntityClassesSection text inputs. The `type="color"` input stays inline (TextInput doesn't support that type — legitimate exception).
- ~~**Icon-picker button-class migration**~~ ✅ Done Session 135 — moved the bespoke icon-button palette into `SELECTED_BUTTON_CLASS_ICON` / `UNSELECTED_BUTTON_CLASS_ICON` sister constants in `buttonClasses.ts` (lighter `text-indigo-700` reads better at Lucide glyph size).
- ~~**TPNode coverage beyond 48% statements**~~ ✅ Done Session 135 — added 7 tests for S&T 5-facet rows (full + partial fill + non-injection guard), hidden-descendant chip (count + zero-omit), and custom-class slug resolution (in-map + fallback). Zoom-up NodeToolbar branch documented as not jsdom-testable (NodeToolbar with `isVisible={false}` renders no children).

---

## Open polish + quality items

- ~~**UI review by expert agent**~~ ✅ *Fully actioned Session 135.* The code-level design pass [docs/DESIGN_AUDIT_SESSION_135.md](DESIGN_AUDIT_SESSION_135.md) produced 25 findings — **all 25 done**: batch 1 (1–3) Field label/fieldset semantics + `EYEBROW` token + inspector `<h2>` header; batch 2 (4, 5, 17, 11) `TOGGLE_BUTTON_BASE` + `<ButtonGroup>` + `<TabBar>` + colour-pair fixes; batch 3 (10, 16) `<InsetCard tone>` + frosted-glass opacity; incremental sweep (6, 8, 13, 14, 15, 18, 20–25); and #19 — `LargeDialog` now opens as a true modal via `showModal()` (native focus trap + page-behind inert-ness, feature-detected `el.open` fallback for jsdom; `useFocusTrap` dropped). Net new primitives: `ButtonGroup`, `TabBar`, `InsetCard`; tokens: `EYEBROW`, `TOGGLE_BUTTON_BASE`; plus `Button size:'xs'`, `Select size`, `Field as="group"`.
- **Manual a11y keyboard walkthrough** — *checklist ready; needs Dann's hands.* Automated portion done Session 121 (axe scans on Help / About / Settings dialogs + Esc-close pins). The fully-manual portion can't be scripted — a printable ~1-hour checklist lives at [docs/MANUAL_A11Y_WALKTHROUGH.md](MANUAL_A11Y_WALKTHROUGH.md): canvas Tab reachability, per-dialog focus order, Esc cascade priority, keyboard-only CRT authoring, palette discoverability, optional screen-reader spot-check. Two known candidates baked in from the design audit: unlabeled inspector fields (`<Field>` gap) and whether edge-connect has any non-mouse path. Run it, log results in the doc.
- **PDF/UA tagged-PDF accessibility** — *investigated Session 135; recommendation: defer.* See [docs/PDF_UA_INVESTIGATION_SESSION_135.md](PDF_UA_INVESTIGATION_SESSION_135.md). The Chromium `page.pdf()` + pdf-lib pipeline **cannot** emit `/StructTreeRoot` (Skia has no tagging backend; pdf-lib has no tagging API) — tagging requires swapping the HTML→PDF renderer, a 1–2 session migration that throws away the current pixel-accurate screenshot placement + book CSS. EPUB already covers accessible reading. If pursued: **Typst** (single binary, tagging maturing fastest), added as a separate `book:pdf-tagged` target — *not* the Pandoc-LaTeX route originally guessed (LaTeX tagging is still experimental + multi-GB install). We already emit `/Lang` + navigable outlines + full metadata.
- **Verify book on a real Kindle device** — *steps ready; needs Dann's hardware.* EPUB build pipeline shipped Session 135; the round-trip "email → Kindle imports → reads natively" can't be done by Claude. Send-to-Kindle steps + a device-verification checklist live at [docs/KINDLE_VERIFICATION.md](KINDLE_VERIFICATION.md). The `.epub` artifact (~707 KB) is committed at `docs/guide/Causal-Thinking-with-TP-Studio.epub`.

---

## Suggested priority order

If picking the next thing up:

**All ten original spec major gaps are closed or out of scope; the design audit + infra-debt file splits + the actionable medium gaps are all done.** What's left:

1. **Reactive-vs-proactive NBR mitigation** — the one remaining medium gap; policy-parked, re-open only if practitioners ask.
2. **Hardware/hands-dependent handoffs** — manual a11y keyboard walkthrough ([checklist](docs/MANUAL_A11Y_WALKTHROUGH.md)) + Kindle device verification ([steps](docs/KINDLE_VERIFICATION.md)). Both need Dann.

## Session 136 usage feedback — bigger items parked for their own session

From Dann's "how it feels in real use" pass (Session 136). Trivial copy/defaults landed inline; the items below need their own design + research time:

- **Render-engine layout pass (top priority)** — when a map changes, the canvas should auto-reflow so every edge is visible (no edges hidden behind nodes), and entities should pull closer together when there's slack. Today's auto-layout only fires on explicit re-layout; live edits leave the diagram visually noisy. Needs a write-up: which layout algorithm (dagre / ELK / custom force-directed), what invalidates the layout (every edit vs. debounced vs. user-triggered), how user-placed positions interact with the auto-pass, perf budget. Pair with the AND-connector routing fix below.
- **AND connector rendering + drag-drop creation** — the AND-junctor visual today renders edges at fixed offsets, which looks chaotic on dense graphs. Spec: edges feed into the AND box first, then a single edge exits to the target. Plus: support creating an AND group by dragging an edge onto an existing AND box. Probably co-built with the layout pass above.
- **Pattern library expansion** — research 5 patterns per diagram type from the published TOC literature (Goldratt, Dettmer, Scheinkopf, Cox/Boyd), with careful copyright handling (originality at the description level; no copy-paste from sources). Curate as `domain/patterns/<type>/<pattern-id>.ts`. Aim: every new doc has a recognisable starter shape.
- **Edit-menu → left toolbar redesign** — the Edit menu has grown enough to feel cluttered. Consider a left-rail vertical toolbar for the most-used verbs (delete, group as AND, join, splice, etc.) and reserve the menu for less-frequent actions. Design discussion first; no implementation until shape agreed.
- **PWA offline integrity** — Dann hit two failures on a plane (no internet): the book PDF/EPUB didn't load, and `pptxgen.es-DQvezJKa.js` failed dynamic import. The first is a service-worker pre-cache gap (the docs-bundle outputs may not be in the SW manifest); the second is a lazy-chunk URL that the SW didn't capture at install time. Both need investigation of the workbox `registerRoute` and `additionalManifestEntries` config.
- **Multi-document tabs** — re-opened from the won't-build list per Dann's session-136 usage feedback. Tabs across diagrams of the same document set (CRT + EC + PRT in one workspace). Last considered Session 91 and cancelled; the new ask is the same shape. Probably still depends on a cross-doc model. Worth a fresh PRD before committing.
- **HTML export with embedded preview image** — the static-HTML viewer is text-only today; embedding a PNG render at the top would make it more useful as a share artifact.
- **EC PDF workshop export bug** — the EC workshop-mode PDF export doesn't produce a usable file. Reproduce + diagnose.
- **Flying Logic notes-as-connections regression** — Dann reports that connections seem lost on import; the source `.flow` may carry notes that should become edges (or vice versa). Needs Dann's reproducer file before investigation can start.

### Session 136 bugs awaiting reproduction

These were reported in the Session 136 usage pass but aren't reproducible from code alone:

- **Inspector closes when making a selection inside it** — *what kind of selection?* The aside has a narrow-viewport tap-to-dismiss backdrop (hidden at md+) and an X / `clearSelection` button — neither should fire on a text-select or radio-click inside an input. Need: a step-by-step repro (which field, which gesture, what was selected before).
- **"Add evidence" button does nothing** — most likely Browse Lock is on (it auto-engages on share-link / example loads and disables every mutating button silently). Need: a screenshot of the Inspector with the lock state visible — if Browse Lock is on, the fix is a toast saying "Browse Lock is on — unlock to add evidence"; if it's off, the click is a real regression. Either way: confirm Browse Lock state when reproducing.
- **Edges render behind entity nodes** — folded into the render-engine layout pass above. The fix is real edge routing (around obstacles), not just z-order — pure z-order raise puts edges over titles, which looks worse.

Otherwise the backlog is genuinely drained — new work would come from fresh spec/product direction.

*(Was on the list: "Phase 1C node-chrome / canvas eligibility surfacing." Already done — `EligibilityBadge` ships on Action nodes via the `Show action-eligibility badge` Display setting, with full inspector readout retained. Code in `src/components/canvas/nodes/TPNodeBadges.tsx` + `useGraphNodeEmission.ts`; tests in `tests/components/canvas/eligibilityBadgeEmission.test.tsx`.)*

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
