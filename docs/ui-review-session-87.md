# UI review — Session 87

**Method:** Static walkthrough of TP Studio's 8 primary UI surfaces (canvas, inspector, top-bar, command palette, settings, print dialog, templates picker, creation wizard) plus cross-cutting primitives (toaster, context menu, empty/first-entity hints). Read ~12 component files at HEAD `bdb1b21`. No screenshots yet — a visual pass will follow once the EC PPT comparison agent (background task `a257994b1d814eb54`) lands so the canvas/inspector/wizard surfaces are stable.

Findings are concrete (file paths + lines where useful) and triaged by effort + design ambiguity.

> **Caveat:** the EC PPT agent is currently mutating `Canvas.tsx`, `Inspector.tsx`, `CreationWizardPanel.tsx`, `verbalisation.ts`, `TPEdge.tsx`. Five EC-specific findings below are flagged ⚠️ — verify against the agent's final commit before lifting them into the backlog. They may have been addressed or made moot.

---

## Quick wins — ship as a single "UI tidy" batch (effort S, no design ambiguity)

1. **Browse-Lock icon swap is confusing.** `TopBar.tsx:75` — when locked, the button shows a `Lock` icon (correct: "currently locked"). When unlocked, it shows `Unlock` (confusing: looks like the action, not the state). Pick one icon and toggle color/state via the existing `softViolet`/`softNeutral` variant — that's already how the History toggle reads. Today's icon swap fights the variant swap.

2. **Print-dialog merge-field preview shows empty for `{pageNumber}` / `{pageCount}`.** `PrintPreviewDialog.tsx:88-89` — the resolver intentionally strips them to empty strings (browsers control running headers), but they're listed in the help text as if they work, and the preview shows the field with them silently removed. Either (a) drop them from the help text + leave them un-stripped so the user sees `{pageNumber}` literally if they type it, or (b) keep stripping but say "(filled by browser at print time)" in the help.

3. **Empty-state hint is too narrow.** `EmptyHint.tsx:13-15` — only suggests double-click. Add two more entry paths: "press `Cmd+K` for commands" and "or pick a Template from the palette." Doesn't add layout pressure since the card has room.

4. **Palette section headers are `aria-hidden="true"`.** `CommandPalette.tsx:163` — screen readers can't announce that they've crossed from File → Edit → View. Either drop the aria-hidden so the headers are announced as static text, or wrap each section in `<section role="group" aria-label="File commands">` and let the section element carry the label.

5. **Two creation-wizard toggles where one would do.** `SettingsDialog.tsx:250-260` — "Show Goal Tree creation wizard" and "Show Evaporating Cloud creation wizard" are independent today. Most users want one consistent behavior across diagram types. Collapse to a single "Show creation wizards for new documents" toggle, OR keep two but group them visually under a shared "Creation wizards" sub-heading inside the Behavior section.

6. **Animation speed "Default" label doesn't say what default means.** `SettingsDialog.tsx:31-35` — radio options are Instant / Slow / Default / Fast with no hint on "Default." Either add a hint ("App default — 200 ms") or rename "Default" → "Normal" so it parses as a member of the speed axis.

7. **`{pageNumber}` / `{pageCount}` aren't listed in the merge-field help row** for the Footer template input. `PrintPreviewDialog.tsx:295-297` — the Header help row lists `{title}` `{date}` `{author}` `{diagramType}`. Footer lists nothing. Either repeat the row or move it above both inputs.

8. **Canvas double-click toast on Browse Lock is silent about *why*.** `Canvas.tsx:100` — `guardWriteOrToast()` fires a generic "Browse Lock is on" toast. Add a one-liner: "Browse Lock is on — disable in Settings → Behavior or the top-bar lock icon." Same upgrade applies wherever `guardWriteOrToast()` is called.

9. **Toaster collides with React Flow Controls.** `Toaster.tsx:28` is `bottom-6`; the Controls bar is at `bottom-center` (~`bottom-2`). On a narrow viewport with multiple toasts stacking, the lowest toast sits ~6px above the zoom buttons. Either bump Toaster to `bottom-20` (clear of Controls) or move Controls to a different anchor (top-center is taken by the EC verbalisation strip; left-center is free).

