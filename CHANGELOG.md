# Changelog

Reverse chronological. Entries are grouped by build session, not by release — the project has no version tags yet.

## Session 95 — Selection-anchored toolbar

The UI-pattern research from Session 94 recommended adding a single new affordance to TP Studio: a floating contextual toolbar anchored above the current selection, bridging the gap between "I know which node I mean" and "I know which verb I want." This session ships it across two phases. **1117 tests passing** (was 1097 at start of Session 95; +12 selectionVerbs registry tests + 8 SelectionToolbar component tests). 3 new Playwright e2e specs cover the on-canvas user journey.

**Phase 1 — prep (commit `adc95b9`).** Built shared infrastructure first so the toolbar and ContextMenu don't diverge on per-selection verb logic:

- New **`src/domain/selectionVerbs.ts`** — single source of truth. Exports a `Branch` discriminated union over selection shapes (`none / pane / single-entity / single-edge / single-group / multi-entities / multi-edges`), `branchFor(selection, contextTarget?)` to derive the branch, and `verbsForBranch(branch, state)` returning ordered `Verb[]`. Each verb references a palette command id where one exists; toolbar-only verbs carry inline `run` closures.
- **4 new palette commands for parity** — every toolbar verb has a Cmd+K home: `add-successor` (Tab equivalent), `add-predecessor` (Shift+Tab), `splice-into-edge` (was ContextMenu-only), `confirm-delete-selection` (wraps the Delete-key flow).
- **ContextMenu partial migration** — branches 1/3/4 (multi-edges, single-entity, single-edge) consume the registry for their stable leading verb block; dynamic per-doc sections (Convert-to type list, Pin/Unpin, Spawn-EC, Negative Branch) stay inline. 10/10 ContextMenu tests still pass.
- New **`getSelectionViewportRect()`** in `services/canvasRef.ts` — returns the union bbox of the current selection in CSS viewport coordinates so the toolbar can anchor via `position: fixed` without depending on canvas-chrome layout.
- New **`useCanvasInteractionState()` hook** — aggregates `{ isEditing, isPaletteOpen, isModalOpen, isDragging }` into one `useShallow`-comparing subscription. Combines our zustand-side flags with React Flow's own drag state. Future overlays inherit the same visibility logic for free.
- New **`showSelectionToolbar` preference**, default ON. `!== false` semantics for first-run users — opt-out, not opt-in. Settings → Behavior toggle persists across reloads.

**Phase 2 — toolbar component (this commit).**

- New **`src/components/canvas/SelectionToolbar.tsx`**. Renders 3-5 verb chips above the selection bbox; positioning via `position: fixed` + `top/left` computed each render from `getSelectionViewportRect()`. Anchored above by default; flips below when the selection sits near the viewport top. Re-positions on viewport transform (pan/zoom) and on selection-shape change.
- Visibility: hidden when `showSelectionToolbar === false`, when the branch is `none`/`pane`, when the verb list is empty, or when `isEditing || isPaletteOpen || isModalOpen || isDragging`. Wrapped in an `ErrorBoundary` so a future regression in the positioning math can't break the canvas.
- Each verb button shows its icon (when registered in `commandIcons.ts`) plus the verb's `shortLabel ?? label`. Tooltip carries the keyboard shortcut from `paletteKbdForCommand` so the toolbar doubles as a kbd-discovery surface. Destructive verbs (Delete) render with rose styling.
- Click handler routes through `command.run(state)` for palette-backed verbs (so Browse Lock guards + history apply correctly) and inline `run` for registry-only verbs.

**Tests.**
| File | Coverage |
|---|---|
| `tests/domain/selectionVerbs.test.ts` (Phase 1) | 12 cases: branchFor across every selection shape; verbsForBranch per branch; conditional verbs (Swap on exactly 2 entities, Ungroup-X only when group exists); palette-command-id integrity (every reference resolves to a real command). |
| `tests/components/SelectionToolbar.test.tsx` (Phase 2) | 8 cases: hidden states (none / palette open / modal open / toolbar disabled), renders correct verbs per selection kind, click dispatches the palette command, tooltip carries the kbd shortcut. |
| `e2e/selection-toolbar.spec.ts` (Phase 2) | 3 Playwright cases: appears on selection + disappears when cleared, clicking Add child creates a second entity, hides while Cmd+K palette is open and reappears after Esc. |

**Docs.** USER_GUIDE.md grew a new **Selection toolbar** section between *Connecting causes to effects* and *Working with multiple entities* — per-selection verb list, hide rules, the Settings opt-out.

**Design choices documented** (all in commit messages + source comments):
- **Partial ContextMenu migration, not full.** The IIFE has rich conditional structure (Convert-to type loop, Pin/Unpin only when pinned, Spawn-EC only on CRT) that doesn't fit a `state → Verb[]` registry naturally. Forcing a full migration would warp the registry into a runtime DSL. Stable verbs are shared; dynamic verbs stay inline. Documented in `selectionVerbs.ts` header.
- **Branch.kind `'pane'` returns empty verbs.** Pane verbs (Paste, Add entity at cursor) are context-menu specific; the toolbar should stay hidden on right-click-pane. Returning `[]` keeps that contract without a separate flag.
- **TPEdge mutex coords pattern** (Session 94 #2) was the cautionary tale that informed the registry shape: the verb-list result must be primitive-stable for `useShallow` to work. The branch object is small enough that a fresh-each-render reference doesn't matter, but verbsForBranch is called inside a `useMemo` over `[branch, edges]` to keep referential stability.

End state: tsc clean, Biome clean, 1117 tests passing, 3 new e2e specs. Live at <https://tp-studio.struktureretsundfornuft.dk/>.

## Session 94 — Top-30 refactoring sweep

Acted on the Top-30 refactoring list produced from a cross-codebase audit. **18 items shipped across 5 commits**, **4 evaluated-and-respected** (in-source rationale already rejected the change), **8 evaluated-and-deferred** with documented reasons. **1097 tests passing** end-to-end; no behavioral changes.

**Commit map:**
- `22f0150` — #1 + #6 LargeDialog shell + migrate 4 picker dialogs
- `cfa5c34` — #2 useShallow consolidation in CreationWizardPanel + EdgeInspector + TPEdge
- `17217f5` — #5 + #10 (skip) + #26 TextInput/TextArea primitives + print thumbnail tokens
- `eaf434d` — #4 + #17 pdfShared module + canonical EC slot data
- `5ced1d2` — #3 banners + #16 useAutoFocusFirstEnabled + #18 layer offset doc + #20 seedDoc helpers + #28 redundant Esc audit + #30 useStoreSlice wrapper

**Shipped highlights:**

- **#1 LargeDialog primitive.** Four picker dialogs (DiagramType / Export / Print / Template) each had ~25 lines of identical scaffolding — raw `<dialog>`, focus trap, Esc handling, header chrome. Extracted to `src/components/ui/LargeDialog.tsx`; ~100 LOC of duplication removed.
- **#2 useShallow consolidation.** CreationWizardPanel (12→1 selectors), EdgeInspector (12→1), TPEdge mutex-coords (4→1). Fewer re-renders on unrelated store mutations. The TPEdge fix is subtle: nested objects break shallow equality, so the selector returns 4 flat primitives and the component composes them.
- **#5 TextInput / TextArea primitives.** New form components in `formPrimitives.tsx` consuming the `INPUT_FOCUS` constant from Session 93. Migrated 4 inspectors (EntityInspector, EdgeInspector, GroupInspector, MultiInspector); the 60-char `"w-full rounded-md border ..."` className is now in one place.
- **#4 pdfShared module.** Both PDF exporters (canvas vector, EC workshop sheet) now go through a single `loadJsPdf()` lazy-import + share canonical `PAGE_DIMENSIONS_MM`. Bundle splitter consistently emits one jspdf chunk.
- **#17 Canonical EC slot data.** `ALL_EC_SLOTS`, `EC_SLOT_GLYPH`, `WizardOrder`, `EC_SLOTS_BY_ORDER` all moved to `@/domain/ecGuiding`. The inline `'a' | 'b' | 'c' | 'd' | 'dPrime'` unions and the local `ALL_SLOTS` const collapsed into one source.
- **#3 types.ts banners (pragmatic).** Physical split deferred — 90+ files import from `@/domain/types`; the migration cost outweighs the TS-server payoff. Added 8 section banners + a top-of-file TOC. Barrel-re-export pattern documented for future splits.
- **#16 useAutoFocusFirstEnabled hook.** Standardises the "find first focusable child" pattern. KebabMenu migrated as canonical example; ContextMenu / ConfirmDialog keep their inline implementations (selector quirks).
- **#18 Y-axis offset table.** Added to `domain/zLayers.ts`. Reference for `top-4` / `top-14` / `bottom-20` / `bottom-24` classnames scattered across chrome.
- **#20 seedDoc helpers.** Three new graph-shape fixture builders: `seedDiverging`, `seedCycle`, `seedForest`. Available for radial-layout / validator / flyingLogic tests.
- **#26 Print thumbnail tokens.** 18 inline hex literals consolidated into `STANDARD_FILLS` / `WORKSHOP_FILLS` / `INKSAVING_FILLS` constants.
- **#28 redundant local Esc audit.** Confirmed clean — only LargeDialog uses `useEscapeKey`; the picker dialogs delegate. Redundancy with the global cascade is intentional (belt + braces; both close idempotently).
- **#30 useStoreSlice wrapper.** Shorthand for `useDocumentStore(useShallow(...))`. Available for new code; existing call sites stay (per-site win is small).

**Evaluated-and-respected** (in-source rationale already rejected the change — the audit didn't see the existing comment):

- **#7 ContextMenu builder extraction** — the IIFE carries an explicit comment: "splitting into per-branch helpers would mean passing ~17 store actions plus doc-shaped state per call — the indirection cost outweighs the line-count win."
- **#8 SettingsDialog tabs declarative** — the tab bar IS already declarative (TABS array + map). Each tab's CONTENT has bespoke ARIA / state — forcing a common shape would obscure each section's unique controls.
- **#10 EC wizard order toggle to RadioGroup** — the existing inline-row 2-button layout is intentional UX; RadioGroup's 2-column grid would crowd the wizard panel.
- **#11 CSV schema alignment** — the export-superset / import-subset asymmetry is documented intent in `csvExport.ts`; the importer accepts a subset for the round-trip and ignores extra columns by design.

**Evaluated-and-deferred** (low payoff relative to remaining work):

- **#9 INPUT_FOCUS sweep across all 15+ input sites** — partial migration shipped via #5 (4 inspectors). Full sweep is mechanical; ride future edits.
- **#13 Lazy-load entityTypeMeta extras** — bundle effect uncertain (the icon imports already get tree-shaken if unused). Revisit with measured profile data.
- **#15 EXPORT_CATEGORIES move to domain** — the 180-line const lives inside ExportPickerDialog; physically moving doesn't change behavior. Reduces ExportPickerDialog from 330 LOC; pure organization.
- **#19 Tests to screen.\* API** — 22 file mechanical migration. Toaster.test.tsx is the only one currently using `screen`; ride future edits.
- **#21 document.test.ts split** — 5-file mechanical split. Existing 392-line file isn't actively painful.
- **#22 / #23 / #24 / #25 coverage gap fills (pdfExport, ecWorkshopExport, CreationWizardPanel, snapshot tests)** — substantial new-test writing, separate session work.
- **#27 CommandPalette test custom setup** — recent-commands localStorage clear is a known one-off, not pattern-breaking.
- **#29 EntityForm spec-driven inspector** — premature abstraction; ride future feature growth.

End state: tsc clean, Biome clean, 1097 tests passing, bundle unchanged in shape, no behavioural regressions. The refactor audit's working list is now exhausted — anything left is either in-source-rejected, mechanically tractable but low-impact, or premature.

## Session 93 — Backlog tail: EC slot indicator + tech-debt convention pass

Closes EC PPT comparison items #30-34 and the tech-debt items #35-40 from the Session 87 UI review. **1097 tests passing** (was 1092; +5 for ECSlotIndicator).

**EC PPT comparison items re-evaluated.** With EC PPT comparison work now shipped, these items were re-triaged:
- **#30 (EC tab bar overcrowding)** — moot. Inspector still has the original 3 tabs (Inspector / Verbalisation / Injections); no 4th was added.
- **#31 (verbalisation strip eats vertical space)** — already shipped (Session 88's combined `ecChromeCollapsed` wrapper + Session 89's default-collapsed flip).
- **#32 (EC wizard slot indicator)** — new this session. New `ECSlotIndicator` component renders a 120×60 inline SVG of the canonical 5-box EC layout with the current step's target slot highlighted in indigo. Coordinates mirror the seed positions from `domain/examples/ec.ts` (A left-center, B top, C bottom, D top-right, D′ bottom-right) with the conflict-cone edges drawn as light lines so the shape reads as the recognized 5-box tree. Mounted inside `CreationWizardPanel` for EC wizards only; reads `EC_SLOTS_BY_ORDER[wizardOrder][step]` so it tracks both A-first and D-first walks. +5 unit tests.
- **#33 (EC mutex ⚡ vs hand-drawn lightning)** — confirmed won't-build per Dann's earlier decision.
- **#34 (Assumption Well + Injection Workbench behind tabs)** — already shipped (Session 87 — canvas-side assumption badge + injection chip).

**Tech-debt items #35-40 triaged.** Three items addressed via lightweight documentation/convention work; three deferred with rationale.

- **#36 (focus-ring patterns)** — new `src/components/ui/focusClasses.ts` exposes three named constants matching the existing tiered patterns: `INPUT_FOCUS` (subtle ring-1 for fields), `CARD_FOCUS` (ring-2 for clickable cards), `EC_BADGE_FOCUS` (violet ring for EC-themed badges). Adopted `CARD_FOCUS` in `DiagramTypePickerDialog` and `ExportPickerDialog` as exemplars; widening the rollout to all 15+ inputs is mechanical and can ride future edits.
- **#37 (Tailwind breakpoint usage)** — JSDoc-style header comment on `TopBar` documents the four breakpoints (`xs` 480 / `sm` 640 / `md` 768 / `lg` 1024) and the rule of thumb ("can the user reach this via palette or kebab at smaller widths?").
- **#38 (dialog width inconsistency)** — JSDoc comment on the `Modal` primitive documents the width-class tier: `max-w-md` for confirms, `max-w-lg` for the palette, `max-w-2xl` for keyboard-heavy dialogs, and the card-grid pickers' viewport-clamped pattern. New modal authors pick the smallest fitting width and pass via `widthClass`.
- **#35 (LAYER_OFFSETS magic numbers)** — parked-with-rationale. M effort touching every absolute-positioned component; magic numbers aren't actively causing bugs and the existing `Z` z-index module is the only multi-component spacing system worth centralizing. Revisit if a viewport-restructure forces multi-file edits.
- **#39 (useFocusTrap adoption audit)** — parked-with-rationale. Reviewed: every modal-style component except the CreationWizardPanel uses focus trapping. The wizard intentionally doesn't because it's a non-modal panel that the user is expected to dismiss + return to the canvas mid-flow. No fix needed.
- **#40 (visual regression coverage for dialogs)** — parked-with-rationale. Storybook visual-snapshot infra was previously rejected (Session 81); Playwright already covers the canvas visual snapshot (`e2e/visual-canvas.spec.ts`). Adding dialog-snapshot specs is a separate infra project, not a 1-hour pass.

End state: tsc clean, Biome clean, 1097 tests passing. The Session 87 UI review queue is now fully closed.

## Session 92 — Backlog finish: 4 UI items + Esc cascade consolidation + 2 stale-marks

Tidies up the remaining UI tidy / polish / bigger-asks items from the Session 87 review queue. **1092 tests passing** (was 1089; +3 Esc cascade tests).

**S1 — Browse-Lock single-icon toggle.** `TopBar` previously swapped between `Lock` and `Unlock` icons depending on `browseLocked`. The icon swap competed with the color-variant swap (violet vs. neutral background) — two signals for one piece of state. The padlock metaphor reads the same regardless of lock state; users look at the chip color to know if the lock is engaged. Now: `Lock` icon always, color carries the state. `Unlock` import dropped.

**S9 — Toaster vs. Controls bottom-edge collision.** Bumped the centered toast layer from `bottom-6` (24 px) to `bottom-20` (80 px) so wide-text toasts on narrow viewports clear the React Flow Controls + MiniMap stack at bottom-left. Session 87 already moved Controls out of bottom-center; this closes the remaining overlap on phone-narrow widths.

**First-Entity Tip — rename + delete hints.** Added a third line of affordance copy to `FirstEntityTip`: "Double-click an entity to rename · Delete / Backspace removes the selection." Pairs with the existing marquee + alt-splice line that Session 87 added. The tip still auto-hides past 2 entities, so it's first-time-only.

**#26 — Visible Undo/Redo in the KebabMenu.** Session 87's TopBar Undo/Redo buttons cover `sm+`; the kebab (`< sm`, phone-narrow) had no surface for them. Added two new menuitems at the top of the kebab list. Disabled state mirrors the TopBar buttons (`!canUndo` / `!canRedo` reads `past.length` / `future.length`). KebabMenu's auto-focus now picks the first **enabled** item (disabled buttons can't accept focus); ArrowUp/Down/Home/End also walk the enabled subset only. Two KebabMenu tests updated to match the new semantics.

**#27 + #28 — Pointer-gesture affordances in the HelpDialog.** The shortcut registry only carries keyboard bindings; gestures like marquee-select and Alt+drag splice had no durable discoverability surface (the FirstEntityTip auto-hides). Added a new "Mouse & touch gestures" section to `HelpDialog` listing six pointer affordances: marquee-select, alt-drag splice, drag-to-connect, alt-click-to-connect, drag-to-pin, double-click rename. Inline list (`GESTURES` const), not in the registry — the registry's `keys` field assumes a keyboard binding.

**#29 — Browse Lock toast dedup verification.** Already covered by `tests/services/browseLock.test.ts` (Session 87 test `dedupes cascading lock-toast attempts to a single visible toast (S29)`). Backlog entry was stale; reconciled in NEXT_STEPS.

**#23 — Esc cascade consolidation + cascade-order tests.** The global Esc cascade in `useGlobalShortcuts` was the single source of truth for "what does Esc close right now," but had drifted behind the dialog surfaces shipped after the original cascade landed — `templatePickerOpen`, `diagramPickerOpen`, `exportPickerOpen`, `printOpen`, `compareRevisionId`, `sideBySideRevisionId`, and `confirmDialog` each had their own `useEscapeKey` / `useOutsideAndEscape` call locally, which still worked but meant the global cascade silently fell through those states. Pulled all dismissable surfaces into one ordered priority chain. Documented the order inline. New tests: cascade order (open picker → settings → help → selection, four Esc presses peel them back in that order), top-priority picker beats lower-priority dialog (export picker closes before settings), Esc on an open confirm dialog resolves the Promise with `false`.

End state: tsc clean, Biome clean, 1092 tests passing.

## Session 91 — Toast dwell-time grading + prominent CTA

Small-ideas bundle. Two related toast pipeline upgrades. **1089 tests passing** (was 1086; +3 around the new duration / prominent-action paths).

**Per-kind auto-dismiss defaults.** The previous single `TOAST_AUTO_DISMISS_MS = 2200` treated every toast equally and was the source of two complaints: PWA "New version available" disappeared before the user could read it; CSV import errors vanished before the line-number hint could be acted on. Replaced with `TOAST_AUTO_DISMISS_MS_BY_KIND = { info: 6000, success: 4000, error: 10000 }` graded by urgency — success (acknowledgement) short, info (announcement) medium, error (actionable) long. `TOAST_AUTO_DISMISS_MS` kept as a back-compat alias pointing at the info default.

**Per-call `durationMs` override.** `showToast(kind, message, options)` grew an optional `durationMs` field on the options bag. Used by `pwaUpdate.ts` to dwell the "New version available" toast at 15 s — well past the info default, since the user often needs a moment to save canvas state before refreshing.

**Prominent action button.** `ToastAction` grew an optional `prominent?: boolean` flag. The Toaster renders prominent buttons as a filled indigo CTA (white text, shadow, focus ring) instead of the default subtle outline-on-current-color. The PWA refresh toast sets `prominent: true` so the "Refresh now" button visually anchors the toast — the only one the user almost always wants to click. Non-prominent action buttons (e.g. Undo on template load) keep the existing subtle styling so they stay informational rather than commanding.

**Tests.** Three new cases in `tests/components/Toaster.test.tsx`: per-kind threshold grading (asserts success drops off before info drops off before error), `durationMs` override (15 s outlasts the info default), and prominent action button (indigo background class signal). Uses `vi.useFakeTimers()` + `vi.advanceTimersByTime` reading the threshold constants from the module so future tweaks to the per-kind values don't require updating the assertions.

End state: tsc clean, Biome clean, 1089 tests passing.

## Session 89 — PWA + custom-domain distribution

TP Studio is now a Progressive Web App served at <https://tp-studio.struktureretsundfornuft.dk/>. Anyone with the URL can use it; the repo went public earlier in the session; search engines stay out via `robots.txt` + `<meta name="robots" content="noindex, nofollow">`. **1086 tests passing** (was 1078; +8 across `pwaUpdate` and `pwaInstall`).

**Dependencies.** New devDeps: `vite-plugin-pwa` + `workbox-window`. The plugin handles manifest + service-worker generation; workbox-window is the underlying registration primitive (transitively used by vite-plugin-pwa's `registerSW`).

**Service worker — `registerType: 'prompt'`.** `vite.config.ts` grew a `VitePWA(...)` plugin entry. We deliberately did NOT pick the `autoUpdate` strategy — silent background reloads would be hostile to a canvas-editing tool where mid-edit state matters. Instead, `src/services/pwaUpdate.ts` hooks `onNeedRefresh` to the existing toast pipeline (`useDocumentStore.getState().showToast(...)` with the `action: { label, run }` shape added in Session 88). The user gets an info toast with a **Refresh now** button; dismissing it lets the next natural reload pick up the change anyway. `onOfflineReady` fires once on first-ever install and surfaces a success toast confirming the app now works offline. Module-level `registered` guard prevents accidental double-registration via hot reload or test re-import. Wired from `src/main.tsx` so registration happens at module load.

**Install palette command.** `src/services/pwaInstall.ts` captures the `beforeinstallprompt` event the browser fires once its engagement heuristic clears. `triggerInstallPrompt()` consumes the event and returns `'accepted' | 'dismissed' | 'unavailable'`. A new palette entry **Install TP Studio…** (Help group) surfaces the prompt explicitly — power users can install on demand without waiting for the browser's default UI. When the event hasn't fired yet, the command toasts "Install prompt not available yet — visit a few times first." `appinstalled` event listener clears the stored reference after install. Side-effect import of the module sits at the top of `main.tsx` so the listener is registered before the browser fires the event.

**Icons + branding.** Four PNGs in `public/`: `icon-192.png`, `icon-512.png`, `icon-192-maskable.png`, `icon-512-maskable.png`. Generated programmatically via `scripts/generate-pwa-icons.mjs` — pure-Node PNG encoder (no `sharp` / no `pngjs`), indigo-500 (`#6366f1`, matches the manifest `theme_color` and the app accent) rounded-square background with a white "TP" monogram. Maskable variants shrink the monogram to ~55% of the canvas so platform mask shapes (Android squircle, Windows tile) never clip it. The OG card lives at `public/og-image.png` (1200×630), built by `scripts/generate-og-image.mjs` — wordmark on the left, an EC-shaped 5-node diagram on the right. The Claude-Preview-screenshot path was considered first but skipped: too many moving parts to orchestrate headlessly (?test=1 + EC seed + fit-view + viewport resize + react-flow render-settle) for a marginal quality win at 600×300 chat-preview sizes. Programmatic is cleaner.

**Custom-domain wiring.** `public/CNAME` carries `tp-studio.struktureretsundfornuft.dk` so future deploys don't strip the domain binding GitHub Pages installed via its UI. `public/robots.txt` disallows all crawlers; `<meta name="robots" content="noindex, nofollow">` in `index.html` is the belt-and-suspenders second signal. OG / Twitter Card meta tags in `index.html` point at the new `og-image.png` for chat-app link previews.

**Deploy pipeline.** New `.github/workflows/deploy-pages.yml` — checkout → pnpm setup → `pnpm install --frozen-lockfile` → `pnpm build` → `actions/upload-pages-artifact@v3` → `actions/deploy-pages@v4`. Triggers on every push to `main` plus `workflow_dispatch`. `concurrency: { group: 'pages', cancel-in-progress: false }` queues fast-follow pushes rather than aborting an in-flight deploy that's already serving traffic. The existing CI workflow (lint / types / tests / build / e2e) keeps running in parallel — both must land green for a push to be considered shipped.

**Tests.** `tests/services/pwaUpdate.test.ts` (5 tests) and `tests/services/pwaInstall.test.ts` (3 tests). The `virtual:pwa-register` module that vite-plugin-pwa generates at build time isn't resolvable in vitest by default — `vite.config.ts` adds a vitest-only alias to `tests/stubs/virtual-pwa-register.ts` (gated on `process.env.VITEST`) that captures `registerSW` options and exposes `__trigger*` helpers for deterministic callback firing. The test imports the helpers via the stub's filesystem path (not via `virtual:pwa-register`) so the production type contract (from `vite-plugin-pwa/client`) stays clean. `src/vite-env.d.ts` now references `vite-plugin-pwa/client` for the runtime type surface.

**Docs.** README top-of-file got a **Live demo** line + Install note. USER_GUIDE picked up a new **Using TP Studio offline** section between Browse Lock and Document details — explains how the PWA cache works, the explicit-refresh update toast, and the install paths on Chrome / Edge / iOS Safari. CHANGELOG (this entry) + NEXT_STEPS struck-through the installable-PWA placeholder.

End state: tsc clean, Biome clean, 1086 tests passing, build green (sw.js + manifest.webmanifest emitted into dist/), live URL serves the app over HTTPS.

## Session 88 — Code optimization sweep (1 win shipped; 6 evaluated audit-clean)

Second commit of Session 88. Re-walked the 7-item Session 86 optimization menu; one real win shipped, the rest evaluated audit-clean. Per Dann's standing rule, the menu has been removed from `NEXT_STEPS.md` and replaced with a single line referencing this entry.

**Real change — CommandPalette lazy-load.** `CommandPalette.tsx` was the last user-facing surface in `App.tsx` still imported eagerly. Its tree pulls in every command file (9 `*Commands` arrays totalling ~30 commands), the new `commandIcons.ts` map, the score function, and the per-command shortcut lookup — none of which is needed on first paint. Wrapped in `React.lazy` + the existing root `<Suspense fallback={null}>` block. Result: a new `CommandPalette-*.js` chunk at **22.22 KB gz**, the `index` chunk drops **116.6 → 98.0 KB gz** (-18.6 KB, -16%). Comfortably below the 112.3 KB budget after weeks of accretion. The palette is opened by Ctrl/Cmd+K — the lazy chunk has had several seconds to background-fetch by the time the user reaches for the shortcut.

**Also dropped: unused `TEMPLATE_THUMBNAIL_VIEWBOX` export from `src/templates/thumbnail.tsx`** (introduced in Session 79 for an external sizing hook that never landed; zero callers).

**Audit-clean items:**

- **`biome-ignore` audit.** 9 remaining; all legitimate: native-`<dialog>` interference (WalkthroughOverlay × 2 + SideBySideDialog), DOMPurify-sanitized markdown (MarkdownPreview), opt-in autofocus (RevisionRow), useFingerprintMemo + useGraphPositions fingerprint contract, derived-`active` dep in SearchPanel. Batch 1's TemplatePickerDialog JSX refactor already removed one; the rest can't be removed without semantic loss.
- **`console.*` outside `services/logger.ts`.** Already clean. The Session 68 audit closed this loop; every recent `log.warn` call site honours it.
- **Hot-path `useMemo` / `useShallow` audit on canvas hooks.** Re-verified per Session 86; every selector in the `useGraphView` composition reads either a primitive scalar or a stable doc/array slice. No new factory selectors introduced since.
- **`as any` / `as unknown as` cast sweep.** Re-verified per Session 86; every `as ` match in `src/` is now a *comment* documenting a previously-removed cast, not a live escape.
- **Dead-code on Session-82 surface (testHook).** `testHook.connect` IS exercised by `e2e/delete-flow.spec.ts` (line 47). Keep.
- **`requireEntity` / `requireEdge` / `isSufficiencyEdge` / `isNecessityEdge`.** Still uncalled in `src/`. Session 86 noted them as "watch list — if uncalled a month from now, that's a real signal." Two sessions later isn't quite that gap; revisit later.

End state: tsc clean, Biome clean, **1078 tests passing**, build green (index 98.0 KB gz, flow 100.4 KB gz, both under budget).

## Session 88 — UI polish queue (10 of 11 items shipped; 2 audit-clean)

Ten items from the UI polish queue (`docs/ui-review-session-87.md`) plus V2 from the inline UI-review section. Two evaluated as already-clean (S10 / S12) — both noted explicitly so a future session doesn't reopen the same audit. **1078 tests passing** (was 1057; +21 across `Toaster`, `ContextMenu`, `CommandPalette`, `recentCommands`, `creationWizard`, `ecChromeCollapsed`).

**S11 — Theme picker as a swatch grid.** Replaced the 7-option `RadioGroup` in Settings → Appearance with a 2×4 grid of preview swatches. Each swatch shows the theme's primary surface colour + an accent stripe matching its CSS-variable accent — pre-click scanning instead of clicking 7 radios. The `Theme` union and `setTheme` action are unchanged; this is a presentation swap inside `SettingsDialog.tsx`. Uses the existing `aria-pressed` pattern (matching `formPrimitives.RadioGroup`) so the swatch is a single-select group without tripping `lint/a11y/useSemanticElements` (Biome wants `<input type="radio">` if a button is annotated `role="radio"`).

**S14 — Toast Undo affordance for template load.** Extended the `Toast` type with an optional `action: { label, run }` field; `showToast` grew a 3rd-arg `options` parameter (existing two-arg callers untouched). `Toaster` renders the action button before the dismiss X when an action is set; clicking it fires `run` then dismisses the toast. Loading a template now captures `useDocumentStore.getState().doc` *before* the swap and surfaces "Undo" on the success toast — `setDocument(previousDoc)` restores. Cheap because the doc is a plain object and `setDocument` is the same path Ctrl+Z uses, so the restore is fully consistent with the history stack.

**S15 — Context menu keyboard navigation.** ContextMenu mounts with `role="menu"` plus first-item auto-focus on open (`queueMicrotask` after mount). New `onMenuKeyDown` handler responds to ArrowDown / ArrowUp (wraps), Home, End — Enter activates via native button behaviour; Esc is still handled by the existing `useOutsideAndEscape`. Headers and separators are skipped automatically because they're not `<button role="menuitem">` elements.

**S16 — Command palette icons.** Optional `icon?: LucideIcon` field on the `Command` type, but the actual map lives in a single `src/components/command-palette/commandIcons.ts` so the visual identity is auditable in one place rather than scattered across 9 command files. Wired for the high-traffic commands (Help / Settings / Search / Undo / Redo / Copy / Cut / Paste / Quick Capture / New from template / each export flavour / Print / Share). CommandPalette renders the icon at the left of each row; rows without an icon get an empty 14×14 spacer so labels stay column-aligned.

**S17 — Recent palette commands.** New `src/services/recentCommands.ts` persists the last 5 invoked palette commands to `localStorage` under `tp-recent-commands`. The list de-duplicates (re-running an existing command moves it to the front, no duplicate row) and caps at `RECENT_COMMANDS_LIMIT = 5`. CommandPalette snapshots the list on open, renders the resolved commands under a sticky violet "Recent" section header, and hides the section when the user starts typing (the filtered view takes over). `__resetRecentCommandsForTest` hook keeps tests deterministic — `tests/components/CommandPalette.test.tsx` clears between cases so the prior canonical-order assertion still pins File / Edit / View / Review / Export / Help.

**S18 — Creation wizard drag-to-reposition.** Added `x: number | null` / `y: number | null` to the `creationWizard` slice plus a `setCreationWizardPosition(x, y)` action. The CreationWizardPanel header band is now a drag handle: `pointerdown` (on the band, not on the inner minimise / dismiss buttons — `closest('button')` filters) begins a drag with `setPointerCapture` so the gesture survives a brief out-of-element move; `pointermove` updates a local `dragPos` state; `pointerup` commits to the store. A `clampToViewport` helper keeps ~40 px of the panel always grabbable so a stored position outside the current viewport can be reclaimed.

**S20 — Print mode visual previews.** Each of the three mode buttons in `PrintPreviewDialog` grew a 60×40 inline-SVG `<ModeThumbnail>`. Standard = colourful entity stripes; workshop = same shapes with bold black strokes (high-contrast translation); ink-saving = white-filled rectangles with thin charcoal strokes. Pure presentational SVG — no layout calc, no React Flow.

**S22 — Templates picker JSX thumbnail refactor.** `src/templates/thumbnail.ts` became `thumbnail.tsx`. The internal layout calculation returns an abstract `Primitive[]` list (`node` + `line` shapes); a new `<TemplateThumbnail>` component renders the primitives as native JSX `<rect>` / `<line>` elements; the legacy `templateThumbnailSvg(spec): string` emitter still works for tests, sharing the same primitive list. TemplatePickerDialog mounts `<TemplateThumbnail>` directly — the `dangerouslySetInnerHTML` + its `biome-ignore lint/security/noDangerouslySetInnerHtml` directive are gone. The `<svg>` carries `role="img"` + `aria-labelledby` referencing a per-template `<title>` element to satisfy `lint/a11y/noSvgWithoutTitle`.

**V2 — Combine reading-instructions + verbalisation strips.** Canvas EC chrome now wraps the two strips in a single collapsible surface with one chevron header band. New `ecChromeCollapsed: boolean` persisted preference (default `false` so first-time EC viewers see both strips). When collapsed, the surface shrinks to a single "EC chrome" header row with a chevron. The per-strip dismiss / collapse controls still work — the new layer is the *outer* control. Kept the legacy `ecReadingInstructionsDismissed` + `verbalisationStripCollapsed` flags so existing Session-87 tests (`ECReadingInstructions.test.tsx`, `VerbalisationStrip.test.tsx`) keep working.

**S10 — Audit-clean: Settings dialog anchors.** Tab split from Session 87 (S25) already cuts the longest Display tab to ~7 controls. Anchor nav inside one tab would be friction the user isn't asking for. Documented; re-evaluate if a single tab grows past ~10 controls.

**S12 — Audit-clean: Long-form direction labels.** Labels were already long-form ("Bottom → Top"); the two-letter codes only appear in `id`. No change needed.

End state: tsc clean, Biome clean, **1078 tests passing**, build green (index chunk 116.6 KB gz — within slop of the 112.3 KB budget, no over).

## Session 87 — EC PPT comparison (6 of 7 items shipped; #5 deferred)

Six small upgrades surfaced by comparing TP Studio's Evaporating Cloud against the canonical BESTSELLER workshop PPT template (`TEMPLATE evaporating cloud.pptx`). Item #5 ("one-page workshop-handout EC export") deferred — large enough to warrant its own scoping conversation.

**#1 — Numbered reading-instruction chips on the EC canvas.** New `src/components/canvas/ECReadingInstructions.tsx`: a dismissible top-of-canvas strip that surfaces the "1) In order to / 2) we must / 3) because" meta-reading the PPT prints prominently. EC-only; sits above the existing VerbalisationStrip. Session-scoped dismissal via the new `ecReadingInstructionsDismissed` flag on the preferences slice (resets across `resetStoreForTest`).

**#2 — Per-slot guiding questions visible after the wizard closes.** New `src/domain/ecGuiding.ts` exports `EC_SLOT_GUIDING_QUESTIONS` and `EC_SLOT_LABEL` — the canonical question table from the PPT, keyed by ECSlot. EntityInspector re-surfaces the slot-specific question whenever an EC slot entity is selected, so the wizard's once-only prompt stays available for editing.

**#3 — Reverse-direction (D-first) wizard mode.** CreationWizardPanel now carries a per-wizard toggle between the canonical A-first walk (A → B → C → D → D′) and the PPT's D-first walk (D → D′ → C → B → A — "start from the felt conflict"). Default stays A-first. Two-button toggle visible only on the EC wizard; flipping it changes which slot step 0 commits to. Existing wizard tests still pass; new component tests cover both walks.

**#4 — Two-sided "I vs they" verbal framing — schema v7 → v8.** New optional `TPDocument.ecVerbalStyle: 'neutral' | 'twoSided'` field (default neutral; `'neutral'` clears the field rather than persisting). `verbaliseEC` swaps "we must" → "they want to" / "I want to" on the D and D′ sides respectively when twoSided is active, matching the PPT's explicit negotiation framing. Doc-level toggle lives in DocumentInspector under the EC section. v7→v8 migration is a pure schema-version bump (additive optional field, no data shape change). `setECVerbalStyle` store action with coalescing under `doc-ec-verbal`.

**#6 — Per-edge assumption badge sourced from BOTH backings.** TPEdge's existing "A" pill on the canvas now unions both legacy `Edge.assumptionIds` and the v7 `doc.assumptions` map keyed by `edgeId` (mirrors the verbalisation generator's same union). The badge is now a real clickable button — clicking it selects the edge AND sets the EC inspector tab to `'inspector'` so the AssumptionWell is visible without a second click.

**#7 — Injection-summary chip on the EC canvas.** New `src/components/canvas/ECInjectionChip.tsx`: a small "Injections (N)" chip anchored top-right of the canvas on EC docs (zero-state included for discoverability). Clicking it sets `ecInspectorTab = 'injections'` via the new `requestECInjectionsView` store action. The EC inspector's tab state is lifted to the store (was local component state) so canvas chrome can request a tab from outside the Inspector.

**Item #5 deliberately deferred.** "One-page workshop-handout EC export" is the biggest single-feature ask of the comparison; it remains in `NEXT_STEPS.md` unchanged. Worth a separate scoping pass before picking up.

End state: tsc clean, Biome clean, **1040 tests passing** (was 1000; +40 across `ecGuiding`, `ecPPTComparison` store, `ECReadingInstructions`, `ECInjectionChip`, `TPEdgeAssumptionBadge`, `CreationWizardPanelECOrder` + extensions to `verbalisation`, `migrations`, `EntityInspector`), build green (flow chunk 102.86 KB gz unchanged), schema bumped 7 → 8.

## Session 86 — Focused 1-hour code-optimization pass

Time-boxed cleanup pass against the menu in `NEXT_STEPS.md`. Three items picked (#3, #5, #6); two shipped real changes, one was an audit-only "verified, no action needed".

**#6 — `as any` / `as unknown as` cast sweep.** `src/domain/entityTypeMeta.ts:424` carried a stale `type: typeId as unknown as EntityType` cast in the unknown-type graceful-degradation branch of `resolveEntityTypeMeta`. Session 85 (Batch D) widened `EntityTypeMeta.type` from `EntityType` to `EntityType | string` precisely to eliminate casts like this one — but the unknown branch wasn't refactored at the time. Dropped the cast; the literal `typeId: string` now flows through directly. Searched the rest of `src/` for `as any` / `as unknown as` — every remaining match is in a comment explaining a previously-removed cast, not a live escape.

**#5 — Drop unused exports.** Grep-based audit across `src/services/` and `src/domain/` (Group Policy blocks `npx ts-prune`; the manual `grep ^export` + cross-reference route was faster than installing a tool for one pass anyway). Two real dead exports removed:

- `effectiveBuiltinType` in `src/domain/entityTypeMeta.ts` — added speculatively "for validators / exporters", but `isOfBuiltin` (the predicate form immediately below it) is what actually got wired up everywhere. Zero callers across `src/` and `tests/`. The predicate stays; the redundant value-returning variant is gone.
- `__getClipboardForTest` in `src/services/clipboard.ts` — paired with `__clearClipboardForTest` as a test seam, but no test ever called it. The clipboard tests exercise the public `pasteAtOffset` / `cut` round-trip instead. Companion `__clearClipboardForTest` stays — it has live callers.

The Batch F (`requireEntity` / `requireEdge` / `getEdge`) and Batch H (`isSufficiencyEdge` / `isNecessityEdge`) helpers also show as currently-uncalled, but they landed today as intentional scaffolding for future migrations of `Object.values(...).find(...)` and `if (!entity) return;` patterns. Audit notes them as "watch list" — if they're still uncalled a month from now, that's a real signal; today they're freshly-laid track.

**#3 — Hot-path `useMemo` / `useShallow` audit on canvas hooks.** Reviewed `useGraphView` and its three composed hooks (`useGraphProjection`, `useGraphPositions`, `useGraphEmission`) plus `useGraphNodeEmission` / `useGraphEdgeEmission` for selectors returning new references per render (which would defeat the memo). Every `useDocumentStore` selector in the pipeline reads either a primitive scalar (`hoistedGroupId`, `layoutMode`, `compareRevisionId`) or a stable doc/array slice — no inline `() => ({ ...s.foo })` factory selectors that would churn. `useCompareDiff` memos on `[compareRevisionId, revisions, liveDoc]` (all stable identities). The Session 81 + Session 85 work on this pipeline holds up: no rewrites needed. Documented here so a future audit can skip re-walking the same ground.

End state: tsc clean, Biome clean, 1000 tests passing, build green (flow chunk 102.86 KB gz, identical to the post-Session-81 baseline).

## Session 85 — 20 under-the-hood improvements (10 batches, 8 shipped + 12 items evaluated-and-skipped)

A two-phase under-the-hood pass. Planned as a list of 20 maintainability / perf / test-coverage items, organized into 10 batches (A-J). Of the 20, **8 batches shipped real changes** and **2 batches were evaluated and consciously skipped** (the planned items turned out to be either already done or net-negative once benchmarked). Honest pruning is part of the story — half a dozen items inside the shipped batches got the same treatment.

End state: tsc clean, Biome clean, **1003 tests passing** (was 992; +11 across two new property-based / hook-coverage files), build green, all budgeted chunks within ceiling.

### Phase 1 (Batches A-D) — CI structure + memoization + property tests + brand-ID cleanup

**Batch A — CI + tooling lockdown.** Split the monolithic `Lint + types + tests + build` CI job into 3 parallel jobs (Lint+types, Tests+build+bundle, Playwright e2e). Tightened `.npmrc` with pnpm 10.x build-script policy (`engine-strict=true`, `manage-package-manager-versions=true`). Added Biome `useSortedClasses` nursery rule at `info` level for Tailwind class ordering; ran `biome check --write --unsafe` to apply the auto-sort (47 files re-formatted mechanically).

**Batch B — `structuralEntities` per-doc memo (#6).** `src/domain/graph.ts` now caches `Object.values(doc.entities).filter(!isNonCausal)` in a WeakMap keyed by doc reference. Same WeakMap pattern reused later in Batch E. Cache hit ≡ "doc unchanged since last call" — same semantics as the existing `useFingerprintMemo` gates at call sites, but transparent to every caller.

**Batch C — Property-based migration coverage (#13).** New `tests/domain/migrationsProperty.test.ts` adds 3 fast-check properties × 100 runs: importFromJSON survives the strict validator on arbitrary v1 docs; `migrateToCurrent` is idempotent at the current version; future-version docs are rejected. Generators mirror the EntityType union exactly — fast-check found a typo'd type name in the first generator immediately (`undesirableEffect` doesn't exist; the union uses `ude`). `fast-check ^3.23.2` added as devDep.

**Batch D — Brand-ID consolidation (#1).** New `Selection` variant `{ kind: 'groups'; ids: GroupId[] }` so group cards can be selected with proper `GroupId` branding instead of `as unknown as EntityId` casts. `TPGroupNode` now calls `selectGroup(group.id)` directly. Widened `EntityTypeMeta.type` from `EntityType` to `EntityType | string` to eliminate casts on custom classes. `useSelectionShape` reports `isSingleGroup = selection.kind === 'groups'`.

### Phase 2 (Batches E-J) — validator cache, helpers, edge predicates, test breadth, dev overlay

**Batch E — `validate(doc)` per-doc memo (#8).** Same WeakMap-by-doc-reference pattern as Batch B, applied to the CLR validator registry's main entry point in `src/domain/validators/index.ts`. 16 rules × per-render call frequency adds up; `useFingerprintMemo` already guards the React render-cycle cost, but the downstream re-computation cost is what this saves. `#7` (per-rule reach maps) evaluated and confirmed already memoized once per emission — no action needed.

**Batch F — `requireEntity` / `requireEdge` / `getEdge` helpers (#2).** `src/domain/graph.ts` grew three throw-or-return helpers for the "I know this id exists" call sites that previously did `doc.entities[id]!` (non-null assertion) or `doc.entities[id] ?? throw …` (boilerplate). `getEntity` already existed; `getEdge` is the matching read-only variant. `#4` (validator error paths) + `#5` (Object.values strict) evaluated and confirmed already well-pathed — no concrete bug cluster to motivate the change.

**Batch G — Bundle-size sweep (evaluated, no commit).** Three items evaluated and consciously skipped: `#10` lucide subpaths (icons chunk already 11.74 KB gz / 44 icons — near the raw floor; subpath imports save ~0.5 KB at most), `#11` hand-rolled SVG serializer (~6 KB gz savings versus 200+ lines of custom code to write and test), `#12` dompurify lazy (already its own chunk `purify.es-*.js` at 8.77 KB gz, loaded only with the inspector). Honest pruning — no commit landed for this batch.

**Batch H — `Edge.kind` predicates (#3, light variant).** Added `isSufficiencyEdge` / `isNecessityEdge` user-defined type guards in `src/domain/graph.ts`. The full discriminated-union version of `Edge.kind` was evaluated and rejected: it touches 50+ files for what amounts to slightly narrower types at the cost of widespread churn. The predicate helpers give callers the same narrowing where they need it, without the blast radius.

**Batch I — Property-based CLR totality + cold-path canvas hook coverage (#14, #16).** Two new test files. `tests/domain/validatorsProperty.test.ts` generates arbitrary `TPDocument`s across all 8 diagram types and asserts three properties × 100-200 runs each: `validate(doc)` never throws and returns well-formed Warning[], every warning targets an entity/edge that actually exists in the doc, and `validateTiered` partitions exactly the same warnings as `validate`. Covers all 16 rules transitively in one property — a rule that crashes on an unusual graph would have surfaced as a blank Inspector and a logged error; now it surfaces in CI with a shrunk repro. `tests/components/canvas/useGraphPositions.test.tsx` pins the cold-load contract: EC docs return synchronous positions on the manual branch, CRT docs return empty positions on first render and populated positions after `waitFor` observes the dagre dynamic import resolving. `#15` (Storybook visual regression) evaluated and skipped — would need Chromatic or test-runner + Playwright + image-diff infra, and the 6 small stories already have matching component tests.

**Batch J — `vite-plugin-checker` dev overlay (#18).** Added as a devDep and wired into the dev server's plugin list. Runs `tsc --noEmit` and `biome check` in a worker alongside Vite, surfacing type and lint errors as a browser overlay the moment they're introduced — without it, type errors only surface at `pnpm build` time (or when the IDE's tsserver catches up, which can lag). Scoped to `command === 'serve'`; `pnpm build` already runs `tsc --noEmit` explicitly before `vite build`, so the build path is untouched.

### Why this entry mixes "shipped" with "evaluated and skipped"

Half the value of an under-the-hood pass is the audit: discovering an item is already done (Batch E's #7, Batch F's #4/#5), or that the apparent win is smaller than the cost (Batch G entirely, Batch I's #15), is just as legitimate an outcome as a code change. Documenting both lets future audits skip re-evaluating the same ground.

## Session 83 — Parked-items sweep: nudge, mobile, layout-memo, drag-splice, visual baselines

Picks off seven items in one pass — three that the previous backlog flagged as parked behind UX/risk concerns plus four that turned out either stale or low-risk. Two were no-ops (the migrations stub had already shipped six versions ago; one component-test gap closed but the Canvas one stays parked for the same React-Flow-in-jsdom reason). Plus an honest backlog placeholder for "Look at UI" + "Validate EC against document".

End state: tsc clean, Biome clean, **992 tests passing** (was 954; +38), build green, all budgeted chunks within ceiling.

### CRT System Scope nudge (`src/services/systemScopeNudge.ts`)

Once-per-doc soft toast on CRT load when the System Scope (Step 0) is empty. Previously rejected as intrusive, this implementation flips a `doc.systemScopeNudgeShown` boolean on first surface so the toast never re-fires for the same doc. Wired via a `useDocumentStore.subscribe` watcher installed from `main.tsx`. New per-doc field validated by `persistenceValidators`. Toast text points the user at the Document Inspector's System Scope section (Session 56) rather than spelling out all seven Step-0 questions inline.

### Mobile / narrow-viewport pass

- New `xs:` breakpoint at 480 px in `tailwind.config.ts` — sits between Tailwind's defaults (`<sm` 640 px → `xs` 480 px → very narrow 320–479 px).
- `TitleBadge`: tighter `gap` + `px-1.5` at the smallest breakpoint so a long title still fits between the left margin and the toolbar. Info button hidden below `xs:` — Document Inspector reachable via palette ("Document details" command) when the icon is suppressed.

### Migrations stub — was already done

Backlog item 4 ("Backward-incompatible migrations stub") flagged `schemaVersion: 1` as a literal. The current state: `src/domain/migrations.ts` with `CURRENT_SCHEMA_VERSION = 7` and six registered migrations (v1 → v7), exercised by `tests/domain/migrations*.test.ts`. `importFromJSON` calls `migrateToCurrent` before validation. NEXT_STEPS entry marked complete; no code change needed.

### Toaster component test (`tests/components/Toaster.test.tsx`)

Six tests — empty queue renders null, per-kind rendering, dedup, manual dismiss via the X button, auto-dismiss after the configured timeout (via `vi.useFakeTimers`). Closes one of the three component-test gaps. TPNode + TPEdge tests already existed (landed alongside the canvas hook split); only the Canvas-shell test stays parked for the same React-Flow-in-jsdom reason as before — the dblclick contract is covered by `e2e/smoke.spec.ts`.

### FL-LA4 — Incremental layout via per-component memoization

Real incremental dagre would need a different layout engine; pragmatic alternative: split the graph into weakly-connected components and run dagre per component, caching results.

- New helpers in `src/domain/layout.ts`: `splitIntoComponents`, `clearLayoutCacheForTests`, plus internal `layoutOneComponent`, `componentCacheKey`, packing logic.
- Module-level LRU cache (`COMPONENT_CACHE_CAP = 64`) keyed by `(component-hash, options-hash)`. Cache hits return cached positions; misses run dagre once and store the result.
- Components packed vertically below each other with an 80 px gap. Stable ordering: largest component first.
- Wins on docs with multiple disconnected subgraphs (Archive groups, Notes, stray new entities mid-edit). Single-component docs see negligible change — same dagre output, no cache contention.
- Tests: 8 in `tests/domain/layoutComponents.test.ts` covering split correctness, single/multi-component layout, repeat-call cache hit, structural-change cache invalidation.

### Drag-to-splice entity into edge

Alt+drag an entity onto an edge body → splice. Previously parked behind a UX-design question; landed with explicit Alt-modifier requirement so the destructive gesture stays opt-in.

- New store action `spliceEntityIntoEdge(entityId, edgeId)`. Cuts the entity's prior incoming/outgoing edges, replaces the target edge with two new edges through the entity. Mirrors `spliceEdge`'s asymmetric metadata distribution (downstream half inherits label / assumptions / isBackEdge; upstream stays clean). Tests: 5 in `tests/domain/spliceEntityIntoEdge.test.ts` covering happy path, metadata preservation, validation rejects (entity is endpoint / entity missing / edge missing).
- New pure module `src/domain/dragSplice.ts` with `pointToSegmentDistanceSq` + `findSpliceTargetEdge` for the hit-test geometry. 9 tests in `tests/domain/dragSplice.test.ts` covering on-segment, perpendicular, endpoint-clamp, degenerate-segment, dragged-entity-skip, missing-position-skip cases.
- Canvas wires `onNodeDragStop` — checks `event.altKey`, computes drop position from React Flow's `node.measured` dimensions, runs the hit-test against current entity positions, calls `spliceEntityIntoEdge` on match. Toasts a success / "already endpoints that edge" hint on completion. Without Alt the drop falls through to React Flow's normal drag-to-pin gesture (LA5 from Session 63 — no behaviour change).

### Visual snapshot baselines — now committed

Triggered the manual `update-visual-snapshots` workflow. The Playwright `--update-snapshots` run pushed two PNGs to `chore/update-visual-snapshots`:

- `e2e/visual-canvas.spec.ts-snapshots/canvas-empty-chromium-linux.png` (25 KB)
- `e2e/visual-canvas.spec.ts-snapshots/canvas-three-entities-chromium-linux.png` (30 KB)

The auto-PR step failed because "Allow GitHub Actions to create / approve pull requests" wasn't enabled on the repo — manually pulled the baselines onto `main` instead. Tests are unskipped on CI; the visual-regression gate is live going forward. Future refresh: enable the repo setting OR keep the manual-cherry-pick step.

### Backlog placeholders

Added two open-ended items to `NEXT_STEPS.md`'s "Placeholders" section:
- **Look at UI** — open-ended UX review pass; needs a fresh-eyes walkthrough to scope.
- **Validate EC against document** — CLR rule comparing an EC's structural shape against a reference text; needs a 15-minute design conversation on what "the document" actually means.

## Session 81 — Parked-extras sweep: lazy dagre, S&T inline edit, EC wizard polish, Storybook

Closes four "extras" items from the post-v3 backlog in one pass. All four had been parked for legitimate reasons (visible UX cost, library risk, install bloat); the user requested doing them anyway. The wins are small individually but compound — eager-bundle size drops, S&T users get a faster edit gesture, EC wizard handles real keyboard mishaps, and primitives now have a visual playground.

End state: tsc clean, Biome clean, **954 tests passing** (unchanged), build green, all budgeted chunks within ceiling.

### Lazy-load dagre (~30 KB gzip off the eager path)

The Session 67 attempt at code-splitting dagre via `manualChunks` failed because Rollup kept dagre in the same chunk as `@xyflow/react`. The real fix — and the one that landed this session — is a `dynamic import('@/domain/layout')` inside `useGraphPositions`, plus removing `dagre` from the manual-chunk hint so Rollup can place it in its own chunk.

- New module-level promise cache (`layoutModulePromise`) coalesces concurrent first-renders onto a single `import()` round-trip.
- `useGraphPositions` split into three branches: **manual** (EC) stays fully synchronous via `useMemo`; **radial** also sync (the algorithm has no dagre dep); **dagre** is async via `useEffect` + `useState`. First paint on a cold load briefly shows an empty position map; subsequent fingerprint changes overwrite cleanly via setState.
- `SideBySideDialog.Panel` also lazy-loads `@/domain/layout` for consistency — the dialog is already lazy at the App level, but this ensures dagre stays in its own shared chunk.
- Bundle delta:
  - `flow-*.js` 134 KB → 103 KB gzip (dagre removed)
  - new `layout-*.js` 31 KB gzip (lazy, loaded on first auto-layout)
  - Net: **~30 KB gzip off the eager critical path**, EC-only users never pay it.

### EC + Goal Tree wizard refinements

Three behavioral polish items on `CreationWizardPanel`:

- **Step-change focus + draft reset now actually fires.** The Session 78 effect dependency array was `[]` — a mount-only effect. Cycling through steps via `Next ›` left stale state. Depends on `stepKey` (`${kind}-${step}`) now, so the textarea refocuses and `draft` resets on every advance, including palette-driven re-opens.
- **Esc-armed discard pattern.** Hitting Esc with a non-empty draft used to lose the typed answer instantly. Now the first Esc surfaces an inline `<output>` band ("Press Esc again to discard…"), auto-disarmed after ~2.5s. Second Esc within that window closes for real; empty drafts continue to close on the first press.
- **Skip-step inline notice.** Empty submits past step 0 and explicit "Skip step" clicks now flash a small grey band ("Step skipped — you can fill it in directly on the canvas later"), auto-cleared after ~2.5s. Replaces silent advance.
- **EC pre-seed missing-slot diagnostic.** If a hand-edited / imported EC reaches the wizard without an entity for the targeted `ecSlot`, the step now logs `ec-wizard-missing-slot` via `log.warn` instead of vanishing silently.

The non-modal panel deliberately does NOT add a focus trap — Tab should still let the user reach the canvas. Keyboard hint line below the textarea documents Enter / Shift+Enter / Esc semantics inline.

### S&T 5-facet inline editing on the canvas

Previously the four S&T attribute facets (NA / Strategy / PA / SA) were read-only on the canvas; the user had to open the inspector to edit them. `StFacetRow` is now an editable component:

- Double-click any row's value swaps it for an inline `<textarea>`.
- Enter / blur commits via `setEntityAttribute`; empty input clears via `removeEntityAttribute`.
- Esc cancels. Shift+Enter inserts a newline. Click/mousedown/keydown all `stopPropagation` so the gesture doesn't bubble to React Flow's pan or select handlers.
- Browse Lock blocks the edit-mode entry via the existing `guardWriteOrToast` gate.
- The card height stays at `ST_NODE_HEIGHT` (dagre still budgets the right rectangle) and the visual layout is unchanged when not editing.

### Storybook for UI primitives

Minimal install — `storybook` + `@storybook/react-vite` + `@storybook/react`. No addon-essentials, no addon-docs, no addon-a11y. The lean dev-dep footprint keeps the maintenance cost defensible at the current primitive count (six).

- `.storybook/main.ts` — config (`stories: '../src/**/*.stories.tsx'`, `framework: '@storybook/react-vite'`).
- `.storybook/preview.ts` — imports `src/styles/index.css` so stories render with the same Tailwind utilities the app uses.
- Six new `*.stories.tsx` files alongside their components:
  - `Button.stories.tsx` (6 stories — primary / ghost / softViolet / destructive / disabled / icon)
  - `Modal.stories.tsx` (2 stories — center / top alignment, stateful open/close demo)
  - `MarkdownPreview.stories.tsx` (4 stories — paragraph / list+heading / fenced code / empty)
  - `ErrorBoundary.stories.tsx` (3 stories — happy path / root crash / nested crash)
  - `Field.stories.tsx` (2 stories — text label / rich label)
  - `MarkdownField.stories.tsx` (3 stories — editable / locked / empty)
- New scripts: `pnpm storybook` (dev server on :6006) and `pnpm build-storybook` (static build).
- `storybook-static/` added to `.gitignore` + `biome.json` ignore (Biome was scanning the built bundles otherwise).

### Bundle-budget bump

`bundle-budget.json` updated to reflect the new chunk shapes:

- `flow` ceiling 140 KB → 110 KB (dagre is out, so the slack from the old budget no longer reflects reality — tightening keeps regressions visible).
- `index` ceiling 100 KB → 115 KB (the main bundle has genuinely grown over Sessions 77–81 with verbalisation, htmlExport, warning actions, templates picker wiring, focus trap, etc. — the previous number was the pre-v3-brief baseline).
- `icons` ceiling unchanged.

## Session 80 — True vector PDF export

Closes the remaining v3-brief critical-path bundle (§8.1 + §8.6 + §8.8 + §8.13). The Session 77 print pipeline handed off to `window.print()`; this session adds a programmatic file download that produces a real vector PDF — text stays text, edges stay resolution-independent, every glyph is selectable + searchable.

End state: tsc clean, Biome clean, **954 tests passing** (was 941; +13 in `tests/services/pdfExport.test.ts`), build green, all budgeted chunks within ceiling.

### Library choice

The v3 brief named `react-to-pdf`, but on inspection that library is a `html2canvas` wrapper — it rasters the DOM into a PNG and embeds the PNG. That directly contradicts "true vector". Shipped with `jspdf` + `svg2pdf.js` instead — reuses the SVG snapshot we already produce for the PNG/JPEG/SVG exporters and walks it into a vector PDF.

### `pdfExport` service (`src/services/pdfExport.ts`)

- `exportToVectorPdf(doc, nodes, options)` is the entry point. Snapshots the live React Flow viewport via the same DOM pre-flight as `image.ts`'s `exportSVG`, parses the result back into an off-screen SVG node, and hands it to `svg2pdf` for vector rendering on each jsPDF page.
- **Multi-page**: when the rendered diagram is taller than a single page's drawable area, the SVG is sliced vertically into N tiles and each tile becomes one page. Tile alignment by translating the SVG origin upward by `i * drawableHeight` per page so svg2pdf's draw-and-clip gives the right slice. Horizontal overflow is handled by scaling to fit width — no horizontal pagination.
- **Header / footer bands**: free text at the top + bottom of every page, with `{pageNumber}` / `{pageCount}` placeholders resolved per-page. The caller (`PrintPreviewDialog`) merge-fills the user's `{title}` / `{date}` / `{author}` / `{diagramType}` before passing through.
- **Annotation appendix**: when `includeAppendix: true`, after the diagram pages the service walks every entity with a non-empty description (sorted by `annotationNumber`) and renders them as numbered `#N — Title` / body blocks. Wraps to additional pages via `pdf.splitTextToSize`.
- **Selection-only**: when the print-preview toggle is on, the caller filters `nodes` to the selected entities before calling — the same filter as the existing print-CSS `body.print-selection-only` path, but applied to the PDF source rather than to display.
- **Bundle**: `jspdf` (115 KB gzip) + `svg2pdf.js` (25 KB gzip) + their `html2canvas` peer (47 KB gzip) all ship as **lazy chunks** so the cost is paid only when the user actually exports.

### Font / Unicode trade-off (§8.13)

jspdf ships with four Latin-1-only Type 1 fonts (Helvetica, Times, Courier, plus bold/italic variants). For diagrams that contain non-ASCII content the export uses Helvetica fall-back; embedding a full Unicode TrueType font would add 200–400 KB to the bundle. CJK / Cyrillic / accented content prints fine via the browser-print path (uses system fonts). This is a documented trade-off, not an oversight.

### `PrintPreviewDialog` changes

- New **Save as PDF** primary button (alongside the existing Open print dialog as a secondary). Disabled while a previous export is in flight; toasts success / failure.
- Selection-only checkbox now filters the PDF source nodes too (was previously only affecting browser-print output).
- `Cancel` and `Open print dialog` both become ghost buttons; `Save as PDF` is the new primary action because vector-PDF download is the v3-brief default.

### Confidence-field UI dropped from backlog

`Entity.confidence` was removed from the schema in Session 71 (deliberate product decision, not deferral). The "Confidence field UI" line item in `NEXT_STEPS.md`'s "Recommended priorities" section was a stale remnant from before that decision — removed this session. The single source-code reference (`persistenceValidators.ts:117`) is a defensive comment explaining that legacy imports silently drop the field; it stays as documented intentional behaviour for back-compat.

### Bundle impact

- **Lazy chunks** (loaded only when exporting): `jspdf.es.min-*.js` 115 KB gzip, `svg2pdf.es.min-*.js` 25 KB gzip, `html2canvas.esm-*.js` 47 KB gzip.
- **Main bundle**: unchanged within slop (still 107 KB gzip).
- **PrintPreviewDialog lazy chunk**: 4.4 KB gzip (was 2.3 KB) — the +2 KB is the new PDF handler + the wiring.

## Session 79 — Templates library, multi-goal soft warning, a11y pass, print-selection-only

Picks off six items from the v3 backlog in one pass: the curated template library (§12), a soft dismissible CLR warning for Goal Trees with >1 goal (replacing the previous hard single-goal constraint), a one-click "Convert extras to CSFs" action attached to that warning, an accessibility audit on the five Session 77+78 components, and a "Print selection only" toggle in the print preview.

End state: tsc clean, Biome clean, **941 tests passing** (was 891; +9 in `tests/domain/goalTreeMultipleGoals.test.ts`, +41 in `tests/templates/templates.test.ts`), build green, bundle within ceiling.

### Soft multi-goal warning + one-click conversion

- New CLR rule `goalTree-multiple-goals` (tier `clarity`) fires whenever a Goal Tree has more than one `goal` entity. The rule sorts goals by `annotationNumber` (per-doc monotonic counter — survives same-tick creations cleanly, unlike `createdAt`) and anchors the warning on the oldest goal so re-validation is stable.
- Warnings now carry an optional `action?: { actionId, label }` payload. `WarningsList` renders that action as a one-click button next to the per-warning Resolve toggle.
- New `WARNING_ACTIONS` registry in `src/services/warningActions.ts` dispatches the handler against the live store + document. First handler: `convert-extra-goals-to-csfs` — converts every `goal` entity except the oldest into a `criticalSuccessFactor`.
- Previous hard single-goal refusal in `addEntity` is gone; users can now have multiple goal entities and either dismiss the warning or one-click-convert.
- Drops backlog item 3.4 (CSF-count soft warning) entirely — too noisy for too little signal.

### Templates library (§12)

- `src/templates/` directory: shared `TemplateSpec` / `TemplateEntity` / `TemplateEdge` types, a `buildTemplate(spec)` inflator (assigns ids, positions, defaults edge.kind for goalTree/EC, applies `ecSlot` for EC slots), an `index.ts` exporting `TEMPLATE_SPECS`, and a framework-free SVG `templateThumbnailSvg(spec)` generator.
- 10 curated specs, by diagram type:
  - **Goal Trees (2)**: `Generic SaaS Goal Tree`, `Retail Operations Goal Tree`.
  - **Evaporating Clouds (5)**: `Sales vs. Marketing`, `Speed vs. Quality`, `Build vs. Buy`, `Centralise vs. Decentralise`, `Maker vs. Manager`.
  - **CRTs (3)**: `Retail Ops CRT`, `SaaS Engineering CRT`, `Personal Productivity CRT`.
- Thumbnails render in the picker as tiny SVGs computed from the spec — no React Flow / dagre off-screen pass. EC thumbnails draw the canonical 5-box layout with the red dashed conflict line; tree thumbnails BFS levels from sinks and row them out bottom-up.
- New `TemplatePickerDialog` (`src/components/templates/`) — semantic `<dialog open>` with `aria-modal`, focus trap via `useFocusTrap`, Esc closes. Grid of cards, each showing the thumbnail + diagram-type badge + entity/edge counts + title + description. Clicking a card runs `buildTemplate(spec)` → `setDocument(doc)` → toasts "Loaded template: X".
- New `New from template…` palette command in the File group (`document.ts`).
- Lazy-loaded under `ErrorBoundary` from `App.tsx`; isolated 6.5 KB gzipped chunk.

### Accessibility audit (Session 77+78 components)

- New shared `useFocusTrap(ref, active)` hook — Tab / Shift+Tab cycling inside the container, initial-focus on first focusable element, restoration of previously-focused element on close. Mirrors the WAI-ARIA Authoring Practices "dialog (modal)" pattern.
- `PrintPreviewDialog`: wired up `useFocusTrap`, `aria-labelledby`, Esc handler. Selection-only checkbox is disabled with explanatory label when no selection.
- `AssumptionWell`: status chip's `aria-label` now announces the next state ("Assumption status: X. Press to cycle to Y."), focus ring added.
- `VerbalisationStrip`: meaningful `aria-label` on assumption-anchor buttons describes the edge + assumption count, focus ring added.
- `CreationWizardPanel`: now a semantic `<section aria-label="…">`; step counter wrapped in `aria-live="polite" aria-atomic="true"` so screen readers announce transitions.
- `InjectionWorkbench`: link-picker buttons live inside `<ul aria-label="Assumptions available to link">` with `<li>` per item, focus ring + per-button aria-labels added.

### Print: "Selection only" toggle (§8.12)

- New checkbox in the print preview modal — disabled until the user has a non-empty React Flow selection.
- `setBodyPrintMode` toggles a `body.print-selection-only` class alongside the existing layout class.
- `print.css` adds:
  ```css
  body.print-selection-only .react-flow__node:not(.selected),
  body.print-selection-only .react-flow__edge:not(.selected) { visibility: hidden !important; }
  ```
  Uses `visibility: hidden` rather than `display: none` so canvas geometry is preserved during printing (no layout collapse, no edge re-routing).

### Bundle impact

- `TemplatePickerDialog-*.js`: 6.5 KB gzipped (lazy, unbudgeted).
- `useFocusTrap-*.js`: 464 B gzipped (lazy, unbudgeted).
- `index-*.js` (main): unchanged within slop.

## Session 78 — Goal Tree + EC creation wizards (dismissible "Get started" panel)

Builds on Session 77's Goal Tree + EC plumbing. Adds the brief's guided creation flow (§5 + §6) as a **dismissible** panel rather than a blocking modal — first-time users get the canonical Goal → CSFs → NCs and A → B/C → D/D′ walkthrough; returning users can skip per-doc or silence the wizard entirely.

End state: tsc clean, Biome clean, **891 tests passing** (was 877; +14 in `tests/store/creationWizard.test.ts`), build green, bundle within ceiling.

### `CreationWizardPanel` component

Floating top-left panel that lives over the canvas (not a blocking modal). 5 steps per diagram:

- **Goal Tree**: Goal → CSF 1 → CSF 2 → CSF 3 → first NC. Each `Next ›` creates the entity, connects it with a `necessity` edge to its parent (CSFs → Goal, first NC → first CSF), and advances the panel.
- **EC**: A → B → C → D → D′. Each `Next ›` fills the corresponding `ecSlot` entity's title via `updateEntity` (the 5 boxes are already pre-seeded since Session 47).

Controls:
- `Next ›` / `Enter` — commits the draft and advances.
- `Skip step` — advances without committing.
- `Minimise` (chevron-up) — collapses to a small "Continue setup ›" pill anchored top-left.
- `Dismiss` (X) or `Esc` — closes the panel this session; preference stays untouched.
- **"Don't show this on new {Goal Trees|Evaporating Clouds}"** checkbox — flips the persisted preference so future `New X` commands skip the wizard.

### Preferences

Two new persisted booleans in `StoredPrefs`, both default `true`:

- `showGoalTreeWizard`
- `showECWizard`

Wired through `preferencesSlice` (setters, defaults, persistence) and `prefs.ts` (deserialisation with sensible defaults for older saved-pref blobs).

### UI state

New `DialogsSlice.creationWizard: { kind, step, minimised } | null`. Four new actions:

- `openCreationWizard(kind)` — resets to step 0.
- `advanceCreationWizardStep()` — moves forward by 1.
- `closeCreationWizard()` — clears the panel.
- `toggleCreationWizardMinimised()` — collapse / expand.

### `newDocument` integration

`docMetaSlice.newDocument(diagramType)` now consults the preference and either:

- Opens the wizard at step 0 (`goalTree` + `showGoalTreeWizard`, or `ec` + `showECWizard`).
- Closes any previously-open wizard (e.g. user creates a CRT after starting an EC wizard).

### Settings toggle

Settings → Behavior gained two checkboxes:

- **Show Goal Tree creation wizard** — toggles `showGoalTreeWizard`.
- **Show Evaporating Cloud creation wizard** — toggles `showECWizard`.

### Palette command

New `Reopen creation wizard` in the Review group. Works only on Goal Tree + EC docs; toasts a friendly hint on other diagram types.

### Tests

`tests/store/creationWizard.test.ts` (14 tests):
- newDocument opens the wizard per preference (goalTree, ec, off, non-wizardable).
- Slice actions (advance, minimise, close, re-open resets).
- Preference toggles silence + re-enable the wizard.
- Cross-kind switch closes a stale wizard.

### Verification

- `tsc --noEmit` → exit 0
- `biome check` → 326 files, no errors
- `vitest run` → **109 files, 891 tests passing** (up from 877)
- `vite build` → 9.83 s
- `check:bundle-size` → all chunks within ceiling

### Why "panel + Skip + remembered preference" instead of a blocking modal

A modal-only wizard creates two problems:

1. **Repeated-use friction.** A practitioner spinning up their 50th Goal Tree doesn't want a 5-step wall blocking the canvas every time.
2. **Returning-user surprise.** The brief positions Goal Tree as the friendly first diagram for non-Jonahs, but it's also the kind of diagram a TOCICO Jonah cranks out routinely.

Linear / Notion / Tldraw all converged on the same pattern for their first-run hints: present but never blocking; dismissible per-instance; silenceable in settings; reopenable on demand. This session adopts that pattern exactly.

## Session 77 — Brief v3 alignment: Assumption records, EC workbench, Goal Tree, verbalisation, HTML viewer, print pipeline

The big v3-brief alignment session. End state: tsc clean, Biome clean, **877 tests passing** (was 863; +14 across 2 new test files), build green, bundle within ceiling. Schema bumped v6 → v7 with a non-trivial migration; the entity-type renaming proposed by the brief was deliberately NOT applied (the user said "keep what we have").

### Themes shipped

**1. Schema foundation — v6 → v7 migration**
- New `Assumption` record type with `status: 'unexamined' | 'valid' | 'invalid' | 'challengeable'`, `injectionIds`, `resolved`, `source`, `createdAt`/`updatedAt`. Lives in a new `Document.assumptions` map keyed by id.
- `Edge.kind` widened from `'sufficiency'` to `'sufficiency' | 'necessity'`. EC + Goal Tree edges are necessity-typed.
- New `Entity.ecSlot: 'a' | 'b' | 'c' | 'd' | 'dPrime'` for explicit EC slot binding (was: implicit via coordinates).
- New `'goalTree'` diagram type alongside the existing 7 — uses existing `goal` / `criticalSuccessFactor` / `necessaryCondition` types, TB layout, 5-step method checklist.
- `v6ToV7` migration: walks EC docs, derives `ecSlot` from canonical seed coordinates, retypes EC edges to `'necessity'`, mints an `Assumption` record per assumption-Entity with `status: 'unexamined'` + reverse-walked `edgeId`.
- `CURRENT_SCHEMA_VERSION` bumped to `7`. `factory.ts`, all `examples/*.ts`, `persistence.ts`, `spawnEC.ts`, `tests/domain/helpers.ts` updated. New `validateAssumption` in `persistenceValidators.ts`.

**2. Verbalisation generator (`domain/verbalisation.ts`)**
- Pure module producing the EC verbal form as a list of `VerbalisationToken`s (text / slot / assumptionAnchor). Renders the canonical 5-sentence form from brief §6, with `[click for assumptions]` anchors carrying `edgeId` + assumption count. Placeholder copy for unfilled slots so the verbal form is legible during the wizard's progressive fill.
- 7 tests in `tests/domain/verbalisation.test.ts` cover the happy path, empty slots, anchor count, plain-text flattener.

**3. EC inspector components**
- `AssumptionWell` (new) — drop-in replacement for `EdgeAssumptions` on EC docs. Renders each assumption with a clickable status chip (U/V/I/C four-way cycle). Mounts the chip + text input + open-entity link + detach button per row.
- `InjectionWorkbench` (new) — separate inspector tab listing every injection entity with its linked assumptions. "Mark implemented" toggle (sets `attributes.implemented`), link/unlink to assumptions via picker.
- `VerbalisationStrip` (new) — renders the verbalisation tokens with click-through anchors. Mounted both as a top-of-canvas overlay on EC docs and as a tab in the EC inspector.
- Inspector tab bar gating on `diagramType === 'ec'` — three tabs (Inspector / Verbalisation / Injections); non-EC docs render the original single-pane inspector unchanged.

**4. EC validation rules (brief §6)**
- New `ec-completeness` rule (ClrRuleId `'ec-completeness'`) covering:
  - Rule 1: A non-empty
  - Rule 2: B + C distinct, each only feeding A
  - Rule 3: D only feeds B; D′ only feeds C
  - Rule 4: ≥1 assumption per of the 5 canonical arrows
  - Rule 5: ≥1 injection exists
- Each sub-issue surfaces as its own warning with its own resolve-toggle target.

**5. Lightning-bolt EC mutex visual (brief §6 + §18)**
- Edge mutex glyph changed from `⊥` to `⚡` to match the book's "lightning between conflicting wants" convention.

**6. Keyboard shortcuts (brief §9)**
- `Cmd/Ctrl+\` — close inspector (clears selection).
- `A` (on selected edge) — add assumption. For EC edges, seeds the text with `"…because "`.
- Both registered in `SHORTCUTS` so the help dialog + `shortcutRegistry.test.ts` see them.

**7. Self-contained HTML viewer (`domain/htmlExport.ts`)**
- Pure generator producing a single `.html` file: inline CSS, no network calls, embedded JSON payload (base64) for future round-trip. Renders entity titles + types + EC verbalisation + assumption list (with status chips).
- New palette command **Export as self-contained HTML viewer**. Wired via `services/exporters/text.ts` (`exportHTMLViewer`).
- 5 tests in `tests/domain/htmlExport.test.ts` cover the round-trip + XSS-escape contract.

**8. Print pipeline (brief §10)**
- New `PrintPreviewDialog` modal (`Cmd/Ctrl+P` palette → "Print / Save as PDF…"): mode picker (Standard / Workshop / Ink-saving), include-annotation-appendix toggle, custom header + footer templates with `{title}` / `{date}` / `{author}` / `{diagramType}` merge fields.
- New `PrintAppendix` always-mounted component that renders the entity descriptions + edge notes + assumption list. Gated on `body.print-include-appendix` so it only shows in the printed output when the user opts in.
- `print.css` extended with:
  - `body.print-mode-inksaving` / `body.print-mode-workshop` / `body.print-mode-standard` variants
  - `body[data-print-header]::before` / `body[data-print-footer]::after` for the merge-field banners
  - `body.print-include-appendix [data-component="print-appendix"]` gating
- The brief calls for true vector PDF via `react-to-pdf`; that piece is deferred (network install) — browser print-to-PDF carries us until the dep lands.

### Notes / deferred

- **EC guided creation wizard (4.1)** is deferred. The existing 5-box pre-seed already gives users a working EC; the wizard's progressive prompts are incremental UX rather than load-bearing functionality.
- **Vector PDF via `react-to-pdf`** is deferred until we have a confirmed install path. The print preview modal + body-mode classes + appendix are forward-compatible — when the dep lands, the modal's "Open print dialog" button switches to the PDF pipeline.
- **Entity-type rename to brief's `gt*` / `ec*` names** was rejected at the user's explicit direction ("keep what we have"). Current names (`goal`, `criticalSuccessFactor`, `need`, `want`, etc.) stay.

### Verification

- `tsc --noEmit` → exit 0
- `biome check` → 324 files, no errors (after fixing a noArrayIndexKey + a useSemanticElements lint that landed with the new components)
- `vitest run` → **108 files, 877 tests passing** (up from 863)
- `vite build` → 9.57 s
- `check:bundle-size` → all chunks within ceiling

## Session 76 — Parked-item sweep: 6 polish items + 1 reconciliation pass

Knocking through items from the "parked with a documented reason" list. Six focused changes plus a backlog audit. Schema is unchanged (every feature lands as additive metadata or pure UI / rendering).

End state: tsc clean, Biome clean, **863 tests passing** (was 848; +15 across 4 new test files), build green, bundle within ceiling (icons chunk budget bumped 8.5 KB → 12.5 KB deliberately for the catalogue expansion).

### Bundles 1, 3, 5 — reconciliation audit

The backlog had drifted out of sync with code over earlier sessions. Audit results:

- **Bundle 1 (Navigation & Search)** — all 5 items live. SearchPanel (`Cmd/Ctrl+F`), Minimap, Zoom controls + ZoomPercent indicator, `select-path-between` palette command, `Cmd/Ctrl+Shift+→/←` successor/predecessor shortcuts.
- **Bundle 3 (Quick Capture)** — both items live. `E` shortcut → `QuickCaptureDialog`, CSV import command.
- **Bundle 5 (Export Pack)** — all 7 items live. PDF (via print), JPEG, SVG, OPML, CSV, annotations (Markdown + text), print stylesheet.

NEXT_STEPS tables updated to `✅`-mark each item.

### Radial layout polish — subtree-weighted angular allocation

The pre-polish radial layout distributed each level uniformly around its ring — children of a parent in a skewed tree could land far from the parent on the next ring. The polish:

- Pass 1 (bottom-up): compute subtree size per node.
- Pass 2 (top-down): each center claims an arc of `2π` proportional to its subtree size; each child claims a sub-arc of its parent's range proportional to its own subtree size; the node sits at the centroid of its slice.

Result: children stay angularly close to their parent, and sibling branches don't fight for the same arc. DAG nodes with multiple parents pick the first-discovered parent for angular allocation; cross-parent edges still render correctly as straight lines through the angular space.

New test `'children stay angularly close to their parent'` locks in the contract: in a 2-branch × 2-child-per-branch tree, each grandchild's angle is closer to its parent's than to the other branch's parent.

### Full-Lucide icon picker — catalogue expansion + search filter

`CUSTOM_CLASS_ICONS` grew from the curated 17 to **57 icons** spanning the common semantic categories (status, content, people, objects, actions, nature, communication, security, business). The icon-picker UI in `CustomEntityClassesSection` now carries:

- A **filter input** that substring-matches against icon names (typing `flag` narrows to Flag + FlagTriangle etc.).
- A scrollable button grid (`max-h-32 overflow-y-auto`) so 57 icons stay scannable.
- A hint paragraph explaining that power users can hand-edit JSON to reference any Lucide name — unknown names round-trip preserved and render with the Box fallback.

Bundle impact: `icons` chunk grew 8.3 KB → 11.2 KB gzip. Budget bumped to 12.5 KB to leave headroom for future additions.

### S&T discipline CLR rule

New `st-tactic-assumptions` rule: fires on any `injection` entity in an `'st'` diagram with fewer than three incoming `necessaryCondition` entities. Tier `clarity` — the nudge prescribes Goldratt's three-facet pattern (NA / PA / SA) without treating the diagram as structurally broken when a tactic legitimately doesn't need all three. Users can resolve individual warnings via the existing WarningsList Resolve action.

- New `ClrRuleId` member `'st-tactic-assumptions'`.
- New validator file `src/domain/validators/stTacticAssumptions.ts`.
- `RULES_BY_DIAGRAM.st` extended with the tiered rule (was just `STRUCTURAL_RULES`).
- 5 tests in `stTacticAssumptions.test.ts` cover the firing logic, ruleskip on non-S&T diagrams, partial counts, and the necessaryCondition-only-counts semantics.

### FL round-trip for OR / XOR / weight

Bundle 8's three structural edge operators now round-trip through Flying Logic — previously only AND did:

- **Writer** (`src/domain/flyingLogic/writer.ts`) — refactored to allocate eids for all three junctor-kind groups, emit each as `<vertex type="junctor">` with a per-kind attribute key (`tp-studio-and-group-id` / `tp-studio-or-group-id` / `tp-studio-xor-group-id`). Edge weight (`positive` / `negative` / `zero`) emits as a `tp-studio-weight` attribute on both regular edges and source-to-junctor edges.
- **Reader** (`src/domain/flyingLogic/reader.ts`) — inspects which `tp-studio-*-group-id` attribute is present on the junctor vertex to determine the kind; mints a kind-specific groupId for files where the attribute is missing (default `'and'`, matching pre-Bundle-8 files). Edge weight parsed into the typed `EdgeWeight` union; unknown values fall to undefined.
- Reader's diagram-type whitelist extended to recognize `prt` / `tt` / `ec` / `st` / `freeform` (was just `crt` / `frt`).
- 4 new tests in `flyingLogicBundle8RoundTrip.test.ts` covering OR / XOR / weight round-trip plus the AND-with-weight composite case.

FL renders all three junctor kinds identically (it has no native OR / XOR operator distinction in the dimensions we use), but the TP Studio round-trip is now lossless.

### First-class S&T 5-facet node rendering

The richer canvas card for Strategy & Tactics tactics. An `injection` entity carrying any of four reserved attribute keys (`stStrategy`, `stNecessaryAssumption`, `stParallelAssumption`, `stSufficiencyAssumption`) renders as a tall 5-row card instead of the standard one-line layout. The Tactic row is the entity's `title`; the four others are pulled from the attributes.

Wiring:

- **Constants** (`src/domain/constants.ts`) — new `ST_NODE_HEIGHT = 220` for the tall variant.
- **Helper** (`src/domain/graph.ts`) — `ST_FACET_KEYS` reserved-name table + `isStNodeFormat(entity)` predicate (true when the entity is an injection AND any of the four keys is present).
- **Layout** (`useGraphPositions`) — passes `ST_NODE_HEIGHT` to dagre for entities matching `isStNodeFormat`; everything else stays at `NODE_MIN_HEIGHT`.
- **Fingerprint** (`layoutFingerprint`) — folds in the S&T-format flag per entity so toggling triggers a relayout. Also extended to include the new OR / XOR groupIds in edge keys (was: only `andGroupId`).
- **TPNode** — renders the 5-facet card body when `isStNodeFormat` is true. A new `StFacetRow` subcomponent draws each row with a label column + value column; the Strategy row uses indigo-accent text so it stands out from the three assumption rows. Empty facets render an italic `(unset)` placeholder.
- **EntityInspector** — new `StFacetsSection` (`'st'` diagram + `injection` entity gating) with four textareas for the facets. Filling any one of them flips the canvas card into the 5-row layout automatically.

5 tests in `stNodeFormat.test.ts` lock in the `isStNodeFormat` trigger semantics.

### Verification

- `tsc --noEmit` → exit 0
- `biome check` → 313 files, no errors
- `vitest run` → **106 files, 863 tests passing** (up from 848)
- `vite build` → 5.31 s
- `check:bundle-size` → all chunks within ceiling (icons budget bumped 8.5 KB → 12.5 KB deliberately)

### Knobs not yet exposed

- **FL native operator type for OR / XOR junctors** — currently FL renders all three as generic junctors; using FL's `operator` attribute would let real FL render them with the right visual. Parked behind real FL-driven usage feedback.
- **5-facet card editing on the canvas itself** — today the four facet attributes are only editable from the inspector. A future polish could surface inline-edit affordances on each facet row.

## Session 75 — Bundle 10: Strategy & Tactics Tree + Freeform diagram

Two new diagram types ride on top of the existing entity/edge model — no schema migration needed, just additions to every `Record<DiagramType, _>` map across the codebase. Also fixes one Session-72 omission discovered along the way (note entity was missing from the persistence guard).

End state: tsc clean, Biome clean, **848 tests passing** (was 825; +18 for `bundle10DiagramTypes` + 4 for existing tests now covering the new types + 1 for the freeform-checklist case), build green, bundle within budget.

### FL-DT4 — Strategy & Tactics Tree

Goldratt's S&T tree as a thin shell over the existing TOC entity model. The book's structure maps cleanly onto types we already have:

- **Strategy** (apex + nested) → `goal`
- **Tactic** → `injection`
- **Necessary / Parallel / Sufficiency Assumption** → `necessaryCondition` for the structural slot, `assumption` for the free-form ones

A dedicated diagram-type avoids cluttering the CRT/FRT palettes with these usages while signaling "this tool understands S&T."

**Where it lives:**
- New `'st'` member in the `DiagramType` union (`src/domain/types.ts`).
- `DIAGRAM_TYPE_LABEL.st = 'Strategy & Tactics Tree'`.
- `PALETTE_BY_DIAGRAM.st = ['goal', 'injection', 'necessaryCondition', 'effect', 'assumption', 'note']`.
- `defaultEntityType('st') = 'injection'` (= the tactic — the "do something" pole, most likely intent on a double-click).
- `LAYOUT_STRATEGY.st = 'auto'` + `HANDLE_ORIENTATION.st = 'vertical'`.
- New `ST` method checklist in `src/domain/methodChecklist.ts` — 6 steps drawn from the book's S&T method: apex strategy → tactic → NA / PA / SA assumptions → recursive decomposition.
- `INITIAL_DOC_BY_DIAGRAM.st = emptySeed` — fresh canvas; the apex strategy is the first thing the user types.
- Example builder `src/domain/examples/st.ts` — a 6-entity two-level S&T showing the canonical decomposition pattern.
- `RULES_BY_DIAGRAM.st = STRUCTURAL_RULES` — entity-existence, causality-existence, clarity, tautology, cycle, indirect-effect. The S&T-specific "every tactic has at least one NA / PA / SA" rule is parked until usage warrants the prescription.

The new "New Strategy & Tactics Tree" and "Load example Strategy & Tactics Tree" palette commands fall out automatically — `documentCommands` already iterates `EXAMPLE_BY_DIAGRAM`.

### FL-DT5 — Freeform diagram

The non-TOC mode: no built-in type pattern matching, no method checklist, no prescribed structure. Useful for argument-mapping, brainstorm boards, dependency sketches that don't fit a TOC pattern. Custom entity classes (B10) layer on top to give users their own typology when they want one.

**Where it lives:**
- New `'freeform'` member in `DiagramType`.
- `DIAGRAM_TYPE_LABEL.freeform = 'Freeform Diagram'`.
- `PALETTE_BY_DIAGRAM.freeform = ['effect', 'assumption', 'note']` — only the universally-applicable types. Custom classes append automatically via `paletteForDoc`.
- `defaultEntityType('freeform') = 'effect'` (neutral box).
- `LAYOUT_STRATEGY.freeform = 'auto'` + `HANDLE_ORIENTATION.freeform = 'vertical'`. Drag-to-pin (LA5) covers the "place this node here specifically" need without forcing manual layout for everyone.
- `METHOD_BY_DIAGRAM.freeform = []` — empty by design; the Document Inspector hides the checklist section when the array is empty.
- `INITIAL_DOC_BY_DIAGRAM.freeform = emptySeed`.
- Example builder `src/domain/examples/freeform.ts` — a small argument-mapping sketch (claim + two evidence nodes + caveat + note) demonstrating the freeform shape.
- `RULES_BY_DIAGRAM.freeform = STRUCTURAL_RULES` — the type-pattern-matching CLR rules (cause-effect-reversal, predicted-effect-existence, ec-missing-conflict, external-root-cause, complete-step, additional-cause, cause-sufficiency) skip freeform entirely, since they're meaningless without their target entity types.

### Bug fix — `isEntityType` missing `'note'`

Session 72 added `'note'` to the `EntityType` union but missed the `isEntityType` guard's runtime set. The bug would have surfaced on any JSON import that carried a note entity — the persistence validator would have rejected it. Caught during the Bundle 10 audit (`isDiagramType` needed the same treatment for the two new types); fixed both in `src/domain/guards.ts`.

### Tests

- New `tests/domain/bundle10DiagramTypes.test.ts` (18 tests) — for each of `st` and `freeform`: `isDiagramType` recognition, label, palette content, default entity type, layout strategy + handle orientation, method checklist, `createDocument` output, JSON round-trip, example builder, validator subset for freeform.
- Updated `tests/domain/methodChecklist.test.ts` — the "every diagram type has ≥1 step" rule now excludes freeform with an explicit assertion that freeform's checklist is empty.

### Verification

- `tsc --noEmit` → exit 0
- `biome check` → 309 files, no errors
- `vitest run` → **102 files, 848 tests passing** (up from 825)
- `vite build` → 6.39 s
- `check:bundle-size` → all budgeted chunks within ceiling (+1.1 KB gzip in the main bundle for the two new diagram-type registrations + S&T example + freeform example)

### Knobs not yet exposed

- **S&T-specific CLR rule** ("every tactic must have at least one NA / PA / SA"). Parked — would prescribe the book's facet shape rigidly. Add when a user asks for the nudge.
- **First-class S&T node rendering.** Today an S&T tree uses individual entities for each facet. A future iteration could collapse the 5-facet card into a single visual entity that carries all five fields, matching the book's diagrams more literally. Bigger UI lift; parked behind real usage feedback.
- **Manual-layout default for freeform.** Today freeform uses auto-layout with drag-to-pin overrides. If users find auto-layout too prescriptive for non-tree shapes, flipping `LAYOUT_STRATEGY.freeform` to `'manual'` is a one-line change — but loses dagre's "good enough" starting point for any new entity.

## Session 74 — FL-EX9 backup recovery + FL-CO1 share-links + tooling reconciliation

Two user-facing features from Bundle 12 plus a backlog audit of the tooling group. End state: tsc clean, Biome clean, **825 tests passing** (was 813; +6 for `persistenceRecovery` + +6 for `shareLink`), build green, bundle within budget.

### FL-EX9 — Backup-slot auto-recovery

The existing 2-level autosave (committed `doc` + live-draft `docLive`) covered the common "tab killed mid-typing" case via A5. The remaining gap was a corrupted main slot — possible from a mid-write tab kill that left an incomplete JSON in localStorage, or external storage tampering. Adds a third slot that's lazily populated with the prior committed doc on every save.

**Storage** (`src/services/storage.ts`):
- New `STORAGE_KEYS.docBackup` key for the previous-save snapshot.

**Persistence** (`src/domain/persistence.ts`):
- `saveToLocalStorage` now reads the existing main slot and writes it to the backup slot BEFORE overwriting main. The backup always lags the main slot by one save — so on a corrupted main, the user loses at most one save's worth of changes.
- New `loadFromLocalStorageWithStatus(): LoadResult` returns both the doc and recovery metadata (`recoveredFromBackup`, `recoveredFromLiveDraftOnly`). The legacy `loadFromLocalStorage()` is preserved as a thin wrapper that drops the metadata — existing tests + callers untouched.
- Fallback chain: committed (intact) → backup (committed unreadable) → live (both committed + backup unreadable). The "newer wins among survivors" rule still applies when multiple slots are usable.

**Boot path** (`src/store/documentSlice/docMetaSlice.ts` + `src/App.tsx`):
- Module-level `bootRecoveryStatus` captures the load metadata at slice-creation time.
- App's first useEffect reads it and shows an `info` toast when recovery happened: "Recovered from backup — the previous session ended unexpectedly..." or "Recovered unsaved edits — the committed snapshot was unreadable, but your live draft was intact." Guarded against StrictMode double-invoke via a module-level flag.

**Tests** — new `tests/domain/persistenceRecovery.test.ts` (6 tests): backup slot is populated only after a second save; corrupted-main falls back to backup; both-dead falls back to live draft; clean status on happy path; tie-breaking when both backup + live exist; legacy `loadFromLocalStorage` strips the metadata.

### FL-CO1 — Reader Mode share-links

A static read-only share mechanism that requires no server, no upload, no account. The sender hits **Cmd/Ctrl+K → Copy read-only share link**; the receiver opens the URL and the doc loads with Browse Lock auto-engaged.

**Implementation** (`src/services/shareLink.ts`):
- `generateShareLink(doc)` — encodes the doc as gzip → URL-safe base64 → puts it in a `#!share=<payload>` URL fragment. Uses the native `CompressionStream('gzip')` API (Chrome 80+, FF 113+, Safari 16.4+). Hand-rolls the `ReadableStream` from a single-chunk encoded JSON rather than using `Blob.stream()` so the same code path works in jsdom for tests.
- `parseShareHash(hash)` — reverse operation. Returns `null` when the fragment isn't a share payload; throws with a descriptive error when it IS a share link but decompression / validation fails.
- `clearShareHash()` — strips the fragment from the URL via `history.replaceState` after a successful load, so a refresh doesn't keep re-loading the same shared doc.
- Soft warning threshold `SHARE_LINK_SOFT_WARN_BYTES = 4096`: links above this size copy with an "info" toast warning that some chat clients may truncate.

**Boot path** (`src/App.tsx`):
- Second useEffect runs on first render: if `window.location.hash` starts with `#!share=`, await `parseShareHash`, then `setDocument(shared)` + `setBrowseLocked(true)` + `clearShareHash()` + success toast. Errors surface as `error` toasts.
- `setDocument` already auto-snapshots the outgoing doc as a revision, so the receiver can roll back to their own working copy if they want one.

**Palette** (`src/components/command-palette/commands/export.ts`):
- New "Copy read-only share link" command in the Export group. Uses `navigator.clipboard.writeText`; falls back to an error toast if the clipboard API isn't available.

**Tests** — new `tests/services/shareLink.test.ts` (6 tests): URL-shape round-trip, doc-shape round-trip (titles + entity / edge id sets), `null`-on-non-share-hash, throw-on-corrupted-payload, small-doc-fits-soft-threshold, `clearShareHash` strips the fragment without reloading.

### Tooling/process — reconciliation only

Audit pass found that **3 of the 4 tooling-group items already shipped**:

- **Husky / pre-commit hooks.** `simple-git-hooks` is installed as a devDep; `package.json` configures `pre-commit` → `lint-staged` (biome on staged files) and `commit-msg` → `scripts/check-commit-msg.cjs`. The `postinstall` hook installs the actual git hooks. Functionally equivalent to husky/lefthook with a smaller dep surface.
- **Conventional Commits enforcement.** `scripts/check-commit-msg.cjs` is wired to the `commit-msg` git hook; commits with non-conformant subject lines are rejected at commit time with a helpful error message + examples.
- **`.editorconfig`.** Present at the repo root with the expected `indent_style = space`, `indent_size = 2`, `end_of_line = lf`, `charset = utf-8`, `insert_final_newline = true` settings + Markdown / YAML overrides.

The fourth item — **Storybook** — is deferred with a documented rationale. The NEXT_STEPS framing already said "Worth it once there are more primitives," and the current primitive count (~6: Button, Field, MarkdownField, MarkdownPreview, ConfirmDialog, ErrorBoundary) hasn't grown to where the dev-dep cost (~25-50 MB) and ongoing maintenance is repaid by the discoverability win. Existing component tests cover the functional surface. Revisit if the primitive count doubles or if we onboard contributors who'd benefit from a visual playground.

### Verification

- `tsc --noEmit` → exit 0
- `biome check` → 306 files, no errors
- `vitest run` → **102 files, 825 tests passing** (up from 813)
- `vite build` → 9.13 s
- `check:bundle-size` → all budgeted chunks within ceiling

### Knobs not yet exposed

- **Multi-document tabs (FL-EX8) and cross-document hyperlinks (FL-CO2).** The biggest items remaining in Bundle 12. FL-EX8 is a meaningful refactor of the single-doc store (`docs: Record<DocId, TPDocument>` + `activeDocId`); FL-CO2 depends on it. Deferred to a future session.
- **Storybook.** See rationale above; the trigger is "primitive count doubles."

## Session 73 — Bundle 8: structural edge operators (FL-ED1 + FL-ED3 + FL-ED4)

Three coordinated edge-model additions. The AND junctor infrastructure from E6 generalized to support two more junctor kinds (OR, XOR) plus a new edge-weight tag for polarity. Schema additions are purely additive; no migration needed.

End state: tsc clean, Biome clean, **813 tests passing** (was 802; +11 for the new `junctorGroups` test file), build green, bundle within budget.

### FL-ED1 — Edge polarity (weight)

New `Edge.weight?: 'positive' | 'negative' | 'zero'` field. Metadata only — the CLR rules and the cycle / cause-effect-reversal validators continue to treat every edge as a structural link; weight is for human-readable polarity tagging.

- **Schema** (`src/domain/types.ts`): new `EdgeWeight` type union + the optional `weight` field on `Edge`.
- **Store**: new `setEdgeWeight(edgeId, weight | undefined)` action in `edgesSlice`. History-coalesces on identical-value reassignment; clearing to `undefined` drops the field entirely from the persisted JSON so unset edges stay minimal.
- **Inspector**: new "Polarity" 4-button picker (`Default` / `Positive` / `Negative` / `Zero`) in the Edge Inspector. `Default` maps to `undefined` (the cleanest data representation of "user has not opined").
- **Canvas**: small rose `−` badge for negative weight, neutral `∅` badge for zero. Positive + unset render no badge — the default sufficiency reading is the implicit positive.
- **Persistence validator**: accepts `weight` ∈ {positive, negative, zero}; throws on any other value.

### FL-ED3 — XOR junctor

Mutual-exclusion junctor across a set of edges sharing a target. Visual mirror of AND: a small white rose-stroked circle labelled "XOR" sits just below the target; all members of the group converge into the circle from below; one short arrowed line continues into the target.

- **Schema**: new optional `Edge.xorGroupId?: string` field.
- **Store**: new `groupAsXor(edgeIds)` / `ungroupXor(edgeIds)` actions. Same shape as `groupAsAnd`: minimum 2 edges, all must share a target. Refuses to group if any selected edge already belongs to an AND or OR group (cross-kind exclusivity — each edge in at most one junctor).
- **ContextMenu + MultiInspector + command palette**: "Group as XOR" / "Ungroup XOR" mirror the AND counterparts.
- **Edge Inspector**: shows the XOR group id with an Ungroup button when set.

### FL-ED4 — Explicit OR junctor

Same shape as XOR but with indigo stroke and the label "OR". Makes alternation visible on the canvas instead of relying on the implicit "two non-AND-grouped incoming edges = either suffices" reading.

- **Schema**: new optional `Edge.orGroupId?: string` field.
- **Store**: `groupAsOr(edgeIds)` / `ungroupOr(edgeIds)`, parallel to AND and XOR.
- **ContextMenu + MultiInspector + command palette**: "Group as OR" / "Ungroup OR" surface alongside the other two kinds.

### Shared infrastructure refactor

`groupAsAnd` / `ungroupAnd` rewritten on top of a generic `groupAs(kind, …)` / `ungroup(kind, …)` helper inside `edgesSlice`. The three exposed actions thin-wrap the helper; cross-kind exclusivity logic lives in one place.

`ANDOverlay.tsx` renamed to `JunctorOverlay.tsx` and generalized to render all three junctor kinds:
- AND keeps its violet stroke (matches the historical `EDGE_STROKE_AND` token).
- OR uses indigo-500 (matches the app's accent).
- XOR uses rose-500 (warm exclusionary tone; distinct from the red mutex stroke).

The overlay reads `andGroupId` / `orGroupId` / `xorGroupId` one-of-three per edge; cross-kind exclusivity is enforced at the store and persistence layers so a target never has two junctors of different kinds.

`useGraphEdgeEmission` now forwards all three groupId fields to `TPEdgeData`, and a junctor-grouped edge stops at the junctor circle regardless of kind. `TPEdge` reads all three to compute `isJunctorGroup`; the stroke uses the AND-violet for all kinds (the junctor circle is where you read the kind off).

### Persistence — cross-kind conflict resolution

`validateEdge` accepts all three groupId fields and the new weight field. Cross-kind conflicts in a hand-edited JSON resolve deterministically: AND wins, then OR, then XOR. The store actions never produce a conflict; this is purely defensive against external edits.

### Flying Logic interop

The FL writer continues to emit AND junctors only; OR and XOR groupings are dropped on FL export (the underlying edges still write — only the grouping metadata is lost). Native FL doesn't have separate OR / XOR junctor types, so we accept the asymmetric round-trip. AND junctors continue to round-trip losslessly via the existing reader. Edge polarity (weight) is dropped on FL export today; round-trip support is a future polish item.

### Tests

New `tests/domain/junctorGroups.test.ts` (11 tests):
- `groupAsOr` happy path, target-mismatch refusal, minimum-2-edges refusal
- `groupAsXor` happy path
- Cross-kind exclusivity: AND blocks OR, OR blocks XOR, ungrouping AND clears the path to OR
- `ungroupOr` drops only `orGroupId`, leaves other fields intact
- `setEdgeWeight`: set / clear / history-coalesce / JSON round-trip

### Verification

- `tsc --noEmit` → exit 0
- `biome check` → 303 files, no errors
- `vitest run` → **100 files, 813 tests passing** (up from 802)
- `vite build` → 8.84 s
- `check:bundle-size` → all budgeted chunks within ceiling (flow 131.1 KB / 136.7 KB unchanged; main bundle +1.5 KB gzip for the three new junctor kinds + weight inspector)

### Knobs not yet exposed

- **Flying Logic round-trip for OR / XOR / weight.** Deferred until users actually round-trip junctor-heavy diagrams through FL. FL's native model uses generic "operator" vertices that can take a `type` attribute — adding two more junctor types is mechanical but only worth it on demand.
- **Visual differentiation on the edge body itself.** All three junctor kinds currently use the same violet stroke for the connector edges; the kind labels live on the junctor circle. A future polish item might colour the connectors to match their junctor (indigo for OR-feeders, rose for XOR-feeders). Tradeoff: more colour on the canvas vs. one less place to read the kind.

## Session 72 — Bundle 4 reconciliation + Bundle 7 (FL-ET7 Note entity)

Backlog audit + one new entity type. The "Bundle 4 — Layout Controls" line in NEXT_STEPS was stale: FL-LA1 (direction), FL-LA2 (bias / `align`), FL-LA3 (compactness slider), and FL-IN1 (Layout Inspector panel) **all shipped in Session 47** under "Block A: Layout Controls" and live today in Settings → Layout. FL-LA4 (incremental relayout) is the only remaining knob from that bundle and is documented as parked. Bundle 4 closed via reconciliation only — no code change.

For Bundle 7, FL-ET6 (Critical Success Factor) is already a built-in entity type (`criticalSuccessFactor`) — confirmed in `entityTypeMeta.ts` LABELS map. FL-ET8 / FL-ET9 / FL-IN3 (custom classes + icon picker + Domain Inspector) shipped Sessions 70 + 71. FL-IN5 (tabs per element type) is rejected on UX grounds — the current sectioned inspector already groups properties cleanly; tabs would add a click without exposing more information. The genuine open work was **FL-ET7 — Note entity**, shipped this session.

End state: tsc clean, Biome clean, **802 tests passing** (was 792; +10 for the new `noteEntity` test file), build green, bundle within budget.

### FL-ET7 — Note entity

A free-form annotation entity that sits **outside** the causal graph. Sticky-note model: yellow stripe, `StickyNote` icon, yellow-tinted card body, no connection handles. Notes never participate in edges, CLR rules, or causality exports — they're metadata pinned next to the diagram.

**Domain types** (`src/domain/types.ts`):
- New `'note'` member added to the `EntityType` union.

**Tokens** (`src/domain/tokens.ts`):
- `ENTITY_STRIPE_COLOR.note = '#eab308'` (yellow-500 — distinct from amber `need` / `rootCause`; reads as "post-it").

**Entity-type meta** (`src/domain/entityTypeMeta.ts`):
- `note` added to `LABELS` ("Note"), `ICONS` (`StickyNote` from lucide-react), and every entry in `PALETTE_BY_DIAGRAM` via a new `UNIVERSAL_ANNOTATION_CLASSES` array. Notes appear last in every diagram's palette so they don't crowd the TOC-typed picks.

**Graph helpers** (`src/domain/graph.ts`):
- New `isNote(e)` predicate.
- New `isNonCausal(e)` predicate = `isAssumption(e) || isNote(e)` — the two entity types that exist outside the causal graph. Future non-causal types are one change away.
- `structuralEntities()` now filters out notes (was: only assumptions). Cascades automatically to every exporter that uses it: DOT, Mermaid, OPML, VGL, reasoning narrative + outline.

**Edge guards** (`src/store/documentSlice/edgesSlice.ts`):
- `connect()` rejects when either endpoint is a note.
- `addCoCauseToEdge()` rejects when the source entity is a note (same posture as the existing assumption guard).

**Validators**:
- `entityExistenceRule` — disconnected-entity check now skips both assumptions and notes (via `isNonCausal`). Empty-title check still applies to notes (a blank note is almost certainly an unfinished stub).
- `clarityRule` — skipped entirely for notes. Sticky-note prose is allowed to run long and may end on a question; both checks would be noise. Assumptions stay in scope — they should still be one tight declarative.

**Canvas** (`src/components/canvas/TPNode.tsx`):
- Notes render with a yellow-tinted body (`bg-yellow-50` / `dark:bg-yellow-950/30`) and yellow border so the card reads as annotation, not causality.
- Source + target React Flow `<Handle>`s are suppressed for notes — users physically can't drag a connection in or out.
- Title-field placeholder switches to "Type a note…" when the entity is a note.

**Flying Logic interop** (`src/domain/flyingLogic/typeMaps.ts`):
- `ENTITY_TYPE_TO_FL.note = 'Note'` — exports under FL's stock "Note" class name.
- `FL_TO_ENTITY_TYPE.Note = 'note'` — imports as our native note type. Was previously mapped to `effect` with a TODO comment about FL-ET7; that comment is now resolved.

**Tests** — new `tests/domain/noteEntity.test.ts` (10 tests):
- `isNote` / `isNonCausal` predicate discrimination
- `structuralEntities` excludes notes
- Note appears in every diagram's palette
- `resolveEntityTypeMeta` returns the right label + stripe
- `connect()` refuses notes as endpoints (all three directions)
- `addCoCauseToEdge` refuses notes as source
- `entityExistenceRule` skips the disconnected check on notes
- `entityExistenceRule` still flags empty-titled notes
- `clarityRule` skips notes entirely
- Reasoning narrative + outline exports skip notes

One existing test (`flyingLogic.test.ts` — "maps Generic / Note / Knowledge fallback to plain effect") was updated to reflect the new contract: FL's "Note" now maps to our native `note` type instead of the `effect` fallback.

### Backlog reconciliation (no code)

NEXT_STEPS updated to mark Bundle 4 and Bundle 7 as closed. FL-IN5 marked "won't build" with rationale (matches the FL-AN4 titles-as-markdown rejection pattern from Session 60).

### Verification

- `tsc --noEmit` → exit 0
- `biome check` → 302 files, no errors
- `vitest run` → **99 files, 802 tests passing** (up from 792)
- `vite build` → 13.10 s
- `check:bundle-size` → all budgeted chunks within ceiling (flow 131.1 KB / 136.7 KB unchanged; main bundle +0.15 KB gzip for the new StickyNote icon + note guards)

## Session 71 — Confidence removal · CI hardening · root-cause-reach badge · B7/B10 finish-the-job

Three threads merged into one session: drop **Confidence** from the schema entirely (it had been parked as a future UI knob — the user is deliberately not shipping it), tighten CI with measured coverage thresholds + expanded Playwright coverage + canvas visual regression, and close the three "knobs not yet exposed" deferred items from Session 70 (edge attributes, custom-class icons, `supersetOf` validator integration).

End state: tsc clean, Biome clean, **792 tests passing** (was 787; +5 for the new `rootCauseReach` reverse-reach helper), build green, bundle within budget.

### Confidence — removed

The schema previously parked `Entity.confidence?: number` for a future inspector slider. Dropped on direct user instruction ("This is something that I am very deliberate in not including"):

- Field removed from `src/domain/types.ts`.
- `persistenceValidators.ts` no longer reads `confidence`; a comment explains that legacy v5/v6 imports may carry it and it's silently dropped (no validation error — the property is simply not copied into the in-memory entity).
- `services/clipboard.ts` entity-clone no longer references `confidence`.
- No schema bump — dropping a previously-optional field is backward-compatible. Old JSON exports still load; the field is just not carried forward.

### Group D — Testing / CI hardening

**D1 — Pin coverage thresholds.** New `scripts/pin-coverage-thresholds.mjs` reads `coverage/coverage-summary.json`, subtracts a 2 % slop margin, and writes measured thresholds into `vite.config.ts` via regex replacement. Surfaced as `pnpm coverage:pin`. Prior thresholds were nominal; the script ties them to what the suite actually covers, so a regression that drops coverage by more than 2 % now fails CI. `vite.config.ts` reporter list gained `json-summary` so the script has a stable input.

**D2 — Playwright e2e expansion.** Two new spec files exercise paths the unit tests can't easily reach:

- `e2e/delete-flow.spec.ts` — confirms the ConfirmDialog appears on delete with edges attached, and that Browse Lock short-circuits the delete with a toast instead of opening the dialog.
- `e2e/undo-redo.spec.ts` — drives `Cmd+Z` / `Cmd+Shift+Z` across three entity creates and verifies the canvas reflects each step.

**D3 — Visual regression for canvas.** `e2e/visual-canvas.spec.ts` snapshots the empty-canvas state and a 3-entity arrangement with `toHaveScreenshot({ maxDiffPixelRatio: 0.02 })`. The 2 % tolerance absorbs anti-aliasing drift across runs without letting a real visual regression sneak through.

### Group E — UX polish (E2 reverse-reach badge)

**E2 — root-cause-reach badge.** Mirror of the existing `→N UDEs` badge, but counted backward: how many root causes transitively feed each entity. Useful inverse signal — a high count on an UDE confirms it has many independent contributing causes; a low count flags an "orphan" UDE that may need more root-cause work.

- New `rootCauseReachCounts(doc): Map<string, number>` in `src/domain/coreDriver.ts` — backward BFS from each root cause; self-counts are excluded (a root cause doesn't count itself).
- `useGraphNodeEmission.ts` computes and stamps `rootCauseReachCount` on each `TPNodeData`.
- `TPNode.tsx` renders a sky-colored `←N root causes` pill in the bottom-right, mirroring the bottom-left UDE-reach pill.
- New preference `showReverseReachBadges` in `preferencesSlice` — defaults off, persists to localStorage. Toggle lives in **Settings → Display → Show root-cause-reach badge**.
- New `tests/domain/rootCauseReach.test.ts` — 5 tests covering empty doc, single-root, two-roots-converging, self-counting exclusion, transitive count through intermediate effects.

**E1 — drag-drop splice variant.** Deliberately deferred. TP Studio has no node-palette tray, so the canonical Flying Logic gesture (drag from palette onto edge) has no natural starting point. Right-click splice + the palette equivalent already cover the workflow.

### Group B — Finish-the-job for B7 + B10

**B1 — Edge attributes.** Symmetric with B7's entity attributes:

- `Edge.attributes?: Record<string, AttrValue>` added to `src/domain/types.ts`.
- `setEdgeAttribute(id, key, value)` and `removeEdgeAttribute(id, key)` in `edgesSlice.ts`, mirroring the entity-attribute actions (history-coalesce on identical value, collapse to undefined when last key removed).
- `validateAttributes` extended to `validateEdge` in `persistenceValidators.ts`.
- `AttributesSection.tsx` refactored from entity-specific to a generic component with `attributes` / `onSet` / `onRemove` props. An `EntityAttributesSection` wrapper preserves the entity call site; `EdgeInspector` mounts the generic component directly, between `EdgeAssumptions` and `WarningsList`.

**B2 — Custom-class icon picker.** Custom entity classes can now carry an icon name beyond the generic `Box` fallback:

- `CustomEntityClass.icon?: string` added to the schema with a documented contract: round-trip preserves any string, but the resolver only renders names from the curated catalogue.
- New `CUSTOM_CLASS_ICONS` catalogue in `entityTypeMeta.ts` — 17 Lucide icons curated for TOC-adjacent semantics (BookOpen, Box, CheckSquare, Compass, FileText, Flag, Hammer, Heart, HelpCircle, Lightbulb, Link2, Milestone, Mountain, Quote, Shield, Sparkles, Sprout, Star, Syringe, Target, ThumbsDown, ThumbsUp, Users, Zap). Chose a curated set over exposing the full ~1500-icon Lucide library to keep the picker scannable and the bundle bounded.
- `resolveEntityTypeMeta` now looks up icon via the catalogue with `Box` as fallback for unknown / undefined names.
- `CustomEntityClassesSection.tsx` gained an icon grid in the add-form (one button per catalogue entry, selected/unselected styling) and renders the chosen icon next to each existing class row.

**B3 — `supersetOf` validator integration.** The `supersetOf` field had been stored and round-tripped since Session 70 but no validator consulted it. Three CLR rules now treat custom classes as their built-in supersets via a new `isOfBuiltin(typeId, builtin, customClasses)` helper:

- `causeEffectReversal` — a custom class with `supersetOf: 'rootCause'` is treated as a root cause; with `supersetOf: 'ude'` is treated as a UDE.
- `predictedEffectExistence` — a custom class with `supersetOf: 'injection'` triggers the rule.
- `ecMissingConflict` — a custom class with `supersetOf: 'want'` joins the Wants set the rule scans.

The helper short-circuits to the trivial equality check for built-in ids, so the integration is cheap on the hot path.

### Verification

- `tsc --noEmit` → exit 0
- `biome check` → 301 files, no errors (cleaned up 4 stale tsc-emitted `.js` / `.d.ts` artifacts under repo root + auto-fixed 3 pre-existing `.cjs` script lints)
- `vitest run` → **98 files, 792 tests passing** (up from 787)
- `vite build` → 6.77 s
- `check:bundle-size` → all budgeted chunks within ceiling (flow 131.1 KB / 136.7 KB, index 90.7 KB / 97.7 KB)

### Knobs not yet exposed

- **Lazy-load dagre.** Still parked from Session 67. Would shave ~25 KB gzip from the main chunk; needs a `dynamic import('@/domain/layout')` with Suspense fallback that cascades `await` through every caller. Bundle is well within budget without it.
- **Custom-class icon picker — full library.** The curated 17-icon set covers the common semantic categories. Letting users type any Lucide name (with autocomplete) is parked behind a UX question: a free-form picker rarely produces icons that scan well at canvas zoom levels, and the round-trip already preserves unknown names if a power user edits the JSON directly.

## Session 70 — B7 + B10: structural extensibility

The big one from the backlog. Two paired structural-extensibility features that reshape TP Studio from a fixed-typology TOC diagrammer into a tool whose typology + per-entity metadata can be extended per-document.

End state: tsc clean, Biome clean, **787 tests passing** (was 764; +10 B7 + 13 B10), build green, bundle within budget. Schema bumped v5 → v6 with a purely additive migration.

### B7 — User-defined attributes

Entities can now carry arbitrary key/value metadata beyond the 16 built-in fields. Use case: domain-specific notes like "vendor", "stage", "probability", "URL" that the built-in `description` / `attestation` / `confidence` fields don't cover.

**Domain types** (`src/domain/types.ts`):
- New `AttrValue` discriminated union: `{ kind: 'string' | 'int' | 'real' | 'bool', value }`
- New `AttrKind` discriminator alias for UI consumers
- New optional `Entity.attributes?: Record<string, AttrValue>` field

**Store actions** (`store/documentSlice/entitiesSlice.ts`):
- `setEntityAttribute(id, key, value)` — add or replace; no-ops on identical value (history-coalesce contract)
- `removeEntityAttribute(id, key)` — collapses `attributes` to undefined when the last key is removed

**UI** — new `src/components/inspector/AttributesSection.tsx`:
- Lives in `EntityInspector` below `<AttachedEdgesList>` and above `<WarningsList>`
- Per-attribute row: key (read-only after creation), kind label, value input (typed per kind), trash button
- "+ Add attribute" opens an inline form for key + kind picker
- Kind-aware inputs: text for string, number with step=1 for int, number step="any" for real, checkbox for bool
- Disabled when Browse Lock is on

**Persistence** (`src/domain/persistenceValidators.ts`):
- New strict `validateAttrValue` — rejects unknown `kind` or wrong value shape
- New `validateAttributes` — strict map validator; drops the field when empty
- Wired through `validateEntity` so JSON imports surface bad attrs with the offending key in the error message

### B10 — Custom entity classes

Users can define document-scoped entity types beyond the 14 built-ins (UDE, Effect, Root Cause, …). Each custom class carries its own label and color; an optional `supersetOf` marks it as "a kind of" a built-in for validator compatibility.

**Domain types** (`src/domain/types.ts`):
- New `CustomEntityClass` type: `{ id, label, color?, hint?, supersetOf? }`
- New optional `TPDocument.customEntityClasses?: Record<string, CustomEntityClass>` field
- Slug rule enforced at persistence boundary: lowercased, `[a-z0-9-]+`, no shadowing of built-in entity-type ids

**Doc-aware resolver** (`src/domain/entityTypeMeta.ts`):
- New `resolveEntityTypeMeta(typeId, customClasses?)` — three-step lookup: built-in → custom → fallback placeholder (`Box` icon, neutral slate stripe). Used everywhere `ENTITY_TYPE_META[type]` used to be.
- New `entityMeta(typeId, doc?)` convenience wrapper that pulls `doc.customEntityClasses`
- New `paletteForDoc(doc)` returns built-ins + custom classes (sorted by id) for the inspector "Type" picker and context-menu "Convert to" entries
- New `effectiveBuiltinType(typeId, customClasses)` returns `supersetOf` for custom classes — used by validators and foreign-format exporters to substitute a known type

**Store actions** (`store/documentSlice/docMetaSlice.ts`):
- `upsertCustomEntityClass(cls)` — add or replace; no-ops on identical class definition
- `removeCustomEntityClass(id)` — entities currently typed as the removed class continue to render via the resolver's "unknown" fallback (label = the id, neutral stripe). User can pick a different type from the Inspector afterward; deletion is non-destructive.

**UI** — new `src/components/settings/CustomEntityClassesSection.tsx`:
- Lives in `DocumentInspector` between the Method Checklist `<details>` and the stats panel
- Per-class row: color swatch, label, id (mono-font), `supersetOf` indicator, trash button
- "+ Add class" form: id input (slug-validated), label, color picker, supersetOf dropdown
- Client-side validation matches the persistence validator: id must be lowercased + alphanumeric-dashes, must not collide with a built-in, label required, no duplicate id

**Render** — TPNode, EntityInspector, MultiInspector, ContextMenu, SideBySideDialog:
- All five sites switched from direct `ENTITY_TYPE_META[type]` lookup to `resolveEntityTypeMeta` so custom-class entities pick up their custom color + label.
- `EntityInspector` "Type" picker and `MultiInspector` "Convert all to" picker now include custom classes via `paletteForDoc`.

**Export fallback** — Mermaid + DOT:
- Both exporters route type lookups through `resolveEntityTypeMeta`, so custom-class entities export with their custom label + color.
- Mermaid `classDef` names sanitize custom-id characters (`type_my-class` → `type_my_class`) so the syntax stays valid.
- The N3 Mermaid importer accepts and ignores unknown `type_<id>` class lines, so a round-trip via Mermaid drops the custom-class info but preserves the structure (importable to a doc without the class definition).

**Persistence** (`src/domain/persistenceValidators.ts`):
- New soft validators `validateCustomEntityClass` (per-entry) and `validateCustomEntityClasses` (the map). Soft = drops bad entries rather than failing the whole import.
- Entries where the map key doesn't match `class.id` are dropped (corrupt import); built-in id collisions are dropped (built-in wins).

### Schema migration

- `CURRENT_SCHEMA_VERSION` bumped to **6**
- New `v5ToV6` migration in `src/domain/migrations.ts` — purely a version bump (both new fields are optional and additive; existing v5 docs round-trip unchanged)
- Updated all `schemaVersion: 5` literals to `6` across: `factory.ts`, the 5 example builders (`crt`, `frt`, `prt`, `tt`, `ec`), `spawnEC.ts`, `persistence.ts` (importFromJSON return), `tests/domain/helpers.ts`
- Updated assertion sites in `tests/domain/factory.test.ts` and `tests/domain/migrationsRoundTrip.test.ts` to expect 6
- The `migrationsRoundTrip` test already covers v1 → current; it now exercises v5 → v6 transparently

### Tests

- **`tests/store/entityAttributes.test.ts`** — 10 tests covering B7 store actions, history coalescing, kind-mismatch tolerance, JSON round-trip
- **`tests/store/customEntityClasses.test.ts`** — 13 tests covering B10 CRUD, `resolveEntityTypeMeta` precedence (built-in beats custom beats unknown), `paletteForDoc` ordering, soft-validator drop behavior for malformed imports

### Verification

- `tsc --noEmit` → exit 0
- `biome check src/ tests/` → 282 files, no errors
- `vitest run` → **97 files, 787 tests passing** (up from 764)
- `vite build` → 23.86s (most of that is initial bundle re-creation after schema bump)
- `check:bundle-size` → all chunks within ceiling

### Knobs not yet exposed

- **Edge attributes.** B7 lands on entities only; edges have their own metadata system (`label`, `description`, `assumptionIds`) and don't yet carry user-defined attributes. Adding `Edge.attributes` is the same shape as Entity's; the symmetry was deliberate but skipped for v1 since edges are already lighter on built-in fields.
- **Custom-class icons.** Custom classes currently always render with the generic `Box` icon. Letting users pick a Lucide icon by name is parked — the labels + colours give enough visual differentiation for v1.
- **`supersetOf` validator integration.** The field is stored and round-trips; the CLR rules don't yet consult `effectiveBuiltinType` to treat custom classes as their built-in supersets. Hooking it through is mechanical once the cascade is understood; deferred until a real consumer asks for it.

## Session 69 — Test-coverage sweep (20 gaps + 2 fixes)

Filled in 20 test-coverage gaps identified during a post-session-68 audit. Plus two real bug/duplication fixes the audit surfaced. End state: **764 tests passing** (was 644), tsc clean, Biome clean, build green, bundle within budget.

### Fixes

- **Duplicate z-index scale removed.** Session 68 #11 added `Z_LEVELS` in `domain/constants.ts`, unaware that `domain/zLayers.ts` already had a richer, more-documented `Z` table covering React Flow's internal layers plus app chrome. Deleted my `Z_LEVELS`; `Z` from `zLayers.ts` is the canonical scale.
- **Browse-Lock guard missing on `confirmAndDeleteEntity` / `confirmAndDeleteSelection`.** Found by writing the "Browse Lock + ConfirmDialog interaction" test (which initially failed). The two confirm-bearing helpers (called from context-menu / keyboard handlers, NOT via palette `withWriteGuard`) previously opened the confirm dialog even when Browse Lock was on — the user saw a "Delete?" prompt that then did nothing. Now both short-circuit with `guardWriteOrToast()` before prompting, so the Lock toast fires instead.

### New test files

| # | File | Covers |
|---|---|---|
| 1 | `tests/store/toastDedup.test.ts` | `showToast` dedup logic (3 tests) |
| 2 | `tests/services/persistScheduler.test.ts` | `PersistScheduler` class isolation (5 tests) |
| 3 | `tests/hooks/useFingerprintMemo.test.tsx` | hook memo contract + stale-closure rule (3 tests) |
| 4 | `tests/services/pickFile.test.ts` | shared file-picker pipeline (4 tests) |
| 5 | `tests/services/logger.test.ts` | test-mode silence contract (3 tests) |
| 6 | `tests/components/ConfirmDialog.test.tsx` | component render + button paths (4 tests) |
| 8 | `tests/services/imageExporters.test.ts` | early-return paths for PNG/JPEG/SVG (4 tests) |
| 9 | `tests/services/canvasRef.test.ts` + `entityRefs.test.ts` | RF instance cache + entity navigation (4 + 7 tests) |
| 10 | `tests/domain/persistenceValidators.test.ts` | soft validators (drop-bad-fields rules; 12 tests) |
| 11 | `tests/domain/redact.test.ts` | content-scrub invariants for sharing (7 tests) |
| 12 | `tests/domain/fingerprint.test.ts` | layout vs validation fingerprint boundaries (12 tests) |
| 13 | `tests/domain/guards.test.ts` | type-guard accept/reject sets (6 describes) |
| 14 | `tests/store/persistRoundTrip.test.ts` | edit → debounce → flush → reload (4 tests) |
| 15 | `tests/services/browseLockGuardWithConfirm.test.ts` | the bug-fix above (2 tests) |
| 16 | `tests/components/KebabMenu.test.tsx` (extended) | doc-type change while menu open (+1 test) |
| 17 | `tests/domain/shortcutUniqueness.test.ts` | registry id + (keys, group) uniqueness (2 tests) |
| 18 | `tests/components/TPNode.test.tsx` + `TPEdge.test.tsx` | canvas-family render smoke (5 + 2 tests) |
| 19 | `tests/components/overlaySmoke.test.tsx` | 8 overlay components mount + show/hide (12 tests) |
| 20 | `tests/components/formPrimitives.test.tsx` | extracted Settings primitives (10 tests) |

Tests #7 was folded into #4 (the cancellation path lives in the same `pickFile` test file).

### Bugs caught by writing the tests

Two test additions surfaced real issues that I fixed as part of this session:

1. The Browse-Lock + confirm-dialog interaction described above.
2. A subtle test-rig bug in jsdom: `File.prototype.text()` isn't implemented uniformly across jsdom versions. `pickFile.test.ts` includes a `makeTextFile()` helper that monkey-patches `.text()` per-instance so the picker's `file.text()` call resolves deterministically.

### Verification

- `tsc --noEmit` → exit 0
- `biome check src/ tests/` → 278 files, no errors
- `vitest run` → **95 files, 764 tests passing** (was 75 / 644)
- `vite build` → 9.38 s
- `check:bundle-size` → all chunks within ceiling

### Test count history

| Session | Files | Tests |
|---|---|---|
| 64 (Mermaid + VGL) | — | 612 |
| 65 (Mobile) | +1 | 620 |
| 66 (Type-error sweep + 10) | +1 | 620 |
| 67 (20 quality items) | +3 | 639 |
| 68 (20 more) | +1 | 644 |
| **69 (test-coverage sweep)** | **+20** | **764** |

## Session 68 — Second code-quality sweep (20 items)

Another round of structural improvements from a fresh audit. 18 of 20 items shipped behavior-unchanged; 2 evaluated as audit-clean (premise didn't apply). End state: tsc clean, Biome clean, **644 tests passing** (was 639), build green.

### Type system & naming

- **#6 — `Brand<T, B>` type helper** in `src/domain/types.ts`. Replaces four hand-rolled `unique symbol` brands with one `type Brand<T, B extends string> = T & { readonly __brand: B }` parameterised generic; `EntityId` / `EdgeId` / `DocumentId` / `GroupId` all rewrite to `Brand<string, 'EntityId'>` etc. Adding a new branded id is now one line.
- **#11 — `Z_LEVELS` constant table** in `src/domain/constants.ts`. Names the five layering tiers (`inline`, `panel`, `banner`, `contextMenu`, `modal`) so future floating UI doesn't reach for a Tailwind `z-25` literal without a reason. Existing components still carry their Tailwind classes (`z-10`, `z-30`, etc.) — the table is the documented authority.
- **#12 — `src/domain/ids.ts`** centralizes the 7 sites that did `nanoid() as EntityId`/`EdgeId`/`DocumentId`/`GroupId`. Exports `newEntityId()` etc.; `factory.ts`, `examples/*`, `spawnEC.ts` all migrated. Future swap (UUIDv7, deterministic test ids) lands in one file.
- **#13 — `DataComponent` enum** in `src/components/dataComponentNames.ts`. Names the 10 `data-component="..."` attributes used across the app; consumers (TopBar, TitleBadge, etc.) now reference `DataComponent.TopBar` etc. so test selectors are compile-time-checked.

### Error handling & logging

- **#14 — `src/services/logger.ts`** wraps `console.warn` / `console.error` for production logging. No-ops when `import.meta.env.MODE === 'test'` so vitest output stays free of expected errors; future Sentry/remote-logging hook lives here. Migrated `services/storage.ts` and `ErrorBoundary.tsx`.
- **#15 — `ErrorBoundary` uses `errorMessage()` + `log.error`.** Combines the wins from session 67 — non-Error throws produce readable strings, and the boundary's emit is routed through the test-aware logger.

### Performance

- **#9 — `React.memo` on `TPNode` and `TPEdge`.** The two most-instantiated components on the canvas. Both now `memo()` their props comparison (shallow-equal default works because the store mutates immutably). On a 50-node graph a keystroke triggering one entity update no longer re-renders the other 49.
- **#10 — Toast deduplication.** `dialogsSlice.showToast` skips when the same `(kind, message)` is already on the queue — common when multiple validators fire on a single edit.

### Cleanup & extraction

- **#4 — `TitleBadge` extracted** from `App.tsx` (50 lines moved) into `src/components/toolbar/TitleBadge.tsx`. `App.tsx` is now a 50-line composition root.
- **#8 — `PersistScheduler` class** in `src/services/persistDebounced.ts`. Replaces the module-level `let timer`/`let pending` globals. Public API unchanged (`persistDebounced`, `flushPersist`, `cancelPendingPersist` still exported); the class makes test isolation possible (`new PersistScheduler()`).
- **#1 — `formPrimitives.tsx`** in `src/components/settings/`. Extracts `Section`, `RadioGroup`, `Slider`, `Toggle` from `SettingsDialog.tsx` — 90 lines moved. SettingsDialog drops from **456 → 338 lines**. Primitives are reusable by future settings-style surfaces (e.g. `DocumentInspector`).
- **#2 — `RevisionRow` + `formatTime` extracted** from `RevisionPanel.tsx`. New files: `src/components/history/RevisionRow.tsx` (163 lines) and `src/components/history/formatTime.ts` (23 lines, renamed export to `formatRelativeTime` for clarity). RevisionPanel drops from **402 → 234 lines**.
- **#3 — ContextMenu items-builder annotated.** The IIFE that builds the menu items has four mutually-exclusive branches. Full extraction would cascade ~17 store actions into a function signature — net negative. Instead, added structured `// ── BRANCH N: … ──` separator comments so each target-kind branch is grep-able and the file's intent is visible at a glance.

### Documentation & conventions

- **#7 — Keyboard hooks already documented** (audit-clean). `useGlobalKeyboard.ts` already documents the split between `useGlobalShortcuts` and `useSelectionShortcuts` in its header. No change needed.
- **#17 — System color-scheme listener** (audit-clean). Premise was wrong — the `Theme` union doesn't include an `'auto'` / system option; users explicitly pick from 7 themes. If `'auto'` is added later, the matchMedia hook belongs in `useThemeClass`.
- **#18 — Coverage-threshold workflow doc'd.** The `vite.config.ts` coverage block now has explicit steps for measuring + tightening the floor (`pnpm test:coverage` → read summary → write measured−2 → commit). The current thresholds remain the conservative starting set.
- **#20 — useShallow comment convention applied.** Annotated the two largest shallow selectors (`Canvas.tsx`, `ContextMenu.tsx`) with explicit "state vs. action ref" sections so the contract is in-file. The pattern was established by `useToolbarActions.ts` in session 66.

### Architecture

- **#5 — `Selection` narrow typing.** `Selection.entities.ids` is now `EntityId[]` and `Selection.edges.ids` is `EdgeId[]` (was `string[]` for both). Cascading cast at the boundary in `selectionSlice.ts` (where ids enter from React Flow events / BFS reach sets). Five call sites updated: `Canvas.tsx` and `ContextMenu.tsx` switched from `ids.includes(rawString)` to `ids.some((id) => id === rawString)` for the brand-mismatch boundary; `groupsSlice.ts` and `TPGroupNode.tsx` cast at the single "groups travel via the entities bucket" site. The Selection model now matches the rest of the type system.
- **#19 — Split `persistence.ts`.** Validation helpers (~200 lines: `validateEntity`, `validateEdge`, `validateGroup`, `validateRecord`, `validateLayoutConfig`, `validateSystemScope`, `validateMethodChecklist`) moved to `src/domain/persistenceValidators.ts`. The public I/O surface (`importFromJSON`, `exportToJSON`, `saveToLocalStorage`, `loadFromLocalStorage`, `clearLocalStorage`) stays in `persistence.ts`. Down from **366 → 130 lines** on the I/O file; the consumer-facing API at `@/domain/persistence` is unchanged.

### Testing

- **#16 — Migration round-trip test** in `tests/domain/migrationsRoundTrip.test.ts` (5 new tests). Feeds `importFromJSON` minimal documents at each past schemaVersion (v1, v2, v3, v4) plus a future v99 fixture. Asserts the migration chain produces a v5 doc with the expected derived fields (v1 → v2 adds `annotationNumber` + `nextAnnotationNumber`; v2 → v3 adds empty `groups`). Future migration regressions fail loudly before users hit them.

### Verification

- `tsc --noEmit` → exit 0
- `biome check src/ tests/` → 258 files, no errors
- `vitest run` → 75 files, **644 tests passing** (up from 639)
- `vite build` → 10.6 s
- `check:bundle-size` → all budgeted chunks within ceiling

### Largest file sizes after the sweep

| Before → After                  | File                                       |
|---------------------------------|--------------------------------------------|
| 456 → **338**                   | `SettingsDialog.tsx`                       |
| 402 → **234**                   | `RevisionPanel.tsx` (+ 163 RevisionRow + 23 formatTime) |
| 366 → **130**                   | `persistence.ts` (+ 220 persistenceValidators) |

The "biggest file" award now goes to `ContextMenu.tsx` at 416 lines, which #3 evaluated and chose to leave intact with branch annotations.

## Session 67 — Code-quality sweep (20 items)

A long maintenance batch executing every item in a 20-suggestion audit. Grouped into four phases by risk; each phase verified independently. End state: tsc clean, Biome clean, 639 tests passing (up from 620), build green.

### Phase 1 — pure additions (zero behavior risk)

- **#2 — `errorMessage(err: unknown, fallback?)` helper** (`src/services/errors.ts` + 6 tests). Replaces four sites doing `(err as Error).message` (which produces `undefined.message` on non-Error throws). Handles `Error`, non-empty strings, and the rest fall through to the `"Unknown error"` fallback.
- **#13 — Drop 9 dead validator re-exports.** `src/domain/validators/index.ts` previously re-exported `clarityRule`, `entityExistenceRule`, `causalityExistenceRule`, etc. with the rationale "for per-rule tests" — but every per-rule test imports from `./rule.ts` directly. Kept `cycleRule`, `completeStepRule`, `ecMissingConflictRule`, `externalRootCauseRule`, and the type re-exports (those DO have external consumers).
- **#14 — Slice ARCHITECTURE.md** (`src/store/ARCHITECTURE.md`, new). Documents the contract for which of the four sub-slices (`documentSlice`, `uiSlice`, `historySlice`, `revisionsSlice`) owns what state, the `applyDocChange` mutation pipeline, the `*Defaults` factory pattern, and the "no slice imports from another slice's internals" rule.
- **#19 — Pin pnpm engine.** `package.json` engines now declares `pnpm: "^11.0.0"`; `.npmrc` already had `engine-strict=true`. Local installs against the wrong pnpm major now fail loudly instead of silently re-resolving the lockfile.
- **#20 — Bundle-size budget in CI.** New `scripts/check-bundle-size.mjs` reads gzip sizes from `dist/assets/*.js` and compares against `bundle-budget.json`. Fails CI on `>10%` over budget (`slopPercent`). Wired into `.github/workflows/ci.yml` after the build step. Chunk-name matcher handles Vite's hash-with-dash filenames.

### Phase 2 — localized fixes (low test risk)

- **#3 — Drop `arr[i]!` non-null assertions** in `src/services/csvImport.ts`. Replaced three `lines[0]!` / `line[i]!` / `lines[i]!` non-null-bang patterns with `String.charAt(i)` and destructured `const [headerLine = '']` plus a permissive `if (!raw) continue` guard. The remaining `!` uses in `src/` are after explicit length-guards and are idiomatic — left them.
- **#6 — Nested `ErrorBoundary`s.** Extended `src/components/ui/ErrorBoundary.tsx` with a `label?: string` (nested mode → inline labeled card) and `fallback?: ReactNode` (custom). `App.tsx` wraps each modal/panel (`Inspector`, `Settings`, `DocumentInspector`, `RevisionPanel`, `SideBySide`) in its own boundary so a crash in one doesn't take the canvas down. Plus 4 new tests in `tests/components/ErrorBoundary.test.tsx`.
- **#7 — Narrow `WalkthroughOverlay` selector via `validationFingerprint`.** The CLR walkthrough re-validated on every doc reference change, even when only a title changed. Now gated on `validationFingerprint(doc)` (then later swapped to use `useFingerprintMemo` in #9).
- **#10 — Coverage in CI.** Added `@vitest/coverage-v8` to devDependencies, `test:coverage` script, `coverage` config in `vite.config.ts` with permissive thresholds (lines/statements/branches 70%, functions 65%) as a starting floor. CI uploads the `coverage/` directory as an artifact.
- **#16 — `KebabMenu` keyboard nav.** ArrowUp/ArrowDown cycle focus across `[role="menuitem"]` items; Home/End jump to ends; Tab closes the menu; on open, focus auto-lands on the first item; on close, focus restores to the trigger. Matches the WAI-ARIA menu pattern. Plus 2 new tests in `tests/components/KebabMenu.test.tsx`.
- **#18 — `aria-keyshortcuts` on TopBar.** New `shortcutToAria(keys: string)` helper in `src/domain/shortcuts.ts` converts display strings (`⌘+K`, `Ctrl+Shift+Z`, etc.) into ARIA-spec format (`Meta+K Control+K`, with two chords for ⌘-or-Ctrl bindings). Applied to the Commands button (the only TopBar button with a registry shortcut). Plus 7 new tests in `tests/domain/shortcutToAria.test.ts`.

### Phase 3 — cross-cutting (medium risk)

- **#4 — Toast instead of `window.alert`.** 5 import paths and 2 edge commands (`commands/edges.ts`) now route failures through `useDocumentStore.getState().showToast('error', …)` instead of the thread-blocking native alert. UX is theme-aware; tests can assert on `s.lastToast` instead of stubbing `globalThis.alert`.
- **#9 — `useFingerprintMemo` hook.** New `src/hooks/useFingerprintMemo.ts` wraps `useMemo` with a single-string fingerprint and the `biome-ignore lint/correctness/useExhaustiveDependencies` comment baked in. Replaces 3 of 4 inline ignores (`Inspector.tsx`, `WalkthroughOverlay.tsx`, `useGraphPositions.ts`). The 4th (`SearchPanel.tsx`) is a `useEffect`, not a memo, so it stays as-is.
- **#15 — `FilePicker` interface.** New `src/services/exporters/picker.ts` exports `pickFile<T>({ accept, label, parse })` — wraps the `<input type="file">` plumbing, the text read, and the try/catch-with-toast pattern. The four existing pickers (`pickJSON`, `pickFlyingLogic`, `pickMermaid`, `pickCsvFile`) each collapse to a 5-line helper call.

### Phase 4 — higher-risk, larger surface

- **#1 — Brand IDs at graph boundaries.** `reachableForward(doc, from)` and `reachableBackward(doc, from)` now take `EntityId[]` and return `Set<EntityId>`. Cast pressure at the consumer (the `Set<EntityId>.has(string)` mismatch in `coreDriver.ts`) is gone. Two callers — `commands/navigate.ts` and `useSelectionShortcuts.ts` — drop a `Selection.ids` (`string[]`) into the helper via an `as EntityId[]` cast at the boundary (with comment explaining the doc-membership filter that makes the cast safe). `Selection.ids` stays `string[]` by design; the brand is enforced at the helper boundary.
- **#17 — Native `<dialog>` for `SideBySideDialog`.** Replaces `<div role="dialog">` with `<dialog ref>` + `showModal()`. Browser handles Esc + focus trap natively; the `onClose` prop wires through to `closeSideBySide`. Defensive: feature-checks `showModal` for jsdom compatibility, falls back to the `<dialog open>` attribute when unavailable. WalkthroughOverlay left as-is (the two `useSemanticElements` ignores were documented and lower-leverage to remove).
- **#8 — Lazy-load dagre — scoped down.** Attempted to split dagre into its own Rollup chunk via `manualChunks.dagre = ['dagre']`. Rollup didn't honor the split (dagre stayed in the `flow` chunk regardless — likely because @xyflow/react re-exports types from dagre and Rollup keeps tightly-coupled modules together). Reverted. The genuine win (dynamic import of `computeLayout`) would cascade `await` through every caller of `useGraphPositions` — too disruptive for this batch. Captured as future work.
- **#5 — Async `ConfirmDialog`.** New `src/components/ui/ConfirmDialog.tsx` and store action `confirm(message, opts?): Promise<boolean>` in `dialogsSlice`. 5 sites migrated: `commands/view.ts` (reset layout), `RevisionPanel.tsx` (delete snapshot), `GroupInspector.tsx` (delete group), and 2 paths in `services/confirmations.ts` (entity / bulk delete). UX is now theme-aware and doesn't block the JS thread. Tests updated: `tests/services/confirmations.test.ts` (rewritten — drives the new Promise via `state.confirmDialog` + `state.resolveConfirm`), `tests/components/RevisionPanel.test.tsx` and `tests/hooks/useGlobalKeyboard.test.tsx` (delete-key path now awaits the resolved dialog).
- **#11 — Playwright e2e scaffolding.** New `playwright.config.ts`, `e2e/smoke.spec.ts` (3 tests: empty-canvas render, `Cmd+K` palette, double-click-creates-entity-and-persists-across-reload), `test:e2e` + `test:e2e:ui` scripts, separate `e2e` job in `.github/workflows/ci.yml` that installs Chromium with `pnpm exec playwright install --with-deps chromium`. Browser binaries aren't auto-installed locally — run `pnpm exec playwright install chromium` once after `pnpm install`. `.gitignore` updated for `playwright-report/` and `test-results/`.

### Verification

- `tsc --noEmit` → exit 0
- `biome check src/ tests/` → 249 files, no errors
- `vitest run` → 74 files, **639 tests passing** (up from 620)
- `vite build` → 8.58 s
- `check:bundle-size` → all chunks within budget

### Summary

19 of 20 items shipped. #8 (lazy-load dagre) was scoped down to a chunk-config change that Rollup didn't honor; the genuine fix would require an async refactor across the layout pipeline. Captured as future work in NEXT_STEPS.

## Session 66 — Type-error sweep + top-10 refactor pass

A maintenance session: clear out lingering type errors that had been hidden by a Biome-only CI, then a ten-item refactor pass focused on structural duplication, magic numbers, and helper reuse. No behaviour changes — 620 tests stay green, Biome clean, tsc clean, build still produces the same chunk sizes.

### TypeScript error sweep

Five files carried errors that `node tsc --noEmit` surfaced (Biome had been the only quality gate in CI, so the type errors had drifted in):

- **`src/components/history/SideBySideDialog.tsx`** — the dialog called `computeLayout(doc, opts)` and indexed `layout.positions[id]`, but `computeLayout`'s actual signature is `(nodes: NodeBox[], edges: EdgeRef[], options) → Record<string, Position>` — the dialog had been written against an older "single-doc-in, `{ width, height, positions }`-out" shape. Adapted the call: build `NodeBox[]` / `EdgeRef[]` from the doc, derive `width` / `height` from the laid-out positions.
- **`src/components/settings/SettingsDialog.tsx`** — imported `DefaultLayoutDirection` from `@/store`; the type existed in `@/store/uiSlice/types` but wasn't re-exported from the top-level store barrel. Added the re-export (plus `LayoutMode` for symmetry — also previously missing).
- **`src/domain/coreDriver.ts`** — `udeIds.has(id)` failed because `udeIds: Set<EntityId>` (branded) but `id` came from `reachableForward`'s `Set<string>` result. Cast at the boundary and use the new `getEntity()` helper for the annotation-number sort lookups.
- **`src/store/documentSlice/docMutate.ts`** (×2) — `Object.keys(patch) as (keyof Entity)[]` synthesized an `'id'` key that doesn't exist in `Partial<Omit<Entity, 'id' | 'createdAt'>>`, so `patch[key]` failed indexed-access. Switched to `(keyof typeof patch)[]` so the type can't include the Omit'd keys.

### Refactor pass — top 10

Identified via a codebase-wide audit; ranked by leverage (#1 = highest).

**R1. Reuse `structuralEntities(doc)` instead of inline `e.type !== 'assumption'` filters.** Two sites still open-coded the filter (`SideBySideDialog.tsx`, `edgeReading.ts`); both now call the existing helper. A future schema change to the "what counts as a structural entity" rule will only need one edit.

**R2. Centralize card dimensions in `@/domain/constants`.** `SideBySideDialog` had local `CARD_WIDTH = 220` / `CARD_HEIGHT = 72` consts (plus their halves) that duplicated `NODE_WIDTH` / `NODE_MIN_HEIGHT`. Added `NODE_HALF_WIDTH` and `NODE_HALF_HEIGHT` to the constants module; `SideBySideDialog` now imports all four. One source of truth — a tweak to base dimensions propagates everywhere automatically.

**R3. Move `ZOOM_UP_THRESHOLD` to `constants.ts`.** Previously a local constant in `TPNode.tsx`. Moved alongside `NODE_WIDTH` etc. so all canvas tunables live in one grep target.

**R4. `withWriteGuard()` helper for palette commands.** Twenty-plus palette commands opened with `if (!guardWriteOrToast()) return;`. Added a `withWriteGuard(cmd)` higher-order wrapper in `commands/types.ts` that threads the guard policy into a single place. Converted every mutating command in `document.ts`, `edges.ts`, `groups.ts`, `tools.ts`, `view.ts`, `analysis.ts` — net change is ~25 lines removed and a clearer intent boundary (writes are visibly distinct from view-state commands). View-state actions (Hoist, Unhoist, Toggle theme, Settings, Browse Lock toggle, Copy) intentionally stay unguarded; the comments in each file call this out.

**R5. `docToLayoutModel(doc, size?)` adapter in `domain/layout.ts`.** Centralizes the "build `{ nodes, edges }` from a `TPDocument`" translation that previously lived inline in `SideBySideDialog`. The main canvas pipeline (`useGraphPositions`) keeps its own model because it threads visibility/collapsed-group state through the adapter, but any preview / snapshot UI that needs a static layout now has a one-liner.

**R6. `useToolbarActions` shared hook for TopBar + KebabMenu.** Both surfaces previously redeclared the same six `useDocumentStore(s => …)` selectors (theme, layoutMode, historyPanelOpen, showLayoutToggle, plus action refs). One `useShallow`-backed hook now serves both. Subscription count drops from 12 → 1 for the cluster; the `LAYOUT_STRATEGY[diagramType]` check that drives `showLayoutToggle` lives in the hook, so the two surfaces can't drift.

**R7. `getEntity(doc, id)` helper in `domain/graph.ts`.** The branded `EntityId` type forced call sites that started with a plain `string` (from React Flow, BFS reach sets, etc.) to write `doc.entities[id as EntityId]` repeatedly. The helper takes a `string`, does the cast once internally, and returns `Entity | undefined`. Adopted in `coreDriver.ts`; available for future callers.

**R8. Dead-export audit (no action).** Audited `src/services/exporters/index.ts`, `src/store/index.ts`, `src/domain/validators/index.ts`, `src/domain/flyingLogic/index.ts`. Nine per-rule re-exports in `validators/index.ts` (`clarityRule`, `entityExistenceRule`, etc.) have no current external consumer, but they're documented as test-targeting hooks; cost to keep is one line each, risk to remove is breaking a future per-rule test in flight. Left as-is. The barrel exports the audit DID find for `exporters` and `store` are all used externally — nothing to remove.

**R9. `pinnedEntities(doc)` helper for the LA5 pinned-position filter.** Three sites (`useGraphPositions` cache-key hash, `fingerprint.layoutFingerprint`, the Reset-layout palette command's confirm-prompt count) called `Object.values(doc.entities).filter(e => e.position)`. Centralizing as `pinnedEntities(doc)` keeps the "what counts as pinned" rule in one place; a future schema change (e.g. distinguishing "pinned" from "dragged but not committed") only touches the helper.

**R10. Test-helper coverage extended.** Four test files (`tests/services/clipboard.test.ts`, `tests/services/confirmations.test.ts`, `tests/store/document.test.ts`, `tests/store/groups.test.ts`) had inline `addNode = (title) => useDocumentStore.getState().addEntity({ type: 'effect', title })` closures duplicating `seedEntity` from `tests/helpers/seedDoc.ts`. Each now imports `seedEntity` and keeps a thin local alias (the local name reads better at call sites; the helper is the implementation). Future store-action signature changes only need to update `seedDoc.ts`.

### Verification

- `tsc --noEmit` → exit 0
- `biome check src/ tests/` → 242 files checked, no errors
- `vitest run` → 71 files, 620 tests passing
- `vite build` → 8.24s, chunk sizes unchanged within margin

## Session 65 — Mobile / narrow-viewport pass

Phones and small tablets (≤ 640 px) lost access to four toolbar buttons — **Layout Mode**, **History**, **Help**, and **Theme** — once Tailwind's `hidden sm:inline-flex` (and `hidden md:inline-flex` for Layout Mode) kicked in. The command palette still reached them, but it's awkward on touch without a hardware keyboard. A kebab menu now closes that gap.

### `KebabMenu` component (`src/components/toolbar/KebabMenu.tsx`)

A small dropdown trigger that appears only at `< sm` (the wrapper carries `sm:hidden`, so it disappears at `sm:` and above where the buttons render directly in the TopBar). Items in the menu:

- **Layout Mode** — flips between flow and radial; omitted when `LAYOUT_STRATEGY[diagramType] !== 'auto'` (currently EC, whose hand-positioned geometry IS the diagnostic).
- **History** — toggles the revision panel; label flips between "Open history" and "Close history" depending on the current panel state.
- **Help** — opens the keyboard-shortcuts dialog.
- **Theme** — flips between light and dark; the icon and label flip with the current theme (Moon + "Dark mode" in light theme; Sun + "Light mode" in dark).

The trigger uses the standard `softNeutral` / `softViolet` Button variants — softViolet while the menu is open so the user has a clear "I'm in the menu" visual cue. ARIA: `aria-haspopup="menu"`, `aria-expanded`, `aria-controls={menuId}` on the trigger; `role="menu"` on the popover with `role="menuitem"` on each item. Dismiss paths: clicking outside (via `useOutsideAndEscape`), pressing Escape, or activating any menuitem (which auto-closes after running its handler).

### TopBar integration

`<KebabMenu />` is rendered at the end of the TopBar cluster. It carries `sm:hidden` itself, so the existing `hidden sm:inline-flex` buttons still render at `sm+` and the kebab vanishes — no double-surfacing of actions on tablet/desktop widths. **Browse Lock** and **Commands** stay outside the kebab because they're primary CTAs the user expects to see at every breakpoint (Browse Lock is a sticky safety toggle; Commands is the palette entrypoint that also covers everything not in the kebab).

### TitleBadge max-width adjustment (`src/App.tsx`)

The narrow-viewport `max-w-[calc(100%-7rem)]` reserved 112 px for the TopBar — fine when only Commands + Lock rendered. With Kebab added, the TopBar's intrinsic width grew to ~120 px (3 icon buttons × 28 px + gaps + outer padding). Bumped to `max-w-[calc(100%-9rem)]` (144 px) so a runaway title can't crowd into the kebab on a 320-px phone. The `sm:` and `md:` caps are unchanged.

### Inspector / RevisionPanel backdrop dismissal

Audited — both panels already render a tap-to-dismiss backdrop below `md:` (the inspector backdrop covers the canvas behind the panel; tapping anywhere outside the 85 vw panel closes it via `clearSelection`). No changes needed.

### Tests (`tests/components/KebabMenu.test.tsx`, 8 new)

- Menu starts closed (no menuitems in DOM until the trigger is clicked).
- Trigger toggles open/closed on repeated click.
- History menuitem toggles `historyPanelOpen` and auto-closes the menu.
- Help menuitem flips `helpOpen` to `true`.
- Theme menuitem cycles light → dark → light; the label flips between "Dark mode" and "Light mode" between opens.
- Layout-mode menuitem flips `layoutMode` between flow and radial.
- The layout-mode item is omitted on EC (manual-layout) documents; Help / History / Theme remain.
- Escape closes the menu.

Total: **620 → 628 tests, all passing.** Existing TopBar tests still pass — the kebab's role="menuitem" buttons don't collide with their `aria-label` queries on the visible-at-sm+ buttons.

## Session 64 — N3 Mermaid IMPORT + N5 VGL-like declarative export

Two final markup-format pieces. After this, every Block-D interop format (OPML / DOT / Mermaid / reasoning narrative + outline) plus N3 (Mermaid import) and N5 (VGL-flavored declarative) has a home in the export menu.

### N3 — Mermaid IMPORT (round-trip with Block D's export)

`src/domain/mermaidImport.ts` parses the subset of Mermaid `graph` syntax our exporter emits, so a user can copy a `.mmd` file out, edit it elsewhere, and round-trip it back. Supported grammar:

- Optional `--- … ---` frontmatter; `title: …` line picked up.
- `graph BT|TB|LR|RL|TD` directive (parsed into `LayoutConfig.direction`). TD is treated as TB.
- Node declarations: `id["label"]`, `id[label]`, `id("rounded")`, `id{diamond}`. Labels can carry `<br/>` (decoded to `\n`) and `&quot;` (decoded to `"`) — the exact escapes our exporter emits.
- Edges: `a --> b` (plain) and `a ==> b` (thick → AND-grouped); inline labels via `a -->|"text"| b` or `a -->|text| b`.
- `class id type_foo` lines map nodes to their `EntityType` using the same `type_<EntityType>` naming convention `exportToMermaid` uses for its `classDef` blocks.
- `classDef …` style blocks tolerated and skipped.
- `subgraph` / `end` tolerated, but group reconstruction is dropped — Mermaid's subgraph maps poorly to our group model (which carries title + color + collapsed state); the parsed nodes + edges still land.

Out-of-scope features (the exporter doesn't emit these): chained edges (`a --> b --> c`), broadcast (`a --> b & c`), dotted arrows (`-.->`). Unknown lines are quietly skipped — easier on the user than a thrown error after hand-editing.

Special handling for our exporter's `#N TypeName<br/>` preamble: on import, a label whose first line matches `^#\d+\s+\S` is split and the preamble is dropped. Re-importing an exported `.mmd` doesn't stack type prefixes onto titles.

AND-grouping reconstruction: `==>` edges to the same target share a generated `andGroupId` (`and_mermaid_<targetId>`). Two `==>` edges going to different targets get distinct groups.

Browser-side wrapper `pickMermaid()` in `src/services/exporters/markup.ts`. Palette command **"Import from Mermaid diagram…"** in the File group.

### N5 — VGL-like declarative export

`src/domain/vglExport.ts` writes a declarative text format the user can paste into a doc or diff against other versions. The Flying Logic VGL format doesn't have a published, stable grammar we can target precisely; this exporter ships a *VGL-flavored* dialect with its own JSDoc spelling out the format. Example:

```
graph "Customer support CRT" type:crt direction:BT {
  entity e_abc class:"Undesirable Effect" {
    title: "Customers churn"
    annotation: 3
    description: "Quarterly NPS dropped 8 points."
  }
  entity e_def class:"Root Cause" {
    title: "Manual order entry"
    annotation: 1
  }
  edge e_def -> e_abc {
    label: "within 30 days"
  }
  edge_and target:e_abc {
    e_def
    e_ghi
  }
}
```

Notes:

- Entity blocks use the human-readable `ENTITY_TYPE_META.label` (`"Undesirable Effect"`, `"Root Cause"`) rather than the internal enum (`"ude"`, `"rootCause"`) — keeps the file readable for users not steeped in our type names.
- AND-grouped edges sharing a target collapse into one `edge_and` block — semantically matches FL's "junctor" intent (multiple causes converge into one effect via a junction).
- Single-member AND groups degrade to a plain `edge` line, since an `edge_and` block with one source is just a verbose plain edge.
- Assumption-typed entities are dropped (same as the Mermaid and DOT exports — they're not structural causal entities).

**Not round-trippable** — no `importFromVgl` companion yet. The format is one-way until a user starts authoring TP documents in it.

Browser-side wrapper `exportVGL(doc)` writes `<title>.vgl`. Palette command **"Export as VGL (declarative)"** in the Export group.

### What changed

- **`src/domain/mermaidImport.ts` (new)** — `importFromMermaid(raw, diagramType?)` parser. Token-level regex matching on each line.
- **`src/domain/vglExport.ts` (new)** — `exportToVgl(doc)` renderer. Stable sort by annotation number for deterministic output.
- **`src/services/exporters/markup.ts`** — Added `exportVGL` browser wrapper and `pickMermaid` file-picker. `pickMermaid` accepts `.mmd` and `.txt` (since hand-edited Mermaid is often pasted into a `.txt`).
- **`src/services/exporters/index.ts`** — Re-exported `exportVGL` and `pickMermaid`.
- **`src/components/command-palette/commands/document.ts`** — New "Import from Mermaid diagram…" command in the File group.
- **`src/components/command-palette/commands/export.ts`** — New "Export as VGL (declarative)" command in the Export group.
- **`tests/domain/mermaidImport.test.ts` (new)** — 15 tests covering frontmatter / direction / brackets / decoding / type mapping / inline edge labels / AND-grouping / subgraph tolerance / unknown-line tolerance / round-trip with our own exporter.
- **`tests/domain/vglExport.test.ts` (new)** — 8 tests covering graph header / entity blocks / annotation rendering / description optionality / assumption exclusion / plain-edge form / labeled-edge form / `edge_and` block / quote+backslash escaping.

### What didn't change

- The Flying Logic XML import / export path (`src/domain/flyingLogic/`) is unchanged. Mermaid is for visual-diagram-tool interchange; FL is for full-fidelity TOC tool interchange.
- VGL has no companion importer. If a user starts authoring TP documents in VGL text, build `importFromVgl` then; until then the export is documentation / interchange only.
- The Block-D `exportMermaid` output is unchanged. The importer adapts to what the exporter emits, not the other way around.

### NEXT_STEPS pivots

After Session 64, the markup-format thread is fully closed. The remaining backlog leans toward structural extensibility:

- **B7 + B10** — User-defined attributes + custom entity classes (paired, L)
- **Confidence field UI** — `Entity.confidence` already in schema; S–M
- **Mobile / narrow-viewport pass** — M

**Tests: 612 passing / 0 failing / 612 total** (+23 across the two new files). Biome clean on `src/` and `tests/`.

## Session 63 — LA5: generalize per-entity pinned positions to all diagrams

Previously, manual positioning lived only on Evaporating Cloud: `LAYOUT_STRATEGY.ec === 'manual'` made every entity read its `position` field; on CRT/FRT/PRT/TT, dragging a node was a no-op (React Flow tracks the gesture but our code never persisted it, so dagre re-ran on the next render and reverted the move).

LA5 lifts that gate: an entity is "pinned" anywhere when its `position` field is set, regardless of diagram type. Dagre still owns the global layout for auto-layout diagrams; pinned entities just get their dagre coords overwritten with the saved values on the way to React Flow.

### How it works

**`Entity.position`** is the existing optional field — no schema change. The semantics are now:
- On manual-layout diagrams (EC) — required for every entity to render in its 5-box slot; matches the existing behavior.
- On auto-layout diagrams (CRT / FRT / PRT / TT) — optional. When set, pins the entity. When unset, dagre places it.

**`useGraphPositions`** (auto-layout branch) now runs dagre / radial as before, then walks `visibleEntityIds` and overwrites `out[id]` with `entity.position` for any pinned entity. The cache key adds a `pinnedKey` segment so a position change re-runs the memo. React Flow re-routes edges from the new node centers at render time — no precomputed edge geometry to invalidate.

**`useGraphMutations`** drops its `strategy === 'manual'` gate on position-persist. Now any settled drag fires `setEntityPosition(id, {x, y})` — that pins the entity. The existing coalesce-key (`pos:<id>`) keeps the 60 fps drag stream collapsed into a single undo entry.

**Drag-to-pin UX**: drag an entity on a CRT, release, and it stays where you put it. Dagre re-flows the rest around the pin. No modifier-key required — direct manipulation is the gesture.

**Visual indicator**: `TPNode` renders a small violet `Pin` glyph at the bottom-right corner when `entity.position` is set on a non-manual diagram. Manual diagrams (EC) suppress the icon because every entity is implicitly pinned there — the indicator would be noise.

### Unpinning

Three escape hatches:

- **Context menu** → **Unpin position (let layout reclaim)**. Per-entity. Shows only on auto-layout diagrams when the entity is currently pinned.
- **Palette → "Reset layout — unpin all entities"** (View group). Confirms with a count first; then clears `position` on every entity in the doc.
- **Direct edit**: setting `entity.position` to `null` via the store API clears the field. Used internally by both the above paths.

### What changed

- **`src/components/canvas/useGraphPositions.ts`** — Pinned-positions overlay applied after the dagre/radial pass. New `pinnedKey` cache-key segment so position changes re-run the memo.
- **`src/components/canvas/useGraphMutations.ts`** — Strategy gate removed; drag-to-pin now active on every diagram type. `LAYOUT_STRATEGY` import dropped.
- **`src/components/canvas/TPNode.tsx`** — Pin glyph at the bottom-right when `entity.position` is set on a non-manual diagram.
- **`src/components/canvas/ContextMenu.tsx`** — New "Unpin position (let layout reclaim)" action on the entity branch when the entity is pinned on an auto-layout diagram.
- **`src/store/documentSlice/entitiesSlice.ts`** — New `clearAllEntityPositions(): number` action returning the count of cleared pins.
- **`src/components/command-palette/commands/view.ts`** — New "Reset layout — unpin all entities" command with confirm dialog.
- **`tests/store/pinnedPositions.test.ts` (new)** — 5 tests: setEntityPosition persists, null clears, clearAllEntityPositions returns the count + no-op short-circuits + JSON round-trip preserves the pin.

### What didn't change

- The `position` field's existence in the schema is unchanged. Existing v5 docs round-trip unaffected.
- Dagre's runtime cost: re-runs once per structural change (same as before) plus once per pin add/remove (newly invalidating). Dragging is the only path that re-pins; a settled drag fires one update, not 60.
- Manual-layout diagrams (EC) keep their existing behavior. Their early-return branch in `useGraphPositions` is untouched.
- Reset Layout is destructive (clears every pin in one go). The palette command confirms with the user before doing it; the per-entity Unpin in the context menu doesn't (single-entity undo via `Cmd+Z` is enough).

### Net effect

Big diagrams that dagre lays out awkwardly are now adjustable in place: drag the few entities that need to go somewhere specific, and let dagre route the rest around them. The original LA5 description in NEXT_STEPS framed this as "bigger than it sounds" because the cleanest model needed a separate `pinned` flag — but `position`-as-pin works without any schema surface, and the visible cost is the indicator glyph + the unpin context-menu item.

**Tests: 589 passing / 0 failing / 589 total** (+5). Biome clean on `src/` and `tests/`.

## Session 62 — Tier-4 versioning: H2 visual diff + H4 side-by-side + H3 named branches

Three revision-history features built on top of Session 41's H1 infrastructure. They share one new domain primitive — a detailed ID-level diff that returns add/remove/change sets rather than just counts — and split into three independent UI surfaces from there.

### Detailed diff primitive

`src/domain/revisions.ts` gains `computeDetailedRevisionDiff(prev, next): DetailedRevisionDiff` returning Sets of entity / edge / group IDs for each diff bucket. Plus `entityStatusFromDiff(diff, id)` and `edgeStatusFromDiff(diff, id)` resolvers that return `'added' | 'removed' | 'changed' | 'unchanged'`. Same position-vs-content rules as the existing `computeRevisionDiff` (positions count only on manual-layout EC diagrams).

`useCompareDiff` (new hook in `src/hooks/`) wraps the primitive: reads the active `compareRevisionId`, finds the revision in the store, computes the diff once per (revision, liveDoc) pair via `useMemo`. Returns `null` when not in compare mode so the cost is zero.

### H2 — Visual diff overlay

A new `compareRevisionId: string | null` state on the dialogs slice. When set, the live canvas tints entities by their diff status:

- **Added** entities (in live but not in the compare revision) — emerald ring + offset.
- **Changed** entities (in both, content differs) — amber ring + offset.
- **Removed** entities (in the snapshot but not live) — surfaced in the side-by-side dialog rather than ghosted on the live canvas, since the live canvas doesn't have positions for them.

The diff status is threaded `useCompareDiff → useGraphView → useGraphEmission → useGraphNodeEmission` and stamped on each `TPNodeData` as `diffStatus`. TPNode reads the field and adds the appropriate tint via `clsx`. No diff overhead when not comparing — the hook returns null and emission stamps nothing.

A `CompareBanner` component mounts between TopBar and Canvas (in `App.tsx`); renders only when compare mode is active. Shows the compared revision's label + `+N / ~N / −N` count pills + an `X` exit button. Esc also exits (keyboard listener in the banner). Comparing rows in `RevisionPanel` get an indigo highlight so the user sees which snapshot is being compared.

### H4 — Side-by-side dialog

A separate `sideBySideRevisionId: string | null` state. Independent of `compareRevisionId` — a user can have both modes active.

`SideBySideDialog` renders a fullscreen modal split into two panels: snapshot (left) + live (right). Each panel runs `computeLayout` for its doc and renders entities as absolute-positioned cards in a scrollable container. Edges render as straight SVG lines between card centers, color-coded by diff status (added=green, removed=red dashed, changed=amber). Each panel filters out entities that don't exist on its side: the snapshot panel skips added entities; the live panel skips removed entities.

Implementation note in the JSDoc: I considered two `<ReactFlowProvider>` instances but went with plain absolute-positioned cards because React Flow's internal stores would race and the dialog is read-only anyway. Each panel is just a function of `(doc, diff)`.

### H3 — Named branches (MVP)

The smallest of the three. Two additions to `Revision`:

- **`branchName?: string`** — optional organizational tag. Unset = implicit `'Main'` branch.
- **`parentRevisionId?: string`** (was already declared but unused) — now wired by both `restoreSnapshot` (safety capture points at the restored revision) and the new `branchFromRevision` action.

New `branchFromRevision(sourceId, branchName)` store action: deep-clones the source revision's doc into a fresh revision tagged with the branch name + parent pointer. The live doc is untouched — branching is record-keeping, not a doc swap. To activate a branch's state, the user explicitly `restoreSnapshot`s on it (existing action).

`RevisionPanel` rewrites the list rendering into a `RevisionList` component that buckets revisions by `branchName` (Main first; named branches by recency afterward) with a sticky branch header for each bucket carrying a `GitBranch` icon + snapshot count. Each row now has three new buttons in the action stack:

- **👁 Compare (visual diff)** — opens `compareRevisionId` for this revision.
- **⫼ Side-by-side** — opens `sideBySideRevisionId`.
- **🌿 Branch from here** — prompts for a branch name, calls `branchFromRevision`.

Alongside the existing Pencil / Restore / Delete.

### What changed

- **`src/domain/revisions.ts`** — Added `Revision.branchName`, `DetailedRevisionDiff` type, `EntityDiffStatus` type, `computeDetailedRevisionDiff`, `entityStatusFromDiff`, `edgeStatusFromDiff`.
- **`src/hooks/useCompareDiff.ts` (new)** — Memoized diff between live doc and compare revision.
- **`src/components/canvas/flow-types.ts`** — `TPNodeData.diffStatus?: 'added' | 'removed' | 'changed'`.
- **`src/components/canvas/useGraphView.ts`** — Plumbs `compareDiff` through to emission.
- **`src/components/canvas/useGraphEmission.ts`** — Forwards `compareDiff` to node emission.
- **`src/components/canvas/useGraphNodeEmission.ts`** — Stamps `diffStatus` on each entity node.
- **`src/components/canvas/TPNode.tsx`** — Renders the emerald/amber ring based on `diffStatus`.
- **`src/components/canvas/CompareBanner.tsx` (new)** — Top-of-canvas banner with counts + Esc-aware close.
- **`src/components/history/SideBySideDialog.tsx` (new)** — Fullscreen comparison modal with two diff-colored panels.
- **`src/components/history/RevisionPanel.tsx`** — Branch grouping (`RevisionList`), three new per-row buttons (Compare / Side-by-side / Branch).
- **`src/store/uiSlice/dialogsSlice.ts`** — `compareRevisionId`, `sideBySideRevisionId` state + actions.
- **`src/store/revisionsSlice.ts`** — `branchFromRevision` action; `restoreSnapshot` now wires `parentRevisionId` + inherits source's `branchName` for safety captures.
- **`src/App.tsx`** — Mounts `<CompareBanner />` and lazy-loads `<SideBySideDialog />`.
- **Tests:**
  - `tests/domain/detailedRevisionDiff.test.ts` (new) — 7 tests covering add/remove/change sets + status resolvers.
  - `tests/store/revisionBranching.test.ts` (new) — 7 tests covering `branchFromRevision` happy/edge cases + safety-capture `parentRevisionId` wiring.
  - `tests/store/compareMode.test.ts` (new) — 4 tests for the two new dialog-state actions.

### What didn't change

- The H1 revisions storage shape stays JSON-serializable; `branchName` is an additive optional field. Existing localStorage data round-trips without migration.
- "Removed" entities live only in the snapshot — they don't surface as ghost cards on the live canvas (no position data, and ghosting would mislead). They DO show in the side-by-side panel's snapshot column.
- H3 is the MVP version. No automatic branch tracking on subsequent captures (every snapshot you take after switching branches goes into the implicit Main bucket unless you branch again). No branch-switching workflow that swaps the canvas. Those upgrades are deferred — the field + lineage is enough to start organizing experimental forks.
- Flying Logic round-trip: revisions don't round-trip via FL (they're a TP-Studio-only storage layer); JSON round-trips carry everything including `branchName` and `parentRevisionId`.

### Tier-4 versioning status

After Session 62: H1 (Session 41) + H2 + H3 + H4 = the full revisioning surface is shipped. H5 (confidence-weighted what-if) remains parked because it depends on confidence / weights from Bucket C, which the user excluded.

**Tests: 584 passing / 0 failing / 584 total** (+18). Biome clean on `src/` and `tests/`.

## Session 61 — Iteration-2 Bundle 11 + 13 audit + three real gaps

User asked to ship Bundles 11 (Groups advanced) and 13 (Polish & Preferences). Audit revealed that — like Sessions 60's Bundle 2 / 6 audit — most items were already shipped. This session ships the three genuine gaps: nested-group UI surface, FL-TO3 default-direction preference, and FL-TO1's four named dark themes.

### Bundle 11 audit — only the UI surface was missing

| Item | Status |
|---|---|
| FL-GR1 Shaded enclosure groups | Shipped (`Group` type + `TPGroupNode`) |
| FL-GR2 Nested group hierarchy | **Logic shipped, UI missing** → fixed this session |
| FL-GR3 Collapse / expand | Shipped (`toggleGroupCollapsed` + inspector button + collapsed-root card) |
| FL-GR4 Hoist into group | Shipped (`hoistGroup` action + `Breadcrumb` + inspector button) |
| FL-GR5 Promote children on delete | Shipped (`deleteGroup` flatmap path) |

### FL-GR2 — Nested groups, now with a discoverability surface

The store already supported nesting through `createGroupFromSelection([groupAId, entityIds...])` (when the selection contains a group plus other things) and `addToGroup(parentGroupId, childGroupId)`. Cycle guard via `wouldCreateCycle` prevents a group from being nested inside its own descendants. But there was no obvious UI path — users would have had to know the gesture.

The GroupInspector now shows a **"Nest into parent group"** dropdown when the document contains at least one other group. The dropdown lists every candidate parent (excluding self + any group that would form a cycle); picking one calls `addToGroup(targetId, currentGroupId)`. Resetting the select value lets the user re-apply the same pick after an undo.

`Group.memberIds` was already mixed-content (entity IDs and group IDs both valid), so no schema change. `wouldCreateCycle` was already in `domain/groups.ts`. The new code is just the inspector field + the candidate filter.

### FL-TO3 — Default layout direction for new documents

New optional `DefaultLayoutDirection` preference (`'auto' | 'BT' | 'TB' | 'LR' | 'RL'`). `'auto'` defers to each diagram type's natural default (CRT/FRT → BT, Goal-Tree-ish → TB, manual-layout EC ignores). When set to a specific direction, `newDocument(diagramType)` seeds the resulting doc's `layoutConfig.direction` with the pref.

Persistence-backed via the existing `StoredPrefs` plumbing. Settings dialog gets a new "Default direction for new documents" radio group right under Causality reading. Existing documents are unaffected — they keep whatever `doc.layoutConfig` they were saved with.

### FL-TO1 — Four named dark theme variants

The `Theme` union grew from `'light' | 'dark' | 'highContrast'` to add `'rust'`, `'coal'`, `'navy'`, `'ayu'`. Each layers on top of `.dark` so Tailwind's dark-mode utilities continue to apply throughout the app — only the body background and the focus-ring accent change per variant.

| Variant | Body BG | Focus accent | Vibe |
|---|---|---|---|
| Rust | `#1c1410` | `#ea580c` | Warm dark, ember tones |
| Coal | `#0c0d10` | `#94a3b8` | Near-black, blue tint |
| Navy | `#0a1628` | `#38bdf8` | Deep blue, easy on the eyes |
| Ayu | `#0f1419` | `#ffb454` | Warm dark, golden accents |

`useThemeClass` was updated to manage the new variant classes mutually-exclusively — picking a new theme strips any stale variant class before applying the current one, so swapping themes never leaves stragglers on `<html>`.

### What changed

- **`src/store/uiSlice/types.ts`** — `Theme` union widened to 7 values; new `DefaultLayoutDirection` type; `StoredPrefs.defaultLayoutDirection` added.
- **`src/store/uiSlice/prefs.ts`** — `VALID_THEMES` widened; `VALID_DEFAULT_DIRECTIONS` set; `readInitialPrefs` returns the new field with `'auto'` default.
- **`src/store/uiSlice/preferencesSlice.ts`** — `defaultLayoutDirection` field + setter; persisted via the existing path.
- **`src/store/uiSlice/index.ts`** — re-export of `DefaultLayoutDirection`.
- **`src/store/documentSlice/docMetaSlice.ts`** — `newDocument` consults `defaultLayoutDirection` and seeds `doc.layoutConfig.direction` when non-`'auto'`.
- **`src/hooks/useThemeClass.ts`** — variant class swap logic; clears all named-variant classes on each theme change before applying the current one.
- **`src/styles/index.css`** — four new `.theme-*` selectors with body BG + focus-ring color.
- **`src/components/settings/SettingsDialog.tsx`** — Theme picker gains four options; new "Default direction for new documents" radio group.
- **`src/components/inspector/GroupInspector.tsx`** — "Nest into parent group" select listing cycle-safe candidates.
- **Tests:**
  - `tests/store/defaultLayoutDirection.test.ts` (new) — 5 tests: default value, setter, seeded-in-new-doc, auto-leaves-undefined, applies regardless of diagram type.
  - `tests/store/nestedGroups.test.ts` (new) — 4 tests: createGroupFromSelection accepts groups, addToGroup nests, cycle prevention, FL-GR5 promotion verification.
  - `tests/components/ThemeVariants.test.tsx` (new) — 5 tests: rust applies `.dark + .theme-rust`, swap is clean, light removes everything, all four named variants layer on `.dark`, highContrast clears named variants.
  - `tests/components/SettingsDialog.test.tsx` — two existing tests updated to disambiguate "Top → Bottom" and "Auto" between the doc-level Layout group and the new app-level Default Direction group via `data-radio-name` selectors.

### What didn't change

- The themes only adjust body background + focus accent. They don't restyle entity stripe colors, edge palette, or per-component card colors — those stay shared across all dark-family themes for visual consistency. Future polish could add per-theme accent tones for entity stripes if practitioners ask.
- Bundle 11 hoist + collapse + delete-promotion paths were already complete from prior sessions; the nested-groups picker is the only net-new UI.
- The `defaultLayoutDirection` preference only takes effect when *new* documents are created. Importing a JSON or Flying Logic doc respects whatever `layoutConfig` it carries; no override.

### Bundle status after this session

- **Bundle 11 — Complete.** All five FL-GR items shipped.
- **Bundle 13 — Complete.** All four FL-TO items shipped (more themes ✓, animation speed ✓, default orientation ✓, edge palette ✓). The FL-DI display toggles + Browse Lock + Document Inspector also live across earlier sessions.

After this session, every Iteration-2 bundle that was approved scope (1, 2, 3, 5, 6, 11, 13) has closed out. NEXT_STEPS pivots to the bigger structural items (B7+B10 custom attrs+classes, LA5 manual positioning everywhere, Tier-4 versioning H2/H3/H4).

**Tests: 566 passing / 0 failing / 566 total** (+14). Biome clean on `src/` and `tests/`.

## Session 60 — Iteration-2 Bundle 2 + 6 audit + Edge.description

User asked to ship Bundles 2 (Multi-select & Bulk Editing) and 6 (Rich Annotations & Text). The audit surfaced that most of both bundles was already shipped — the backlog had drifted out of sync with the code. This session ships the one genuine gap (`Edge.description` for long-form edge annotations), explicitly documents two design decisions (titles stay plain text, group annotations are out of scope), and updates NEXT_STEPS to mark both bundles complete.

### Bundle 2 audit — all four items already shipped

| Item | Status | Where |
|---|---|---|
| FL-SE1 Shift+click multi-select entities | Shipped | `Canvas.tsx:167` `multiSelectionKeyCode="Shift"` + `selectionSlice.ts:61` |
| FL-SE2 Marquee / rubber-band selection | Shipped | `Canvas.tsx:168` `selectionOnDrag` prop |
| FL-SE3 Cut / copy / paste | Shipped | `services/clipboard.ts` + `useGlobalShortcuts.ts` Cmd/Ctrl+C/X/V bindings + palette commands |
| FL-SE7 Alt+click to connect from current selection | Shipped | `Canvas.tsx:115` `onNodeClick` altKey branch |

The original "longest-pending Iteration-2 item" framing on these in NEXT_STEPS was stale — they've been live for several sessions.

### Bundle 6 audit + the one real gap

| Item | Status | Where / Why |
|---|---|---|
| FL-AN1 Multi-line titles (Alt+Enter) | Shipped | `TPNode.tsx:199` inline editor handles Alt+Enter |
| FL-AN2 Rich entity annotations | Shipped | `Entity` carries description (markdown), attestation, confidence, spanOfControl, unspecified flag |
| FL-AN3 / FL-ED7 Edge annotations | **Now shipped** (this session) — `Edge.description` |
| FL-AN4 Styled text in titles | **Won't build** (see decision below) |
| FL-AN5 Hyperlinks (URLs + cross-refs) | Shipped | `services/markdown.ts` external URL + internal `#N` rewrite |

### `Edge.description` — the new field

New optional `Edge.description?: string`. Distinct from:
- **`label`** (short, ≤30 chars, rendered inline mid-edge) — the *what is this edge*
- **`assumptionIds`** (linked Assumption entities for CLR challenges) — the *what assumptions back it*

The `description` field is the *why this edge holds* prose — a longer explanation that doesn't deserve a separate Assumption entity but is too long for the label. Renders in EdgeInspector as a `MarkdownField` (same idiom as Entity description and Document description). Markdown is supported.

Canvas surface: a small `📝` indicator appears mid-edge (mirrored opposite the assumption "A" pill, so they coexist on heavily-annotated edges) when the description is non-empty. The full text reads in the inspector. Hover tooltip says "This edge has a longer description — open inspector to read."

Round-trips through JSON. Flying Logic export drops it (no FL analog without re-opening the user-defined-attribute model the user excluded); reimporting an FL-exported doc loses the field.

### Design decision: titles stay plain text (FL-AN4 partial)

The "styled text in titles" leg of FL-AN4 is deliberately *not* shipped. Reasons:

- Titles are clamped to 2 lines on the canvas; markdown would expand into multi-line renders that don't fit the badge constraint.
- Annotation numbers, step badges, span-of-control pills, and reach badges already crowd the node's visual budget — adding markdown formatting would compete for the same screen real estate.
- Every export path (OPML / DOT / Mermaid / Flying Logic / reasoning narrative / annotations) currently treats titles as plain strings. Adding markdown to titles would either ship raw markdown chars in those outputs (ugly) or require stripping logic in every exporter (busywork that adds no value).
- Search would need to ignore the markdown syntax, breaking simple substring match.
- The book's examples consistently use plain titles. Emphasis goes in the description field, not the title.

Descriptions continue to render markdown (bold/italic/lists/links). Titles remain plain text by design.

### What changed

- **`src/domain/types.ts`** — `Edge.description?: string` added with explanatory comment.
- **`src/domain/persistence.ts`** — Validates the new optional field; rejects non-string values.
- **`src/components/inspector/EdgeInspector.tsx`** — New `MarkdownField` for description, placed between the short Label input and the Back-edge / Mutex / Assumptions blocks.
- **`src/components/canvas/TPEdge.tsx`** — Subscribes to the description field; renders a `📝` indicator pill when non-empty, mirrored opposite the assumption pill.
- **`tests/domain/edgeDescription.test.ts` (new)** — 4 tests: JSON round-trip, clear-on-undefined, coexistence with label + assumptionIds, persistence validation of non-string values.
- **`tests/components/EdgeInspector.test.tsx`** — 2 new tests: typing writes through, clearing → undefined (not empty string).

### What didn't change

- The short `label` field stays as-is — there's a natural division of labor now: `label` for "the connector word or short condition", `description` for "the explanation."
- Flying Logic round-trip stays best-effort; the new description doesn't break existing FL exports, just isn't carried.
- Bundle 11 (advanced groups) and B7/B10 (user-defined attributes + custom classes) remain on the backlog as separate work.

### Bundle status after this session

- **Bundle 2 — Complete.** All four FL-SE items shipped (most across earlier sessions; verified and documented this session).
- **Bundle 6 — Complete.** Four of five items shipped (FL-AN1, AN2, AN3/ED7, AN5); FL-AN4 partial-then-rejected for titles, fully shipped for descriptions. NEXT_STEPS updated accordingly.

NEXT_STEPS top notice now reflects that two more Iteration-2 bundles close out. The remaining Iteration-2 scope is Bundle 11 (advanced groups), Bundle 13 polish remainder (small).

**Tests: 552 passing / 0 failing / 552 total** (+6). Biome clean on `src/` and `tests/`.

## Session 59 — Closing out TOC-reading: Group presets + Archive + NBR + Span-of-control

Five book-derived items shipped together to close out the TOC-reading backlog ("Workflow & process" and "Mental model" sub-buckets). After this session, every item from the "Thinking with Flying Logic" reading has either landed (24 items across Sessions 52–59) or been deliberately deferred.

### Group presets

New canonical-catalog file `src/domain/groupPresets.ts` defines five book-derived structural sub-graph names with matching colors. The GroupInspector now offers them as a one-click chooser in a new "Preset" field — picking a preset writes both the group's title and its color in a single action; both fields remain editable afterward so the preset is a starting point, not a lock.

| Preset | Color | Default collapsed? | Used for |
|---|---|---|---|
| Negative Branch | rose | no | FRT injection's unintended UDE captured as a sub-tree |
| Positive Reinforcing Loop | emerald | no | FRT: a self-sustaining loop (pairs with back-edge tagging) |
| Archive | slate | **yes** | Pruned alternatives — CRT Step 8 / PRT Step 6 |
| Step | indigo | no | TT (Action + Precondition → Outcome) triple |
| NSP Block | amber | no | S&T Tree triple (parked until S&T ships) |

`presetById(id)` and `presetByTitle(title)` (case-insensitive + trim-tolerant) are exposed for cross-component lookups — the Archive palette command uses `presetByTitle` to find an existing Archive group rather than creating duplicates.

### Archive palette command

Palette → **"Move selection to Archive group"** reuses the existing "Archive" group if one is present (so the doc doesn't accumulate Archive (2) / Archive (3) duplicates) or creates one with the Archive preset (slate, collapsed). Pruned alternatives stay visible without cluttering the live diagram — the book's prescription on CRT Step 8 and PRT Step 6.

### Negative Branch (NBR) capture

Right-click any FRT entity → **"Start Negative Branch from this entity"** (also exposed as a palette command). Creates a new group titled "Negative Branch" (rose) with the right-clicked entity as the rooted member. Restricted to FRT in the context menu because NBR is specifically the FRT device for "an injection has produced an unintended UDE — capture the branch and decide whether to mitigate or replace the injection."

### Span-of-control flag

New optional `Entity.spanOfControl?: 'control' | 'influence' | 'external'` field captures the book's distinction between things the user can directly act on, indirectly affect, or only observe. CRT Step 7 explicitly asks "have you built down to causes you actually control or influence?"

EntityInspector renders a 4-button segmented control (Unset / Control / Influence / External). TPNode shows a single-letter colour-coded pill after the type label when flagged — emerald `C` (control), amber `I` (influence), neutral `E` (external). Unset entities show nothing, so the diagram stays clean for users who don't engage with the flag.

### External-root-cause CLR rule (mental-model nudge)

New `external-root-cause` rule (tier `clarity`, CRT-only) fires on any `rootCause` entity flagged `spanOfControl: 'external'`. Message: *"Root cause flagged as external — is it really the root? Keep digging toward something you control or influence."* The user resolves the warning by either pushing the chain deeper to a controllable cause OR explicitly acknowledging via the existing `resolvedWarnings` mechanism.

The rule is CRT-only because FRT injections (and EC Wants, PRT obstacles) are sometimes intentionally external — the warning would be noise on those diagram types. Tier `clarity` because the question is "have you stated this in a way you can act on?" rather than a structural-existence check.

### What changed

- **`src/domain/types.ts`** — Added `SpanOfControl` type, `Entity.spanOfControl?` field, `'external-root-cause'` in `ClrRuleId`.
- **`src/domain/groupPresets.ts` (new)** — Canonical preset catalog with `presetById` / `presetByTitle` lookups.
- **`src/domain/persistence.ts`** — Validates the new optional `spanOfControl` field as one of the three string values.
- **`src/domain/validators/externalRootCause.ts` (new)** — The CRT-only mental-model rule.
- **`src/domain/validators/index.ts`** — Registers `external-root-cause` on the CRT rule set with `clarity` tier; re-exports.
- **`src/components/inspector/GroupInspector.tsx`** — New "Preset" field with five preset buttons (title + hint + colour swatch).
- **`src/components/inspector/EntityInspector.tsx`** — New "Span of control" field with a 4-button segmented control (Unset / Control / Influence / External).
- **`src/components/canvas/TPNode.tsx`** — Renders a single-letter colour-coded pill next to the type label when `spanOfControl` is set.
- **`src/components/canvas/ContextMenu.tsx`** — New "Start Negative Branch from this entity" action on the entity branch, shown only in FRT.
- **`src/components/command-palette/commands/groups.ts`** — Two new palette commands: "Move selection to Archive group" and "Start Negative Branch from selected entity".
- **`tests/domain/groupPresets.test.ts` (new)** — 6 tests covering catalog shape, uniqueness, Archive's collapse default, and case-insensitive lookup.
- **`tests/domain/externalRootCause.test.ts` (new)** — 7 tests covering fires/silent cases, type filter, diagram-type scoping (CRT-only), and JSON round-trip.

### What didn't change

- The `Step` and `NSP Block` presets are parked — `Step` is useful once TT users start wrapping triples (a workflow choice that emerges from real usage), and `NSP Block` is reserved for the eventual S&T Tree diagram type.
- The Group preset chooser doesn't auto-collapse the group when picking Archive (the user can collapse manually if they want). The Archive palette command does collapse because the workflow target there is "tuck this away."
- Flying Logic round-trips: `spanOfControl` carries through via the custom `tp-studio-*` attribute path our writer already uses; group preset titles round-trip as plain titles. Both fields survive JSON exports natively.

### TOC-reading set: complete

After Session 59, every TOC-reading item is either shipped or explicitly deferred. The book-derived backlog opened in Session 51 closes here. Per-sub-bucket status:

| Sub-bucket | Items shipped | Items deferred |
|---|---|---|
| Reasoning helpers | 5/5 | 0 |
| Workflow & process | 6/6 | 0 |
| Analysis features | 3/3 | 0 |
| Diagram operations | 6/6 | 0 |
| Mental model | 1/1 | 0 |
| Reasoning text output | 2/2 | 0 |

**24 features delivered across Sessions 52–59** from one book reading. NEXT_STEPS now leads with the remaining Iteration-2 buckets (Bundle 2 Multi-select, Bundle 6 Rich Annotations, Bundle 11 Groups advanced) and the deferred structural items (B7 custom attrs, B10 custom classes, LA5 manual positioning, H2/H3/H4 versioning extensions).

**Tests: 546 passing / 0 failing / 546 total** (+13 across the two new test files). Biome clean on `src/` and `tests/`.

## Session 58 — Reasoning text export (narrative + outline Markdown)

Direct follow-up to Session 57 — the read-through overlay verbalizes edges live; this session carries that verbalization *out* of the app as a Markdown document the user can paste into a brief, deck, or postmortem. Two output shapes share the rendering primitives shipped in Session 57's `edgeReading.ts`.

### Narrative form

`exportReasoningNarrative(doc, label?)` walks every structural edge in topological order, rendering each as a complete English sentence using the diagram's natural causality reading. The output has three sections:

1. **Preamble** — title (H1), diagram-type subtitle (italic), optional author, document description (markdown verbatim). System Scope answers (Session 56) render as a `## System scope` block with one bullet per filled field. EC documents get a `## The conflict` block stating both Wants as "On the one hand…on the other hand…", plus a note when no mutex edge is drawn yet.
2. **Reasoning** — sentences one per edge in topological order. CRT/FRT/TT default to "[Effect] because [Cause]." PRT/EC default to "In order to obtain [Effect], [Cause] must hold." TT renders the proper AND-junctor triples: "In order to obtain [Outcome], do [Action] given [Precondition]." when the structure supports it.
3. **CRT-specific appendix** — `## Likely Core Driver(s)` section listing the entities surfaced by `findCoreDrivers(doc)` with their UDE-reach counts. The exported document carries the headline analytical finding alongside the chains.

### Outline form

`exportReasoningOutline(doc, label?)` is the same content reshaped as Markdown headings + nested bullets. Each terminal entity (no structural outgoing edges) becomes an `### heading`; its causes are nested underneath via `renderCausesInto`, recursing toward the root causes. Cycle-safe via a visited set.

EC isn't a tree — the 5-box layout is a structured description, not a recursion target — so EC outline mode renders the canonical hierarchy (Common goal → Needs → Wants), notes the mutex edge if drawn, and lists each edge's assumptions in an `### Assumptions on edges` subsection.

### File outputs + palette commands

`src/services/exporters/markup.ts` adds `exportReasoningNarrativeMd(doc)` and `exportReasoningOutlineMd(doc)` — same blob+download wrappers as the existing OPML/DOT/Mermaid exports. Filenames: `<title>-reasoning.md` and `<title>-reasoning-outline.md`. Two new palette commands in the Export group:

- "Export reasoning as narrative (Markdown)"
- "Export reasoning as outline (Markdown)"

### What changed

- **`src/domain/reasoningExport.ts` (new)** — `exportReasoningNarrative` + `exportReasoningOutline`, plus internal helpers (`renderPreamble`, `ttTriples`, `appendCoreDriverSection`, `renderCausesInto`, `renderEcOutline`, `findTerminals`).
- **`src/services/exporters/markup.ts`** — added `exportReasoningNarrativeMd` and `exportReasoningOutlineMd` browser-download wrappers.
- **`src/services/exporters/index.ts`** — re-exports the two new symbols.
- **`src/components/command-palette/commands/export.ts`** — two new palette commands in the Export group.
- **`tests/domain/reasoningExport.test.ts` (new)** — 16 tests across both modes: preamble + diagram-type subtitle, author, sentences in topological order, empty-doc placeholder, System Scope preamble, CRT Core Driver appendix, EC conflict statement + missing-mutex note, TT triple form, PRT "in order to" framing, outline headings, outline recursion, outline empty-causes hint, assumption exclusion, EC outline structure, CRT outline Core Driver appendix.

### What didn't change

- Reasoning exports use the `'auto'` causality preference by default (the right pick for most cases). Consumers can pass an explicit `CausalityLabel` if they want to override.
- Flying Logic doesn't round-trip these (no FL analog). They're a one-way Markdown export — same shape as the OPML / DOT / Mermaid exports from Block D.
- Per-diagram CRT/EC/TT shaping fully shipped. FRT-specific shaping (e.g., highlighting injections + negative-branch warnings) is feasible but the basic narrative form already reads correctly for FRT — deferred unless usage warrants more.
- The exporter doesn't yet emit the Method Checklist progress as a preamble line — could add a one-line "Method progress: N/M steps" if useful. Not shipped because the export is the *output of the reasoning*, not its method-tracking layer.

**Tests: 533 passing / 0 failing / 533 total** (+16). Biome clean on `src/` and `tests/`.

## Session 57 — TOC reasoning bundle: 6 features closing out Reasoning helpers + Diagram operations

Big batch — both the **Diagram operations** and **Reasoning helpers** sub-buckets of the TOC-reading set close out in this session. Six features grouped under three themes.

### Theme 1: EC depth (Diagram operations)

**Mutual-exclusion edge flag.** New `Edge.isMutualExclusion?: boolean` field, surfaced as a checkbox in the Edge Inspector when both endpoints are `want`-typed. The edge renders red with a ⊥ glyph. Persisted through JSON.

**EC missing-conflict CLR rule (`ec-missing-conflict`).** New existence-tier rule registered only on `RULES_BY_DIAGRAM.ec`. Fires when an EC has ≥2 Wants but no edge between any two Wants is flagged `isMutualExclusion`. Message: *"No mutual-exclusion edge between the two Wants — is this really a conflict?"* Stops firing once the user draws the want↔want edge and ticks the mutex checkbox.

**EC brainstorm prompts on edges.** When an edge is selected on an EC document, the inspector shows the book-prescribed brainstorm question matching the edge's role:

- Want → Need: *"How can we satisfy [Need] without obtaining [Want]?"*
- Need → Goal: *"How can we accomplish [Goal] without satisfying [Need]?"*
- Want ↔ Want (mutex): *"How can we obtain both [Want] and [Want']?"*

One click on **"Add as a new assumption"** turns the question into a `…because <question>` assumption attached to the edge. Pairs with Session 55's "…because" prefix.

### Theme 2: Direct manipulation (Diagram operations)

**Drag-onto-edge to create an AND junctor.** New store action `addCoCauseToEdge(edgeId, sourceId)` plus the canvas wiring to detect "drag from a node handle, release over an edge body". The canvas tracks `onEdgeMouseEnter` / `onEdgeMouseLeave` during the drag; `onConnectEnd` consumes that ref when `toHandle === null && toNode === null` and the hovered edge is set. The new edge joins the existing edge's AND group if any, otherwise mints a fresh `andGroupId` and stamps both. Toast confirms ("Added as a co-cause (AND-grouped).") or surfaces the duplicate / self-target reason.

### Theme 3: Verbalization (Reasoning helpers)

**Per-diagram-type edge reading templates.** Two additions to the `CausalityLabel` enum:

- `'in-order-to'` — renders as "in order to" (necessity-flavor reading natural for PRT/EC).
- `'auto'` — picks the diagram-type-appropriate reading at render time. CRT/FRT/TT → `because`. PRT/EC → `in order to`.

Settings dialog updated with both options + hint text. New domain utility `src/domain/edgeReading.ts` exposes:
- `resolveCausalityWord(label, diagramType)` — the resolution logic (centralized so the read-through overlay reuses it).
- `renderEdgeSentence(source, target, connector)` — verbalizes a single edge as a complete English sentence in the appropriate grammatical form for the connector.
- `resolveEdgeConnector(edge, label, diagramType)` — per-edge label wins, else falls back to global.
- `topologicalEdgeOrder(doc)` — Kahn-style DAG sort over structural edges; cycle-tolerant.

**Read-through mode.** New palette command "Start read-through (verbalize every edge)" opens a fullscreen overlay that walks every structural edge in topological order. Each step renders the canonical sentence ("[Effect] because [Cause]", "In order to obtain [Effect], [Cause] must hold"). Keyboard: → / Space advance, ← go back, Esc close. "Open this edge in the inspector" jumps directly. Forces the user (or an audience during a presentation) to verbalize every causal step.

**CLR walkthrough wizard.** New palette command "Start CLR walkthrough" iterates over every open warning one at a time. Each step shows the rule + tier + target description + message + two actions: **Resolve** (writes through `resolveWarning` and advances) and **Open in inspector** (jumps to the entity/edge and closes the wizard). The book's prescription is to "deliberately consider each CLR question for each part of the diagram" — the wizard is the deliberate version of the Inspector's at-a-glance WarningsList.

Both walkthroughs share a single uiSlice (`WalkthroughSlice`) with state shape `{ kind, index, targetIds }`. The overlay component reads which kind is active and switches body components accordingly.

### What changed

- **`src/domain/types.ts`** — Added `Edge.isMutualExclusion`, `'ec-missing-conflict'` to `ClrRuleId`, extended `CausalityLabel` shape.
- **`src/domain/persistence.ts`** — Validates the new `isMutualExclusion` boolean field.
- **`src/domain/validators/ecMissingConflict.ts` (new)** — The EC-specific rule.
- **`src/domain/validators/index.ts`** — Registers `ec-missing-conflict` on `RULES_BY_DIAGRAM.ec`, re-exports.
- **`src/domain/edgeReading.ts` (new)** — Shared verbalization utilities (resolveCausalityWord, renderEdgeSentence, topologicalEdgeOrder, resolveEdgeConnector).
- **`src/store/documentSlice/edgesSlice.ts`** — New `addCoCauseToEdge` action.
- **`src/store/uiSlice/walkthroughSlice.ts` (new)** — Walkthrough state machine + actions (startReadThrough, startClrWalkthrough, next/prev/close).
- **`src/store/uiSlice/index.ts`** — Wires the new sub-slice into the unified UISlice.
- **`src/store/uiSlice/prefs.ts` + `types.ts`** — Extended valid `CausalityLabel` values.
- **`src/components/canvas/useGraphMutations.ts`** — Returns new `onEdgeMouseEnter` / `onEdgeMouseLeave` callbacks; extended `onConnectEnd` to route drag-onto-edge releases through `addCoCauseToEdge`.
- **`src/components/canvas/Canvas.tsx`** — Wires the new edge-hover callbacks on `<ReactFlow>`.
- **`src/components/canvas/TPEdge.tsx`** — Mutex stroke + ⊥ glyph; `auto`/`in-order-to` causality resolution.
- **`src/components/inspector/EdgeInspector.tsx`** — Mutex checkbox (when both endpoints are Wants) + EC brainstorm-prompt panel.
- **`src/components/settings/SettingsDialog.tsx`** — `Auto` and `In order to` options in the Causality reading radio group.
- **`src/components/walkthrough/WalkthroughOverlay.tsx` (new)** — Fullscreen overlay reading the walkthrough state machine. Two body variants for read-through vs. CLR walkthrough.
- **`src/App.tsx`** — Mounts `<WalkthroughOverlay />` via lazy import.
- **`src/components/command-palette/commands/analysis.ts`** — Two new commands: "Start read-through (verbalize every edge)" and "Start CLR walkthrough".
- **Tests:**
  - `tests/domain/ecMissingConflict.test.ts` (new) — 5 tests covering fires/silent cases + diagram-type scoping.
  - `tests/domain/addCoCauseToEdge.test.ts` (new) — 6 tests covering AND-join semantics + guards.
  - `tests/domain/edgeReading.test.ts` (new) — 13 tests covering causality resolution + sentence rendering + topological order + cycle tolerance.
  - `tests/store/walkthrough.test.ts` (new) — 6 tests covering start/next/prev/close state machine.
  - `tests/components/SettingsDialog.test.tsx` — updated to disambiguate the now-shared "Auto" label.

### What didn't change

- Splice (Session 55) and drag-onto-edge AND junctor are now complementary: splice creates a new entity *in* the edge; drag-onto-edge creates an entity that becomes a *co-cause* on the edge's target via AND. Different gestures, different outcomes — both useful.
- The Flying Logic writer doesn't currently round-trip `isMutualExclusion` (no FL analog without re-opening the numeric weight model the user excluded). Field is dropped on FL export.
- Read-through and CLR walkthrough overlays don't persist progress — closing and re-opening restarts at index 0. A future polish could remember the last index per doc.

**Tests: 517 passing / 0 failing / 517 total** (+30 across four new test files; one update to keep `SettingsDialog.test.tsx` unambiguous about which "Auto" button it clicks). Biome clean on `src/` and `tests/`.

## Session 56 — TOC procedural scaffolding: System Scope + Method Checklist

Two coordinated TOC-reading items: a "Step 0" capture for the seven questions Goldratt's CRT method opens with, and a per-diagram-type method checklist that walks the user through each tree's canonical recipe. Both land inside the existing Document Inspector dialog so there's no new TopBar button or floating panel to learn — the user discovers them via "Document details…" as before.

### System Scope

New optional `TPDocument.systemScope` field with seven optional string sub-fields, one per book-canonical CRT Step 1 question:

- `goal` — what is this system / situation for?
- `necessaryConditions` — what must be true for the goal to be reachable?
- `successMeasures` — how will we know it's working?
- `boundaries` — what's inside the system vs. context that just affects it?
- `containingSystem` — what larger system is this inside?
- `interactingSystems` — other systems that affect or are affected
- `inputsOutputs` — what flows in, what flows out

The fields are universal rather than per-diagram-type — every TOC tree benefits from naming its scope before drawing entities. UI renders as a collapsible section in the Document Inspector with one textarea per question, auto-opening when at least one answer is already filled and showing a `N/7 answered` summary line on the collapsed header.

### Method Checklist

New optional `TPDocument.methodChecklist: Record<string, boolean>` plus a canonical catalog of step IDs + labels per diagram type in `src/domain/methodChecklist.ts`:

- **CRT** (9 steps): scope → list UDEs → connect causal chains → build down to root causes → apply CLR → test span of control → look for reinforcing loops → archive rejected branches → identify Core Driver
- **FRT** (6 steps): scope desired future → choose injections → build causal chains → CLR → watch for Negative Branches → design positive reinforcing loops
- **PRT** (6 steps): state objective → list obstacles → define IOs → sequence IOs → CLR → archive pruned
- **TT** (6 steps): state outcome → list actions → identify preconditions → build triples → CLR (incl. Complete-Step) → capture unspecified placeholders
- **EC** (7 steps): state conflict → articulate goal → name needs → verbalize edges → brainstorm "…because" assumptions → CLR → find injection

Each step has a one-line hint that ties back to existing TP Studio features where relevant (e.g. CRT step 9's hint mentions the Find Core Drivers palette command from Session 52; TT's preconditions step references the Unspecified flag from Session 53; the reinforcing-loop step references back-edge tagging from Session 55). The checklist isn't just procedural — it's also a discoverability surface for features that might otherwise sit unused.

Step IDs are stable, dot-prefixed by diagram type (`crt.scope`, `tt.preconditions`, etc.) so a doc's checklist survives a diagram-type change without colliding. The catalog is exhaustive over `DiagramType` via `Record<DiagramType, MethodStep[]>`, so a new diagram type fails TypeScript compile until a catalog entry lands.

UI renders as a collapsible section showing `M/N steps — [Diagram label]` in the summary header and an ordered list of checkboxes + labels + hints when expanded. Same auto-open behavior as System Scope (when ≥1 step is already checked).

### What changed

- **`src/domain/types.ts`** — Added `SystemScope` type and `TPDocument.systemScope` + `TPDocument.methodChecklist` fields.
- **`src/domain/methodChecklist.ts` (new)** — Canonical per-diagram-type step catalog (CRT 9 / FRT 6 / PRT 6 / TT 6 / EC 7 = 34 total steps) plus `METHOD_BY_DIAGRAM` and `ALL_METHOD_STEP_IDS`.
- **`src/domain/persistence.ts`** — Two new defensive validators (`validateSystemScope`, `validateMethodChecklist`) that drop malformed sub-fields rather than failing the whole import. JSON round-trip preserves both fields.
- **`src/store/documentSlice/docMetaSlice.ts`** — Two new actions: `setSystemScope(patch)` (merges, treats empty strings as clears, coalesces under `doc-scope:<keys>` for one undo step per field) and `setMethodStep(stepId, done)` (stores only `true` values; `done=false` removes the key entirely).
- **`src/components/settings/DocumentInspector.tsx`** — Two new collapsible sections with seven textareas + N-step checklist respectively. Module-level `EMPTY_SCOPE` / `EMPTY_CHECKLIST` sentinels keep the `useShallow` selector from looping (would have shipped to production as a "max update depth" bug otherwise — caught by the new component test).
- **`tests/domain/methodChecklist.test.ts` (new)** — 5 tests pinning the catalog shape: every diagram type has steps, step IDs are non-empty, step IDs are prefixed by diagram type, no duplicate IDs globally, `ALL_METHOD_STEP_IDS` contains every catalog entry.
- **`tests/store/systemScopeAndMethod.test.ts` (new)** — 14 tests covering merge / clear / no-op / round-trip behavior for both store actions, plus defensive validation on malformed JSON input.
- **`tests/components/DocumentInspector.test.tsx` (new)** — 11 tests covering existing meta-field regression + System Scope textarea wiring + auto-open behavior + N/7 counter + Method Checklist per-diagram catalogs + per-step toggling + Browse Lock disables both new sections.

### What didn't change

- The DocumentInspector's title / author / description / Description / type / counts blocks stay exactly as they were — additive surface, no regression risk on the existing happy path.
- No schema migration: both fields are optional and additive. Existing v5 docs validate unchanged.
- No new palette command — the existing "Document details…" entry is enough. Adding "Open System Scope…" / "Open Method Checklist…" shortcuts is a future polish if usage warrants.
- Flying Logic export: neither field round-trips via FL (no FL analog). They round-trip via JSON only.
- The "soft toast nudge on loading a CRT without an answered scope" — deferred. Toast on every doc load felt intrusive; the existing Document Inspector entry isn't hidden.

### Discoverability bonus

The checklist hints function as a guided tour of features shipped over the last few sessions:

| Where | Mentions |
|---|---|
| CRT step "identify Core Driver" | Session 52's Find Core Drivers palette command |
| CRT step "look for reinforcing loops" | Session 55's back-edge tagging |
| TT step "identify a precondition" | Session 53's Unspecified placeholder flag |
| TT step "apply CLR" | Session 53's Complete-Step rule |
| EC step "brainstorm assumptions" | Session 55's "…because" prefix |

A user who has been using TP Studio without working through the checklist will discover these features just by reading the steps.

**Tests: 487 passing / 0 failing / 487 total** (+30 across the three new files). Biome clean on `src/` and `tests/`.

## Session 55 — Three smallest-wins: splice, back-edge tagging, "…because" prefix

Three TOC-reading items shipped together as a single coherent UX upgrade. They share the theme "edge as a first-class target" — splice operates on an edge to insert an entity, back-edge tagging is a per-edge flag with visual + CLR consequences, and the "…because" prefix is on the new-assumption input that hangs off an edge.

### Splice — insert entity into an edge

`spliceEdge(edgeId)` action on the edges slice: removes the original edge, creates a fresh entity at the diagram's default type, and adds two new edges (`source → new`, `new → target`). The new entity is auto-selected and put in inline-edit mode so the user can type a title immediately — mirrors the Tab / "Add child" flows.

Edge property migration on splice:
- **Label** → downstream half (semantically closer to the effect).
- **Assumptions** → downstream half (same reasoning).
- **`isBackEdge` flag** → downstream half (the cycle is still closed by the same end, with one more node on the way).
- **`andGroupId`** → dropped on both new edges. The splice changes the AND structure (new entity now points to the original target alone), so the cleanest default is "you'll re-AND if you want." The remaining members of the original AND group keep their grouping; a toast informs the user when grouping was dropped.

Wired into the edge context menu as **"Splice entity into this edge"**.

### Back-edge tagging

New optional `Edge.isBackEdge?: boolean` field. The book treats causal loops as a legitimate phenomenon to *model* (vicious circles in CRTs, positive reinforcing loops in FRTs) rather than just to flag. Tagging an edge as a back-edge tells the system "this loop is the point."

Three places consume the flag:

- **Cycle CLR rule** (`src/domain/validators/cycle.ts`) now walks every edge in each cycle; if any edge is flagged `isBackEdge`, the warning is suppressed for that cycle. The user can tag *any* edge in the loop — most naturally the closing edge that the warning already pointed at, but the rule doesn't care which.
- **TPEdge render** picks up a `+1.5 px` stroke bump and a `6 4` dash pattern, plus a small `↻` glyph badge in amber to the right of the label position. Two visual cues so the back-edge reads as "deliberate" rather than just "selected" in a quick scan.
- **EdgeInspector + context menu** expose toggles: the inspector has a checkbox with explanatory hint, the context menu has "Tag as back-edge" / "Untag back-edge" depending on current state.

Persistence validates the field as optional boolean; JSON / Flying Logic round-trips preserve it.

### "…because" prefix for new EC assumptions

The book recommends every Evaporating Cloud assumption start with "…because" so the canonical reading falls out: "we must obtain *Want* …because *Assumption*." The `EdgeAssumptions` component now passes `'…because '` as the seed title to `addAssumptionToEdge` when `diagramType === 'ec'`; on any other diagram the input stays empty.

A small caret-position fix in `AssumptionRow` moves the cursor to the *end* of the seed text on auto-focus, so the user types from `…because ▍` rather than `▍…because `.

### What changed

- **`src/domain/types.ts`** — Added `Edge.isBackEdge?: boolean` with documentation.
- **`src/domain/persistence.ts`** — Validates the new optional boolean field on Edge.
- **`src/domain/validators/cycle.ts`** — Walks the full cycle edge list; skips cycles where any edge has `isBackEdge: true`.
- **`src/store/documentSlice/edgesSlice.ts`** — New `spliceEdge(edgeId): Entity | null` action.
- **`src/components/canvas/TPEdge.tsx`** — Reads `isBackEdge`, bumps stroke + adds dash pattern + renders the `↻` badge.
- **`src/components/canvas/ContextMenu.tsx`** — New edge-menu items: "Splice entity into this edge", "Tag as back-edge" / "Untag back-edge".
- **`src/components/inspector/EdgeInspector.tsx`** — New "Back-edge" checkbox field with explanatory hint.
- **`src/components/inspector/EdgeAssumptions.tsx`** — EC-prefixed seed title via the `addAssumptionToEdge` second arg, plus caret-to-end behavior on auto-focus.
- **`tests/domain/spliceEdge.test.ts` (new)** — 6 tests: replaces edge with two-edge pair through new entity, selects + edits the new entity, inherits label/assumptions/back-edge onto downstream half, drops AND grouping cleanly, null on missing edge id, increments annotation counter.
- **`tests/domain/backEdge.test.ts` (new)** — 5 tests: cycle fires by default, exemption when any cycle edge is flagged, two disjoint cycles handled independently, JSON round-trip preserves the flag, validate() pipeline tags warnings with `existence` tier.
- **`tests/components/EdgeInspector.test.tsx`** — Added back-edge checkbox round-trip + EC "…because" prefix test + CRT-default-empty test (3 new cases).

### What didn't change

- Edge inspector still shows AND-group field conditionally on `andGroupId` presence; back-edge is independent.
- Browse Lock semantics: splice, back-edge toggle, and assumption-add all gate through `guardWriteOrToast()` / the inspector's `disabled={locked}` plumbing.
- The Flying Logic writer doesn't currently round-trip `isBackEdge` (no native FL analog). On TP → FL export, the flag is silently dropped; on FL → TP import (no source), the field starts undefined. Acceptable for an interop-best-effort target.

**Tests: 457 passing / 0 failing / 457 total** (+14 across the three wins). Biome clean on `src/` and `tests/`.

## Session 54 — Flying Logic import: accept FL 4 user-saved (.xlogic) format

A real `.xlogic` file (Flying Logic 4 desktop-save) from a user surfaced a silent-failure bug in our FL reader: 58 entities + 59 edges in, zero entities and zero edges out, no error. Diagnosis: our reader was built against the *scripting API* XML shape (flat layout, `<attribute>` children directly under `<vertex>`, `entityClass` as a plain XML attribute), but the desktop app's File → Save format uses a *different* nested layout. Both are valid FL XML; we only handled one.

### The two schema variants

| Aspect | Scripting / our writer (flat) | FL 4 user-saved (nested) |
|---|---|---|
| Vertices path | `decisionGraph > vertices` | `decisionGraph > logicGraph > graph > vertices` |
| Edges path | `decisionGraph > edges` | `decisionGraph > logicGraph > graph > edges` |
| Attribute container | `<attribute>` children direct on `<vertex>` | `<attributes>` wrapper around `<attribute>` children |
| `entityClass` storage | XML attribute on `<vertex>` | Nested `<attribute key="entityClass"><entityClass name="..."/></attribute>` |
| Vertex `type` storage | XML attribute on `<vertex>` | Nested `<attribute key="type">entity</attribute>` text |
| Document metadata | Root-level `<attribute key="title">…</attribute>` | `<documentInfo title=… author=… comments=…/>` element |

The reader now handles both. It tries the flat form first (cheaper, the shape our own writer emits) and falls back to the nested form via dedicated helpers (`attributeHost`, `getEntityClass`, `getVertexTypeAttr`, `getGroupedAttr`, `getCollapsedAttr`). Descendant selectors (`decisionGraph vertices`, `decisionGraph edges`) match both layouts since each XML file contains exactly one `<vertices>` / `<edges>` element.

### jsdom `:scope` quirk worked around

A subtle bug surfaced while testing: `el.querySelector(':scope > entityClass')` returned `null` on the real-world file but worked on a hand-crafted minimal fixture. Manual `Array.from(el.children).find(c => c.tagName === 'entityClass')` worked in both. Replaced every `:scope > tag` selector in the reader with a small `firstChildByTag` helper that iterates `children` directly — same semantics, but reliable in jsdom's XML mode regardless of which attributes are on the parent element.

### Entity-class mappings extended

The real file used FL stock classes that weren't in our `FL_TO_ENTITY_TYPE` map:

| FL class | New mapping | Note |
|---|---|---|
| `Desirable Effect` | `desiredEffect` | Spelling variant of "Desired Effect"; same TS type |
| `Generic` | `effect` | FL's catch-all class; rendered as a plain effect node |
| `Note` | `effect` | A future `note` entity type (FL-ET7) would absorb this |
| `Knowledge` | `effect` | FL's "we know X about the situation" class |

The fallback for unmapped classes was already `effect`, so existing files with these classes loaded as effects — but the new mappings make the intent explicit and let `desiredEffect`-typed entities land with their proper color and icon.

### File picker now accepts `.xlogic`

The Flying Logic file picker (`pickFlyingLogic`) accepted `.logicx, .logic, application/xml, text/xml`. Added `.xlogic` (the FL 4 desktop-save extension) so the file chooser doesn't grey out the file in the first place.

### What changed

- **`src/domain/flyingLogic/reader.ts`** — Refactored to handle both schema variants via the helpers described above; replaced unreliable `querySelector(':scope > tag')` calls with a manual `firstChildByTag` iteration.
- **`src/domain/flyingLogic/typeMaps.ts`** — Added `Desirable Effect → desiredEffect`, `Generic → effect`, `Note → effect`, `Knowledge → effect` mappings.
- **`src/services/exporters/flyingLogic.ts`** — File picker now accepts `.xlogic` alongside `.logicx` / `.logic`.
- **`tests/domain/flyingLogic.test.ts`** — Added 8 nested-schema tests against a hand-crafted minimal fixture: structural parsing, title reading from `<attributes>` wrapper, entityClass extraction from nested `<entityClass name="..."/>` element, `Desirable Effect → desiredEffect` mapping, `Generic / Note → effect` fallback, document metadata from `<documentInfo>`, edge-target resolution across the nested layout, and junctor handling (AND-grouped edges) in the nested form.

### What didn't change

- The writer still emits the flat / scripting format. We don't need to round-trip to user-saved form — real Flying Logic will read either shape. Round-trip-via-our-writer is still tested and works.
- AND-groups, group entities, edge labels, attestations: all still round-trip the same way they did before.
- The probe used to verify the real user file (58 entities, 59 edges, 5 goals + 2 desiredEffect + 51 effects) was a disposable test, not committed — the user's actual business data stays out of the repo. The hand-crafted minimal fixture in the test suite pins the schema contract instead.

**Tests: 443 passing / 0 failing / 443 total** (+8 new nested-schema cases; +1 ticked from the FL test suite reorganization).

## Session 53 — TT discipline (Complete-Step validator + Unspecified-Precondition flag)

Two TOC-reading items that work together: a new TT-specific CLR rule that demands every Action be paired with a Precondition, and a generic "unspecified placeholder" entity flag that lets the user capture inarticulate hunches without triggering the empty-title rule. The pair closes the long-acknowledged "no TT-specific CLR rules yet" gap (Session 48) and adds the book's "unspecified Preconditions" device.

### Complete-Step structural rule (`complete-step`)

From the book's TT taxonomy: a Transition Tree "step" is the triple `(Outcome ← Precondition + Action)`. The Action is the do-something; the Precondition is the existing reality that, together with the Action, sufficient-cause-produces the Outcome. A TT with Actions feeding Outcomes without paired Preconditions is structurally incomplete — "what's the existing state that lets this Action work?" remains unanswered.

`src/domain/validators/completeStep.ts` implements the rule:

```
for each `action` entity A:
  for each outgoing edge A → T:
    look at T's other incoming edges (excluding A → T)
    if no sibling is from a non-action, non-assumption entity:
      fire warning on the A → T edge
```

Tier: `sufficiency` (the question is "are these causes enough on their own?"). Wired into `RULES_BY_DIAGRAM.tt` and exposed alongside the other per-rule entries from `validators/index.ts`. CRT / FRT / PRT / EC don't pick the rule up — it's TT-specific.

### Unspecified-Precondition flag (`Entity.unspecified`)

New optional `unspecified?: boolean` field on `Entity`. When `true`:

1. **`entity-existence`** rule skips the empty-title check — the empty title is *deliberate*, signalling "there's a precondition here, I don't yet know what."
2. **TPNode** renders a `?` glyph and an italic "Unspecified — fill in later" placeholder, so the user remembers to come back.
3. **Complete-Step** rule treats the placeholder as a valid precondition sibling — the slot is filled, even if the title is blank.

The user toggles the flag via a new "Unspecified placeholder" field in `EntityInspector`. Originally motivated by the book's TT device (Step 5: "inarticulate reservations should be added as unspecified Preconditions that can be removed later if they fail to materialize"), but the flag itself is generic and works in any diagram type.

The field is optional and additive, so no schema migration is needed — existing v5 documents stay valid. `persistence.ts` validates it as `boolean | undefined`; JSON / Flying Logic round-trips carry it through.

### What changed

- **`src/domain/types.ts`** — Added `Entity.unspecified?: boolean` and `'complete-step'` to `ClrRuleId`.
- **`src/domain/persistence.ts`** — Validates the new optional boolean field on Entity.
- **`src/domain/validators/entityExistence.ts`** — Skips the empty-title check when `entity.unspecified === true`.
- **`src/domain/validators/completeStep.ts` (new)** — TT-specific rule firing on Actions without paired Preconditions.
- **`src/domain/validators/index.ts`** — Registers `complete-step` in `RULES_BY_DIAGRAM.tt` with tier `sufficiency`, re-exports it.
- **`src/components/inspector/EntityInspector.tsx`** — New "Unspecified placeholder" toggle, controls the flag with an explanatory hint.
- **`src/components/canvas/TPNode.tsx`** — Renders a `?` glyph + italic placeholder when `entity.unspecified === true`.
- **`tests/domain/completeStep.test.ts` (new)** — 9 tests covering: fires on bare action→outcome, skips when a non-action sibling feeds the same outcome, treats `unspecified` placeholders as valid preconditions, doesn't accept two ANDed actions as filling each other's slot, ignores assumption-sourced siblings, TT-only registration (CRT untouched), and `sufficiency` tier tagging. Plus 2 tests on `entityExistence` + the unspecified flag interaction.

### TT example rewrite

`src/domain/examples/tt.ts` was rewritten from a flat 5-action chain into the proper Outcome ← (Action + Precondition) triple structure. Each step now AND-groups an Action with its enabling Precondition (or the previous step's Outcome chained forward), so loading the example demonstrates the canonical TT pattern rather than tripping the Complete-Step rule five times. One step's precondition is intentionally left as an Unspecified placeholder (`?` glyph, empty title) so the example also showcases that feature in its natural habitat. New `EXAMPLE_BY_DIAGRAM.tt()` round-trips clean validation — pinned by a new test.

`buildEntity` (in `src/domain/examples/shared.ts`) had its `extras` Pick widened from `{ ordering, position }` to also accept `{ unspecified, description }`, so the new TT example can declare the unspecified placeholder inline.

### What didn't change

- The flag is generic, but the immediate user value is in TT documents. Other diagram types can flag entities as `unspecified` too — useful for any "I'll come back to this" placeholder.
- Browse Lock semantics: the flag is a write, so it gates through `guardWriteOrToast()` like every other entity edit.

**Tests: 435 passing / 0 failing / 435 total** (+10: 9 for Complete-Step + unspecified, 1 for the new TT example pinning). Pre-existing Biome and TS warnings outside this block (`scripts/*.cjs`, `tailwind.config.js`, `docMutate.ts`) are unchanged.

## Session 52 — Analysis bundle (Core Driver finder + UDE-reach badge + Spawn EC)

Three TOC-discipline features sourced from the "Thinking with Flying Logic" reading. The thread connecting them: TP Studio has surfaces for *building* a CRT but not for *using* one — the practitioner's payoff for drawing the tree is supposed to be the Core Driver, the single root cause whose elimination clears the most UDEs (Goldratt's CRT Step 9). This session ships three coordinated pieces around that payoff.

### Core Driver finder

`src/domain/coreDriver.ts` exports `findCoreDrivers(doc): CoreDriverCandidate[]` and the underlying `udeReachCounts(doc): Map<id, number>` helper. The finder:

1. Picks candidates: explicit `rootCause`-typed entities when any exist (the user has already done the typing work), otherwise structural entities with no structural incoming edges (graph leaves).
2. Scores each candidate by transitive forward UDE-reach via existing `reachableForward`.
3. Sorts descending by reach, breaks ties by annotation number.
4. Keeps everything tied for top plus anything within one UDE of the top, capped at 3 unless the top tier itself is wider.

The palette command **"Find core driver(s)"** runs the finder, selects the candidates so the canvas highlights them, and toasts the scores. Single-candidate result: `Core driver: "Order entry is manual" reaches 7 UDEs.` Multiple candidates: a comparison list with the top scores. No-result case (no UDEs, or no root cause reaches any): informative toast, no selection change.

### UDE-reach badge overlay

New persisted preference `showReachBadges` (default OFF, surfaced in Settings → Display). When on, every entity that transitively reaches one or more UDEs gets a small amber pill at the bottom-left of its node reading `→N UDEs`. The badge IS the cheap continuous view of the Core Driver signal — the higher the number on a leaf cause, the stronger that cause's case for being the Core Driver. Auto-hides on diagrams without UDEs (PRT / TT / EC).

The reach counts are computed once per doc change inside `useGraphNodeEmission` and threaded onto each `TPNodeData` as `udeReachCount`, so the per-node render path stays a primitive read with no extra subscriptions. Cost is O(V × (V+E)) but cached by the existing graph-emission `useMemo` — sub-millisecond on the test graphs, well under any plausible interactive ceiling.

### Spawn EC from a CRT entity

`src/domain/spawnEC.ts` exports `spawnECFromConflict(sourceDoc, entityId)` which returns a fresh Evaporating Cloud document seeded with the source entity's title in the Want 1 slot, plus blank placeholders for Goal / Need 1 / Need 2 / Want 2 at the canonical 5-box coordinates. The book's prescription: after producing a CRT, recast the Core Driver as the Core Conflict and explore it with an EC.

Two entry points:

- **Context-menu** action on any entity in a CRT: "Spawn Evaporating Cloud from this entity". Restricted to CRT because the workflow is CRT-specific (the practitioner has just identified a Core Driver and wants to recast it).
- **Palette command** "Spawn Evaporating Cloud from selected entity" — same action, keyboard-driven, works whenever exactly one entity is selected.

The swap uses the existing `setDocument` action, so Session 41's H1 auto-snapshot path captures the outgoing CRT as a revision — the user can roll back to the CRT at any time. The new EC's title is prefixed `EC from "..."` so it's identifiable in the revisions panel.

### What changed

- **`src/domain/coreDriver.ts` (new)** — `udeReachCounts` + `findCoreDrivers`. Pure functions, no React or store dependencies.
- **`src/domain/spawnEC.ts` (new)** — `spawnECFromConflict` factory.
- **`src/components/canvas/useGraphNodeEmission.ts`** — runs `udeReachCounts(doc)` once per doc change and stamps `udeReachCount` onto each entity's node data.
- **`src/components/canvas/flow-types.ts`** — `udeReachCount?: number` added to `TPNodeData`.
- **`src/components/canvas/TPNode.tsx`** — renders the amber `→N UDEs` badge at the bottom-left when `showReachBadges` is on and the entity has a non-zero count.
- **`src/components/canvas/ContextMenu.tsx`** — new "Spawn Evaporating Cloud from this entity" action shown on entity context menus when `diagramType === 'crt'`.
- **`src/components/command-palette/commands/analysis.ts` (new)** — `analysisCommands`: "Find core driver(s)" and "Spawn Evaporating Cloud from selected entity". Registered in `commands/index.ts`.
- **`src/components/settings/SettingsDialog.tsx`** — new Display toggle "Show UDE-reach badge".
- **`src/store/uiSlice/preferencesSlice.ts` + `prefs.ts` + `types.ts`** — `showReachBadges` field with setter, persisted to localStorage alongside the other display prefs.
- **`tests/domain/coreDriver.test.ts` (new)** — 10 tests covering: no-UDE empty case, BFS counts, multi-UDE downstream, assumption exclusion, no-rootCause-reaches-UDE empty case, dominant-driver ranking, tie-breaking, fallback to leaf entities, reachedUdeIds plumbing.
- **`tests/domain/spawnEC.test.ts` (new)** — 7 tests covering: canonical 5-box shape, Want 1 title seeding, four canonical edges, canonical positions, missing-source fallback, title-derivation, fresh document id.

### What didn't change

- The Core Driver finder doesn't permanently *mark* entities — it's a one-shot palette command. The reach badge is the persistent view; the finder is the explicit "now tell me" question.
- Spawn EC works by document swap (single-doc model). When multi-document tabs ship (FL-EX8), this would naturally upgrade to open the EC in a new tab rather than replace the current doc.
- Browse Lock semantics: the finder is a read, no lock check. Spawn EC writes (swaps the doc), so it gates through `guardWriteOrToast()` like every other mutation.
- The reach count is forward-only (cause → UDE). The TOC-reading also suggested showing "←N root causes" for the reverse direction, but on real CRTs that number is almost always 1 (the graph is approximately a tree), so it was deferred as low-leverage clutter.

**Tests: 425 passing / 0 failing / 425 total** (+17). Pre-existing Biome and TS warnings outside this block (`scripts/*.cjs`, `tailwind.config.js`, `docMutate.ts`) are unchanged.

## Session 51 — Block D: Extra exports (N1 OPML + N2 DOT + N3 Mermaid)

Three new one-way export formats that ride on the same per-format pipeline as the existing JSON / CSV / Flying Logic / annotation exports — domain layer produces a string, the service layer wraps it in a `Blob` and triggers a browser download, the command palette exposes the trigger. Block D was the last block from the original Bundle 4 + B + E + N plan; with this shipping the plan closes out.

### N1 — OPML 2.0 outline (`.opml`)

`src/domain/opmlExport.ts` renders the structural causal graph as an OPML 2.0 outline ready to open in OmniOutliner, Bike, Logseq, or any outliner that speaks OPML. Causal graphs are DAGs but outliners want a single-parent tree, so the projection picks each entity's lowest-numbered outgoing target as its outline parent — deterministic and stable across runs. Roots are entities with no outgoing edges (the apex of a CRT / FRT / PRT). Each `<outline>` carries `text`, custom `_type` (entity type label), `_annotation` (the stable per-document number), and `_note` (the markdown description, OmniOutliner convention). Assumption entities are omitted — they belong to edges, not the causal flow.

### N2 — Graphviz DOT (`.dot`)

`src/domain/dotExport.ts` emits a `digraph` ready to paste into `dot`, `dreampuf.github.io/GraphvizOnline`, VS Code's Graphviz Preview, or any DOT-aware tool. `rankdir=BT` matches the in-app rendering (effects on top, causes below). Per-entity styling uses the type's stripe colour as the node border with a 2 px pen weight — we don't tint the fill since alpha hex (`#rrggbbaa`) isn't universally supported. AND-grouped edges render with `style=bold` (closest cue to FL's junctor circle in plain DOT). Label preamble (`Undesirable Effect — #3`) keeps the type / annotation visible in the rendered output.

### N3 — Mermaid flowchart (`.mmd`)

`src/domain/mermaidExport.ts` emits Mermaid `graph BT` syntax that renders inline in GitHub READMEs, Notion code blocks, Obsidian notes, GitLab MRs, and `mermaid.live`. Frontmatter carries the document title (`---\ntitle: ...\n---`). Per-entity styling uses one `classDef` per entity type present in the doc, with the stripe colour as `stroke` and a 10 %-alpha tint as `fill` (Mermaid accepts the `1a` alpha suffix). AND-grouped edges use Mermaid's thick-arrow syntax (`==>`). Labels are HTML-escaped (`&quot;`) and embedded newlines become `<br/>` since Mermaid doesn't accept literal newlines inside `"..."`.

### What changed

- **`src/domain/opmlExport.ts` (new)** — `exportToOpml(doc): string`. DAG → tree projection by lowest-numbered outgoing target. Custom `_type / _annotation / _note` attributes per OPML 2.0 convention. XML-escapes title / description / author.
- **`src/domain/dotExport.ts` (new)** — `exportToDot(doc): string`. `rankdir=BT`, stripe-coloured node borders, bold edges for AND groups, type/annotation in label preamble. Escapes backslashes, quotes, and newlines inside DOT-string labels.
- **`src/domain/mermaidExport.ts` (new)** — `exportToMermaid(doc): string`. Frontmatter title, `graph BT`, per-type `classDef`, `==>` for AND-grouped edges. HTML-escapes labels.
- **`src/services/exporters/markup.ts` (new)** — `exportOPML / exportDOT / exportMermaid` browser-side wrappers, each one a 3-line `Blob` + `triggerDownload` over the domain function.
- **`src/services/exporters/index.ts`** — re-exports the three new symbols alongside the existing format families.
- **`src/components/command-palette/commands/export.ts`** — three new palette commands in the `Export` group: "Export as OPML outline", "Export as Graphviz DOT", "Export as Mermaid diagram".
- **`tests/domain/opmlExport.test.ts` (new)** — 8 tests covering: OPML envelope shape, empty-doc body, cause-under-effect nesting, XML-escaping of titles & descriptions, assumption exclusion, three-deep chain depth, `_type / _annotation` attributes, `<ownerName>` rendering.
- **`tests/domain/dotExport.test.ts` (new)** — 6 tests covering: digraph header + `rankdir=BT`, per-entity nodes with stripe colour, source → target arrows, assumption exclusion, `style=bold` for AND-grouped edges, escaping of `"` / `\\` / newlines.
- **`tests/domain/mermaidExport.test.ts` (new)** — 7 tests covering: frontmatter title + `graph BT`, labeled nodes, `-->` edges, `==>` for AND-grouped edges, `classDef` + `class` per type, newline / quote escaping, assumption exclusion.

### What didn't change

- Imports stay one-way for the new formats. Mermaid import (N3 reverse) was already deferred to NEXT_STEPS as a heavier parser task; OPML / DOT import would slot into the same module layout if they ever land.
- The Flying Logic round-trip remains the canonical "full fidelity" interop path — OPML / DOT / Mermaid each drop something the others keep (OPML drops multi-parent links; DOT and Mermaid drop assumptions and the annotation grouping fields).
- The existing JSON / CSV / SVG / PNG / JPEG / annotation paths are unchanged.
- Browse Lock doesn't gate exports — reads are always allowed.

**Tests: 408 passing / 0 failing / 408 total** (+21). The pre-existing Biome warnings in `scripts/*.cjs` + `tailwind.config.js` and the TS errors in `src/store/documentSlice/docMutate.ts` are unrelated to Block D and unchanged by this session.

### Block plan complete

With Block D shipping, the Bundle 4 + B + E + N multi-block plan from Session 46 closes out:

| Block | Scope | Session |
|---|---|---|
| 0 | Refactor pre-work (schema v5, LayoutConfig, TieredRule, useZoomLevel, findCycles, icon slot) | 46 |
| A | Layout Controls (LA1/LA2/LA3) — Direction / Compactness / Bias / Reset | 47 |
| C | CLR rule extensions (E2 Indirect / E3 Cycle / E5 Tiered / E6 Attestation) | 48 |
| B | Visual distinguishers (B3 icons / B5 zoom-up / B8 batch-edit) | 50 |
| D | Extra exports (N1 OPML / N2 DOT / N3 Mermaid) | 51 |

Plus a connection-UX fix mid-stream (Session 49). NEXT_STEPS carries the deferred items (LA5 manual positioning, B7 attributes, B10 custom classes, N3 Mermaid import, N5 VGL) and a new batch of 21 ideas from the "Thinking with Flying Logic" TOC reading.

## Session 50 — Block B: Visual distinguishers (B3 icons + B5 zoom-up + B8 batch-edit)

Three pieces of node-level UX that share one theme: keep the user oriented when the canvas gets dense. Per-type icons add a second visual cue alongside the stripe colour. A zoom-up overlay surfaces full titles when the user pulls back. Multi-select inspector gains two batch operations beyond type-conversion. Block 0.6 had already cut the icon slot in `EntityTypeMeta` and the `useZoomLevel` hook — this session filled both in and added the batch ops on top.

### B3 — Per-type entity icons

Each `EntityType` now carries a Lucide icon picked for semantic clarity over decoration:

| Type | Icon | Reading |
|---|---|---|
| `ude` | AlertTriangle | warning, something we don't want |
| `effect` | Activity | a happening; motion + change |
| `rootCause` | Sprout | grows downstream effects |
| `injection` | Syringe | the TOC term, literal |
| `desiredEffect` | Sparkles | a good outcome |
| `assumption` | HelpCircle | unverified, taken on faith |
| `goal` | Flag | aspirational endpoint |
| `criticalSuccessFactor` | Star | primary supporting condition |
| `necessaryCondition` | CheckSquare | checkable prerequisite |
| `obstacle` | Mountain | barrier in a PRT |
| `intermediateObjective` | Milestone | stepping stone in a PRT |
| `action` | Hammer | do-something step in a TT |
| `need` | Heart | EC middle-row requirement |
| `want` | Zap | EC outer-row strategy |

`EntityTypeMeta.icon` is now **required** (was optional through Block 0.6). The icon renders next to the type label in `TPNode`, coloured to match the stripe so the two cues read together rather than competing. `aria-hidden` because the label text already announces the type.

### B5 — Zoom-up annotation overlay

Below `zoom < 0.7`, in-node title text starts looking pixel-fuzzy. The new overlay fires when **(zoom < 0.7) AND (selected OR hovered)** — always-on at low zoom would clutter the canvas, but the user is signalling intent the moment they hover or select. The card renders inside React Flow's `NodeToolbar` so it stays in screen coordinates regardless of the canvas transform. It carries the type label + icon, the full multi-line title, and the description's first 4 lines.

`TPNode` subscribes to zoom via `useZoomLevel()` (one subscription per visible node — the only thing that depends on zoom). Hover state is local `useState`, not in the store — there's no cross-component consumer of "is this node hovered."

### B8 — Multi-select batch operations

`MultiInspector` for entities previously had only type-conversion + swap + delete. Two new operations:

- **Title size — apply to all.** Three buttons (Compact / Regular / Large). `'md'` is the implicit default, so picking Regular writes `titleSize: undefined` — the persisted shape matches a freshly-created entity rather than carrying a redundant explicit `'md'`. The pill highlights when all selected entities already share that size.
- **Renumber as steps.** A start-at input (defaults to 1) + an "Apply N…N+k-1" button. Walks the selection in order, writing `ordering: startAt + idx` to each. Hidden for single-entity selection (the action makes no sense at length < 2). The selection order mirrors what React Flow collected — typically click order, with marquee selection falling back to node z-order. Close enough for a renumber gesture; if the user wants strict order they re-click in sequence.

Description mass-edit was considered and rejected as scope creep — markdown descriptions are author-specific enough that a "replace all" is almost always wrong; type / size / order ops are not.

### What changed

- **`src/domain/entityTypeMeta.ts`** — `icon: LucideIcon` is now a required field on `EntityTypeMeta`. Added the 14-icon `ICONS` map and a documentation block explaining each pick.
- **`src/components/canvas/TPNode.tsx`** — renders `<meta.icon>` next to the type label. Added `isHovered` local state, `useZoomLevel()` subscription, and the `NodeToolbar` overlay gated on `zoom < ZOOM_UP_THRESHOLD && (selected || isHovered) && !isEditing`. The overlay carries icon + label + full title + description (first 4 lines, `line-clamp-4`).
- **`src/components/inspector/MultiInspector.tsx`** — added the "Title size — apply to all" Field with three Compact/Regular/Large buttons, and a new `RenumberControl` component (number input + Apply button). Browse Lock disables both. Single-entity selection hides the renumber control.
- **`tests/domain/entityTypeMeta.test.ts`** — new `ENTITY_TYPE_META (Block B / B3 icons)` describe block: every entity type carries an icon, and the existing `stripeColor / label / type` triple is preserved.
- **`tests/components/MultiInspector.test.tsx` (new)** — 6 tests for the batch ops: Compact applies to all selected, Regular writes `undefined`, renumber starts at 1 and walks the selection, the start-at input is respected, renumber hides for single-entity selection, Browse Lock disables both controls.

### What didn't change

- The stripe colour is still the primary type cue; the icon supplements it (especially valuable for the high-contrast / colorblind-safe palettes added in Session 33).
- `EntityInspector` (single-entity) still has its own Title size + Step # fields — the batch ops are *additional*, not a replacement.
- Browse Lock semantics — all new write paths gate through `guardWriteOrToast()` like every other mutation.
- The `useZoomLevel` hook still has just two callers (this one and `ZoomPercent`); the per-node subscription cost is one selector reading `state.transform[2]`.

**Tests: 387 passing / 0 failing / 387 total** (+8). The pre-existing Biome warnings in `scripts/*.cjs` + `tailwind.config.js` and TS errors in `src/store/documentSlice/docMutate.ts` are unrelated to Block B and unchanged by this session.

## Session 49 — UX fix: connections can land anywhere over the target box

**The problem.** React Flow's default behaviour is "drag from a handle, drop on a handle." Each entity's handle is a ~10 px dot at the top or bottom of the node — releasing a few pixels off failed silently, even when the cursor was clearly over the target entity. The rest of the 220 × 72 px box (most of the inviting surface) was a dead zone.

**The fix.** React Flow's `onConnectEnd` callback fires whenever a connection-drag ends, with a `FinalConnectionState` that includes `toNode` — the node the cursor was over at release time, regardless of whether a handle was hit. So the new flow:

1. **Existing path (unchanged):** release on / near the handle dot → React Flow fires `onConnect` → store's `connect()` runs.
2. **New fallback:** release over the target body (but not the handle) → `onConnect` doesn't fire, but `onConnectEnd` does with `toNode` set and `toHandle: null` → hook detects that case and fires the same `connect()` action with the two node IDs.

No `connectionRadius` tweak (which would over-eagerly snap to nearby nodes during the drag), no DOM hit-testing. React Flow already tracks the cursor's hovered node — we just consume the data it's exposing.

### What changed

- **`src/components/canvas/useGraphMutations.ts`** — added `onConnectEnd(event, connectionState)` callback. Bails out if `toHandle !== null` (the normal path already fired), if `toNode` is missing (released over empty canvas), if `fromNode` is missing (defensive), or if `fromNode === toNode` (self-loop guard duplicates the store's no-op for clarity). Same `guardWriteOrToast()` gate as the rest of the canvas mutations.
- **`src/components/canvas/Canvas.tsx`** — wired the new `onConnectEnd` to the `<ReactFlow>` prop.
- **5 new tests in `tests/hooks/useGraphMutations.test.tsx`** — synthesize a `FinalConnectionState` matching what React Flow would emit and assert the hook routes it correctly: release-over-body fires connect, empty canvas does nothing, self-loop does nothing, `toHandle` set (normal path already fired) does nothing, Browse Lock blocks the fallback.

### What didn't change

- The "pick up" gesture still happens at the source handle dot — drag-start is unambiguous.
- `connectionRadius` stays at React Flow's default (no visual change to the in-progress snap zone).
- Self-loops still rejected.
- Browse Lock still gates the fallback path.

**Tests: 379 passing / 0 failing / 379 total** (+5). TypeScript + Biome clean.

## Session 48 — Block C: CLR rule extensions (Bucket E)

Three new CLR concepts, one provenance field, one structural type refactor. All four E-bucket items from the Bundle 4 + B + E + N plan landed (E1 was already shipped; E4 stays out of scope without confidence).

### Type-system refactor: `UntieredWarning`

The shipped `Warning` type now requires a `tier: ClrTier` field. Rule files don't know their own tier (tier mapping is a composition concern, set in `validators/index.ts`'s `tieredRule(...)` registry), so they return `UntieredWarning = Omit<Warning, 'tier'>` and `validate()` stamps the tier on each warning before exposing it to consumers. Each of the eight existing rule files swept to import `UntieredWarning` from `shared.ts` and use it in their return type. The type system enforces the layered design: a rule file can't accidentally hard-code a tier.

### E2 Indirect Effects — `src/domain/validators/indirectEffect.ts`

When a structural entity has **three or more direct incoming edges** that aren't part of any AND group, fire `'indirect-effect'`: "could some of these chain through intermediate effects?" Two-cause shapes stay silent (common and intentional). AND-grouped edges are exempt — an explicit AND group already commits to "these causes converge directly." Tier: `existence`.

### E3 Cycle warning — `src/domain/validators/cycle.ts`

Built on `findCycles(doc)` from Block 0.5. Emits one warning per cycle, targeting the **edge that closes the loop** rather than the entity — gives the user a concrete thing to delete or reverse. Two-node cycles get a more pointed message ("Mutual cause/effect — one of these edges is probably reversed."); longer cycles say "Cycle of N entities — CLR is built on acyclic sufficiency." Tier: `existence`.

### E5 Three-level WarningsList grouping

`WarningsList` now groups its already-filtered slice under three section headers — **Clarity / Existence / Sufficiency** — in that order, reading `w.tier` directly off each warning. Each header carries a one-line hint of the tier's question ("Is the statement well-formed?" / "Does the structure make sense?" / "Is the cause enough on its own?"). Tiers with no warnings drop out — no empty headers. The top "CLR (N open, M resolved)" counter is unchanged.

### E6 Per-entity attestation field

New textarea in `EntityInspector` under the Step #/Title-size fields, writes `Entity.attestation: string | undefined` (the v5 schema field added by Block 0.1). Free text — placeholder is "Source or evidence — URL, document, interview, etc. Optional." Clearing the field stores `undefined`, not an empty string, so JSON exports stay clean. Browse Lock disables it like every other editor.

### Tier mapping (the source of truth, in `validators/index.ts`)

| Rule | Tier |
|---|---|
| clarity | clarity |
| tautology | clarity |
| entity-existence | existence |
| causality-existence | existence |
| cause-effect-reversal | existence |
| predicted-effect-existence | existence |
| **cycle** *(new)* | existence |
| **indirect-effect** *(new)* | existence |
| cause-sufficiency | sufficiency |
| additional-cause | sufficiency |

### Tests

- **+7 in `tests/domain/validators.test.ts`** — 3 for E2 (fires at ≥3, silent at 2, exempts AND), 3 for E3 (2-cycle, 3-cycle, acyclic baseline), 1 "every warning carries a tier" smoke check.
- **+4 new file `tests/components/WarningsList.test.tsx`** — empty-state, canonical header order, empty-tier suppression, open/resolved counter.
- **+2 in `tests/components/EntityInspector.test.tsx`** — attestation write-through, clear-to-undefined.

### Verification

**Tests: 374 passing / 0 failing / 374 total** (+13 from Block C). TypeScript clean. Biome clean.

**Pausing here.** Block B (Visual distinguishers — B3 icons + B5 zoom-up + B8 batch-edit) is next per plan. Block 0.4's `useZoomLevel()` and Block 0.6's icon slot in `ENTITY_TYPE_META` are already in place. Resume only on approval.

## Session 47 — Block A: Layout Controls (Bundle 4 + B1 + B2)

First feature block of the four-block plan. Builds on the Block 0 refactor pre-work: `LayoutConfig` type + `computeLayout(options)` adapter from Block 0.2 + the `Entity.attestation` / `TPDocument.layoutConfig` v4→v5 schema migration from Block 0.1 — both ship as user-visible knobs today.

### What landed

A new **Layout** section in `SettingsDialog` exposes three per-document dagre knobs:

- **Direction** — Bottom → Top (default for CRT / FRT), Top → Bottom (Goal at top), Left → Right, Right → Left. Stored as `doc.layoutConfig.direction`.
- **Compactness** — 0..100 slider mapping exponentially via `factor = 2^((slider − 50) / 50)`. Slider 50 = app defaults (`LAYOUT_RANK_SEPARATION = 80`, `LAYOUT_NODE_SEPARATION = 40`); 0 = half-spacing; 100 = double-spacing. Stored as `doc.layoutConfig.nodesep` + `doc.layoutConfig.ranksep`.
- **Bias** — Auto (dagre's own balancing), Upper-left / Upper-right / Lower-left / Lower-right (dagre's `align` parameter, for multi-parent placements). Stored as `doc.layoutConfig.align`; `Auto` clears the field.
- **Reset to defaults** — button visible only when `layoutConfig` has any override, calls `setLayoutConfig(undefined)`.

For manual-layout diagrams (Evaporating Cloud), the Layout section renders an explanatory note instead of the knobs — the EC geometry IS the diagnostic, so dagre is bypassed and these knobs would be misleading.

### Plumbing

- **`setLayoutConfig(patch | undefined)`** action on `docMetaSlice`. Merges partial patches; explicit `undefined` on a field clears that field; `undefined` for the whole patch clears the entire override. No-op short-circuits when the patch matches existing state (so dragging a slider through identical intermediate values doesn't churn history). Coalesces under `doc-layout` so a slider drag through 20 intermediate values collapses to one undo step.
- **`useGraphPositions`** now threads `doc.layoutConfig` through `layoutConfigToOptions()` (from Block 0.2) into `computeLayout()`. Layout fingerprint extended with a `cfg:` segment so a Settings tweak triggers a relayout — title-only edits still skip the dagre pass.
- **Radial layout mode** (F5) ignores the config — `align` etc. have no meaning for a ring placement. The user's choice resurfaces when they toggle back to flow.

### Tests

- **6 new store-action tests** in `tests/store/document.test.ts`: partial merge, clear-all-with-undefined, clear-one-field-with-undefined-in-patch, drop-when-last-field-cleared, no-op short-circuit, and history coalescing under one key.
- **5 new component tests** in `tests/components/SettingsDialog.test.tsx`: Direction radio writes `direction`, Bias `'auto'` clears `align`, Compactness slider scales `nodesep`/`ranksep`, Reset button clears the override, EC diagram shows the manual-layout note instead of knobs.

### Bonus: gitignore for TypeScript build artifacts

Re-discovered the `tokens.js` / `types.js` / `types.d.ts` duplicates that Sessions 40 + 46 had already deleted. Root cause: `tsc -b` walks project references; the referenced `tsconfig.node.json` has `composite: true` which can emit alongside `src/` sources when invoked from this directory. Two-line fix: add `src/**/*.d.ts` and `*.tsbuildinfo` patterns to `.gitignore`, mirror the ignore list in `biome.json`. The duplicates can still appear locally after a build but they're now invisible to git and Biome — and `vite-env.d.ts` is whitelisted so the real declaration file isn't accidentally hidden.

### Verification

**Tests: 361 / 361 green** (+11 from Block A). TypeScript clean (no new errors). Biome clean.

**Pausing here.** Block C (CLR rule extensions — E2 + E3 + E5 + E6) is next per the plan's order, since it depends on Block 0.3 (TieredRule) and Block 0.5 (findCycles) which are already in place. Resume only on approval.

## Session 46 — Block 0: refactor pre-work for Bundle 4 + B + E + N

Foundation work before the four feature blocks (Layout Controls, Visual distinguishers, CLR rule extensions, Extra exports). No user-visible change — everything here unblocks one or more of the upcoming feature blocks.

### 0.1 — Schema migration v4 → v5

- **`Entity.attestation?: string`** added — optional source / evidence citation per entity (Block C / E6). Surfaces as an EntityInspector textarea once Block C lands; persistence + JSON round-trip work today.
- **`TPDocument.layoutConfig?: LayoutConfig`** added — per-doc dagre knobs (Block A / Bundle 4). A Goal Tree and a CRT in the same workspace want different orientations, so this is per-doc rather than per-app.
- **`ClrRuleId`** union extended with `'indirect-effect'` and `'cycle'` (Block C / E2 + E3).
- **`ClrTier` type** added (`'clarity' | 'existence' | 'sufficiency'`) — drives Block C / E5's three-level WarningsList grouping.
- **`CURRENT_SCHEMA_VERSION`** bumped 4 → 5; new `v4ToV5` migration registered (purely additive optional fields, no data shape change).
- **`persistence.ts`** validators accept (but don't require) `attestation` and `layoutConfig`. Malformed `layoutConfig` sub-fields fall back to `undefined` rather than failing the whole import — a corrupt LayoutConfig shouldn't kill the doc.
- **`factory.ts`** + 5 example builders bumped to emit `schemaVersion: 5`.
- **Test helper** (`tests/domain/helpers.ts`) bumped to v5.
- **Bonus cleanup:** dropped stale `src/domain/types.d.ts` (dead JS-era duplicate of `types.ts`, same pattern as `tokens.d.ts` removed in Session 40).

### 0.2 — `LayoutConfig` runtime support

- **`LayoutConfig`** type added to `src/domain/types.ts` (declaration), matched by a `LayoutOptions` runtime type in `src/domain/layout.ts` that's what dagre actually consumes.
- **`computeLayout(nodes, edges, options?)`** already accepted `direction` / `nodeSep` / `rankSep`; now also accepts `align` (bias) — UL / UR / DL / DR for multi-parent placement. Defaults match prior behaviour (no align hint).
- **`layoutConfigToOptions(cfg)`** adapter converts the persisted shape to runtime options. Block A's `useGraphPositions` will thread `doc.layoutConfig` through this adapter.

### 0.3 — CLR rule tier metadata

- **`TieredRule`** type (`{ tier, ruleId, fn }`) + `tieredRule()` factory in `validators/shared.ts`. Lets each rule declare which CLR tier (clarity / existence / sufficiency) its warnings belong to.
- **`validators/index.ts`** wraps every existing rule with `tieredRule(...)` at composition time — the per-rule files stay clean plain-function exports. Tier mapping (e.g. `tautology` → clarity, `cause-effect-reversal` → existence) lives in one place.
- **`validateTiered(doc)`** new export — same input as `validate`, output is grouped `Record<ClrTier, Warning[]>`. Block C / E5's WarningsList consumes this.
- `validate()` unchanged in behaviour and shape — all 24 existing validator tests pass without modification.

### 0.4 — `useZoomLevel()` hook

- New `src/hooks/useZoomLevel.ts` — extracts React Flow's viewport zoom as a primitive `number`. One subscription point for all zoom-aware UI; subscribers re-render only when zoom changes.
- `ZoomPercent.tsx` refactored to use the hook. Block B's zoom-up annotations (B5) and TPNode's collapse-at-low-zoom both consume the same hook so they share one subscription.

### 0.5 — `findCycles(doc): string[][]`

- New helper in `src/domain/graph.ts`. DFS-with-stack approach: when a child is already on the recursion stack, the suffix of the stack from that child to the top is a cycle. Canonicalizes each cycle to the rotation whose lexicographically-smallest entity id is first, so two DFS discoveries of the same cycle (different roots) collapse to one entry.
- 5 new unit tests in `tests/domain/graph.test.ts` cover the acyclic case, simple 2-cycle, 3-cycle deduplication across rotation, two independent cycles, and a regression guard (A→B→C with B→A produces one cycle, not two).
- Block C / E3's cycle-warning rule will consume this.

### 0.6 — Entity icon slot

- `EntityTypeMeta` gains `icon?: LucideIcon`. No icons assigned today; the slot exists so Block B can wire in the 14 per-type icons without re-shaping the meta object.

### Verification

**Tests: 350 passing / 0 failing / 350 total** (+5 from `findCycles`). TypeScript clean (the two pre-existing `docMutate.ts` errors from Session 33 remain unchanged). Biome clean.

**Pausing here.** Block A (Layout Controls — Bundle 4 + B1 + B2) is next. Resume only on approval.

## Session 45 — Command palette: layered sections (File / Edit / View / Review / Export / Help)

The palette already tagged every command with a `group`, but rendered them as a flat list with the group name printed as a small caption under each row — readable, but no use to scanning. Restructured the menu into **6 layered sections with headers between** for the unfiltered view, and consolidated the 8 historical group labels into 6 user-mental-model ones:

### Group consolidation

| Old | New | Why |
|---|---|---|
| `Document` (mixed file ops + history + details) | `File` (load/import/new) + `Review` (history, capture snapshot, document details) | Two distinct user goals were collapsed under one label. |
| `Tools` (clipboard + undo + swap + validation) | `Edit` (clipboard, undo, swap) + `Review` (validation) | Validation is review-oriented, not edit-oriented. |
| `Edges` + `Groups` | `Edit` | Both are structural mutations — same user goal. |
| `Navigate` | `View` | Viewport navigation IS the view. |
| `View` (theme/settings/browse lock) | `View` (folded together with navigation) | Display prefs + viewport in one bucket. |
| `Help` | `Help` (unchanged) | One item; deserves its own bucket so the keyboard shortcut surfaces at the end. |
| `Export` | `Export` (unchanged) | Already cohesive. |

The narrowed `CommandGroup` type union — `'File' \| 'Edit' \| 'View' \| 'Review' \| 'Export' \| 'Help'` — makes a stray group label a TypeScript error rather than a stale string sitting in the rendered list.

### Render changes in `CommandPalette.tsx`

- **Unfiltered** view groups by `cmd.group` in a canonical `GROUP_ORDER` and emits an `<li aria-hidden>` section header (small uppercase caption) before each non-empty group. Within a group, commands keep their definition order — controlled by the per-file `*Commands` arrays.
- **Filtered** view (any non-empty query) falls back to flat-by-paletteScore. Headers would lie when the top match jumps groups; they're suppressed so the user's keyboard target is always at row 0.
- **Per-row group caption removed** — the section header carries that context now, and dropping the second line saves ~30 % vertical density per row.
- **Arrow-key cursor** keeps tracking the flat-list index, so up/down still works correctly across section boundaries in the grouped view.

### Re-tagging

Every `group:` literal in `commands/*.ts` updated to the new label:

- `edges.ts` × 3 → `Edit`
- `groups.ts` × 5 → `Edit`
- `tools.ts` × 6 → `Edit` (clipboard / undo / redo / swap), × 1 → `Review` (run validation)
- `document.ts` × 12 → `File` (per-diagram new + load example × 5, JSON / FL / CSV imports, quick capture), × 3 → `Review` (document details, open history, capture snapshot)
- `navigate.ts` × 5 → `View` (find / fit / path / successors / predecessors)
- `view.ts` × 3 → `View` (theme / settings / browse lock; already `View`)
- `export.ts` × 10 → `Export` (unchanged)
- `help.ts` × 1 → `Help` (unchanged)

Files under `commands/` keep their domain-oriented split (one file per concept cluster) — the per-file boundary is decoupled from the user-facing group, which lets `tools.ts` contribute to both `Edit` and `Review` cleanly.

### Tests

Two new component tests in `CommandPalette.test.tsx`:

- `renders section headers in canonical order when no query is active` — pins that headers appear as a non-strict subsequence of the canonical `['File', 'Edit', 'View', 'Review', 'Export', 'Help']` list. Empty groups (none today, but future-proofed) are suppressed.
- `suppresses section headers once a query narrows the list` — pins the flat-when-filtering behavior.

**Tests after batch: 345 passing / 0 failing / 345 total** (+2). Biome + TypeScript clean.

## Session 44 — Polish: optional causality-reading edge label

Last open polish bullet ships: a global "Causality reading" preference that adds a faint `because` or `therefore` label to every edge that doesn't already carry an explicit per-edge label. Per-edge labels (set via the EdgeInspector) keep winning — the global default just fills the gaps.

### Reading direction

- **`because`** — reads bottom-up: "the effect happens *because* the cause exists." Matches the visual flow of CRT-style diagrams (causes at the bottom, effects above).
- **`therefore`** — reads top-down: "the cause exists, *therefore* the effect happens." Matches argumentation-style readings.
- **`none`** (default) — no fallback label; the canvas stays uncluttered.

### Implementation

- **`CausalityLabel` type** added to `src/store/uiSlice/types.ts` and re-exported from `@/store/uiSlice` and `@/store`.
- **`StoredPrefs.causalityLabel`** persists the choice in localStorage. Validation set in `prefs.ts` mirrors the other persisted enums.
- **`preferencesSlice`** carries the state + `setCausalityLabel` setter. Default `'none'` (kept everywhere — initial slice state, `preferencesDefaults` for tests, and the `prefs.ts` reader fall-through).
- **TPEdge** consults `s.causalityLabel` via a narrow primitive selector. Renders the fallback only when `!edge.label && !isAggregated && causalityLabel !== 'none'`. Visually muted (italic, smaller, no border, neutral-400 text) so an explicit per-edge label in the same diagram still reads as the more authored thing. `aria-hidden` so screen readers don't double-announce the same word on every edge.
- **SettingsDialog** new "Causality reading" radio group at the bottom of the Display section. Three options with one-line hints (None / Because — read bottom-up / Therefore — read top-down).

### Why aggregated edges skip the fallback

When `useGraphEmission` collapses multiple edges across a group boundary into a single synthetic edge, that edge already renders a `×N` badge mid-edge. Adding `because` next to `×3` would be visually noisy and semantically wrong — the badge is the more informative annotation in that slot.

**Tests: 343 passing / 0 failing / 343 total** (+1 SettingsDialog test pinning the new radio group). Biome + TypeScript clean.

**Polish section closed:** all five Polish-ideas bullets in NEXT_STEPS are now ✓. Remaining open items live in Tier 4 (H2 / H3 / H4) and the unpicked FL bundles.

## Session 43 — Polish: close the print-stylesheet gaps

The print stylesheet (`src/styles/print.css`) was mostly complete already — Iteration 2 Phase 7 (Session 14) had landed the core `@media print` rules. But several overlays were missing from the hide list, so `Cmd/Ctrl+P` would print them on top of the canvas:

- **`.revision-panel`** — H1's new history panel (Session 41) wasn't in the print hide list. With the panel open, the printed page would have a 320 px column of UI obscuring the canvas's right edge.
- **`[data-component="search-panel"]`** — the find panel's root `<div>` had no `data-component` hook; print couldn't target it. Added the hook + the selector.
- **`[data-component="empty-hint"]`** — "Empty diagram — double-click anywhere to add your first entity" hint would print on an empty canvas. Hooked + hidden.
- **`[data-component="first-entity-tip"]`** — the "Next steps: Tab adds a child…" tier-2 tip would print over the first two entities. Hooked + hidden.
- **`[data-component="zoom-percent"]`** — the small `100%` zoom readout in the bottom-center Controls cluster. Hooked + hidden (cosmetic, but it has no business on paper).
- **`dialog` element selector** — the `Modal` component renders a native `<dialog>` with `aria-modal="true"` but no explicit `role="dialog"`. CSS attribute selectors only match explicit attributes, so the print stylesheet's `[role="dialog"]` rule missed every dialog. Added a bare `dialog` selector to catch them by element name. Affects the CommandPalette, SettingsDialog, HelpDialog, DocumentInspector, and QuickCaptureDialog — all of which would have printed on top of the canvas if the user had `Cmd+P`'d with one open.

**Net:** `data-component` attributes added to `SearchPanel.tsx`, `EmptyHint.tsx`, `FirstEntityTip.tsx`, `ZoomPercent.tsx`. The `display: none !important` selector list in `print.css` extended with the new hooks plus `dialog` and `.revision-panel`.

**Tests: 342 / 342 still green.** CSS + DOM-attribute changes; jsdom doesn't compute `@media print` so the test suite is unaffected. TypeScript + Biome clean.

## Session 42 — Polish: animated slide-in panels + clear two stale backlog bullets

Picked up the "Polish ideas" bullet group from NEXT_STEPS. Two of the three items were already shipped earlier and the callouts in NEXT_STEPS had gone stale — the audit confirmed:

- **Right-click on multi-selected edges → "Group as AND"** is already in `ContextMenu.tsx` (lines 75–107) for the `isMultiEdges` branch, and there's a passing test (`ContextMenu.test.tsx > on a multi-edge selection puts "Group as AND" as the top item`). Shipped originally during Iteration 2 Phase 2 (Session 8) but the NEXT_STEPS entry was never cleared.
- **Empty-state tier-2 hint** is already in `FirstEntityTip.tsx` (mounted by `Canvas.tsx`). Shows "Tab adds a child · drag from the bottom handle to connect · Ctrl+K opens commands" once the first entity is placed, auto-hides past 2 entities, persists dismissal via `emptyStateTipDismissed`. Shipped Iteration 2 Phase 1 (Session 7).

The actual change this session is the **animated slide-in**:

- Added `transition-transform duration-200 ease-out` to `Inspector.tsx`'s `<aside>` className.
- Same on `RevisionPanel.tsx` so when one closes and the other opens — or vice versa — the motion reads as one continuous swap. `ease-out` decelerates into position on enter and accelerates off-screen on close; symmetric enough that a one-curve choice covers both.

The transitions are CSS-only — no React state changes, no test impact. jsdom doesn't compute layout so the existing 16 Inspector + Panel tests pass unchanged.

**Tests after batch: 342 passing / 0 failing / 342 total** (unchanged). TypeScript + Biome clean.

**NEXT_STEPS cleanup:** the Polish-ideas section now strikes through the two already-done bullets and the just-done animation bullet. The remaining two — edge causality-reading labels and a print stylesheet — stay open.

## Session 41 — H1 Revision history (Tier 4)

First Tier-4 feature shipped: per-document snapshot history with one-click restore. H2 (visual diff), H3 (named branches), and H4 (side-by-side compare) are deferred — they each layer on this foundation but are substantial enough to warrant their own sessions.

### Domain

- **New `src/domain/revisions.ts`** — `Revision` type carrying `{ id, docId, capturedAt, doc, label?, parentRevisionId? }`. The `parentRevisionId` field is reserved for H3 lineage tracking; H1 doesn't use it yet but the slot is in the type so a future H3 doesn't have to migrate the storage shape.
- **`computeRevisionDiff(prev, next)`** — pure function returning `{ entitiesAdded, entitiesRemoved, entitiesChanged, edgesAdded, edgesRemoved, edgesChanged, groupsAdded, groupsRemoved, groupsChanged }`. Position changes count *only* on manual-layout diagrams (EC) where the user owns position; on auto-layout diagrams a position-only diff would be misleading noise.
- **`summarizeRevisionDiff(d)`** — compact human label (`"+2 entities, −1 edge"`, `"No changes"`). Order: additions / removals / changes; empty buckets are omitted.
- 10 domain tests in `tests/domain/revisions.test.ts` pin every branch.

### Store

- **New `src/store/revisionsSlice.ts`** with `revisions: Revision[]` (active doc's history, newest first) + `captureSnapshot(label?)` / `restoreSnapshot(id)` / `deleteSnapshot(id)` / `renameSnapshot(id, label)` / `reloadRevisionsForActiveDoc()`.
- **Persistence** lives in localStorage under `tp-studio:revisions:v1` as `Record<docId, Revision[]>`. Each per-doc list is capped at `REVISIONS_PER_DOC_CAP = 50` — older snapshots drop oldest-first when the cap is hit.
- **Auto-snapshot** hook (`autoSnapshotOutgoing`, module-level in revisionsSlice) is called from `docMetaSlice.setDocument` and `docMetaSlice.newDocument` *before* the swap, capturing the outgoing doc with a contextual label (`"Auto: document swap"`, `"Auto: new crt document"`). The user can roll back via the panel.
- **Restore path** captures a *safety snapshot* of the current doc first (labelled `"Auto: before restoring \"…\""`) so a restore is itself undoable. A module-level `suppressNextAutoSnapshot` flag prevents the inner `setDocument` call from double-snapshotting.
- 8 slice tests in `tests/store/revisions.test.ts`.

### UI

- **New `src/components/history/RevisionPanel.tsx`** — slide-in panel on the right edge, same geometry as the Inspector. Rows show label / relative time / diff-vs-live summary, with restore / rename (inline) / delete buttons per row. Empty state and a "Snapshot now" button at the top.
- **`historyPanelOpen` state** added to `uiSlice/dialogsSlice.ts` with `openHistoryPanel` / `closeHistoryPanel` / `toggleHistoryPanel` actions. Opening clears any active selection so the panel doesn't visually race with the Inspector for the right-edge slot.
- **Canvas wired** to call `closeHistoryPanel` when a selection lands (so the Inspector takes over the slot naturally).
- **Esc cascade** in `useGlobalShortcuts.ts` now includes the history panel — Esc closes settings → search → help → palette → **history** → unhoists → deselects, in that order.
- **TopBar** carries a new clock-history icon button (visible at `sm:` and up, `aria-pressed` reflects open state).
- **Palette commands** in `commands/document.ts`: `"Open history…"` and `"Capture snapshot"`. Both reachable via `Cmd/Ctrl+K`.
- **Lazy-loaded** via `React.lazy` in `App.tsx` alongside the other modal-ish surfaces — the panel's code only ships when the user first opens it.
- 8 component tests in `tests/components/RevisionPanel.test.tsx` covering gated render, snapshot-now, close, restore, delete (with `window.confirm` spy), and inline rename.

### Tests after batch

**342 passing / 0 failing / 342 total** (+26 from H1: 10 diff + 8 slice + 8 panel). TypeScript + Biome clean.

### What's left in Tier 4

H1 ships the foundation that the remaining three features build on:

- **H2 Visual diff** — overlay two snapshots on one canvas with +green / −red tinting. Needs a `compareRevisionId` UI mode that flows into `useGraphProjection` to mark nodes / edges as added / removed / changed; the underlying diff already comes from `computeRevisionDiff`. ~Medium effort.
- **H4 Side-by-side compare** — two read-only React Flow instances showing two revisions. Each instance reuses the existing `useGraphView` pipeline against a frozen doc. Mostly a layout shell + a revision-picker. ~Medium effort.
- **H3 Named branches** — fork a revision into a separate document lineage (the `parentRevisionId` field is the seam). Needs a branch picker, multi-doc switching, and the storage shape grows to `Record<branchId, { docId, revisions }>`. ~Large effort and the highest user-facing payoff.

H5 (confidence-weighted what-if) stays parked — depends on the per-entity confidence layer which is out of project scope.

## Session 40 — Next-batch under-the-hood: finish #3, #6, #7, #8, #9, #10 + drop stale `tokens.js` duplicate

Six final items from the next-batch top-10. The codebase is now end-to-end uniform on the per-X split pattern across `commands/`, `validators/`, `examples/`, `exporters/`, `flyingLogic/`, `documentSlice/`, `uiSlice/`, and the three-stage `useGraphView` pipeline (projection / positions / emission, with emission itself further split into node + edge halves).

### #7 — Shared test helpers (`tests/helpers/seedDoc.ts`)

New module: `seedEntity`, `seedConnectedPair`, `seedChain`, `seedAndGroupable`. Sixty-plus test sites were inlining `useDocumentStore.getState().addEntity({ type, title })` and tiny local factory closures (`const addNode = ...`, `const seedTwoEntities = () => ...`). The three Inspector test files now import the shared helpers and shed their own copies — `EntityInspector.test.tsx` lost 2 lines of boilerplate, `Inspector.test.tsx` lost 2, `EdgeInspector.test.tsx` lost 7 + folded two AND-group setups onto one `seedAndGroupable()` call.

### #8 — Extract `paletteScore` to its own module

Moved the inline `score()` function from `CommandPalette.tsx` to `src/domain/paletteScore.ts`. The function was tested only indirectly through palette render tests; now it has 8 direct unit tests in `tests/domain/paletteScore.test.ts` covering every score branch (`100` exact / `80` prefix / `50` substring / `20` in-word subsequence / `-1` no match) plus the Session 37 fix that constrained the subsequence-match branch to a single word (pinned as: `paletteScore('Load example Evaporating Cloud', 'export')` returns `-1`).

### #6 — Extract `useSelectionShape` hook

The Inspector body used to compute `singleId` / `isMulti` / `isSingleGroup` / `headerLabel` via a 25-line chain of nested ternaries inline in the render. Lifted to `src/hooks/useSelectionShape.ts` — pure derivation from `(selection, doc.groups)`. The Inspector body is now a flat dispatch on the shape. 5 unit tests pin each derived field per selection state.

### #3 — Split `examples.ts` (281 lines) into `src/domain/examples/`

Same proven per-X pattern. `shared.ts` carries the `buildEntity` / `buildEdge` helpers; `crt.ts`, `frt.ts`, `prt.ts`, `tt.ts`, `ec.ts` each contain one diagram's example with its own per-diagram comment (e.g. EC's `EC_POSITIONS` map is colocated with `buildExampleEC`). `index.ts` composes `EXAMPLE_BY_DIAGRAM`. External consumers (`commands/document.ts`, `tests/domain/flyingLogic.test.ts`, `tests/domain/entityTypeMeta.test.ts`) import from `@/domain/examples` unchanged.

### #9 — Split `useGraphEmission` into node + edge emission

`useGraphEmission.ts` (198 lines) → 30-line composer + `useGraphNodeEmission.ts` (115 lines) + `useGraphEdgeEmission.ts` (98 lines). The win is a tighter dependency surface:

- **Nodes** depend on `(doc, projection, positions)` — re-run on drag-to-reposition.
- **Edges** depend on `(doc, projection)` only — NOT on positions. Geometry is computed by React Flow at render time from live node positions; the only data this layer carries is source/target ids + style metadata. So dragging an entity on the EC canvas now skips the edge bucket-aggregation pass entirely.

### #10 — README architecture audit

Five sessions of refactoring left the README's architecture section pointing at files that no longer exist as single units. Updated:

- Store section now describes the `documentSlice/` + `uiSlice/` sub-slice composition.
- `useGraphView` mention names the three composed stage hooks (projection / positions / emission).
- Schema migration note bumped from v2 to v4 with the actual chain (annotation numbers → groups → edge label).
- `TPDocument` type sample updated to include all five diagram types, `groups`, `nextAnnotationNumber`, `author`/`description`, `schemaVersion: 4`.
- AND-junction description rewritten for the Flying-Logic-style junctor circle (the old "violet dot + AND midpoint label" predates Session 28).
- New "Layout strategy is per-diagram-type" bullet — CRT/FRT/PRT/TT auto, EC manual.
- CLR rules section points at `validators/` directory.
- Keyboard section refers to the shortcut registry as the single source of truth instead of carrying its own (incomplete) table — adding a shortcut means editing one registry file, not three places. Names the two context-keyed sub-hooks (`useGlobalShortcuts` / `useSelectionShortcuts`).
- Testing section updated: 316 cases (was 87), per-layer breakdown reflects current coverage, `tests/helpers/seedDoc.ts` mentioned.
- Status section rewritten — Iteration 2 + Tier 1/2/3 features all landed, AND-junctor visuals, two refactor passes.

### Bonus cleanup — drop stale `tokens.js` + `tokens.d.ts`

The Biome lint surfaced 13 `noVar` errors in `src/domain/tokens.js` while running `pnpm lint`. Investigation revealed `tokens.js` + `tokens.d.ts` were a stale JS-era duplicate of `tokens.ts` — same constants, just `var` syntax. `tokens.ts` is the live source (`tailwind.config.ts` imports `./src/domain/tokens` which TypeScript resolves to `.ts` over `.d.ts`). Removed both `tokens.js` and `tokens.d.ts`; nothing references them. Lint and tests are clean afterward.

### Result

**Tests: 316 passing / 0 failing / 316 total** (+13 from #7's helpers in use, #8's 8 paletteScore tests, #6's 5 useSelectionShape tests). Biome clean. TypeScript clean (no new errors from this batch).

**The next-batch top-10 is complete.** Sessions 38–40 delivered all 10 items: useGlobalKeyboard split, CI tightening, validators per-rule, exporters per-format, examples per-diagram, useSelectionShape extraction, shared test helpers, paletteScore extraction + tests, useGraphEmission node/edge split, README audit. Plus the tokens.js cleanup bonus.

## Session 39 — Next-batch under-the-hood: validators + exporters split per-rule / per-format

Two more items from the next-batch top-10. Both follow the same per-X split pattern that's been working well (commands/, flyingLogic/, documentSlice/, uiSlice/) — one cohesive concern per file, shared helpers lifted to a `shared.ts`, an `index.ts` that composes the public surface so external imports don't change.

### #2 — Split `validators.ts` (290 lines, 8 CLR rules) into `src/domain/validators/`

The monolith carried all 8 CLR rules plus their shared text/similarity helpers in one file. Splitting:

- **`shared.ts`** (78 lines) — `ValidatorRule` type, `makeWarning`, `countWords`, `levenshtein`, `similarity`. The non-trivial bits (rolling-row Levenshtein, normalized similarity) now have one home.
- **`clarity.ts`** (38) — title word-count + question-mark check.
- **`entityExistence.ts`** (45) — empty-title + disconnected-graph rule.
- **`causalityExistence.ts`** (20) — per-edge "does the cause inevitably produce the effect?" nudge.
- **`causeSufficiency.ts`** (30) — single-incoming-edge-without-AND-group prompt.
- **`additionalCause.ts`** (31) — factory parametrized by terminal type (`ude` for CRT, `desiredEffect` for FRT).
- **`causeEffectReversal.ts`** (44) — Root Cause with incoming / UDE with outgoing.
- **`predictedEffectExistence.ts`** (27) — FRT-specific injection-without-downstream nudge.
- **`tautology.ts`** (33) — similarity-threshold check between parent and sole child.
- **`index.ts`** (83) — composes `STRUCTURAL_RULES` and `RULES_BY_DIAGRAM`, exports `validate` + each per-rule entry point (so future per-rule unit tests can target one rule without going through the diagram-scoped `validate`).

External consumers (`Inspector.tsx`, `commands/tools.ts`, `tests/domain/validators.test.ts`) all import `validate` from `@/domain/validators` and resolve unchanged through the new `index.ts`. 24/24 validator tests pass without modification.

### #4 — Split `exporters.ts` (211 lines, 8 formats + 2 file pickers) into `src/services/exporters/`

Same pattern, grouped by **format family** rather than per-function (the families share pre-flight helpers):

- **`shared.ts`** (51 lines) — `slug`, `triggerDownload` (Blob path), `triggerDataUrlDownload` (data-URL path).
- **`text.ts`** (65) — `exportJSON`, `exportCSV`, `exportAnnotationsMd`, `exportAnnotationsTxt`, plus `pickJSON` (the JSON import file-picker — its reverse pipeline lives next to its forward one).
- **`image.ts`** (103) — `exportPNG`, `exportJPEG`, `exportSVG`. The shared `prepareExport` pre-flight (locate viewport, compute bounds, theme-aware background) is private to this file because no other format uses it.
- **`flyingLogic.ts`** (43) — `exportFlyingLogic` + `pickFlyingLogic`. Round-trip pair in one file.
- **`index.ts`** (21) — public re-exports keyed by format.

External consumers (`commands/document.ts`, `commands/export.ts`, `tests/services/exporters.test.ts`) all import from `@/services/exporters` unchanged.

**Net result:**

| Before | After |
|---|---|
| `src/domain/validators.ts` 290 lines, 8 rules + shared helpers | 9 files, each ≤ 78 lines, one rule per file |
| `src/services/exporters.ts` 211 lines, 8 formats + 2 pickers + shared helpers | 5 files, each ≤ 103 lines, grouped by format family |

**Tests after batch: 303 passing / 0 failing / 303 total** (unchanged — both splits are mechanical, every test still green). TypeScript + Biome clean.

**What's left from the next-batch top-10:**
- #3 Split `examples.ts` (281 lines) per-diagram
- #6 `useSelectionShape` hook extraction from Inspector
- #7 Shared `tests/helpers/seedDoc.ts`
- #8 Extract `paletteScore` to its own testable module
- #9 Split `useGraphEmission` into node / edge emission
- #10 README architecture audit

## Session 38 — Next-batch under-the-hood: useGlobalKeyboard split + CI tightening

A fresh top-10 under-the-hood audit produced the next batch of structural improvements (see CHANGELOG header note in NEXT_STEPS). This session lands the two highest-leverage items.

### #1 — Split `useGlobalKeyboard` (372 lines → 24-line composer + two context-keyed sub-hooks)

The hook had grown into one giant `handler` with 15+ if-branches, even after the `// reg:` markers from Session 35. Each branch implicitly partitioned by **selection context** — some keys work anywhere, others only when something is selected. Splitting along that line cuts the cognitive load.

- **New `src/hooks/keyboardUtils.ts`** (20 lines) — the `isEditableTarget` helper lifted out so both sub-hooks can share it without duplicating the input/textarea/contentEditable check.
- **New `src/hooks/useGlobalShortcuts.ts`** (221 lines) — selection-agnostic shortcuts: palette (`⌘+K`), save (`⌘+S`), swap (`⌘+Shift+S`), export menu (`⌘+E`), settings (`⌘+,`), find (`⌘+F`), quick capture (`E`), clipboard (`⌘+C/X/V`), undo/redo (`⌘+Z` / `⌘+Shift+Z`), zoom (`+`/`-`/`0`), and the Esc cascade.
- **New `src/hooks/useSelectionShortcuts.ts`** (177 lines) — selection-dependent shortcuts: select successors / predecessors (`⌘+Shift+Arrow`), rename / hoist (`Enter`), delete (`Del`/`Backspace`), add child / parent (`Tab` / `Shift+Tab`), group expand / collapse (`←`/`→`), and arrow nav between entities.
- **Rewritten `src/hooks/useGlobalKeyboard.ts`** (24 lines) — the composer. Just calls the two sub-hooks. Each sub-hook registers its own `keydown` listener; the branches inside each are mutually exclusive on `(key, modifiers, selection state)` so running two handlers per event is safe (only one matches any given keystroke).
- **Updated `tests/hooks/shortcutRegistry.test.ts`** — now reads both sub-hook sources via `?raw` (the composer no longer carries markers). Also tightened the `// reg: <id>` regex to anchor at line start so explanatory mentions in JSDoc headers don't get parsed as real markers.

The registry-link test still proves the same invariants: every `bindsAt: 'hook'` shortcut has a `// reg:` marker, every marker resolves to a real registry entry, and no marker points at a non-hook entry. Adding a shortcut without the marker still fails CI.

**Why this split is worth it:** the two sub-hooks have genuinely different mounting concerns. `useGlobalShortcuts` is always active; `useSelectionShortcuts` could in the future be mounted conditionally (only when `selection.kind !== 'none'`) or have its own sub-splits per selection kind. Today both are unconditional, but the seam is now there. Adding a new shortcut becomes "pick the right file" — global vs selection-dependent — instead of "scroll a 370-line handler to find the right neighborhood."

### #5 — CI workflow tightened

The Phase 0 `ci.yml` already existed (this was the stale callout from the audit). Two refinements landed:

- **Removed `version: 9`** from the `pnpm/action-setup@v4` step. Without an explicit version, the action reads `packageManager` from `package.json` (currently `pnpm@11.0.9`). The previous pin to v9 silently used a different pnpm than developers run locally and risked re-resolving the lockfile.
- **Tightened the Type-check step** from `tsc --noEmit` (root project only) to `pnpm exec tsc -b --noEmit` (walks project references). This matches the typecheck `pnpm build` runs locally — previously the CI's type-check step was weaker than the local one, so a project-reference-only error could slip through the dedicated typecheck and only surface in the later Build step.

**Tests after batch: 303 passing / 0 failing / 303 total** (same count as Session 37 — no new tests, the existing registry-link test now covers the split sub-hooks transparently). TypeScript + Biome clean.

**What's left from the next-batch top-10:**
- #2 Split `validators.ts` (290 lines, 8 CLR rules) per-rule
- #3 Split `examples.ts` (281 lines) per-diagram
- #4 Split `exporters.ts` (211 lines) per-format
- #6 `useSelectionShape` hook extraction from Inspector
- #7 `tests/helpers/seedDoc.ts` shared test helpers
- #8 Extract `paletteScore` to its own testable module
- #9 Split `useGraphEmission` into node / edge emission
- #10 README architecture audit

## Session 37 — Fix the two pre-existing test failures flagged in Sessions 34–36

Both failures were in untracked test files authored by earlier sessions; both had been flagged for follow-up in CHANGELOG / NEXT_STEPS without being fixed at the time because they were out of scope for the refactor work. With the refactor pass done, this session cleans them up.

- **`CommandPalette` subsequence scorer false positive.** The palette's `score` function gave a +20 score to any label whose lowercase letters subseq-matched the query *across word boundaries*. That meant a query of `"Export"` filtered in `"Load example Evaporating Cloud"` — the letters e-x-p-o-r-t appear in order across `example` + `Evaporating`. The test asserted every surviving label matched `/export/i`, so the false positive showed up as a red test.
  - **Fix:** constrain the subsequence-match branch to a single word. The label is split on non-alphanumeric runs (`/[^a-z0-9]+/`); each word is checked for a complete subsequence of the query. The substring branch above (`includes`) still catches short partial matches inside a word, and within-word abbreviations (`"exrt"` → `"Export"`) still match because they're contiguous in one word. The trade-off — cross-word abbreviations like `"expjs"` → `"Export as JSON"` no longer match — is acceptable: users almost always type a prefix of one word (`"export"`, `"json"`) which the `includes` branch catches at score 50 anyway.

- **`radialLayout` apex-at-center test premise was wrong.** The test asserted that after normalization the apex sits closest to the bbox-midpoint. But the bbox-midpoint reference only works when the bbox is symmetric around the apex — and the test's input was a chain `a→b→c→d`, which puts all nodes on one ray from the apex. After bbox normalization, the apex ends up at the far corner of the bbox, not the center; the level-3 leaf `a` ties with the apex on distance to bbox-midpoint, and stable sort order put `a` first.
  - **Fix:** rewrite the assertion to use the invariant the algorithm actually guarantees — *each level sits further from the apex than the previous level on the same ray*. `distFromApex(d)` is 0; `distFromApex(c)` > `distFromApex(d)`; `distFromApex(b)` > `distFromApex(c)`; etc. This holds regardless of bbox shape, captures the real semantic intent (ring radii grow with depth), and survives any future normalization tweak.

**Tests after batch: 301 passing / 0 failing / 301 total.** TypeScript + Biome clean. The suite is fully green for the first time since Session 32's refactor work introduced the two failures' test files into the working tree.

## Session 36 — Refactor #9: split `useGraphView` into three composed hooks

Final item on the top-10 refactor list. The original `useGraphView.ts` was 329 lines in a single hook with three `useMemo` blocks doing distinct work; the file did its own visibility computation, ran dagre, and emitted RF nodes + edges all in one place. The three blocks had no compile-time fence between them — adding a new node kind required reading the whole file to know where in the chain to plug it in.

- **New `graphViewConstants.ts`** (17 lines) — `GROUP_PADDING`, `GROUP_TITLE_TOP`, `COLLAPSED_WIDTH`, `COLLAPSED_HEIGHT`. Lifted from file-local consts in the old monolith because both positions (sizes dagre nodes for collapsed groups) and emission (renders the cards and the group rectangles around them) read them.

- **New `useGraphProjection.ts`** (119 lines) — stage 1. Reads `hoistedGroupId` from the store. Returns a `GraphProjection`: `{ proj, visibleEntityIds, visibleCollapsedRoots, hoistVisibleGroups, remap, hiddenCountByCollapser }`. Pure derivation from doc + hoist state; O(N) in entities + groups. Carries the F7 per-entity collapse logic (BFS from each collapsed entity to find its descendants).

- **New `useGraphPositions.ts`** (91 lines) — stage 2. Takes `(doc, projection)`. Reads `layoutMode` + `hoistedGroupId` from the store. Memo gated on `layoutFingerprint(doc) | h | c | ec` (preserved verbatim from the monolith so the title-edit fast path still skips dagre). Returns `Record<id, {x, y}>`. Branches: manual diagrams read `Entity.position`; auto diagrams run dagre or radial based on `layoutMode`.

- **New `useGraphEmission.ts`** (198 lines) — stage 3. Takes `(doc, projection, positions)`. **Pure given those three inputs — no store reads.** Builds the three node kinds (group rectangles, entity nodes, collapsed-root cards) and bucket-aggregates edges by remapped endpoint pair (single-source edges keep their real id; aggregated ones get `agg:source->target` synthetic ids). AND-junctor arrowhead drop logic lives here.

- **Rewritten `useGraphView.ts`** (39 lines) — composer. Just calls the three sub-hooks in order and returns the unified `{ nodes, edges }`. Canvas.tsx is unchanged.

**Why split this way:** the three stages have genuinely different inputs and reactivity characteristics. Projection reacts to hoist + collapse state (UI); positions react to the structural fingerprint (skipping title edits); emission reacts to projection + positions (pure). Folding them into one `useMemo` chain hid that — a hook that's actually three concerns reads as one big lump. Now adding a new node kind is "edit emission"; adding a new visibility filter is "edit projection"; adding a third layout strategy is "edit positions." No re-reading the whole file to know where to land.

**Tests after batch: 299 passing / 2 pre-existing failing / 301 total** (same as Session 35 — no behavior changes, same memo gating, same cache key). TypeScript + Biome clean.

**That's the top-10 done.** Every item on the original refactor list has landed across Sessions 32–36:
- #1 ContextMenu/TPNode subscription consolidation (Session 32)
- #2 entityPatch/edgePatch no-op helpers (Session 32)
- #3 Canvas component extraction (Session 32)
- #4 commands.ts split per-group (Session 32)
- #5 declarative shortcut registry (Session 35)
- #6 documentSlice split (Session 33)
- #7 uiSlice split (Session 33)
- #8 flyingLogic.ts split (Session 32)
- #9 useGraphView split (this session)
- #10 component-test safety net (Session 34)

## Session 35 — Refactor #5: declarative keyboard-shortcut registry

Single source of truth for every shortcut surfaced in the UI. Previously three places drifted independently:

- `useGlobalKeyboard.ts` — the only file that actually binds keys to behavior.
- `HelpDialog.tsx` — a static `SECTIONS` array describing the same shortcuts in human-readable form.
- `commands/*.ts` — per-command `shortcut?: 'Ctrl+...'` strings shown as kbd hints in the palette (hardcoded, not Mac-aware).

Adding a shortcut required three edits in sync; missing one only showed up at runtime when a user noticed the help screen was off. Now there's one list.

- **New `src/domain/shortcuts.ts`** — the canonical registry.
  - `M` constant — Mac-aware `⌘` glyph (`Ctrl` elsewhere).
  - `Shortcut` type — `{ id, keys, label, group, bindsAt }`.
  - `bindsAt` is one of `'hook' | 'reactFlow' | 'native'`: where the binding actually lives. Helps the linkage test (below) know which entries to assert against.
  - `SHORTCUTS` array — every shortcut in the app, 30 entries spanning four groups (global, entity, group, canvas).
  - `SHORTCUT_BY_ID` and `SHORTCUTS_BY_GROUP` — derived O(1) lookups for consumers.
  - `SHORTCUT_GROUP_TITLE` — `Record<ShortcutGroup, string>` heading labels used by the help dialog.
  - `PALETTE_KBD_BY_COMMAND_ID` + `paletteKbdForCommand(id)` — palette commands sometimes need their own kbd hint (the help-dialog row for copy/cut/paste is the aggregate "⌘+C / ⌘+X / ⌘+V", but the palette shows each command on its own line). The override map covers those cases; the function falls back to `SHORTCUT_BY_ID` when the palette id matches a registry id directly (`undo`, `redo`, etc.).

- **`HelpDialog.tsx`** — rewritten to iterate `SHORTCUTS_BY_GROUP`. The local `SECTIONS` array (50 lines of duplicated row definitions) is gone. Section order is a small const tuple. Adding a shortcut means adding one line to `SHORTCUTS`; the dialog picks it up automatically.

- **`commands/*.ts`** — every `shortcut: 'Ctrl+...'` string removed (8 occurrences across `tools.ts`, `navigate.ts`, `view.ts`, `document.ts`, `export.ts`). `Command.shortcut` field dropped from the type. The palette renderer in `CommandPalette.tsx` now calls `paletteKbdForCommand(cmd.id)` to derive the kbd hint from the registry. **User-visible side effect:** Mac users now see `⌘+Z` / `⌘+K` / etc. in the palette instead of the hardcoded `Ctrl+...`.

- **`useGlobalKeyboard.ts`** — kept imperative (the Esc cascade, the Tab/Arrow context-sensitive logic, and the `inField` guards are too entangled with selection state to declaratively express without a regression risk), but each branch now carries a `// reg: <id>` comment marker referencing the registry entry it implements. A branch handling two registry entries uses `// reg: a / b`.

- **`tests/domain/shortcuts.test.ts`** (7 tests) — registry sanity: unique ids, group partition, every entry has non-empty keys + label, `paletteKbdForCommand` override-vs-fallback behavior.

- **`tests/hooks/shortcutRegistry.test.ts`** (3 tests) — **the source-text linkage test.** Loads `useGlobalKeyboard.ts` via Vite's `?raw` import, scans for `// reg: <id>` markers, then asserts:
  1. Every `bindsAt: 'hook'` registry entry's id appears in a marker.
  2. Every marker id resolves to a real registry entry (catches typos).
  3. Every marker points at a `bindsAt: 'hook'` entry (catches category errors).

  Adding a new hook-bound shortcut without the corresponding marker now fails CI instead of silently drifting.

**Tests after batch: 299 passing / 2 pre-existing failing / 301 total** (+10 new tests). TypeScript + Biome clean. The two pre-existing failures (CommandPalette subsequence scorer and radialLayout apex-distance) are unchanged from Session 34.

**What's left from the top-10:**
- **#9** Extract `useGraphView` into composed hooks (~1.5 hr).

## Session 34 — Refactor batch 3: #10 component-test safety net for canvas / inspector / settings surface

Last refactor item that does *not* touch product code — a coverage pass that pins the user-facing behavior of the upper-right toolbar, the inspector body for both single-entity and single-edge selection, and the two static dialogs (settings, help). The next two structural refactors on the list (**#5** keyboard registry, **#9** `useGraphView` split) both rewire how these surfaces wire to the store, so the tests have to land first.

- **`tests/components/TopBar.test.tsx`** (6 tests) — palette toggle, browse-lock flip + aria-pressed, layout-mode toggle flow↔radial + aria-pressed, layout toggle hidden on `LAYOUT_STRATEGY[ec] === 'manual'`, help open, theme flip.
- **`tests/components/SettingsDialog.test.tsx`** (9 tests) — gated render (`settingsOpen`), close button, radio-group clicks for theme / palette / animation-speed, checkbox toggles for browse-lock / minimap / annotation numbers. Every assertion goes through the `aria-label` or visible label so a future restyle of the body doesn't break the test.
- **`tests/components/HelpDialog.test.tsx`** (4 tests) — gated render, all four section headings present ("Global", "On a selected entity", "On a selected group", "Canvas"), representative shortcut rows visible, close button. Locks the surface that **#5** will rewrite — when the declarative-shortcuts refactor lands, these tests will catch any regression in what the user actually sees.
- **`tests/components/EntityInspector.test.tsx`** (6 tests) — title textarea pre-fill + write-through, type-button click → `updateEntity` with new type, title-size buttons → `titleSize` undefined for md / set for sm + lg, Browse Lock disables textarea + destructive delete, renders nothing when entity id no longer exists.
- **`tests/components/EdgeInspector.test.tsx`** (8 tests) — source/target titles displayed, label input write-through (and empty → undefined), AND-group field appears only when `andGroupId` is set, Ungroup button clears it, Delete edge removes the edge, Browse Lock disables every input, renders nothing on missing edge id.

**Net new: 5 test files / 33 tests, all green.** The whole canvas / inspector / settings cluster now has component-level coverage in addition to the slice-level store tests from earlier sessions.

**Pre-existing failures unrelated to this batch (flagged for follow-up):**
- `tests/components/CommandPalette.test.tsx > honors paletteInitialQuery on open` — the substring scorer's subsequence-match branch lets `"Load example Evaporating Cloud"` filter in for the query `"Export"` (the letters e-x-p-o-r-t appear in order across `e`xample / `p`(load examp**l**e) / `o`(evap**o**rating) / `r` / `t`). The test asserts every surviving label contains `/export/i`, which this entry doesn't. **Fix path:** either tighten the scorer (require subsequence matches at word boundaries) or relax the test to "at least one Export-related label survives." Out of scope for this batch.
- `tests/domain/radialLayout.test.ts > puts the apex at the center` — assertion `ranked[0]?.id` not.toBe `'a'` fails because after normalization the apex `d` and the leaf `a` end up equidistant from the bbox-midpoint reference point, and the sort happens to put `a` first. The test comment acknowledges the bbox-midpoint comparison is a proxy ("Spot-check by asserting d sits further from the bounding box edge than the level-3 leaf a") — the proxy isn't tight enough. **Fix path:** compare positions to the layout center directly rather than the bbox-min. Out of scope.

Both failures were already in the working tree before this session — they're in untracked test files authored by previous sessions and remained red across the recent slice splits. Calling them out here so the next refactor session doesn't lose track of them.

**Tests after batch: 289 passing / 2 pre-existing failing / 291 total.** TypeScript + Biome clean.

**What's left from the top-10:**
- **#5** Declarative keyboard-shortcut registry shared with `HelpDialog` (~1.5 hr).
- **#9** Extract `useGraphView` into composed hooks (`useGraphProjection`, `useGraphPositions`, `useGraphEmission`) (~1.5 hr).

## Session 33 — Refactor batch 2 (#7 + #6 from the top-10 list)

Continued the top-10 refactor pass with the two heaviest store splits. The combined `useDocumentStore` surface is unchanged from a consumer's perspective — every existing import path still works because each split landed behind an index file that resolves the same module path.

- **#7 Split `uiSlice` (414 lines) into focused sub-slices.** New `src/store/uiSlice/` directory with:
  - `types.ts` — shared type definitions (`Selection`, `Theme`, `AnimationSpeed`, `EdgePalette`, `LayoutMode`, `ContextMenuTarget`, `ContextMenuState`, `ToastKind`, `Toast`, `SearchOptions`, `StoredPrefs`).
  - `prefs.ts` — localStorage persistence helpers (`readInitialPrefs`, `writePrefs`, `readInitialTheme`, `writeTheme`) plus validation sets.
  - `selectionSlice.ts` — selection + editing + hoist (~95 lines).
  - `preferencesSlice.ts` — theme + persisted UI prefs + emptyStateTip + setters + persistPrefs helper (~120 lines).
  - `dialogsSlice.ts` — palette / help / settings / docSettings / quickCapture / contextMenu / toasts (~95 lines).
  - `searchSlice.ts` — search state + actions (~45 lines).
  - `index.ts` — combines all four via `... & ... & ... & ...` and a spread-composed `createUISlice` (~55 lines).

- **#6 Split `documentSlice` (583 lines) into focused sub-slices.** New `src/store/documentSlice/` directory with:
  - `docMutate.ts` — shared mutation infrastructure: `makeApplyDocChange(get, set)` factory (each sub-slice builds its own `applyDocChange` closure bound to the same get/set), plus `touch`, `entityPatch`, `edgePatch`, `scrubFromGroups` helpers. The `entityPatch` / `edgePatch` no-op helpers from Session 32 live here now.
  - `docMetaSlice.ts` — the `doc` field itself + `setDocument` / `newDocument` / `setTitle` / `setDocumentMeta` + CLR warning resolve/unresolve (~95 lines).
  - `entitiesSlice.ts` — `addEntity` / `updateEntity` / `deleteEntity` / `toggleEntityCollapsed` / `setEntityPosition` / `swapEntities` / `deleteEntitiesAndEdges` + the three assumption-on-edge helpers (which create entities + attach to edges) (~190 lines).
  - `edgesSlice.ts` — `connect` / `updateEdge` / `deleteEdge` / `reverseEdge` + AND-grouping (~115 lines).
  - `groupsSlice.ts` — `createGroupFromSelection` / `deleteGroup` / `renameGroup` / `recolorGroup` / `addToGroup` / `removeFromGroup` / `toggleGroupCollapsed` (~140 lines).
  - `index.ts` — type-union + composition + re-exports of the shared helpers from `docMutate` so any future caller (e.g. `quickCapture` service) can build their own apply-doc-change flow without recreating the closure.

**Tests: 252/252 still green** (no behavior changes — the sub-slices are a literal split of the same closures by concern, the unified consumer surface via `useDocumentStore` is identical). **TypeScript + Biome clean. Production build 11.8 s.**

**Live note:** the dev-server preview hit the same Vite-cache-after-file-moves measurement issue from Session 32 — React Flow's `EdgeWrapper` mounts with null handle positions on the first load after a major file reorg. Production build is clean, the doc state is intact (6 nodes + 5 edges in props confirmed via fiber inspection), and a real browser reload typically resolves it. Logged here for transparency; not a code regression.

**What's left from the top-10 (each its own focused session):**
- **#5** Declarative keyboard-shortcut registry shared with `HelpDialog` (~1.5 hr — eliminates source-of-truth drift between `useGlobalKeyboard` and the help screen).
- **#9** Extract `useGraphView` into composed hooks (`useGraphProjection`, `useGraphPositions`, `useGraphEmission`) (~1.5 hr — highest leverage for future canvas features).
- **#10** Component tests for the canvas / inspector / settings surface (~2 hr — the safety net that makes any of these structural refactors truly safe).

## Session 32 — Refactor batch 1 of 3 (#1–#4, #8 from the top-10 list)

First batch of the top-10 refactor pass. Five items landed, no behavior changes — every test still passes, every diagram type still renders, the example CRT loads with 6 nodes / 5 edges / 1 AND junctor as before. The refactors set up cleaner seams for subsequent batches.

- **#1 Consolidated `useDocumentStore` subscriptions** in [ContextMenu.tsx](src/components/canvas/ContextMenu.tsx) (17 separate `useDocumentStore((s) => s.X)` calls → one `useShallow` bag) and [TPNode.tsx](src/components/canvas/TPNode.tsx) (7 → one). Each individual subscription was a separate Zustand listener that re-ran on every store change; the consolidated form only fires a render when one of the listed fields actually changes.
- **#2 `entityPatch` / `edgePatch` no-op helpers** in [documentSlice.ts](src/store/documentSlice.ts). The `applyDocChange` no-op detection relies on every mutator returning `prev` unchanged when the patch wouldn't actually change anything. `updateEntity`, `updateEdge`, `toggleEntityCollapsed`, and `setEntityPosition` were each open-coding the no-op check; the helpers now centralize the shallow-equality logic (including a per-axis comparison for `position`). Easy-to-forget pattern → impossible-to-forget helper.
- **#3 Extracted Canvas's nested components** to their own files: [ZoomPercent.tsx](src/components/canvas/ZoomPercent.tsx), [EmptyHint.tsx](src/components/canvas/EmptyHint.tsx), [FirstEntityTip.tsx](src/components/canvas/FirstEntityTip.tsx). [Canvas.tsx](src/components/canvas/Canvas.tsx) shrank ~80 lines and now only contains the React Flow shell + selection / context-menu / double-click wiring.
- **#4 Split `commands.ts` (539 lines, 39 commands) per-group.** New `src/components/command-palette/commands/` directory with `types.ts` + one file per group: `document.ts`, `export.ts`, `edges.ts`, `view.ts`, `help.ts`, `tools.ts`, `groups.ts`, `navigate.ts`. `commands/index.ts` re-exports the unioned `COMMANDS` array. Adding a new command becomes "open the right group file and append" rather than "scroll 500 lines to find the right cluster." Only consumer was `CommandPalette.tsx` (imports `./commands`) — works unchanged because the path resolves to `commands/index.ts`.
- **#8 Split `flyingLogic.ts` (524 lines)** into [src/domain/flyingLogic/typeMaps.ts](src/domain/flyingLogic/typeMaps.ts) (the EntityType ↔ FL entityClass maps + small helpers like `escapeXml`, `mapEntityType`, `VALID_GROUP_COLORS`), [writer.ts](src/domain/flyingLogic/writer.ts) (`exportToFlyingLogic`), [reader.ts](src/domain/flyingLogic/reader.ts) (`importFromFlyingLogic` and its parser helpers), [index.ts](src/domain/flyingLogic/index.ts) (re-exports). Each file becomes ~150 lines and tells one coherent story. Consumers (`@/services/exporters`, `tests/domain/flyingLogic.test.ts`) unchanged — they import from `@/domain/flyingLogic` which resolves through the new index.

**Tests: 252/252 still green** (no behavior changes — every test was about data-model correctness, which the refactors don't touch). **TypeScript + Biome clean. Production build 10.4 s.** Required a Vite cache clear + dev-server restart mid-batch (the file moves confused HMR); production builds stayed clean throughout.

**Live-verified at 1440 px after fresh server restart:** example CRT loads with 6 nodes, 5 edges, 1 AND junctor — identical to pre-refactor behavior. Nothing about the user-visible UI changed.

**What's left from the top-10:**
- #6 (split documentSlice into per-concern slices) and #7 (split uiSlice the same way) — the meaty store splits, batch 2.
- #5 (declarative keyboard-shortcut registry) and #9 (split useGraphView into composed hooks) — the heavier semantic refactors, batch 3.
- #10 (component tests for the canvas / inspector / settings surface) — the safety net.

## Session 31 — AND junctor opacity fix + per-diagram handle orientation (horizontal for EC)

Two refinements to the connector visuals.

**AND junctor opacity** — the violet bezier curves used to terminate at the junctor's CENTER, which meant the lower half of each curve passed through the white-filled circle interior; with the curves drawn in React Flow's edge layer beneath ANDOverlay's SVG, the strokes were visible through the fill. Fixed by terminating each curve at the circle's BOTTOM perimeter instead (`targetY + JUNCTOR_CENTER_OFFSET_Y + JUNCTOR_RADIUS`). ANDOverlay's circle center stays where it was; only the source-side bezier endpoints moved. The circle now reads as an opaque junction with strokes meeting it cleanly at the south point. [src/components/canvas/TPEdge.tsx](src/components/canvas/TPEdge.tsx), [src/components/canvas/ANDOverlay.tsx](src/components/canvas/ANDOverlay.tsx).

**Per-diagram handle orientation** — Evaporating Cloud is laid out left-to-right (A goal on the left, B/C needs in the middle, D/D′ wants on the right) but used the same vertical handle config as the trees (target=Bottom, source=Top). The result was that EC edges had to wrap around vertically to reach horizontally-adjacent nodes — small C-loops near each node instead of clean horizontal arrows. Fixed by making handle positions per-diagram-type:

- **New `HANDLE_ORIENTATION` registry** ([src/domain/layoutStrategy.ts](src/domain/layoutStrategy.ts)). Sibling map to `LAYOUT_STRATEGY`. CRT/FRT/PRT/TT are `'vertical'` (target=Bottom, source=Top — edges flow upward, matching dagre BT). EC is `'horizontal'` (target=Right, source=Left — edges flow right-to-left, matching the WANT → NEED → GOAL reading order). The `Record<DiagramType, _>` shape forces a future diagram type to declare its orientation.
- **TPNode + TPCollapsedGroupNode** ([src/components/canvas/TPNode.tsx](src/components/canvas/TPNode.tsx), [src/components/canvas/TPCollapsedGroupNode.tsx](src/components/canvas/TPCollapsedGroupNode.tsx)). Each subscribes to `doc.diagramType` and reads `HANDLE_ORIENTATION[diagramType]` to pick `target` / `source` `Position` values. No data-model change; pure visual routing.

**Tests: 252/252 still green. TypeScript + Biome clean. Production build 7.5 s.**

**Live-verified at 1440 px:**
- EC example renders with **horizontal right-to-left arrows**: WANT → NEED arrows go straight LEFT (no more wrap-around), NEED → GOAL arrows curve gently up-and-left into the goal's right edge. Clean canonical EC reading.
- CRT example unchanged from Session 30 — vertical UP-arrows into target bottoms, AND junctor sits below "Wrong items ship to customers" with an opaque white circle and the two violet causes converging into its southern perimeter (visibly outside the circle, not bleeding through).
- All four auto-layout diagrams (CRT/FRT/PRT/TT) reconfirmed: vertical orientation preserved.

**Deliberately deferred:** the AND junctor's geometry is still vertical-only — if a user creates an AND group on an EC (uncommon — EC is conjunctive by convention, both needs hold for the goal), the junctor renders at the wrong position. Adding horizontal-junctor support would mean two coordinate variants in `JUNCTOR_CENTER_OFFSET`; defer until someone actually asks.

## Session 30 — Connector handle direction flip (arrows now point up into target bottoms)

In response to the question "is there a reason edges go out below and in on top?" — there wasn't. The original handle config (`source=Position.Bottom`, `target=Position.Top`) was React Flow's default for a top-down flowchart, but our dagre layout is `BT` (sources at the bottom of canvas, targets at the top — the standard TOC convention). The combination produced clean-enough beziers but the arrowheads pointed *down* into the top of each effect/UDE, which contradicts the "tree growing upward" mental model every TOC reference tool (Flying Logic, Kumu, etc.) uses.

- **TPNode + TPCollapsedGroupNode** ([src/components/canvas/TPNode.tsx](src/components/canvas/TPNode.tsx), [src/components/canvas/TPCollapsedGroupNode.tsx](src/components/canvas/TPCollapsedGroupNode.tsx)). Handles flipped: `target=Position.Bottom` (the side facing the source below), `source=Position.Top` (the side facing the target above). Edges now exit the top of each source going up and enter the bottom of each target with arrowheads pointing up.
- **TPEdge** ([src/components/canvas/TPEdge.tsx](src/components/canvas/TPEdge.tsx)). `JUNCTOR_OFFSET_Y` is now *added* to `targetY` rather than subtracted — the junctor sits in the empty space between target and source instead of above the target. The wrap-around bezier is gone; curves go straight up from source.top to junctor / target.bottom.
- **ANDOverlay** ([src/components/canvas/ANDOverlay.tsx](src/components/canvas/ANDOverlay.tsx)). The junctor's reference Y is now the target's *bottom* edge (`tPos.y + tHeight`), with the circle and outgoing arrow positioned below it. Visually: multiple causes converge into the junctor from underneath, one short up-arrow continues into target.bottom.

**Tests: 252/252 still green** (rendering-only change). **TypeScript + Biome clean. Production build 6.1 s.**

**Live-verified at 1440 px with a fresh dev server:** the example CRT renders with the AND junctor sitting between the root causes (bottom) and "Wrong items ship to customers" effect (above), arrow pointing UP into the effect's bottom. Plain edges throughout the tree flow upward with arrows pointing up at each target's bottom. All four auto-layout diagrams (CRT/FRT/PRT/TT) re-verified after the change — node/edge counts unchanged from before. Evaporating Cloud is unaffected (manual layout, no auto-routing).

**Process note (for honesty):** a mid-session debug rabbit hole made it look like React Flow couldn't render edges with the flipped handles. It turned out to be stale Vite cache from earlier HMR confusion — stopping the dev server, clearing `node_modules/.vite`, and starting fresh resolved it. The current code is correct; the empirical claim I'd briefly added to a code comment about RF being incompatible with the flipped config was wrong and has been removed.

## Session 29 — E1–E5 connector ergonomics pass

Five small affordances on edges, all in [TPEdge.tsx](src/components/canvas/TPEdge.tsx) and [styles/index.css](src/styles/index.css). No data-model changes.

- **E1 — Click-target halo.** `BaseEdge` now passes `interactionWidth={32}` (default was 20). Slightly imprecise clicks on a 1.5 px stroke now still select the edge. The halo is an invisible transparent path React Flow renders beneath the visible stroke.
- **E2 — Edge hover state.** CSS-only — `.react-flow__edge:hover .react-flow__edge-path` bumps `stroke-width` to 2.75 with a 120 ms transition (scaled by `--anim-speed`). Hovering an edge now reads as "this is interactive" before the user commits to clicking.
- **E3 — Assumption indicator badge.** When `edge.assumptionIds.length > 0`, a small violet "A" pill (or `A2`, `A3`, …) renders just above-left of the edge label position. Hover tooltip gives the exact count. Replaces the previously-hidden semantic — users no longer have to open the inspector to see which edges carry assumptions.
- **E4 — Stronger selection feedback.** Selected stroke goes from 2 px → **3 px** with a `drop-shadow(0 0 4px ${EDGE_STROKE_SELECTED}66)` filter for a subtle glow. Works across light, dark, and high-contrast themes without theme-specific tokens. The color change to indigo is preserved.
- **E5 — Always-visible truncated labels.** The previous "long-label-becomes-an-i-icon" path is gone. Long labels now truncate inline at 30 chars with an `…` suffix, full text on `title` for hover. Scanning a diagram for edge meaning no longer requires hovering every edge.

**Tests: 252/252 still green** (rendering-only changes). **TypeScript + Biome clean. Production build 9.4 s.**

**Live-verified at 1440 px:** seeded the example CRT with one long edge label and one assumption-carrying AND edge. DOM confirms: 5 invisible interaction paths at stroke-width=32; CSS hover rule installed; one `A2` violet badge rendering; one truncated label ending in `…`. AND junctor from Session 28 still renders cleanly alongside.

## Session 28 — E6 Flying-Logic-style AND junctor

Replaces the previous three-layer AND visual (stacked dots at the target + an SVG arc overlay + a mid-edge "AND" badge) with a single Flying-Logic-style **junctor circle**: a small white-filled circle outlined in violet with "AND" written inside, sitting in the empty space the bezier already wraps through above the target. Multiple causes converge into the circle; one short violet arrow continues from the junctor down into the target's top handle. One visual element, not three; recognizable to FL transplants; cleaner extension point for future junctor types (OR / NOT) if ever needed.

- **useGraphView** ([src/components/canvas/useGraphView.ts](src/components/canvas/useGraphView.ts)) drops the `markerEnd` for AND-grouped non-aggregated edges so the per-edge arrowheads stop piling up at the target — only the junctor's outgoing short line carries an arrow now. Aggregated AND edges (single synthetic edge bridging a collapsed-group boundary) keep their arrowhead because they don't get the junctor treatment.
- **TPEdge** ([src/components/canvas/TPEdge.tsx](src/components/canvas/TPEdge.tsx)) redirects the bezier endpoint for AND-grouped non-aggregated edges to `(targetX, targetY − 35)` — above the target on canvas, in the empty space the bezier naturally wraps through given source=Position.Bottom / target=Position.Top handles. Removes the inline `<circle>` "approach dot" and the mid-edge "AND" badge `<div>` that used to compete with the overlay. Aggregate ×N badges and edge labels still render exactly as before.
- **ANDOverlay** ([src/components/canvas/ANDOverlay.tsx](src/components/canvas/ANDOverlay.tsx)) rewritten end-to-end. For each AND group, looks up the target node's live position via `flow.getInternalNode()`, computes the junctor at the same `(targetX, targetY − 35)` TPEdge uses, then renders an SVG group containing the short junctor→target line with a violet arrowhead marker plus the junctor circle (r=14, white fill, violet stroke) with "AND" text inside. The `junctors` array is no longer `useMemo`d — React Flow's internal node measurements land after the component first mounts, but neither `groups` nor `flow` changes when measurements arrive; the memo's cached empty array would have stuck forever. Recomputing per render is cheap (one node lookup per AND group) and the component already re-renders on every `transform` tick via the pan/zoom subscription.

**Tests: 252/252 still green** — the change is rendering-only; the data model (edges keep their `andGroupId`, aggregation logic unchanged) is identical. **TypeScript + Biome clean. Production build 7.4 s.**

**Live-verified at 1440 px:** loaded the example CRT, which has one AND group (rcManual + rcBug → effMistakes). DOM contains exactly one `<text>` element reading "AND" and one `<circle>` with r=14 — matching one expected junctor. Old per-edge AND badge `<div>` count is zero. Screenshot at fit-zoom shows the two violet causes converging into the AND junctor circle, then a short arrow continuing down into "Wrong items ship to customers." Zoomed in, the junctor is a crisp violet-outlined white circle with the "AND" label.

## Session 27 — F5 radial / sunburst alternate view

Tier 3's first feature. A canvas-level toggle that flips the layout between the default dagre flow (top-down tree) and a radial sunburst (apex at center, contributors radiating out on concentric rings). Useful for "see the whole tree at once" screenshots, alternative reading, and Goal-Trees that read naturally from one apex.

**F1 incremental relayout is parked, intentionally.** The premise was "on a 500-node Goal Tree dagre is noticeable," but `layoutFingerprint` already shields title/text edits from the layout path — dagre only re-runs on add/remove operations, which aren't high-frequency. A componentwise cache adds real infrastructure (per-component shape hashes, packing logic for disconnected graphs) and changes the visual layout for disconnected diagrams. No evidence yet that real users hit the slowness; deferring until profile data motivates it.

What landed for F5:

- **`radialLayout(nodes, edges)` pure function** ([src/domain/radialLayout.ts](src/domain/radialLayout.ts) — new, [tests/domain/radialLayout.test.ts](tests/domain/radialLayout.test.ts) — new). BFS from "centers" (nodes with no outgoing edges within the visible set — UDEs, desired effects, goals) via incoming edges. Each level lands on a ring of radius `RING_STEP * level` (`280` per level), distributed uniformly starting at 12 o'clock. Single-sink graphs put the apex at the exact center; multi-sink graphs share an inner ring at half-radius. Disconnected / cyclic islands land alongside the centers (level 0) rather than disappearing. Positions are normalized so the layout bbox top-left sits at `(0, 0)` — matches dagre's convention so downstream group-rectangle and collapsed-root code doesn't care which layout produced the coordinates. **7 new tests** cover empty / single / tree / orphan / cyclic / normalization / multi-sink shapes.
- **`LayoutMode = 'flow' | 'radial'` preference** ([src/store/uiSlice.ts](src/store/uiSlice.ts)). Lives in `StoredPrefs` alongside `printInkSaver` etc. — viewing preference, persisted app-wide rather than per-doc. Defaults to `'flow'`. New `setLayoutMode` action.
- **Dispatch in `useGraphView`** ([src/components/canvas/useGraphView.ts](src/components/canvas/useGraphView.ts)). Inside the `'auto'` strategy branch (manual-layout diagrams skip the layout pass entirely), the positions memo branches on `layoutMode`: `radialLayout(...)` for `'radial'`, `computeLayout(...)` for `'flow'`. The memo's dependency array gains `layoutMode` so a toggle re-runs the positions pass immediately.
- **Top-bar toggle** ([src/components/toolbar/TopBar.tsx](src/components/toolbar/TopBar.tsx)). A small icon button between Browse Lock and Help — `Orbit` icon when currently in flow (click → radial), `Network` icon when currently in radial (click → flow). `aria-pressed` reflects state. **Hidden when `LAYOUT_STRATEGY[doc.diagramType] === 'manual'`** — Evaporating Cloud's geometry IS the diagnostic, so flipping to radial would erase the conflict. The button is in the `md:inline-flex` cluster alongside Help and Theme so it folds out of narrow viewports gracefully.

**Tests: 245 → 252 (+7) all green.** **TypeScript + Biome clean. Production build 8.9 s.**

**Live-verified at 1440 px end-to-end:** loaded the example CRT (6 nodes), captured dagre positions, clicked the Orbit button → 6 nodes re-positioned into the radial sunburst (UDE at top of the layout, effects on the inner ring, three root causes on the outer ring with AND-grouped edges curving in), clicked Network → returned to identical dagre positions. Switched to a new Evaporating Cloud — the layout toggle correctly disappears.

**Tier 3 is half done.** F1 deferred (see top note). What's left of the original picks:
- **Tier 4:** H1 revision history, H2 visual diff, H3 named branches, H4 side-by-side compare

## Session 26 — A1 Evaporating Cloud

Third and final Tier-2 diagram type. An EC (Evaporating Cloud) surfaces a conflict between two strategies that both pursue the same underlying goal — the classic 5-box layout: common goal **A** on the left, two needs **B** / **C** in the middle, two conflicting wants **D** / **D′** on the right. The diagnostic IS the geometry, so this is the first diagram type with hand-positioned layout instead of dagre.

What landed end-to-end (every entry below was one to five lines of new code thanks to the Session 22 / 23 / 24 / 25 refactor passes):

- **Two new entity types** ([src/domain/types.ts](src/domain/types.ts), [src/domain/guards.ts](src/domain/guards.ts), [src/domain/tokens.ts](src/domain/tokens.ts), [src/domain/entityTypeMeta.ts](src/domain/entityTypeMeta.ts)). `need` with amber-500 stripe (`#f59e0b`), `want` with fuchsia-500 (`#d946ef`). The apex of an EC reuses the existing `goal` type from A4. No new "EC objective" class needed.
- **`DiagramType = 'ec'`** ([src/domain/types.ts](src/domain/types.ts), [src/domain/entityTypeMeta.ts](src/domain/entityTypeMeta.ts)). `DIAGRAM_TYPE_LABEL.ec = 'Evaporating Cloud'`, `PALETTE_BY_DIAGRAM.ec = ['goal', 'need', 'want', 'assumption']`, `DEFAULT_ENTITY_TYPE_BY_DIAGRAM.ec = 'need'` so double-click-to-add on a blank EC drops a Need (the most common addition).
- **`LAYOUT_STRATEGY.ec = 'manual'`** ([src/domain/layoutStrategy.ts](src/domain/layoutStrategy.ts)) — flips `useGraphView` from dagre to position-reading. The dormant position-persist branch in `useGraphMutations` (Session 25) lights up the moment this flag flips, so drag-to-reposition just works.
- **`RULES_BY_DIAGRAM.ec = STRUCTURAL_RULES`** ([src/domain/validators.ts](src/domain/validators.ts)) — clarity / entity-existence / causality-existence / tautology. EC-specific rules ("the two wants conflict at the objective") would need a notion of a conflict edge we don't model yet; parked.
- **`buildExampleEC` + `EXAMPLE_BY_DIAGRAM.ec`** ([src/domain/examples.ts](src/domain/examples.ts)). Canonical work/family balance teaching example: A = "Be present for my family AND deliver at work"; B = "Spend evening time with my family"; C = "Hit my quarterly performance targets"; D = "Leave the office at 5pm every day"; D′ = "Stay late to finish the feature on time". All five entities carry `position` literals (the EC reads right-to-left: each want satisfies a need, each need supports the common goal — yet the wants conflict).
- **`INITIAL_DOC_BY_DIAGRAM.ec = seedEC`** ([src/domain/factory.ts](src/domain/factory.ts)). A blank EC arrives with all 5 boxes pre-positioned and the 4 sufficiency edges (D→B, D′→C, B→A, C→A) already wired — empty titles for the user to fill in. Without the seed, the diagnostic structure would be invisible on a fresh canvas.
- **Flying Logic round-trip** ([src/domain/flyingLogic.ts](src/domain/flyingLogic.ts)). `need ↔ "Need"`, `want ↔ "Want"`. FL has no native need/want class; the exporter emits under the natural names and FL accepts them as user-defined classes. **Position data is dropped on FL round-trip** (FL doesn't store positions either); a re-import via Flying Logic loses the EC geometry.
- **Palette commands** appeared automatically — the `EXAMPLE_BY_DIAGRAM.ec` entry alone is enough; `commands.ts`'s diagram-command loop (Session 23) generates `new-ec` and `load-example-ec` without any edits there.

**Tests: 244 → 245 (+1).** Existing `tests/domain/factory.test.ts` "every diagram starts blank" assertion was tightened to except EC, and a new test asserts EC's seed shape — 5 entities (1 goal, 2 needs, 2 wants), all with positions, goal left of needs left of wants, 4 edges, `nextAnnotationNumber: 6`. **TypeScript + Biome clean. Production build 6.7 s.**

**Live-verified at 1440 px:**
- `Cmd+K → New Evaporating Cloud` seeds 5 nodes at canonical positions with the right stripe colors (sky goal, amber needs, fuchsia wants), 4 edges drawn, "Evaporating Cloud" badge in the top bar.
- Dragging a node fires React Flow's `onNodesChange` with `type: 'position', dragging: false` → `useGraphMutations` reads `LAYOUT_STRATEGY.ec === 'manual'` and forwards to `setEntityPosition` → entity's `position` field updates → next render keeps the box at the new location.
- Reload preserves the dragged position (auto-save wrote it; `useGraphView` reads `entity.position` on mount because strategy is `'manual'`).
- `Cmd+K → Load example Evaporating Cloud` swaps in the work/family teaching example with all 5 boxes labeled and positioned per the canonical layout.

**Tier 2 of the feature-research menu is done** (A1 + A2 + A3). What remains from the original "C is out, do A / F / H" picks:
- **Tier 3:** F1 incremental relayout, F5 sunburst/radial alternate view
- **Tier 4:** H1 revision history, H2 visual diff, H3 named branches, H4 side-by-side compare

## Session 25 — Fourth refactor pass: last A1 prep (seed registry + dormant position branch)

Two small additions, both designed so A1's net change is "add a `Record<DiagramType, _>` entry" rather than "write new infrastructure."

- **`INITIAL_DOC_BY_DIAGRAM` seed registry** ([src/domain/factory.ts](src/domain/factory.ts), [tests/domain/factory.test.ts](tests/domain/factory.test.ts) — new). `createDocument`'s body used to hardcode `entities: {}, edges: {}, nextAnnotationNumber: 1`. Pulled that out into a per-DiagramType seed function (signature `(now: number) => DocSeed`). The four current diagrams all use a shared empty seed; Evaporating Cloud's entry will return five hand-positioned boxes plus the four edges that wire B/C/D/D′ around objective A. `createDocument` now reads `INITIAL_DOC_BY_DIAGRAM[diagramType](now)` and threads the result into the document shell. The `Record<DiagramType, _>` shape forces EC to declare its seed at compile time.
- **Dormant position-persist branch in `useGraphMutations`** ([src/components/canvas/useGraphMutations.ts](src/components/canvas/useGraphMutations.ts)). Added the `change.type === 'position'` arm to `onNodesChange`, gated by `LAYOUT_STRATEGY[doc.diagramType] === 'manual'` and `change.dragging === false` (drag settle, not every frame). Today no diagram has `'manual'` strategy so the branch never executes — A1 flips `LAYOUT_STRATEGY.ec = 'manual'` and the branch lights up. The store action's `pos:<id>` coalesce key (Session 22) means even if a future caller streams per-frame, the undo stack stays clean.

**Tests: 240 → 244 (+4) all green.** New [tests/domain/factory.test.ts](tests/domain/factory.test.ts) — `createDocument` produces a valid blank document for every diagram type (asserts diagramType, schemaVersion, timestamps, empty groups/resolvedWarnings), and the seed registry has a function for every diagram type. The "seed is empty" assertion will fail loudly the moment EC starts pre-seeding entities, which is exactly when a human should look at the change. **TypeScript + Biome clean. Production build 7.4 s.**

**Live-verified at 1440 px:** loaded the CRT example via the palette, 6 nodes render unchanged. No regression from `createDocument`'s refactor or the dormant position branch.

**Cumulative A1 prep status after Sessions 22 + 23 + 24 + 25:**
- ✅ `Entity.position` field with persistence validator and round-trip test
- ✅ `LAYOUT_STRATEGY` map gating `useGraphView`'s dagre vs. position-read branch
- ✅ `layoutFingerprint` hashes positions so drags re-render
- ✅ `setEntityPosition` store action with drag-coalescing
- ✅ `RULES_BY_DIAGRAM` validator registry
- ✅ Exhaustive `DEFAULT_ENTITY_TYPE_BY_DIAGRAM`
- ✅ Exhaustive `EXAMPLE_BY_DIAGRAM`
- ✅ Palette command pairs auto-generated per diagram type
- ✅ `useGraphMutations` hook owns the React Flow change handlers
- ✅ Position-persist branch already wired in `useGraphMutations` — gated by strategy, dormant until A1
- ✅ `INITIAL_DOC_BY_DIAGRAM` seed registry — A1 fills in one entry with EC's 5-box geometry

A1 itself is now: add `'ec'` to `DiagramType` → compiler force-flags seven maps + one function → fill in the entries (`'ec'` label + palette + default + layout strategy `'manual'` + rules + example + seed). The seed entry is the meaty one (positioning five boxes plus four edges); everything else is a few lines each. Plus a small EC-specific validator if we want one. **~30 min** for the whole feature, down from the original 2-3 hours.

## Session 24 — Third refactor pass: thin Canvas.tsx for A1 and F5

Two small hooks extracted out of [src/components/canvas/Canvas.tsx](src/components/canvas/Canvas.tsx). No behavior changes — Canvas shrinks ~50 lines and the extracted hooks become the natural seam for upcoming features.

- **`useSearchDimming` hook** ([src/components/canvas/useSearchDimming.ts](src/components/canvas/useSearchDimming.ts) — new). The F4 search-dim logic — `matchedIds` memo plus the two node/edge mappers that attach the `tp-dimmed` className — moves into a self-contained hook. Same memoization shape, same referential-equality short-circuit when no search is active. Future visual-overlay features (F5 sunburst/radial alternate view, future highlight-path UX) now have an obvious composition seam instead of having to weave around the existing inline code.
- **`useGraphMutations` hook** ([src/components/canvas/useGraphMutations.ts](src/components/canvas/useGraphMutations.ts) — new). Owns the three React Flow → store bridge callbacks (`onConnect`, `onNodesChange`, `onEdgesChange`). Canvas keeps its alt-click `connect()` flow (different gesture, lives in `onNodeClick`). A1 (Evaporating Cloud) will add a `'position'` branch to `onNodesChange` — gated by `LAYOUT_STRATEGY[doc.diagramType] === 'manual'` so auto-layout diagrams don't accidentally persist drag-snapshots — and that branch now lands inside the hook rather than as another append to Canvas.tsx.

**Tests: 240/240 still green.** No new tests — the extracted code paths are exercised by the unchanged Canvas behavior, and the existing component-test plan (parked in NEXT_STEPS as "Component-level interaction tests") would cover them when it lands. **TypeScript + Biome clean. Production build 9.6 s.**

**Live-verified at 1440 px end-to-end:** loaded the example CRT (6 nodes), opened search with `Cmd+F`, typed "Customer" → 4 of 6 nodes get the `tp-dimmed` className. Hit Escape → all 6 nodes un-dim. Same behavior as before the extraction.

**Cumulative A1 prep status after Sessions 22 + 23 + 24:**
- ✅ `Entity.position` field with persistence validator and round-trip test
- ✅ `LAYOUT_STRATEGY` map gating `useGraphView`'s dagre vs. position-read branch
- ✅ `layoutFingerprint` hashes positions so drags re-render
- ✅ `setEntityPosition` store action with drag-coalescing
- ✅ `RULES_BY_DIAGRAM` validator registry
- ✅ Exhaustive `DEFAULT_ENTITY_TYPE_BY_DIAGRAM`
- ✅ Exhaustive `EXAMPLE_BY_DIAGRAM`
- ✅ Palette command pairs auto-generated per diagram type
- ✅ `useGraphMutations` hook owns the React Flow change handlers — A1's position branch lands inside it

## Session 23 — Second refactor pass before A1 (closing the silent-fallthrough gaps)

Three more small refactors, all about closing places where adding `'ec'` to the `DiagramType` union would have compiled cleanly but defaulted to the wrong thing.

- **`defaultEntityType` → `Record<DiagramType, EntityType>`** ([src/domain/entityTypeMeta.ts](src/domain/entityTypeMeta.ts)). The if/else fallback would have silently returned `'effect'` for EC (the right answer is "objective" or similar, not an effect). Now an exhaustive map; the previous behaviour for CRT / FRT / PRT / TT is preserved.
- **`examples.ts` → `EXAMPLE_BY_DIAGRAM` registry** ([src/domain/examples.ts](src/domain/examples.ts), [tests/domain/flyingLogic.test.ts](tests/domain/flyingLogic.test.ts)). The four named `buildExampleX` exports become private functions; a new `EXAMPLE_BY_DIAGRAM: Record<DiagramType, () => TPDocument>` is the public surface. Forces EC to register an example builder (or explicitly say "no example yet") rather than silently lacking one. The one test that imported `buildExampleCRT` directly now reads `EXAMPLE_BY_DIAGRAM.crt()` instead.
- **`commands.ts` diagram commands → loop** ([src/components/command-palette/commands.ts](src/components/command-palette/commands.ts)). The eight hardcoded `new-X` / `load-example-X` blocks become a single `diagramCommands` array generated from `EXAMPLE_BY_DIAGRAM` and `DIAGRAM_TYPE_LABEL`. ~80 lines → ~30. Adding EC becomes zero work in this file — the moment it's a registry key, both palette commands appear.

**Tests: 236 → 240 (+4) all green.** New `tests/domain/entityTypeMeta.test.ts` walks every key in `DIAGRAM_TYPE_LABEL` and asserts every registry (`defaultEntityType`, `EXAMPLE_BY_DIAGRAM`) returns something for it; the loop is the actual guard, not the named assertions. **TypeScript + Biome clean. Production build 11.6 s.**

**Live-verified at 1440 px:** all four "Load example …" commands fire from the palette and produce the right node counts (CRT 6, FRT 5, PRT 7, TT 6). Diagram-type badges read correctly.

**Cumulative A1 prep status after Sessions 22 + 23:**
- ✅ `Entity.position` field with persistence validator and round-trip test
- ✅ `LAYOUT_STRATEGY` map gating `useGraphView`'s dagre vs. position-read branch
- ✅ `layoutFingerprint` hashes positions so drags re-render
- ✅ `setEntityPosition` store action with drag-coalescing
- ✅ `RULES_BY_DIAGRAM` validator registry
- ✅ Exhaustive `DEFAULT_ENTITY_TYPE_BY_DIAGRAM`
- ✅ Exhaustive `EXAMPLE_BY_DIAGRAM`
- ✅ Palette command pairs auto-generated per diagram type

A1 itself shrinks to: add `'ec'` to `DiagramType` (compiler force-flags six maps + one function), fill in the new entries, write `createDocument('ec')` so it pre-seeds the five boxes at canonical coordinates, wire Canvas `onNodesChange` → `setEntityPosition` gated by strategy, and a small EC validator. ~1 hr now, down from 2-3.

## Session 22 — Refactor pass before A1 (Evaporating Cloud)

No user-visible features. Four pre-emptive refactors so A1 — hand-positioned Evaporating Cloud — lands as a small concrete change rather than a redesign:

- **Validators dispatch by diagram type** ([src/domain/validators.ts](src/domain/validators.ts)). The flat `RULES` array became `RULES_BY_DIAGRAM: Record<DiagramType, ValidatorRule[]>`. Rules that previously short-circuited internally (`causeEffectReversalRule` started with `if (doc.diagramType !== 'crt') return [];`, same for `predictedEffectExistenceRule`) drop the guard and are simply registered under the diagrams that apply. `additionalCauseRule` becomes a small factory (`additionalCauseRuleFor(terminalType)`) so CRT and FRT can specialize without duplicating the body. CRT/FRT keep their full set; PRT and TT get the structural rules only (clarity, entity-existence, causality-existence, tautology). EC will be able to register an empty array or a 5-box-specific set.
- **`Entity.position` field** ([src/domain/types.ts](src/domain/types.ts), [src/domain/persistence.ts](src/domain/persistence.ts)). Optional `position?: { x: number; y: number }`. Carried through `importFromJSON` / `exportToJSON` with type-safe validation (`isObject` + per-axis number check). Auto-layout diagrams ignore it today; the field exists so EC has somewhere to write to.
- **Layout-strategy plumbing** ([src/domain/layoutStrategy.ts](src/domain/layoutStrategy.ts) — new, [src/components/canvas/useGraphView.ts](src/components/canvas/useGraphView.ts), [src/domain/fingerprint.ts](src/domain/fingerprint.ts)). New `LAYOUT_STRATEGY: Record<DiagramType, 'auto' | 'manual'>` map — all four current types are `'auto'`. `useGraphView`'s `positions` memo now dispatches: for `'manual'` it skips dagre and reads `Entity.position` (fallback `{0,0}`); for `'auto'` it runs dagre exactly as before. `layoutFingerprint` now hashes positions too so manual-layout diagrams re-render reactively on drag.
- **`setEntityPosition` store action** ([src/store/documentSlice.ts](src/store/documentSlice.ts)). Persists `{x, y}` or clears via `null`. Coalesced under `pos:<id>` so a 60fps drag stream collapses into a single undo entry per gesture, not 60 entries. No-op when the new position equals the current one. No UI wiring yet — drag-to-persist lands with A1 when it's actually visible.

**Tests: 225 → 236 (+11) all green.**
- `tests/domain/persistence.test.ts` — round-trips `Entity.position`; rejects a malformed `position`.
- `tests/domain/layoutStrategy.test.ts` (new) — every existing diagram type is `'auto'`; the `Record<DiagramType, _>` shape forces future EC entries to declare their strategy.
- `tests/domain/validators.test.ts` — structural rules apply to PRT/TT; CRT/FRT-specific rules don't fire on PRT/TT.
- `tests/store/document.test.ts` — `setEntityPosition` writes / clears / coalesces / no-ops on equal position.

**TypeScript + Biome clean. Production build 6.0 s.**

**Live-verified at 1440 px:** sanity check that the refactor is non-regressive — loaded all four example documents in sequence (CRT 6 nodes, FRT 5 nodes, PRT 7 nodes, TT 6 nodes). The diagram-type badges read correctly and dagre still drives layout on every diagram (no positions stored, `'auto'` strategy unchanged).

**What A1 will add on top:**
- `'ec'` added to `DiagramType` — TypeScript will force entries in `DIAGRAM_TYPE_LABEL`, `PALETTE_BY_DIAGRAM`, `LAYOUT_STRATEGY`, `RULES_BY_DIAGRAM`, `defaultEntityType`, and the FL mapping.
- `LAYOUT_STRATEGY.ec = 'manual'` — flips `useGraphView` to the position-reading branch.
- `createDocument('ec')` pre-seeds the 5 boxes at their canonical coordinates (writing to the new `position` field).
- Canvas `onNodesChange` calls `setEntityPosition` on `'position'` change events (gated by `LAYOUT_STRATEGY[doc.diagramType] === 'manual'`).
- A small EC-specific validator (e.g. "both wants point at the objective") goes in `RULES_BY_DIAGRAM.ec`.

## Session 21 — A3 Transition Tree

Second Tier-2 diagram type. A TT (Transition Tree) is the sequenced injection plan: a chain of actions that transition from current reality to a desired effect, with explicit step numbers so the order is legible even after rearranging.

- **One new entity type** ([src/domain/types.ts](src/domain/types.ts), [src/domain/guards.ts](src/domain/guards.ts), [src/domain/tokens.ts](src/domain/tokens.ts), [src/domain/entityTypeMeta.ts](src/domain/entityTypeMeta.ts)). `action` with a cyan-500 stripe (`#06b6d4`), distinct from injection-emerald, IO-blue, and goal-sky. The apex of a TT reuses the existing `desiredEffect` type from FRT; intermediate states (when modelled) reuse `effect`. No new "TT-only outcome" class needed.
- **`DiagramType = 'tt'`** ([src/domain/types.ts](src/domain/types.ts), [src/domain/entityTypeMeta.ts](src/domain/entityTypeMeta.ts)). `DIAGRAM_TYPE_LABEL.tt = 'Transition Tree'`, `PALETTE_BY_DIAGRAM.tt = ['action', 'effect', 'desiredEffect', 'assumption']`, `defaultEntityType('tt') === 'action'` so double-click-to-add on an empty TT canvas seeds an Action.
- **Optional `ordering?: number` on Entity** ([src/domain/types.ts](src/domain/types.ts), [src/domain/persistence.ts](src/domain/persistence.ts)). Step-number field, generic over all entity types (so future work — TT polish, sequenced PRT IOs, etc. — has a hook without another schema bump). Validates as `number | undefined`; persists when set, drops via JSON when unset.
- **Inspector Step # input** ([src/components/inspector/EntityInspector.tsx](src/components/inspector/EntityInspector.tsx)). A small numeric input rendered only when `entity.type === 'action'`. Empty value clears `ordering` to undefined; positive integer commits. Other entity types don't see this field even if they happen to carry `ordering` (the schema field is generic; the UI is deliberately scoped to where it makes sense today).
- **Step badge on the node** ([src/components/canvas/TPNode.tsx](src/components/canvas/TPNode.tsx)). When `entity.ordering` is set, a small cyan-tinted pill rendered at the node's top-left reads "Step N". Pairs cleanly with the existing annotation-number pill at top-right.
- **Flying Logic round-trip** ([src/domain/flyingLogic.ts](src/domain/flyingLogic.ts)). `action ↔ "Action"`, with `"Step"` as an inbound alias. FL has no native action class so it accepts these as user-defined classes silently. `ordering` is not round-tripped through FL today (it's a TP-Studio concept, not part of the FL spec); the persisted JSON keeps it for native open/save.
- **Palette commands + example TT** ([src/components/command-palette/commands.ts](src/components/command-palette/commands.ts), [src/domain/examples.ts](src/domain/examples.ts)). `New Transition Tree` and `Load example Transition Tree` under the Document group. The example is a 5-step support-triage plan (audit intake → draft rubric → pilot → roll out → weekly metrics review) ending in a Desired Effect ("Customer wait time drops below 4 hours"). Every Action carries an explicit ordering so the badges read Step 1 … Step 5 down the dagre flow.

**Tests: 225/225 still green** (purely additive — new enum values + an optional field; the existing persistence / palette tests cover the union extensions transitively). **TypeScript + Biome clean. Production build 8.1 s.**

**Live-verified at 1440 px:** `Cmd+K → Load example Transition Tree` produces 6 nodes — 5 cyan Actions with "Step 1" through "Step 5" badges at top-left, plus one indigo Desired Effect with no badge. Diagram-type label reads "Transition Tree". Selecting an Action opens the inspector with the Step # input pre-filled to the entity's ordering; clearing the input drops the badge from the canvas.

## Session 20 — A2 Prerequisite Tree

First Tier-2 diagram type from [docs/feature-research.md](docs/feature-research.md). The PRT (Prerequisite Tree) is the third tree in the Theory of Constraints stack alongside CRT and FRT: it surfaces obstacles between a team and an ambitious goal, plus the intermediate objectives that overcome each obstacle. Reads bottom-up: do these IOs → defeat these obstacles → reach the goal.

- **Two new entity types** ([src/domain/types.ts](src/domain/types.ts), [src/domain/guards.ts](src/domain/guards.ts), [src/domain/tokens.ts](src/domain/tokens.ts), [src/domain/entityTypeMeta.ts](src/domain/entityTypeMeta.ts)). `obstacle` (rose-500 stripe) and `intermediateObjective` (blue-600 stripe). The apex goal reuses the existing `goal` type from A4 — no need for a fourth "PRT-only objective" class.
- **`DiagramType = 'prt'`** ([src/domain/types.ts](src/domain/types.ts), [src/domain/guards.ts](src/domain/guards.ts), [src/domain/entityTypeMeta.ts](src/domain/entityTypeMeta.ts)). Wired through `DIAGRAM_TYPE_LABEL` ("Prerequisite Tree"), `PALETTE_BY_DIAGRAM.prt = ['goal', 'obstacle', 'intermediateObjective', 'assumption']`, and `defaultEntityType('prt') === 'intermediateObjective'` so double-click-to-add on an empty PRT canvas seeds an IO rather than an effect.
- **Flying Logic round-trip** ([src/domain/flyingLogic.ts](src/domain/flyingLogic.ts)). `obstacle ↔ "Obstacle"`, `intermediateObjective ↔ "Intermediate Objective"`, with `IO` as an inbound alias. Real Flying Logic doesn't predefine these classes; the exporter emits them under their natural names and FL imports them as user-defined classes without complaint.
- **Palette commands** ([src/components/command-palette/commands.ts](src/components/command-palette/commands.ts)). `New Prerequisite Tree` and `Load example Prerequisite Tree` under the Document group, paired with the existing CRT/FRT entries.
- **Example PRT** ([src/domain/examples.ts](src/domain/examples.ts)). A 7-entity product-launch tree: one apex goal ("Launch the new product line in Q3"), three obstacles (skills gap, no budget approval, QA at capacity), three IOs (training sprint, vendor-backed budget request, contract testers). Edges go IO → obstacle → goal so dagre lays it out bottom-up.
- **No validator changes needed.** The existing `additional-cause` rule keys on `terminalType = doc.diagramType === 'crt' ? 'ude' : 'desiredEffect'` — for a PRT, neither type exists, so the rule produces zero warnings. The CRT-only `cause-effect-reversal` and FRT-only `predicted-effect-existence` rules early-exit on `doc.diagramType !== '…'`. Clean PRT-specific validators ("a goal with no IOs feeding obstacles below it") are parked.

**Tests: 225/225 still green** (the additions are purely enum extensions; the existing palette / persistence / guards tests cover the new types transitively via the union types). **TypeScript + Biome clean. Production build 5.9 s.**

**Live-verified at 1440 px:** `Cmd+K → Load example Prerequisite Tree` produces 7 nodes with stripe colors matching the spec — goal `#0ea5e9`, obstacle `#f43f5e`, intermediate objective `#2563eb`. The title-badge reads "Prerequisite Tree". Dagre lays the tree bottom-up with the three IOs at the base, three obstacles above them, and the goal at the apex.

## Session 19 — Tier 1 from the feature-research menu (A4 / A5 / A6 / A7 / F2 / F3 / F4 / F6 / F7)

First nine items from the 94-feature research catalogue at [docs/feature-research.md](docs/feature-research.md). The user picked buckets **A** (table-stakes), **F** (layout / ergonomics), and **H** (versioning) and asked for Tier 1 in one shot — the trivial / small effort wins where the design is unambiguous. No new diagram types yet (those are Tier 2: A1 EC, A2 PRT, A3 Transition Tree); H1–H4 history features are Tier 4.

- **A4 Goal Tree entity classes** ([src/domain/types.ts](src/domain/types.ts), [src/domain/entityTypeMeta.ts](src/domain/entityTypeMeta.ts), [src/domain/tokens.ts](src/domain/tokens.ts), [src/domain/guards.ts](src/domain/guards.ts), [src/domain/flyingLogic.ts](src/domain/flyingLogic.ts)). Three new entity types — `goal` (sky-500 stripe), `criticalSuccessFactor` (teal-600), `necessaryCondition` (lime-500) — appended to both CRT and FRT palettes. Flying Logic mapping extended with reverse aliases ("Objective", "CSF"). **Live-tested loader bug found and fixed during verification**: `isEntityType` in [guards.ts](src/domain/guards.ts) had a hard-coded ENTITY_TYPES set that I forgot to extend, so documents containing a Goal failed `importFromJSON` with a misleading "invalid type" error. Caught by seeding a 4-entity doc and watching the canvas come up blank.
- **A5 Live-draft auto-recovery** ([src/services/storage.ts](src/services/storage.ts), [src/services/persistDebounced.ts](src/services/persistDebounced.ts), [src/domain/persistence.ts](src/domain/persistence.ts)). New `tp-studio:active-document-live:v1` key written synchronously on every mutation alongside the existing debounced commit. On load, whichever copy has the newer `updatedAt` wins, so a tab crash or OS shutdown mid-keystroke now restores the in-flight document instead of dropping the last few seconds of work. `flushNow()` removes the live key once the committed write lands so steady-state storage is unchanged.
- **A6 Reverse edge** ([src/store/documentSlice.ts](src/store/documentSlice.ts), [src/components/canvas/ContextMenu.tsx](src/components/canvas/ContextMenu.tsx), [src/components/command-palette/commands.ts](src/components/command-palette/commands.ts)). New `reverseEdge(id)` action — swaps `sourceId` and `targetId` unless the opposite-direction edge already exists, in which case it toasts an info message instead of corrupting the graph. Reachable from right-click on an edge ("Reverse direction") and from the command palette (`Edges → Reverse edge`).
- **A7 Redact-on-export (JSON)** ([src/domain/redact.ts](src/domain/redact.ts), [src/components/command-palette/commands.ts](src/components/command-palette/commands.ts)). New `redactDocument(doc)` pure transform that replaces every entity title with `#N`, blanks descriptions and edge labels, retitles groups as `Group N`, and drops document-level `author` / `description`. The structure (IDs, edges, types, AND-groups) is preserved exactly. Wired up as a new palette command (`Export → Export as redacted JSON`). PNG-redacted variant deferred (needs a parallel canvas render).
- **F2 Fade-in/out animations** ([src/styles/index.css](src/styles/index.css)). Nodes get a 220 ms `tp-fade-in` keyframe on mount and a 180 ms opacity transition for live changes. Edges get the same fade-in. All animation durations are scaled by `var(--anim-speed)` so the existing instant / slow / default / fast preference still controls everything.
- **F3 Per-entity title font size** ([src/domain/types.ts](src/domain/types.ts), [src/domain/persistence.ts](src/domain/persistence.ts), [src/components/canvas/TPNode.tsx](src/components/canvas/TPNode.tsx), [src/components/inspector/EntityInspector.tsx](src/components/inspector/EntityInspector.tsx)). Optional `titleSize?: 'sm' | 'md' | 'lg'` on `Entity`, undefined = default `md` (= the existing `text-node` token). Compact / Regular / Large 3-button group in the inspector below Description. Validation accepts the new field forward and ignores missing values on older docs (no migration needed since the field is optional).
- **F4 Dim non-matching nodes during search** ([src/components/canvas/Canvas.tsx](src/components/canvas/Canvas.tsx), [src/styles/index.css](src/styles/index.css)). When `searchOpen` is true and the query has at least one hit, non-matching nodes and edges get a `tp-dimmed` className → `opacity: 0.18` with a soft transition. Inspired by Kumu's "showcase" mode — translucent rather than hidden, so the surrounding causal context stays readable. Adjacent-to-match edges (both endpoints hit) stay full-opacity to keep the highlighted subgraph legible.
- **F6 Ink-saving print mode** ([src/store/uiSlice.ts](src/store/uiSlice.ts), [src/hooks/useThemeClass.ts](src/hooks/useThemeClass.ts), [src/styles/print.css](src/styles/print.css), [src/components/settings/SettingsDialog.tsx](src/components/settings/SettingsDialog.tsx)). New `printInkSaver` boolean preference (persisted in `StoredPrefs`). When on, the `.print-ink-saver` class on `<html>` activates an extra block inside `@media print` that strips color fills from entity backgrounds while keeping stripe accents and text — about 60–70% less toner on a CRT with many nodes. Toggle lives in `Settings → Display`.
- **F7 Per-entity disclosure-triangle collapse** ([src/domain/types.ts](src/domain/types.ts), [src/domain/persistence.ts](src/domain/persistence.ts), [src/store/documentSlice.ts](src/store/documentSlice.ts), [src/components/canvas/flow-types.ts](src/components/canvas/flow-types.ts), [src/components/canvas/useGraphView.ts](src/components/canvas/useGraphView.ts), [src/components/canvas/TPNode.tsx](src/components/canvas/TPNode.tsx), [src/components/canvas/ContextMenu.tsx](src/components/canvas/ContextMenu.tsx)). Optional `collapsed?: boolean` on `Entity`. When `true`, `useGraphView` BFS-walks the entity's outgoing-edge subtree and removes those nodes from `visibleEntityIds` while keeping the collapser itself visible. A small "▸+N" chip rendered at the bottom of the collapsed node expands the subtree on click. Reachable from right-click → "Collapse downstream" / "Expand downstream" (the menu item only appears when the entity has any downstream edges). **Caveat surfaced live**: the layout fingerprint was extended to include the entity-collapser set so `positions` recomputes when the collapsed-state flips (without this, freshly-uncollapsed entities would render at the dagre fallback `{0, 0}`).

**H5 dropped from Tier 1** — the H5 "confidence-weighted what-if" feature in the research doc depends on per-entity confidence (C1) and per-edge weight (C2), and the user explicitly excluded bucket C. Without those signals there's nothing to scale, so H5 stays parked.

**Tests: 225/225 still green** (no new tests this session — the additions are either visual/CSS-only or covered by existing snapshot-equivalent behavior in [persistence.test.ts](tests/domain/persistence.test.ts) for the new optional fields). **TypeScript + Biome clean. Production build 8.0 s.**

**Live-verified at 1440 px:** seeded a 4-entity diagram (Root cause A → Effect B → Hidden child C, plus a standalone Goal D with `titleSize: 'sm'`) with B pre-collapsed. On load: 3 nodes render (C correctly hidden), B's chevron reads "Expand 1 hidden descendant" with the "▸+1" badge. Clicking the chevron brings C back; the right-click "Expand downstream" / "Collapse downstream" item appears on B and on entities with any downstream edge, hidden otherwise. Goal D renders with the lime stripe and `text-xs` title token.

## Session 18 — Layout audit fixes

Six findings from a full layout audit (every absolute / fixed overlay measured at desktop / tablet / phone widths). Each fix is small and visual-only — no behavior change, no test impact.

- **A1 MiniMap → bottom-left** ([Canvas.tsx](src/components/canvas/Canvas.tsx)). Was bottom-right, so the right-anchored Inspector covered it entirely (201 px overlap at desktop) whenever the user had a selection. Now bottom-left, 0 px overlap with the inspector at every width.
- **A2 SearchPanel reserves inspector room** ([SearchPanel.tsx](src/components/search/SearchPanel.tsx)). The panel was `left-1/2 w-[min(720px,90vw)]` and overlapped the inspector by 168 px @ 1024 / 288 px @ 640 when both were open. Now when `selection.kind !== 'none'`, the panel re-centers in the canvas-minus-inspector area and caps its width at `min(720px, calc(100vw − 360px))`. Verified: 20 px clean gap at 1024 px width.
- **A3 Title max-width per breakpoint** ([App.tsx](src/App.tsx)). The title region's max-width was `calc(100% − 13rem)` everywhere, which overlapped the 4-button TopBar at md+ by up to 104 px. Now tiered:
  - `< sm` → `calc(100% − 7rem)` (TopBar ~80 px: icon Commands + Lock)
  - `sm` → `calc(100% − 12rem)` (TopBar ~150 px: full Commands + Lock)
  - `md+` → `calc(100% − 20rem)` (TopBar ~280 px: all four buttons)
- **B1 FirstEntityTip moved above Controls** ([Canvas.tsx](src/components/canvas/Canvas.tsx)). Was `bottom-6` in the same vertical band as the React Flow Controls bar. Now `bottom-24`, clearing the controls with shadow room.
- **E Print stylesheet cleanup** ([print.css](src/styles/print.css)). Removed four dead selectors (`.toaster`, `.breadcrumb`, `.top-bar`, `.top-bar-buttons`) that didn't match any class in the codebase. Added stable `data-component` hooks to TitleBadge, TopBar, Breadcrumb, and Toaster, then rewrote the print rules against those instead of brittle `aria-label` strings.
- **C Z-index contract** ([src/domain/zLayers.ts](src/domain/zLayers.ts)). New module documenting the eight z-index tiers used across the app — `below / canvas / controls / chrome / aside / menu / toast / modal` — with rationale for each. Replaces a magic `-1` in `useGraphView.ts` with `Z.below`. Future overlays can fit an existing tier rather than inventing fresh numbers.

**Verified live at 1440 px:** MiniMap landed at x=15 → 216 (bottom-left, 0 px overlap with inspector zone), title ends at x=570 with 588 px gap to TopBar at x=1159, screenshot confirms layout is clean. **At 1024 px with inspector open:** SearchPanel occupies x=20–684, inspector at x=704–1024, 20 px gap. **Tests: 225/225 still green. TypeScript + Biome clean. Production build 7.1 s.**

**Deferred** (intentionally — not load-bearing): the broader z-index migration to import from `Z` everywhere (Tailwind classes are still the source for chrome/aside/menu/modal); inspector width transition at the md breakpoint (resize-time-only flash); group selection moving from the `entities` bucket to its own `{kind: 'group'}` selection arm (architectural; revisit when groups grow).

## Session 17 — Flying Logic file interop

Open and save Flying Logic's native `.logicx` (XML) format. Best-effort implementation against the public Flying Logic 4/5 scripting docs ([reference](https://docs.flyinglogic.com/scripting-guide/flying-logic-document-format.html)); see "Known limitations" below.

- **Format spec used:** `<flyingLogic majorversion="5">` root, `<symbols>` listing entity classes, `<decisionGraph>` containing `<vertices>` (each `<vertex eid type entityClass>` with `<attribute key=... class=...>` children) and `<edges>` (each `<edge source target>`). AND-style sufficient+necessary semantics in Flying Logic are carried by **junctor vertices** (`<vertex type="junctor">`) rather than by an edge attribute. Groups are vertices with a `grouped="eid1 eid2 …"` attribute.
- **Writer** ([src/domain/flyingLogic.ts](src/domain/flyingLogic.ts) — `exportToFlyingLogic`). Allocates small integer `eid`s, emits each entity as `<vertex type="entity">` with its title/description as `<attribute>` children, emits one `<vertex type="junctor">` per `andGroupId`, then wires AND-grouped edges as N inputs into the junctor + one output to the shared target. Plain edges go through directly. Groups emit as `<vertex grouped="…">`.
- **Parser** (`importFromFlyingLogic`). Uses the browser's `DOMParser`. Walks vertices to classify entity / junctor / group; walks edges. Junctors are unpacked back into TP Studio `andGroupId`s — an `inEdge → junctor → outEdge` triple becomes a set of AND-grouped edges from each `inEdge.source` to `outEdge.target`. Unknown / malformed vertices are tolerated rather than throwing.
- **TP-Studio-custom attributes** preserved for clean round-trip: `tp-studio-id` (entity / group / edge), `tp-studio-annotation`, `tp-studio-and-group-id`, `tp-studio-color`, `tp-studio-diagram-type`, `tp-studio-next-annotation`. A real Flying Logic app ignores them; we read them back when re-opening one of our exports.
- **Palette commands**: *Open Flying Logic file…* (under Document) and *Export as Flying Logic file* (under Export). The picker accepts both `.logicx` and `.logic` extensions.
- **Tests: 213 → 225.** New `tests/domain/flyingLogic.test.ts` (12 cases): writer shape + entityClass enumeration + AND junctor emission + XML escaping; parser rejects non-`<flyingLogic>` roots, malformed XML, and maps entity-class names back to our types; full round-trip on the example CRT preserves entity / edge / AND counts; round-trip preserves IDs, annotation numbers, and edge labels. TypeScript + Biome clean. Production build 4.4 s.

**Live verification:** round-trip on the loaded example CRT — exported XML re-imports with 6 → 6 entities, 5 → 5 edges, 2 → 2 AND-grouped edges. The XML head reads `<?xml … ?><flyingLogic majorversion="5" uuid="…">…<entityClass name="Root Cause"/>` etc., shape matching the spec.

**Known limitations / "lossy" bits to be aware of:**
- **Container is flat XML, not ZIP.** Real `.logicx` files may be ZIP archives; if so, extract the inner XML before opening. The public Flying Logic scripting docs only describe the XML structure, not the container.
- **Position data is dropped.** Flying Logic doesn't save positions either (it re-runs auto-layout on open), so this matches but a hand-positioned diagram won't keep its positions on round-trip.
- **Junctor types are coerced to AND.** Flying Logic supports more junctor flavors (sufficient+necessary, OR, NOT-AND, etc.); we map everything to our `andGroupId` model.
- **Display / canvas settings, domains, custom entity-class definitions** in real FL files are read past silently.
- **Edge labels and group colors** are TP Studio-specific; they survive a TP → FL → TP round-trip via the custom attributes but Flying Logic itself won't surface them.

If you have an actual `.logicx` from Flying Logic, opening it through TP Studio is the right way to test where the spec assumptions are off; the parser will surface a descriptive error when it can't match the schema.

## Session 16 — Under-the-hood + maintainability pass

A focused pass between the iteration close and the layout audit. Six targeted improvements; no behavior change.

- **Code-split modal dialogs** ([App.tsx](src/App.tsx)). HelpDialog, SettingsDialog, DocumentInspector, SearchPanel, and QuickCaptureDialog are now `React.lazy` imports wrapped in a single `<Suspense fallback={null}>`. Each ships as a separate chunk loaded on first invocation rather than at page load.
  - **Main `index` chunk: 227.21 → 206.73 kB** (gzip **66.97 → 62.14 kB**, −4.83 kB).
  - 5 new lazy chunks total ~21 kB raw / ~8.8 kB gzip, fetched only when the user opens that surface.
  - Verified: SearchPanel chunk loads on first `Cmd+F` and the input auto-focuses (Search functionality unaffected).
- **GROUP_COLOR_CLASSES extraction** ([src/domain/groupColors.ts](src/domain/groupColors.ts)). The 6-tone Tailwind class map was triple-duplicated across [TPGroupNode.tsx](src/components/canvas/TPGroupNode.tsx), [TPCollapsedGroupNode.tsx](src/components/canvas/TPCollapsedGroupNode.tsx), and [GroupInspector.tsx](src/components/inspector/GroupInspector.tsx) with subtly different keys (`bg/border/title`, `bg/border/label`, `COLOR_SWATCH`). Now centralized into a single `Record<GroupColor, GroupColorClasses>` with `bg` (subtle), `bgStrong` (saturated), `border`, `text`, and `swatch` keys, plus a `GROUP_COLORS_ORDER` array. Adding a new tone now updates every consumer from one place. ~80 lines of duplicated Tailwind classes removed.
- **AttachedEdgesList**: filter is now `useMemo`-ized on `(edges, assumptionId)` so the O(E) walk only runs when the dependency actually changes, not on every parent re-render.
- **GroupInspector**: dropped a second `useDocumentStore` subscription that read the same group; member count is now derived locally from the existing one — one fewer subscriber per render.
- **ANDOverlay**: removed `tx / ty / scale` from the `arcs` memo's deps. The path strings are graph-coord, and the surrounding `<g>` CSS transform already handles pan/zoom — recomputing on every pixel of pan was wasted work.
- **PrintFooter**: captures the date string once at module scope. `new Date()` no longer runs every render.
- **Tests / TS / Biome**: still clean. 213/213 tests green. Production build 7.1 s.

## Session 15 — Iteration 2, Phase 8: narrow-viewport responsive + component tests

Closes out the iteration. Two parallel tracks: the app stays usable down to phone-sized viewports, and the component-level RTL test surface catches changes that the existing domain + store tests don't.

- **Title region** ([App.tsx](src/App.tsx)) — wraps in a flex container with a viewport-aware `max-width` so the title input + diagram-type badge + Document Details icon never overlap the right-edge toolbar. Input itself caps at 60ch with `min-w-0 flex-shrink`, so a runaway title truncates with a trailing ellipsis (via the input's native overflow) instead of pushing the badge off-screen. Below `sm`, the diagram-type badge is hidden — the document title carries enough context.
- **TopBar** ([TopBar.tsx](src/components/toolbar/TopBar.tsx)) — at `< sm`, the labelled "Commands ⌘+K" button swaps for an icon-only Search button (same handler). The Help and Theme buttons are hidden at `< md`; both remain reachable via the palette ("Show keyboard shortcuts", "Settings…"), so no functionality is lost on phone-sized screens.
- **Inspector** ([Inspector.tsx](src/components/inspector/Inspector.tsx)) — width is now `min(85vw, 320px)` below `md`, capping at 320px from `md` upward. The slide-off when nothing is selected is unchanged.
- **Minimap + Zoom percent** ([Canvas.tsx](src/components/canvas/Canvas.tsx)) — both hidden at `< sm`. The bottom-center zoom controls remain, plus keyboard `+ / - / 0`.
- **Component tests (track 8.2).** Three new RTL test files in `tests/components/`:
  - `CommandPalette.test.tsx` (5 cases): renders all commands, filters live, honors `paletteInitialQuery`, Enter on the active match runs + closes, "No matches." for impossible queries.
  - `Inspector.test.tsx` (6 cases): hidden when nothing selected, single-entity view, multi-entity summary with bulk actions, group inspector, Close button clears, Edit/Preview toggle present.
  - `ContextMenu.test.tsx` (6 cases): single-entity items (Add child / parent / Rename / Convert / Delete), single-edge with AND group shows Ungroup, multi-entity bulk Convert + Delete, multi-edge top item is "Group as AND", pane shows "New entity here", closed renders nothing.
- **Tests: 196 → 213** (+17). TypeScript + Biome clean. Production build 5.2 s.

**Verified live at three viewports:** 1280×800 (full chrome — Commands button + badge + Help + Theme + minimap all visible), 600×800 (icon-only Commands, Lock; badge / Help / Theme / minimap / zoom-percent hidden), 400×800 (phone — title truncates cleanly, only Search + Lock visible up top, canvas + controls fit without overlap).

## Session 14 — Iteration 2, Phase 7: Bundle 5 export pack

Six new "get your diagram out of TP Studio" paths. PDF via browser print, two new image formats, a CSV that's structurally a superset of the importer's, and human-readable annotations exports.

- **FL-EX1 / FL-EX7 Print → PDF** ([src/styles/print.css](src/styles/print.css)). `@media print` hides the toolbar, inspector, palette, modals, minimap, controls, and breadcrumb; expands the React Flow viewport to fill the page; forces a light color scheme regardless of theme; injects a top-of-document header (title + author + description) and a bottom date footer. `Cmd+P` is the OS/browser shortcut (we don't intercept it); a **Print / Save as PDF…** palette command also calls `window.print()` for discoverability.
- **FL-EX2 JPEG export** ([exporters.ts](src/services/exporters.ts)) — `exportJPEG` mirrors `exportPNG` via `html-to-image`'s `toJpeg`, quality 0.92, same 2× pixel ratio. Internal `prepareExport` helper extracted so PNG / JPEG / SVG share the viewport math.
- **FL-EX3 SVG export** — `exportSVG` via `toSvg`. Inline SVG; browsers and design tools open it directly.
- **FL-EX5 CSV export** ([src/services/csvExport.ts](src/services/csvExport.ts)). Pure `exportToCsv(doc) → string` writes a single CSV with a `kind` column discriminating entity / edge / group rows. RFC 4180-safe escaping (quotes around any cell containing `, " \n`; embedded quotes doubled). Entity rows are a structural superset of what the FL-QC2 importer reads — feed an entity-only re-import back through `parseEntitiesCsv` and it round-trips.
- **FL-EX6 Annotations-only export** ([src/services/annotationsExport.ts](src/services/annotationsExport.ts)). Two formats: **Markdown** (`# title`, `## #N — entity title`, `_type_` line, then the entity's description verbatim) and **plain text** (flat, indented descriptions). Both are ordered by `annotationNumber` ascending, so the printed doc reads in a stable order regardless of canvas position.
- **App.tsx**: `<PrintHeader />` and `<PrintFooter />` mounted globally; CSS keeps them hidden in normal view.
- **Palette**: 6 new commands under the Export group — JPEG, SVG, CSV, Annotations Markdown, Annotations Text, Print/PDF.
- **Tests: 186 → 196.** 4 cases in `tests/services/csvExport.test.ts` (header, RFC-4180 escaping, round-trip with importer, row ordering); 6 cases in `tests/services/annotationsExport.test.ts` (ordering, headings, author present/absent, markdown verbatim, text indentation). TypeScript + Biome clean. Production build 7.9 s.

**Verified live:** the canvas mounts cleanly; `.print-only` and `.print-footer` blocks are in the DOM and hidden in normal view (`display: none`). Calling the CSV export against the loaded example produces a 13-line file (header + 6 entities + 5 edges + 1 group) with the documented header row; the Markdown annotations export emits a leading H1 plus `## #N — Title` blocks ordered by annotation number.

## Session 13 — Iteration 2, Phase 6: Bundle 6 rich annotations + edge labels

Five additions that move TP Studio's text fields from plain strings to richly-formatted notes. Adds the first new dependency surface area in months (`micromark` + `dompurify`).

- **FL-AN1 Multi-line titles** ([TPNode.tsx](src/components/canvas/TPNode.tsx)) — `Alt+Enter` inside the title textarea inserts a newline at the caret. Plain `Enter` still commits. The rendered title preserves explicit line breaks via `whitespace-pre-line` and a native tooltip surfaces the full title on hover. Round-trips through save/load — the `title` field already accepted any string.
- **Markdown rendering pipeline** ([src/services/markdown.ts](src/services/markdown.ts)). `renderMarkdown(src)` runs `micromark` with GFM, sanitizes with `dompurify`, and post-processes anchors to (a) add `target="_blank" rel="noopener noreferrer"` to external links and (b) rewrite `#entity:ID` / `#N` references to `data-entity-ref` for the click delegator. Lightweight `.prose-tp` styles in [index.css](src/styles/index.css) avoid the @tailwindcss/typography dep.
- **FL-AN2 Markdown descriptions** ([MarkdownField.tsx](src/components/inspector/MarkdownField.tsx), [MarkdownPreview.tsx](src/components/ui/MarkdownPreview.tsx)) — entity descriptions and the Document Inspector description both render as markdown. Each Description field has a tiny **Edit ↔ Preview** segmented toggle in its header; Browse Lock forces Preview mode.
- **Schema v4 + FL-AN3 Edge labels.** New optional `Edge.label?: string`. The EdgeInspector gains a Label input. `TPEdge.tsx` renders inline labels mid-edge (white pill, ≤30 chars) or shrinks to a tiny `i` tooltip-only chip for longer text. v3 → v4 migration is a pure version bump (no edge needs to change shape). Search now indexes `Edge.label` too — search results can navigate to edges, which auto-select that edge.
- **FL-AN5 Internal entity links** ([entityRefs.ts](src/services/entityRefs.ts)). Markdown links of the form `[anything](#N)` (annotation number) or `[anything](#entity:ID)` (raw id) render as click chips with an indigo background. Clicking selects the referenced entity, auto-expanding any collapsed ancestor groups and unhoisting if the target lives outside the current hoist.
- **Tests: 174 → 186.** New `tests/services/markdown.test.ts` (10 cases: bold/italic/lists, external links, both internal-ref forms, script-tag neutralization, `javascript:` URI scheme stripping, inline code). One additional v3 → v4 migration case in `tests/domain/migrations.test.ts`. New edge-label-search case in `tests/domain/search.test.ts`. TypeScript + Biome clean. Production build 7.5 s.

**Verified live in the preview:** the renderMarkdown service correctly transforms `**bold**, *italic*, [link](https://example.com), [#42](#42)` into the expected HTML — external link with `target=_blank rel=noopener`, internal `#42` ref rewritten to `data-entity-ref="#42"`, with bold/italic working. Canvas still mounts cleanly with the persisted example + group + AND arc.

## Session 12 — Iteration 2, Phase 5: Bundle 3 Quick Capture + CSV import

Two paths to "skip the click-by-click flow and build a diagram fast." Both turn structured text into a connected set of entities in a single action.

- **FL-QC1 Quick Capture** ([QuickCaptureDialog.tsx](src/components/quick-capture/QuickCaptureDialog.tsx)). Press `E` (when not in a text field) or pick *Quick Capture…* from the palette. A two-pane modal opens: paste / type a bulleted, indented list on the left; the right pane shows a live preview tree of exactly what will be created. Press `Cmd/Ctrl+Enter` (or click **Create N entities**) to commit. Each line becomes an entity of the diagram's default type (Effect for both CRT and FRT). Indents (2 spaces or a tab per level) turn into parent → child edges; roots attach to the currently-selected entity, or float if nothing is selected. Bullets (`-`, `*`, `•`, `>`, `1.`, `2)`) and a single leading emoji are stripped automatically; lone bullets and blank lines are skipped.
- **Pure parser** ([src/domain/quickCapture.ts](src/domain/quickCapture.ts)). `parseQuickCapture(text)` returns a forest of `CaptureNode`s plus a `total` count. Defensive against over-indentation (a child at indent 4 with no indent-2 ancestor snaps under the nearest available ancestor). 10 cases in [tests/domain/quickCapture.test.ts](tests/domain/quickCapture.test.ts).
- **Apply service** ([src/services/quickCapture.ts](src/services/quickCapture.ts)). Mints entities in pre-order, wires edges from parent → child, and ends with the entire pasted set selected so the user can immediately group, delete, or convert.
- **FL-QC2 CSV import** ([src/services/csvImport.ts](src/services/csvImport.ts)). Palette → *Import entities from CSV…* opens a file picker. Header is order-flexible, case-insensitive, with `title` + `type` required and `description` / `parent_title` optional. Forgiving line parser handles quoted fields with embedded commas and the doubled-up `""` escape. Unknown types are rejected with a line-numbered toast. Within-import `parent_title` links resolve by title match.
- **Tests: 154 → 174.** New `tests/services/csvImport.test.ts` (10 cases: empty file, missing required header, minimal row, column-order flexibility, unknown type, embedded commas, doubled-quote escape, plus 3 apply cases) + `tests/domain/quickCapture.test.ts` (10 cases covering bullets / emoji / tabs / blank lines / over-indentation / nested). TypeScript + Biome clean. Production build 6.6 s.

**Verified live:** Pressing `E` opens the modal with the textarea auto-focused; pasting the 4-line "Customer satisfaction is declining → ... → Hard to find qualified pickers" sample renders a live preview tree with **4 entities** and a **Create 4 entities** CTA button.

## Session 11 — Iteration 2, Phase 4: Bundle 1 navigation + search

Five additions for moving around a large diagram quickly: a Find panel, a minimap, explicit zoom controls + live percentage, "Select path between," and "Select all successors / predecessors."

- **FL-NA1 Find panel** ([SearchPanel.tsx](src/components/search/SearchPanel.tsx)) — slides over the canvas on `Cmd/Ctrl+F`. Live match list with Next / Previous, regex / case / whole-word toggles, and `Enter` / `Shift+Enter` to cycle. Jumping to a match auto-expands any collapsed ancestor groups (X-Search-5) and unhoists when the match lives outside the current hoist. Pure search in [src/domain/search.ts](src/domain/search.ts) covers entity titles + descriptions and group titles.
- **FL-NA2 Minimap** — React Flow's `<MiniMap>` rendered bottom-right with theme-aware mask + accent colors for group nodes. Toggle in **Settings → Display → Show minimap** (defaults on).
- **FL-DI1 Zoom controls** — keyboard `+` / `=` zooms in, `-` / `_` zooms out, `0` fits view. Only fires outside text fields so OS browser zoom (Cmd+`=`) still works while typing. Live **zoom percentage** displayed next to the bottom-center Controls, reading the React Flow transform directly so it updates as the user pans / zooms.
- **FL-SE4 Select path between** — palette command active for a 2-entity selection. New `findPath(doc, from, to)` in [src/domain/graph.ts](src/domain/graph.ts) does directed BFS first, falls back to undirected, returns the ordered entity + edge ids. Toast on no-path. Selects everything on the path.
- **FL-SE5 Successors / Predecessors** — `Cmd/Ctrl+Shift+→` selects all reachable entities downstream from the current selection; `Cmd/Ctrl+Shift+←` does the upstream walk. Palette commands mirror the keyboard. New pure helpers `reachableForward` / `reachableBackward` in `graph.ts`. Cycle-safe via a visited set.
- **Navigate palette group** — search, path, successors, predecessors, and a quick "Fit view" command now live under a dedicated Navigate group.
- **Help dialog updated** with the new shortcuts.
- **Tests: 138 → 154.** `tests/domain/search.test.ts` (9 cases: empty / case-insensitive / case-sensitive / whole-word / regex / `/pat/flags` shorthand / invalid regex / description match / group-title match). `tests/domain/graph.test.ts` gains 7 cases for `reachableForward`, `reachableBackward`, and `findPath` (directed, undirected fallback, disconnected, self-loop). TypeScript + Biome clean. Production build 8.8 s.

**Verified live in the preview:** Cmd+F opens the panel and focuses the input; typing "order" finds 2 entity matches; minimap renders; live zoom percentage updates as the user pans / zooms.

## Session 10 — Iteration 2, Phase 3 (part 2): Bundle 11 collapse / hoist / nesting + AND arc

Completes Phase 3. Groups now collapse to a single node, hoist into a focused sub-view, nest with cycle detection, and promote children on delete. The AND-junction subtle arc lands as a separate overlay.

- **FL-GR5 Promote children on delete** ([documentSlice.ts](src/store/documentSlice.ts)). Deleting a nested group splices its `memberIds` into its parent group's `memberIds` in the exact slot the deleted group occupied — preserves member ordering relative to siblings. Top-level group deletion leaves members at the root.
- **FL-GR2 Nested groups + cycle detection** ([src/domain/groups.ts](src/domain/groups.ts)). New pure helpers: `findParentGroup`, `ancestorChain`, `descendantIds`, `wouldCreateCycle`, `computeCollapseProjection`, `visibleEntityIdsForHoist`. `addToGroup` rejects self-add and ancestor-into-descendant moves. `createGroupFromSelection` already accepted both entity IDs and group IDs — nested groups now work end-to-end. 12 new domain tests in [tests/domain/groups.test.ts](tests/domain/groups.test.ts).
- **FL-GR3 Collapse / expand** ([TPCollapsedGroupNode.tsx](src/components/canvas/TPCollapsedGroupNode.tsx) + [useGraphView.ts](src/components/canvas/useGraphView.ts)). When a group is collapsed, its member entities and nested groups are hidden; a single oversized labelled card with a member-count subline takes their place. Edges that cross the collapsed boundary are remapped to/from the collapsed-root and **aggregated** into one edge per (source, target) pair, with a `×N` count badge when more than one underlying edge maps to the same pair. Interior edges (both endpoints inside the same collapsed group) are dropped. Aggregated edges are non-selectable; single-underlying edges keep their original IDs so the EdgeInspector still works. Double-click a collapsed card to expand; the keyboard binds `→` to expand and `←` to collapse a selected group.
- **FL-GR4 Hoist into a group + breadcrumb** ([Breadcrumb.tsx](src/components/canvas/Breadcrumb.tsx), [uiSlice.ts](src/store/uiSlice.ts)). `uiSlice.hoistedGroupId` filters the canvas to that group's transitive entity members. Cross-boundary edges are dropped from view (stubs deferred — they need a clickable affordance to unhoist+select). A top-center breadcrumb pill shows `Document › Outer › Hoisted` with clickable segments; `Esc` unhoists one level; `Enter` on a selected group hoists into it.
- **Group inspector** ([GroupInspector.tsx](src/components/inspector/GroupInspector.tsx)) gains **Collapse / Expand** and **Hoist into group** buttons. The collapse button toggle-mirrors the group's `collapsed` state with appropriate chevron iconography.
- **Palette commands.** New commands: *Collapse / expand selected group*, *Hoist into selected group*, *Exit hoist*.
- **11.8 AND-junction subtle arc** ([ANDOverlay.tsx](src/components/canvas/ANDOverlay.tsx)). A non-interactive SVG overlay rendered inside the React Flow viewport. For each `andGroupId` with ≥2 edges sharing a target, draws a violet quadratic-bezier arc just above the target connecting the inferred approach points of the sibling edges. Pans and zooms with the canvas via React Flow's transform store.
- **X-Group-5 CLR interaction.** `validate(doc)` is unchanged — the open-count toast still reports every warning. The inspector naturally suppresses per-entity warnings while an entity is inside a collapsed group because the entity is not selectable (the inspector simply can't surface them). No on-canvas warning markers exist today, so no additional gating is needed.
- **Tests: 120 → 138.** 12 cases in `tests/domain/groups.test.ts` (parent / ancestor / descendant / cycle detection / collapse projection / hoist visibility), 6 added in `tests/store/groups.test.ts` (promote-on-delete, addToGroup cycle guard for self and ancestor, hoist / unhoist actions). TypeScript + Biome clean. Production build 9.7 s.

**Known follow-ups parked for later:** cross-boundary edges in hoist view as labelled stubs (need a navigable affordance per PRD), an on-canvas warning marker per entity (so X-Group-5 has something to suppress), drag-into-group from the canvas (today members are added via the palette / multi-selection flow).

## Session 9 — Iteration 2, Phase 3 (part 1): Bundle 11 group foundation

Schema v2 → v3 plus the core group create / edit / delete loop. Collapse, hoist, nested groups, the AND-junction arc, and the CLR interaction land in a follow-up.

- **Schema v3.** New `Group` type with brand `GroupId`; `TPDocument.groups: Record<string, Group>`. A group carries `title`, fixed-palette `color` (slate / indigo / emerald / amber / rose / violet), ordered `memberIds`, `collapsed`, timestamps. Members may eventually be `EntityId | GroupId` (nested); for now `createGroupFromSelection` accepts either, but no UI yet creates nested groups.
- **Migration v2 → v3.** Adds an empty `groups: {}` map; existing entity / edge data unchanged. Round-trips through `importFromJSON`. New test case in `tests/domain/migrations.test.ts`.
- **Persistence.** `importFromJSON` validates groups (color from a closed set, `memberIds` are strings, `collapsed` boolean). Export round-trips them.
- **Store actions** ([documentSlice.ts](src/store/documentSlice.ts)): `createGroupFromSelection`, `deleteGroup`, `renameGroup`, `recolorGroup`, `addToGroup`, `removeFromGroup`, `toggleGroupCollapsed`. `deleteEntity` and `deleteEntitiesAndEdges` scrub deleted IDs from every group's `memberIds` so groups never reference dead entities.
- **Group rendering** ([TPGroupNode.tsx](src/components/canvas/TPGroupNode.tsx) + [useGraphView.ts](src/components/canvas/useGraphView.ts)). Groups render as a non-interactive labelled dashed rounded rectangle behind their members, computed from each member's layout position with 24 px padding. Clicking the title selects the group. Each of the six colors has its own light + dark Tailwind class set.
- **Group Inspector** ([GroupInspector.tsx](src/components/inspector/GroupInspector.tsx)). Edit title, pick a color (6 swatches), see member count, delete the group (with confirm — "Members will be preserved").
- **Palette commands**: "Group selected entities" creates a group from the current multi-selection; "Delete selected group" deletes a single-selected group. New "Groups" palette group.
- **Tests: 109 → 120.** New `tests/store/groups.test.ts` (10 cases) covering create, partial-validity filtering, rename/recolor/toggle, add/remove member, delete (preserves members), and scrub-on-delete for both single- and bulk-delete paths. New migrations case for v2 → v3. TypeScript + Biome clean.

**Still pending in Phase 3:** nested groups + cycle detection (FL-GR2), collapse/expand with aggregated cross-boundary edges + arrow-key expand (FL-GR3), hoist + breadcrumb (FL-GR4), promote-children-on-delete (FL-GR5), CLR-suppression in collapsed groups (X-Group-5), AND-junction subtle arc (11.8).

## Session 8 — Iteration 2, Phase 2: Bundle 2 multi-select + right-click multi-edge

Selection model overhauled to support multi-entity / multi-edge selection; bulk actions wired across the inspector, context menu, keyboard handler, and palette.

- **Selection model.** `Selection` is now `{ kind: 'none' } | { kind: 'entities'; ids } | { kind: 'edges'; ids }`. New store actions: `selectEntity`, `selectEdge`, `selectEntities`, `selectEdges`, `toggleEntitySelection`, `toggleEdgeSelection`, `clearSelection`. Mixed entity+edge selection is intentionally not supported — the inspector has one render path per kind.
- **Marquee + Shift-click.** React Flow's `selectionOnDrag` is enabled; drag-rectangle on the empty canvas selects nodes inside. `multiSelectionKeyCode="Shift"` toggles individual nodes / edges into the current selection. Canvas mirrors React Flow's selection truth via `onSelectionChange`.
- **Alt+click connect** ([Canvas.tsx](src/components/canvas/Canvas.tsx)). With one entity selected, Alt-clicking another creates an edge from the current to the clicked entity.
- **Multi-selection inspector** ([MultiInspector.tsx](src/components/inspector/MultiInspector.tsx)). When N>1 entities are selected: bulk "Convert all to…" + "Swap entities" (exactly 2) + bulk delete. When N>1 edges are selected: "Group as AND" / "Ungroup AND" + bulk delete. Reports whether the selected edges share a target so the user knows whether AND-grouping is possible.
- **Right-click on a multi-selection** ([ContextMenu.tsx](src/components/canvas/ContextMenu.tsx)). For ≥2 selected edges, the top items are "Group as AND" + (when any are already grouped) "Ungroup AND" + bulk delete. For ≥2 selected entities, the items are "Swap entities" (if exactly 2) + "Convert all to" (each type) + bulk delete. Single-entity right-click still shows the original menu.
- **Bulk delete confirm** ([confirmations.ts](src/services/confirmations.ts)). `confirmAndDeleteSelection()` computes the cascade size (entities + every edge that touches them, or edges-only) and fires a single confirm. Keyboard `Delete` / `Backspace` and palette / context-menu deletion all route through it.
- **Cut / Copy / Paste** ([clipboard.ts](src/services/clipboard.ts)). Module-scoped within-document clipboard. `Cmd+C` copies the entity multi-selection plus the edges that are entirely inside it; `Cmd+X` cuts; `Cmd+V` pastes with new IDs, remapped edge endpoints, fresh annotation numbers in sequence, and the newly-pasted entities pre-selected. Pasting twice produces independent copies.
- **Swap two entities** ([documentSlice.ts](src/store/documentSlice.ts)). `swapEntities(a, b)` swaps title/type/description/annotation/confidence while keeping the same `id`s pinned — edges stay attached to the same positions but read as the opposite content. Triggered via `Cmd+Shift+S`, the palette command "Swap selected entities", the multi-entity inspector button, and the 2-entity right-click menu.
- **Keyboard map.** New shortcuts: `Cmd+C` / `Cmd+X` / `Cmd+V` for clipboard; `Cmd+Shift+S` for swap. Delete now bulk-deletes the whole selection in one prompt. Single-entity Tab / Enter / Arrow navigation paths preserve their previous behavior.
- **Tests: 99 → 109.** New `tests/services/clipboard.test.ts` (6 cases) covers copy/paste/cut, twice-paste independence, annotation-number sequencing, and post-paste selection. `tests/store/document.test.ts` gains `swapEntities` (2) and `deleteEntitiesAndEdges` (2). All existing tests still green. TypeScript + Biome clean.

## Session 7 — Iteration 2, Phase 1: Bundle 13 + animated inspector + tier-2 hint

Settings + visual prefs + Browse Lock + Document Inspector. Sets up the schema fields and UI scaffolding the rest of the iteration leans on.

- **Schema v1 → v2.** Each entity now carries a stable `annotationNumber` (1..N per document, assigned at creation, never reused). The document carries `nextAnnotationNumber`, optional `author`, optional `description`. Forward-only migration in `migrations.ts` walks v1 entities by `createdAt asc, id asc` and assigns 1..N; existing JSON imports keep working.
- **Theme.** New `highContrast` theme layered on top of `dark`. Pure-black body, pure-white text, thicker focus rings. `theme-hc` class on `<html>`.
- **Edge palettes** ([src/domain/tokens.ts](src/domain/tokens.ts)). `default`, `colorblindSafe` (Wong), `mono`. Driven by `uiSlice.edgePalette`.
- **Animation speed pref.** `--anim-speed` CSS variable consumed by every transition-duration via `calc(Xms * var(--anim-speed))`. `instant` collapses to zero.
- **Settings dialog** ([src/components/settings/SettingsDialog.tsx](src/components/settings/SettingsDialog.tsx)). Theme, edge palette, animation speed, browse lock, show annotation numbers, show entity IDs. Opens via `Cmd+,` and the "Settings…" palette command.
- **Document Inspector** ([src/components/settings/DocumentInspector.tsx](src/components/settings/DocumentInspector.tsx)). Edit document title, author, description; shows entity/edge counts. Opens via the title-area info icon and the "Document details…" palette command.
- **TPNode badges** (toggle-driven). `#N` pill in the top-right when "Show annotation numbers" is on; mono-font entity ID below the title when "Show entity IDs" is on. Titles now clamp to two lines.
- **Inspector slide-in.** Tailwind's `duration-200` swapped for the `.inspector-aside` CSS class so the transition scales with the user's animation-speed preference.
- **First-entity tip.** Once the user places their first entity (and until they dismiss it), a small bottom-center panel hints at Tab / drag-to-connect / `Cmd+K`.
- **Browse Lock**. TopBar lock button toggles read-only mode. A guard service ([src/services/browseLock.ts](src/services/browseLock.ts)) gates every UI write entry point (canvas double-click, drag-to-connect, deletions, palette commands, keyboard shortcuts, context menu, entity/edge inspectors, document title). When locked, attempts show a single toast; React Flow's `nodesConnectable` is disabled; every inspector input/button is `disabled`.
- **Tests: 94 → 99.** New `setDocumentMeta` cases in `tests/store/document.test.ts`; new `tests/services/browseLock.test.ts`. TypeScript + Biome clean.

## Session 6 — Iteration 2, Phase 0: Foundations

Tooling and infrastructure that catches regressions throughout the rest of the iteration. No user-visible changes; the canvas is unchanged.

- **F0.1 GitHub Actions CI** ([.github/workflows/ci.yml](.github/workflows/ci.yml)) — runs lint + type-check + Vitest + build on every push and pull request. Concurrency group cancels stale runs.
- **F0.2 Pre-commit hook** via `simple-git-hooks` + `lint-staged`. Biome runs on staged files; failing files block the commit. Installs on `pnpm install` via the `postinstall` script.
- **F0.3 Conventional-commits commit-msg hook** ([scripts/check-commit-msg.cjs](scripts/check-commit-msg.cjs)) — rejects messages that don't follow `type(scope)?: subject` with one of 11 allowed types. Merge / revert / fixup messages are skipped.
- **F0.4 `.editorconfig`** — UTF-8, LF, 2-space indent, trim trailing whitespace, insert final newline. Markdown opts out of trim (preserves trailing-space line breaks).
- **F0.6 Schema migration framework** ([src/domain/migrations.ts](src/domain/migrations.ts)) — forward-only migration loop with a `MIGRATIONS` registry and a `CURRENT_SCHEMA_VERSION` constant. `importFromJSON` walks documents forward to current before validating. Registry is empty today; Phases 1, 3, 6 will register migrations as they add schema fields. 5 new vitest cases.

F0.5 Storybook is deferred to a separate turn (Windows AppLocker risk on `npx storybook init`).

**Tests: 87 → 94.** TypeScript + Biome clean.

## Session 5 — Documentation pass

- Expanded [README.md](README.md) with quick start, performance hooks, type-safety hooks, storage seam, and a CLR rules table.
- New end-user manual: [USER_GUIDE.md](USER_GUIDE.md).
- New roadmap / parking lot: [NEXT_STEPS.md](NEXT_STEPS.md).
- This changelog.

## Session 4 — Maintainability round 3 + honorable mentions  (`3d5d0ae`)

**Top 10 under-the-hood improvements:**

1. **Node version pin.** `.nvmrc`, `.npmrc` (`engine-strict=true`), `package.json` engines field, and a preinstall guard script.
2. **Shared guards module** ([src/domain/guards.ts](src/domain/guards.ts)) — `isObject`, `isDiagramType`, `isEntityType`, `isEdgeKind`, `isStringArray`, `isTrueMap`.
3. **Stricter JSON import validation.** Every entity/edge field shape is checked; malformed input throws a descriptive `path.to.field` error.
4. **Manual Vite chunks.** Build splits into `react` / `flow` (xyflow + dagre) / `icons` (lucide) plus app chunks.
5. **Lazy `html-to-image`.** Dynamic import inside `exportPNG`; library ships only on first PNG export.
6. **`QuotaExceededError` handling** in storage.ts with a listener wired to a destructive toast.
7. **Debounced persistence.** New `src/services/persistDebounced.ts` — 200 ms idle write, synchronous flush on `Cmd+S` / `setDocument` / undo / redo / `beforeunload` / `visibilitychange`.
8. **Memoized layout + validation** via structural fingerprints in `src/domain/fingerprint.ts`. Title edits skip dagre.
9. **Warnings indexed by target id** in the Inspector. Replaced two O(N) `.filter()` passes with O(1) `Map` lookups.
10. **Tests for `slug` (8 cases) and `confirmAndDeleteEntity` (6 cases).**

**Honorable mentions:**

- **Brand types** `EntityId` / `EdgeId` / `DocumentId` — phantom-branded strings used across the domain layer, factory casts at the boundary.
- **`useShallow`** for multi-field store selectors in `useGlobalKeyboard` (11) and `Canvas` (6).
- **Preinstall script** (covered by item 1).
- **Tests for `useGlobalKeyboard`** — 11 RTL cases covering every shortcut.
- **`inert` attribute** on the collapsed Inspector for sequential-focus and screen-reader correctness.

**Tests: 62 → 87.**

## Session 3 — Maintainability round 2  (`5cea9ef`)

1. Storage abstraction module (`src/services/storage.ts`) replaced three independent feature-detection blocks.
2. RootStore type extracted to `src/store/types.ts` — broke the circular import between `index.ts` and the slice files.
3. Typed `canvasRef` singleton with `ReactFlowInstance<TPNode, TPEdge>`.
4. Toast IDs switched to `nanoid` (string) from `Date.now() + Math.random()` to avoid millisecond collisions.
5. New `useSelectedEntity` / `useSelectedEdge` / `useEntity` / `useEdge` hooks in `src/hooks/useSelected.ts`.
6. `ErrorBoundary` wraps `<App />` in `main.tsx`.
7. Direct tests for `src/domain/graph.ts` helpers — 10 cases.
8. `resetStoreForTest` helper. Each slice exports a `*Defaults()` factory; test setup uses the composed defaults instead of hardcoding every field.
9. Path aliases (`@/*` → `src/*`) configured in tsconfig + vite; sweep updated 28 source + 6 test files.
10. `noUncheckedIndexedAccess` flag enabled in tsconfig with fixes throughout.

## Session 2 — Maintainability round 1  (`78cae7a`)

1. `src/domain/constants.ts` collects magic numbers (history limits, CLR thresholds, layout sizes, sibling-nav tolerance, PNG export params, toast TTL).
2. `src/domain/tokens.ts` is the single source for colors (entity stripes, edge strokes, surface, grid). Tailwind config imports it.
3. `src/domain/graph.ts` hosts shared graph queries used by validators, store, and confirmations.
4. `tsconfig.json` enables `noImplicitReturns`.
5. `Button` primitive ([src/components/ui/Button.tsx](src/components/ui/Button.tsx)) with primary / ghost / softNeutral / softViolet / destructive variants.
6. `Modal` primitive + `useOutsideAndEscape` hook ([src/components/ui/Modal.tsx](src/components/ui/Modal.tsx), [src/hooks/useOutsideAndEscape.ts](src/hooks/useOutsideAndEscape.ts)). CommandPalette, HelpDialog, ContextMenu all migrated.
7. `Inspector.tsx` split into six files — `Inspector`, `EntityInspector`, `EdgeInspector`, `EdgeAssumptions`, `AttachedEdgesList`, `Field`.
8. Strongly typed RF node/edge data via `src/components/canvas/flow-types.ts` (`TPNode` / `TPEdge`).
9. Zustand store split into `documentSlice` / `uiSlice` / `historySlice` combined in `store/index.ts`.
10. Architecture section added to README.

## Session 2 (continued) — Assumptions feature  (`1ab367e`)

End-to-end UI for the last brief schema feature.

- Store actions: `addAssumptionToEdge`, `attachAssumption`, `detachAssumption`; cascade-delete scrubs assumption ids from edges.
- Edge inspector gains an "Assumptions" section with inline create / edit / detach / open.
- Entity inspector for an assumption entity shows an "Attached to" list of referring edges.
- 5 new tests in `tests/store/document.test.ts`.

## Session 2 — Brief-completing additions  (`1dad461`)

- Delete confirmation when an entity has connections.
- `Cmd+E` opens the palette pre-filtered to Export.
- "Run validation" palette command surfaces a toast with open / resolved counts.
- "Load example CRT" / "Load example FRT" palette commands populate a small pre-wired diagram.
- AND-junction dot rendered as a violet circle on each AND-grouped edge near the target — sibling dots stack into one visual junction.

## Session 2 — Deferred items, second pass  (`cf9ea33`)

- Tests for store mutations: groupAsAnd, ungroupAnd, undo with coalescing, history cap, persistence side-effect. **+12 tests.**
- Convert-type section in the entity context menu.
- Toast notifier (`Toaster.tsx`); `Cmd+S` triggers a success toast.
- Help dialog (`HelpDialog.tsx`) listing all keyboard shortcuts, reachable via palette and a HelpCircle button.
- Left/Right arrow keys move selection between same-rank siblings using live React Flow positions.

## Session 2 — Address flagged issues  (`1b95592`)

The first review surfaced gaps; this commit closed them.

- AND-grouping: store actions + multi-edge selection + palette commands + edge styling.
- Arrow-key navigation: ArrowUp follows an outgoing edge, ArrowDown follows incoming.
- Right-click context menu: entity (Add child / Add parent / Rename / Delete), edge (Delete), pane (New entity here).
- Layout animation via CSS transition on `.react-flow__node`.
- Bug fixes caught by the preview: React Flow had no measurable parent (switched to `h-screen`); Tailwind utilities weren't processing in dev (PostCSS config inlined into vite.config.ts); React Flow's default `zoomOnDoubleClick` was eating the pane double-click (disabled).

## Session 1 — Slice D: Export pipeline  (`1069e38`)

JSON download, JSON import (with file picker), PNG export at 2× resolution via `html-to-image`. A module-scoped React Flow instance ref lets palette actions reach into the live canvas from outside the React tree.

## Session 1 — Slice C: Inspector + palette + keyboard + theme  (`05ce890`)

Right inspector with title/description editing, type switcher, CLR warnings with Resolved/Reopen toggles. `Cmd+K` command palette with arrow/Enter nav. Global keyboard map. Undo/redo with 1 s coalescing window and 100-entry history. Dark mode toggle persisting to localStorage.

## Session 1 — Slice B: Canvas  (`6df5d16`)

React Flow + custom `TPNode` (colored stripe, inline title editing) + `TPEdge` (sufficiency arrow). Zustand store for document state. `useGraphView` bridges store doc → React Flow nodes/edges via dagre layout (bottom-to-top). Double-click to create, drag-handle to connect, click to select.

## Session 1 — Initial scaffold  (`98b4692`)

- Vite 5 + React 18 + TypeScript strict + Vitest + Biome.
- Domain layer first per the brief: types, 8 CLR validators (with 20 tests covering positive + negative for each rule), dagre layout wrapper, JSON + localStorage persistence with round-trip tests.
- **Tests: 35 green.**
