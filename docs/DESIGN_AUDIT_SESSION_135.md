# Design Audit — Session 135

Code-only review (no app run) of inspector, dialog chrome, canvas overlays, and shared primitives. Ranked high → low by combined impact and reach.

---

## High impact

### 1. `Field` label is a `<span>` / `<div>` — not a real `<label>` — so most inspector controls have no semantic name
`src/components/inspector/Field.tsx:6–14` wraps every inspector control in a presentational span/div labelled "Title", "Type", "Polarity", "State", etc., but never emits a `<label htmlFor>`. EntityInspector's Title textarea now papers over this with an explicit `ariaLabel="Entity title"` (EntityInspector.tsx:95) — a workaround Dann added for axe — but most other Fields (Polarity buttons, State buttons, Locus buttons, the Owner TextInput at EntityInspector.tsx:237, the Attestation TextArea at EntityInspector.tsx:223, the Label TextInput at EdgeInspector.tsx:87) inherit no accessible name. Screen readers announce them as bare textboxes/buttons.
**Fix:** make `Field` render a real `<label>` (with auto-generated `useId`) when the control is a single input, and a `<fieldset><legend>` when the control is a button group. Inspectors then stop hand-rolling `ariaLabel` on each TextInput.

### 2. Three different "uppercase tiny label" sizes are in use for the same semantic role
- `Field` label = `text-[10px]` (Field.tsx:7)
- Inspector header label = `text-[11px]` (Inspector.tsx:105)
- Settings `<Section>` title = `text-[10px]` (formPrimitives.tsx:21)
- PrintPreviewDialog `<legend>` Mode = `text-[11px]` (PrintPreviewDialog.tsx:380)
- CompareBanner "VISUAL DIFF" eyebrow = default size (CompareBanner.tsx:55) — no explicit `text-[Npx]`, so renders at the parent `text-xs`
- Tab labels (Inspector.tsx:139, SettingsDialog.tsx:69) mix `text-[11px]` with `tracking-wide` vs `tracking-wider`

Three sizes for the same "eyebrow / section label" role. They look the same to a casual eye and the inconsistency is invisible until you put two next to each other.
**Fix:** define a single `.eyebrow` token (e.g. `text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400`) and use it from Field, Section, the Inspector header, the dialog legends, and the tab bars.

### 3. The Inspector header label is more prominent than any Field label, but is the same visual class
Inspector.tsx:104 renders the panel-level header ("ENTITY", "EDGE", "GROUP", "MULTI") at `text-[11px] font-semibold uppercase tracking-wider text-neutral-500`. A `Field` label below it ("Title", "Polarity") renders at `text-[10px] font-semibold uppercase tracking-wider text-neutral-500`. One pixel font-size delta in the same color — nobody notices the header is meant to dominate. The information hierarchy is flat.
**Fix:** bump the inspector header to `text-xs text-neutral-700 dark:text-neutral-200` (drop uppercase entirely, or keep uppercase but use a darker tone) so the panel root reads as a heading and Field labels read as subordinate.

### 4. Two parallel "selected/unselected button" recipes drift across inspectors
The same selected-state pattern appears with three different layout wrappers:
- EntityInspector type picker (EntityInspector.tsx:111) — `rounded-md border px-2 py-1.5` + `_PLAIN`
- EntityInspector titleSize (EntityInspector.tsx:153) — same layout but `_CLASS` (text-color variant)
- EntityInspector Locus / State (EntityInspector.tsx:319, 363) — same layout
- EdgeInspector Polarity (EdgeInspector.tsx:169) — same layout
- PrintPreviewDialog mode picker (PrintPreviewDialog.tsx:391) — `rounded-md border px-3 py-2` (wider padding, mixes `SELECTED_BUTTON_CLASS` with `UNSELECTED_BUTTON_CLASS_PLAIN`)
- `RadioGroup` in formPrimitives.tsx:50 — `rounded-md border px-2.5 py-1.5` (third padding)

Three button paddings (px-2/px-2.5/px-3) for the same conceptual control. The shared constants in `buttonClasses.ts` factor the *color* but not the *shape*, exactly as the file's own comment admits — but no design token absorbs the shape either.
**Fix:** add a `TOGGLE_BUTTON_BASE` constant (`'rounded-md border px-2 py-1.5 text-xs transition disabled:cursor-not-allowed disabled:opacity-60'`) next to the existing color constants. Make `RadioGroup` and PrintPreviewDialog use the same base.