---

## Polish — individual fixes, can ship anytime (effort S–M)

10. **Settings dialog has no section anchor / quick-nav.** `SettingsDialog.tsx:220-363` — Appearance / Behavior / Display / Layout sections render top-to-bottom in a single scroll container with `max-h-[70vh]`. With 15+ controls users scroll a lot. Add a slim left-rail TOC (4 short links) or a sticky section header that highlights the current section on scroll. Effort: S.

11. **Theme picker is a long radio list.** `SettingsDialog.tsx:222` — 7 themes as radio buttons. Better: a grid of color swatches (2 rows × 4) with the theme name below each. Lets the user *see* the difference before committing. Effort: M (new component or extend `RadioGroup`).

12. **Layout-direction labels use abbreviations.** `SettingsDialog.tsx:73-77` and `:55-64` — `BT` / `TB` / `LR` / `RL` labels with optional hints. Many users skim past hints. Replace primary labels with the long form ("Bottom → Top") and demote the abbreviation to a secondary caption. Effort: S.

13. **Templates picker has no filter.** `TemplatePickerDialog.tsx:94-143` — 10 cards in a grid. At 10 it's fine; if the library grows (and Iteration 2 mentioned it will), an input filter or a diagram-type chip-bar would scale better. Effort: S as a preemptive add, M when needed.

14. **Templates picker commits on click — no preview.** `TemplatePickerDialog.tsx:106` — `onClick={() => handlePick(spec.id)}` immediately calls `setDocument(doc)` and closes. The thumbnail SVG is small. Consider a 2-step: hover/focus shows a larger preview pane on the right, click commits. Or add an Undo affordance in the success toast ("Loaded template: X. Undo?"). Effort: M.

15. **Context menu has no keyboard navigation.** `ContextMenu.tsx:449-498` — `role="menu"` is set, but there's no arrow-key handler. A user opening the menu via Shift+F10 (or the in-progress "context menu key") can't walk the items. Add ArrowUp/Down to walk, Enter to activate, Esc to close. Effort: M.

16. **Command palette has no command icons.** `CommandPalette.tsx:113-114` — rows are pure text + optional kbd. Adding a lucide icon per command (already implicit via `cmd.group`) would speed scanning. Effort: M (touches the `Command` type + every command definition).

17. **Command palette has no "recent" section.** `CommandPalette.tsx:39-66` — unfiltered view groups by category. A small sticky "Recent (3-5)" group at the top, persisted to localStorage, would speed power-user flow. Effort: M.

18. **Creation wizard panel can't be moved.** `CreationWizardPanel.tsx:251` — fixed at `top-14 left-4`. If the user wants to work in the top-left of the canvas, they're stuck minimising. Add drag-to-reposition (or at least a "snap to corner" option). Effort: M.

19. **First-Entity Tip's keyboard hints are partial.** `FirstEntityTip.tsx:34-49` — covers Tab + drag + `Ctrl+K`. Doesn't mention how to rename (Enter / F2) or how to delete (Backspace / Del). Effort: S.

20. **Print-dialog mode buttons have no visual preview.** `PrintPreviewDialog.tsx:237-253` — 3 buttons with label + hint paragraph below. A small inline thumbnail per mode (workshop = bold large text; ink-saving = greyscale) would help the user pick without clicking through. Effort: M (3 small inline SVGs or screenshot images).

21. **Inspector close X is below the section selector tabs on EC docs.** `Inspector.tsx:96-109` — the header (with the close X) renders BEFORE the EC tab bar. On EC docs the tab bar pushes content down but the X stays anchored top. Visually fine, but the X is now two visual rows above the active content. Consider moving the X *into* the tab bar row when EC, or making the tab bar the header on EC docs.

22. **Templates picker thumbnail uses `dangerouslySetInnerHTML`.** `TemplatePickerDialog.tsx:121-122` — the comment justifies it ("trusted SVG"), and the source is curated, but the pattern is fragile if a future contributor wires user input into `templateThumbnailSvg`. Consider returning a JSX tree from `templateThumbnailSvg` instead of a string. Effort: M (refactor of the thumbnail builder).

---

## Bigger asks — design conversation first (effort M+)

23. **Inspector doesn't dismiss on Esc consistently.** `Inspector.tsx` — Esc is handled at the global keyboard layer (probably via `useGlobalKeyboard`); the inspector's own component doesn't catch it. The other dialogs (Settings, Print, Templates) catch Esc locally. Inconsistency means users don't trust Esc. Decide on one model — local handlers per modal/panel, or a global "topmost overlay catches Esc" registry. Effort: M.

24. **No global "current state" indicator.** TitleBadge shows title + diagram type. The TopBar shows toggles. There's no single "I'm in EC mode, 5 entities, 1 unresolved warning, lock on" status line. With many concurrent state pieces (lock, hoist, history-panel-open, wizard-active, search-open), a thin status strip at the top or bottom of the canvas would help. Effort: M (new component) — but design question: where does it go without crowding existing chrome?

25. **Settings dialog grows linearly with features.** `SettingsDialog.tsx` is 367 lines for one component. Each new toggle is mechanical to add but the dialog is approaching the limit of what's comfortable in a single scroll. Time to consider tabs (Appearance / Behavior / Display / Layout / About). Effort: M.

26. **No "global undo" surface.** Cmd+Z works (via the History panel infrastructure), but there's no visible affordance in the UI. A small "Undo" button next to the Browse-Lock in the TopBar would surface it. Effort: S to add the button, M+ if you want a proper "What did I just do?" preview.

27. **Canvas alt+drag-to-splice is invisible.** `Canvas.tsx:120-158` — the destructive Alt-modifier gesture is documented nowhere in the UI. A user accidentally holding Alt while dragging could trigger it. Add a hint to FirstEntityTip mentioning Alt+drag, OR show a brief overlay when the user starts dragging with Alt held ("Drop on an edge to splice"). Effort: M (overlay state machine).

28. **Marquee selection is a hidden gesture.** `Canvas.tsx:223` — `selectionOnDrag` enabled by default. New users don't know they can drag-to-select rectangles. The palette has "Select all" but not "Marquee mode toggle." First-Entity Tip is one place to surface it; the help dialog is another. Effort: S to add hints; M to add a visual marquee-mode indicator.

29. **Browse Lock toast cascade.** When the user tries to edit while locked, `guardWriteOrToast()` fires a toast. If they trigger multiple edits in quick succession (e.g. typing in a field), they may get multiple stacked toasts. The Toaster dedupes by message identity (per Session 68/83 notes) — verify this is working on the lock-toast specifically, and if not, add an explicit `dedupeKey: 'browse-lock'`. Effort: S to verify; S to fix.

---

## EC-specific findings — verify after Session 87 agent lands ⚠️

The EC PPT comparison agent (background task) is currently editing these surfaces. Cross-check before adding to the backlog:

30. ⚠️ **EC Inspector tab bar has 3 tabs (Inspector / Verbalisation / Injections).** `Inspector.tsx:116-141`. The agent may be adding a 4th (per item #6's assumption-bubbles work or #7's injection-summary work). At 4+ tabs the row gets crowded on narrow viewports — consider a dropdown / overflow menu pattern, or moving Verbalisation to a strip *above* the canvas (it's already there!) and keeping Injections in the inspector.

31. ⚠️ **Verbalisation strip overlays the canvas top.** `Canvas.tsx:263-268` and `verbalisation.ts`. It's `pointer-events-auto` on a `pointer-events-none` wrapper — clicking inside the strip works, clicking through it to the canvas doesn't. On a narrow EC canvas (< 600px), the strip eats vertical space. Consider a "collapse" toggle so the strip can be hidden when not needed.

32. ⚠️ **EC wizard steps don't say what slot each step maps to.** `CreationWizardPanel.tsx:65-86` — step prompts mention "Need B" / "Want D" but not visually which one of the 5 pre-seeded boxes will receive the answer. A small inline EC-shape indicator highlighting the target slot per step would help first-time users. Effort: M. *(This pairs naturally with the EC PPT comparison agent's "per-slot guiding questions" work — possibly already addressed.)*