### 5. The PrintPreviewDialog mode picker mixes `SELECTED_BUTTON_CLASS` with `UNSELECTED_BUTTON_CLASS_PLAIN` — the unselected card has no text color
`PrintPreviewDialog.tsx:391`: `mode === m ? SELECTED_BUTTON_CLASS : UNSELECTED_BUTTON_CLASS_PLAIN`. The selected variant carries `text-indigo-900` but the unselected variant carries no `text-…` rule, so the inner `<div className="font-medium">{MODE_LABEL[m]}</div>` (line 399) inherits whatever the dialog body sets — currently the default (`text-neutral-900` from `FIELD_BASE`? No, this is a `<button>`, no parent text class). On the dark surface this label can fade below contrast.
**Fix:** use `UNSELECTED_BUTTON_CLASS` (the version *with* text colors) here. The card has no icon override that needs `_PLAIN`.

### 6. EntityInspector "Mark validated" inline button is hand-rolled and breaks the Button system
EntityInspector.tsx:256–263 builds a small validation-action button with a bespoke className stack (`rounded-sm border border-neutral-200 bg-white px-2 py-0.5 text-[11px] …`) that doesn't match any `Button` variant or any inspector toggle button. The Evidence row's equivalent button (EvidenceList.tsx:245) is *also* hand-rolled with yet another className stack. Two different "tiny outline action" looks for the same role.
**Fix:** add a `Button` `size: 'xs'` or a `variant: 'inlineGhost'` and route both callers through it.

### 7. The 18 `dark:bg-*/40` and `dark:bg-*/30` surfaces use inconsistent opacity for the same role
Quick grep across the audited files:
- Imported-from badge: `dark:bg-indigo-950/30` (EntityInspector.tsx:195)
- EC guiding question: `dark:bg-indigo-950/40` (EntityInspector.tsx:75)
- EC brainstorm prompt: `dark:bg-amber-950/30` (EdgeInspector.tsx:323)
- Evidence row: `dark:bg-neutral-900/40` (EvidenceList.tsx:157)
- AttributesSection add-row: `dark:bg-neutral-900` (no opacity) (AttributesSection.tsx:110)
- Edge inspector Cause/Effect card: `dark:bg-neutral-900` (no opacity) (EdgeInspector.tsx:74)
- Group inspector preset row hover: `dark:hover:bg-neutral-900` (GroupInspector.tsx:89)

Three opacity tiers (0%, 30%, 40%) for what is functionally the same "tinted card" treatment. The 30% versus 40% delta is invisible to the eye but the 0% (fully opaque) version reads as a noticeably heavier card on dark surfaces.
**Fix:** pick one opacity per role: tinted accent cards = `/40`, neutral inset cards = `/60`, and drop the 0% variants on tinted surfaces.

### 8. EdgeInspector renders the AND/OR/XOR group-id literally — it's a UUID, not a user-facing string
EdgeInspector.tsx:104–106: `<p className="font-mono text-neutral-600 text-xs">{edge.andGroupId}</p>`. The user sees the raw group id ("AND group: f0a3b6e2-…"). Same for OR (line 122) and XOR (line 140). Font-mono + truncate-less means it'll word-wrap awkwardly in the 320-px-wide inspector.
**Fix:** either drop the literal id (label says "AND group" already) and just keep the Ungroup button, or render a friendly short hash (`#3a2`) — the id itself isn't actionable from the inspector.

### 9. Many text-on-tinted-bg combinations probably miss WCAG AA in dark mode
Suspect pairings (each is a "light text on light-translucent tinted background"):
- `text-amber-300` on `bg-amber-950/30` (CompareBanner.tsx:66 — `bg-amber-100 text-amber-800` light variant is fine; the dark variant is `bg-amber-900 text-amber-100` which is roughly OK, but the surrounding banner is `bg-indigo-950/90` so the inner amber chip sits on a 90%-opaque indigo backdrop — contrast is undefined visually).
- EC guiding question dark: `text-indigo-100` on `bg-indigo-950/40` (EntityInspector.tsx:75). With the parent dialog `bg-neutral-950/95`, the effective background is dark neutral with a 40% indigo wash — text-indigo-100 over that is probably AA at body sizes but borderline at `text-[12px]`.
- Polarity selected-state: `dark:text-indigo-200` on `dark:bg-indigo-950/40` (buttonClasses.ts:34). The 40% opacity over `dark:bg-neutral-950` is the real concern — the selected button reads "almost the same as unselected" in dark mode.
**Fix:** bump every `/40` accent fill to `/60` on dark mode, OR drop opacity entirely on accent fills and use a darker base hue (`indigo-900` instead of `indigo-950/40`). A real Lighthouse pass would surface concrete fail offenders — flag for a11y walkthrough handoff.

### 10. Three different "card chrome" recipes exist for "tinted inline note"
- Imported-from: `rounded-md border border-indigo-200 bg-indigo-50/60 px-2 py-1.5 text-[11px]` (EntityInspector.tsx:195)
- EC guiding question: `rounded-md border border-indigo-200 bg-indigo-50/70 px-3 py-2 text-[12px]` (EntityInspector.tsx:75)
- EC brainstorm prompt: `rounded-md border border-amber-200 bg-amber-50/60 p-2` (EdgeInspector.tsx:323)
- Evidence row: `rounded-md border border-neutral-200 bg-neutral-50/60 p-2` (EvidenceList.tsx:157)
- Attributes add-row: `rounded-md border border-neutral-200 bg-neutral-50 p-2` (AttributesSection.tsx:110)

Same shape, six different padding / opacity / font-size combinations. The two indigo cards in the EntityInspector (Imported-from + EC guiding) are visible side-by-side and use different paddings *and* different opacities.
**Fix:** introduce a `<InsetCard tone="indigo|amber|neutral">` wrapper or a `INSET_CARD_BASE` class with one canonical padding (`px-3 py-2`) and one canonical opacity (`/60`). Pure replacement, no behavior change.

---

## Medium impact

### 11. The inspector tab bar and the settings tab bar are visually identical — but only one is reusable
Inspector.tsx:118–149 and SettingsDialog.tsx:54–79 contain near-identical 25-line tab-bar implementations (same role="tablist", same indigo-bottom-border active pattern, same flex-1 buttons). Two files, copy-paste drift waiting to happen. The Inspector version uses `tracking-wide`; SettingsDialog uses `tracking-wide`. Inspector uses `py-1.5`; Settings uses `py-2`. Subtle drift already.
**Fix:** extract a `<TabBar tabs={[{id,label}]} active={...} onChange={...} ariaLabel="…" />` in `src/components/ui/`. Drop ~50 lines of duplication.

### 12. `<Field>` only handles strings cleanly — passing a ReactNode label produces a different DOM (div vs span)
Field.tsx:7 vs 11: the wrapper switches between `<span>` and `<div>` based on `typeof label === 'string'`. EvidenceList.tsx:108 passes `` `Evidence (${items.length})` `` — string, gets span. If a future caller passes `<>Evidence <span>(3)</span></>`, the DOM silently swaps to a `<div>`, breaking any sibling-selector CSS and flipping the inline-context. Subtle footgun.
**Fix:** always render `<span>`. ReactNodes can sit inside a span fine.