33. ⚠️ **EC mutex visual is a unicode ⚡** versus the PPT's hand-drawn lightning. Dann's decision from earlier: not worth changing. Leave as-is.

34. ⚠️ **EC inspector's Assumption Well and Injection Workbench live behind tabs** — addressed by EC PPT comparison agent's #6 and #7 (assumption-count badge on canvas, injection-summary strip). After the agent lands, verify the badges are discoverable; if not, the "click-to-open-tab" affordance may need a hover preview.

---

## Cross-cutting / tech-debt

35. **Magic-number spacing throughout JSX.** `top-4`, `top-14`, `bottom-6`, `bottom-24`, `left-4`, `right-4` are inline numbers. A small `LAYER_OFFSETS` constants module (mirror of `Z_LEVELS` in `domain/zLayers.ts`) would centralize them. Effort: M.

36. **Inconsistent focus-ring patterns.** Some inputs use `focus:ring-2 focus:ring-indigo-300`, others `focus:border-indigo-400 focus:ring-1`. Pick one and document it in `src/components/ui/`. Effort: S (find/replace + biome format).

37. **Tailwind breakpoint usage is mixed.** Some components hide things at `sm` (640px), some at `md` (768px), some at the custom `xs` (480px) added in Session 83. The mapping (which feature appears at which width) lives only in JSX. A short table in `docs/` or a comment header on `src/components/toolbar/TopBar.tsx` explaining the breakpoints would help future contributors. Effort: S (docs only).

38. **Dialog widths are inconsistent.** Settings = `max-w-md` (~448px); Print = `min(640px, 92vw)`; Templates = `min(960px, 94vw)`; CommandPalette = `max-w-lg` (~512px). The sizing logic isn't visible at a glance. Either standardize on three sizes (sm / md / lg) in the `Modal` primitive or add a comment explaining the rationale per dialog. Effort: S (docs); M (refactor).

39. **`useFocusTrap` adoption is uneven.** Print dialog + Templates picker use it. Settings dialog uses `Modal`'s built-in (presumably). CommandPalette uses `Modal`. The Creation wizard *doesn't* — it's not a modal but it does steal focus on open. Consistency would prevent surprise behaviors. Effort: M (audit + fix).

40. **No screenshot / visual-regression coverage for dialogs.** Storybook covers 6 small primitives. The 8 surfaces here aren't covered. The 1-hour pass already rejected Storybook visual regression infra; consider Playwright snapshot specs for these surfaces as a follow-up. Effort: M.

---

## Recommended next steps

1. **Quick wins (items 1-9)** — bundle into one "UI tidy" commit (~2 hours). Mechanical fixes, no design work, no test changes beyond verification.
2. **Polish (items 10-22)** — pick 3-5 that align with what you're working on next. Items 10 (Settings TOC), 11 (theme swatches), 12 (long-form direction labels), and 16 (palette icons) are user-visible wins.
3. **Bigger asks (items 23-29)** — these need a Dann decision. Item 23 (Esc handling) is the most cross-cutting; doing it well unblocks the others. Item 25 (Settings tabs) becomes inevitable as the Settings dialog grows.
4. **EC-specific (items 30-34)** — wait for the EC PPT comparison agent to ship, then re-walk these. Half may be already done.
5. **Cross-cutting (items 35-40)** — schedule these into a future focused-1-hour-pass; they're tech-debt fixes that pay long-term dividends.
6. **Visual walkthrough** — once the EC PPT agent lands, drive the live app via Chrome MCP or Claude Preview and capture screenshots + spacing/contrast/motion-level issues that this static review can't see.

---

**Total findings: 40** (9 quick wins, 13 polish, 7 bigger asks, 5 EC-specific, 6 cross-cutting).