### 13. SettingsDialog header uses different sizing than LargeDialog header
- SettingsDialog header: `text-sm font-semibold` (SettingsDialog.tsx:42)
- LargeDialog header: `text-base font-semibold` (LargeDialog.tsx:104)
- PrintPreviewDialog inherits LargeDialog → text-base. SettingsDialog feels visually smaller / less authoritative.
**Fix:** standardize on `text-base` for dialog titles, OR push SettingsDialog through LargeDialog (it's almost the same structure — header + tab bar + scrolling body — but uses Modal).

### 14. EC tab styling uses indigo, but EC has its own violet identity per `focusClasses.ts` comment
focusClasses.ts:14 explicitly documents "EC-themed badges (verbalisation strip, assumption well): violet ring instead of indigo. This is intentional — EC has its own visual identity carried through the violet palette." But the EC inspector tab bar (Inspector.tsx:141) uses indigo: `border-indigo-500 text-indigo-700`. So the EC tabs feel like the rest of the app instead of like EC's own thing.
**Fix:** either commit to violet across all EC chrome (tab bar included), or update the focusClasses comment to acknowledge the rule is partial.

### 15. `text-ui` is used once and isn't defined in the audited files
EmptyHint.tsx:19 reads `className="mt-1 text-neutral-500 text-ui dark:text-neutral-400"`. `text-ui` is presumably a custom Tailwind token from `index.css`, but it's the only place in the audited surfaces using it. Inconsistent with the rest of the codebase using `text-xs` / `text-sm`.
**Fix:** verify `text-ui` is defined; if so, document it; if not, replace with `text-sm`.

### 16. `bg-white/95 backdrop-blur-sm` vs `bg-white/80 backdrop-blur-sm` vs `bg-white/90 backdrop-blur-sm` — three frosted-glass opacities
- Inspector aside: `bg-white/95` (Inspector.tsx:85)
- EmptyHint: `bg-white/80` (EmptyHint.tsx:17)
- CanvasNav: `bg-white/90` (CanvasNav.tsx:35)
- PresentationStepThrough: `bg-white/95` (PresentationStepThrough.tsx:156)
- CompareBanner: `bg-indigo-50/95` (CompareBanner.tsx:54)

The frosted-glass canvas overlays should pick one opacity. The 5% delta between 80/90/95 isn't load-bearing — it's drift.
**Fix:** pick `/95` for chrome (toolbars, nav) and `/80` for content cards (EmptyHint).

### 17. Polarity / State / Locus / TitleSize button rows all duplicate the same grid + button-render code
EntityInspector.tsx:140–161 (TitleSize), 302–327 (Locus), 338–371 (State), 100–125 (Type); EdgeInspector.tsx:159–178 (Polarity); MultiInspector.tsx:121–151 + 162–189. Six button-row implementations of the same control. The differences (column count, with-stripe vs without) are real but small.
**Fix:** extract a `<ButtonGroup options={[{id,label,stripe?,hint?}]} value={...} onChange={...} columns={3|4} disabled={...} />` component. Each call site shrinks from ~20 lines to ~6 and consistency follows for free.

### 18. EvidenceList row pills (Source / Strength) use `focus:ring-2` while neighbouring elements use `focus-visible:ring-2`
EvidenceList.tsx:175, 190: `focus:outline-hidden focus:ring-2 focus:ring-indigo-400`. The `<Button>` primitive uses `focus-visible:ring-2` (Button.tsx:9). So clicking a pill with the mouse shows a ring, but clicking a Button doesn't. Inconsistent within the same row.
**Fix:** route through `CARD_FOCUS` (which uses `focus:` correctly for that role) or migrate the pills to `focus-visible:` to match Button. The `focus:` vs `focus-visible:` decision rule is already documented in focusClasses.ts:25 — pills aren't covered by it.

### 19. `<dialog open>` without `showModal()` doesn't actually behave like a modal — page-behind is interactive
LargeDialog.tsx:87 uses `<dialog open>` (the attribute form) plus a custom focus trap. The file's own comment at line 24 acknowledges "SideBySideDialog stays out of this abstraction: it's a fullscreen native `<dialog>` using `showModal()` for browser-built-in focus management". So LargeDialog *doesn't* use `showModal()`. Result: content behind the dialog is still in the tab order (the focus trap masks it for keyboard users, but assistive tech may still announce content behind). The `aria-modal="true"` (line 91) helps but isn't perfect substitution.
**Fix:** call `dialogRef.current?.showModal()` in a `useEffect` when `open` flips true; remove the manual focus trap (browser provides it). Or add `inert` to the page-root when LargeDialog is open. Same fix pattern that already lands `inert` on the Inspector aside (Inspector.tsx:101).

### 20. AttributeRow hand-rolls its own input className instead of using `TextInput` / `Select`
AttributesSection.tsx:209–262 builds its own input styling (`min-w-0 flex-1 rounded border border-neutral-200 bg-white px-2 py-0.5 text-xs outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 …`). This duplicates `FIELD_BASE + FIELD_SIZE_SM + INPUT_FOCUS` from `formPrimitives.tsx` almost byte-for-byte but with `rounded` instead of `rounded-md`, `outline-none` instead of `outline-hidden`. Drift on a primitive that was already migrated.
**Fix:** AttributeValueInput should compose `FIELD_BASE` + `FIELD_SIZE_SM` + `INPUT_FOCUS`, or just use `TextInput size="sm"` directly.

### 21. The inline TextInput / select inside AttributesSection's "Add" form skips form primitives entirely
AttributesSection.tsx:110–145 hand-rolls another `<input>` and `<select>` with bespoke classes (line 116, 122). Same `formPrimitives` are imported file-relatively elsewhere in this same component — Add-row just predates the migration.
**Fix:** replace the bespoke `<input>` with `<TextInput size="sm">` and the bespoke `<select>` with the new `<Select>` primitive.

---

## Lower impact / quick wins

### 22. `aria-label="Dismiss inspector"` button is `tabIndex={-1}` so keyboard users can't reach it
Inspector.tsx:71–77. The backdrop is a button, but `tabIndex={-1}` removes it from focus. The aria-label is therefore announced to nobody. Either keep it focusable so screen-reader users can click-to-dismiss, or drop the aria-label (it's just visual clickthrough).
**Fix:** drop the aria-label, or remove `tabIndex={-1}` and add a visually-hidden helper text.

### 23. SelectionToolbar buttons render `<span>{display}</span>` after the icon, with no whitespace handling for empty display
SelectionToolbar.tsx:246. If a verb has no `shortLabel` and no `label`, an empty `<span>` renders next to the icon and skews the button's gap-1 spacing. Defensive only.
**Fix:** `{display && <span>{display}</span>}` — one-char change.

### 24. CompareBanner colour chips use `text-[11px]` parent on its `<span>` siblings but the parent itself is `text-xs`
CompareBanner.tsx:54 sets `text-xs`, then line 59 sets `text-[11px]` on the chip-row span, and inner chips inherit that. The eyebrow at line 55 inherits `text-xs`. Minor — but the eyebrow ("VISUAL DIFF") sits at a different size than the equivalent eyebrows in the Inspector / Settings tabs. Belongs to finding 2.

### 25. The Inspector mobile backdrop animates open but the inspector itself uses a `120ms` transform — no coordinated fade-in for the backdrop
Inspector.tsx:71–78. The backdrop pops in instantly while the inspector slides in over 120ms. Tiny visual incoherence — the dark plate snaps on, then the panel slides.
**Fix:** add `transition-opacity duration-[120ms]` and key `opacity-0 → opacity-100` on the backdrop via the same `open` flag.

---

## Largely clean

**Motion (`transition` / `animate-*`)** — duration usage is consistent (120ms slide on the inspector aside, 250ms `fitView` duration in presentation step-through, and most other transitions rely on bare `transition` for default 150ms). No animate-with-no-reason offenders in this set of files. The one nit is finding 25.

**`focusClasses.ts` itself** — the tiering (INPUT_FOCUS / CARD_FOCUS, plus the Button primitive's own `focus-visible:` rule) is well thought through and well documented. The drift is in the *consumers* (finding 18), not in the design of the constants.

**`Button.tsx`** — clean. Five variants, three sizes, all variants have a hover state and disabled state. The shape of the API is right; the issues are downstream (callers building their own one-off buttons in inspectors when they should use `Button`).

**`<LargeDialog>` and `<SettingsDialog>`** — both have proper `aria-modal`, `aria-labelledby`, focus traps (or note in comments why they don't), Esc handling. Header layout reads cleanly. The only structural critique is finding 19 (showModal vs `open`).

**`PresentationStepThrough` and `CanvasNav`** — internally clean. Icon-only buttons all have `aria-label` + `title`. `tabular-nums` on the position counters is the right touch.

---

## Suggested order of action

If Dann picks a small batch:

1. **Findings 1, 2, 3** (Field semantics + eyebrow token + inspector hierarchy) — single coherent pass on the inspector pane that fixes a11y + visual hierarchy together.
2. **Findings 4, 17, 11** (toggle-button base + ButtonGroup extraction + TabBar extraction) — three component extractions that pay for themselves in maintenance volume.
3. **Findings 10, 16** (InsetCard + frosted-glass opacity) — final visual-consistency pass.

The rest is incremental cleanup.
