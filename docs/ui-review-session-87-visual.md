# UI review — Session 87, visual pass

**Method:** Live-app walkthrough of TP Studio via Claude Preview (Vite dev server at `localhost:5173`), at desktop viewport (1024-1440px wide). Drove the app programmatically via the `__TP_TEST__` hook + DOM dispatched events; captured screenshots and accessibility snapshots at each surface. Pairs with the static review at [`ui-review-session-87.md`](./ui-review-session-87.md) — focuses on what the code-reading missed.

**Coverage:**
- CRT canvas (empty + 4 entities chained) and inspector
- Top-bar at desktop width
- Command palette (unfiltered + with query)
- Settings dialog
- EC canvas (loaded via "Load example Evaporating Cloud")
- EC inspector with slot entity selected
- Reading-instructions strip + verbalisation strip + injection chip (Session 87 EC PPT additions)

**Status of static review items #30-34 (EC-specific findings):**

| # | Item | Status |
|---|------|--------|
| 30 | EC Inspector 3-tab crowding | ✅ **No change in tab count** — agent kept 3 tabs (Inspector / Verbalisation / Injections); didn't add a 4th. Crowding is not worse, not better. |
| 31 | Verbalisation strip eats canvas vertical space | ⚠️ **Still present.** New `ECReadingInstructions` strip ALSO consumes vertical space *above* the verbalisation strip. Combined chrome (reading instructions + verbalisation prose) ≈ 80-100 px of canvas. **New severity higher.** Reading instructions has a dismiss button — once dismissed, only verbalisation remains. Worth verifying the dismiss persists across reloads. |
| 32 | EC wizard steps don't say which slot they target | ✅ **Addressed by agent's item #2** — per-slot guiding questions surface in the EntityInspector when an EC slot entity is selected. The Inspector now shows e.g. "A · Common objective" heading + "What common objective will be achieved by meeting both need B and need C?" question above the title input. *Caveat below — only works when ecSlot is set on the entity.* |
| 33 | EC mutex visual (⚡ glyph vs PPT lightning) | Per Dann's earlier decision: not worth changing. Keep as-is. |
| 34 | AssumptionWell + InjectionWorkbench behind inspector tabs | ✅ **Addressed by agent's items #6 + #7** — assumption-count badge on each EC edge becomes a clickable button that focuses the AssumptionWell tab; new top-right `ECInjectionChip` shows "Injections (N)" on the canvas. **Visual verification below.** |

---

## 🔴 Bug — example EC loader produces a broken-looking EC

**Severity: medium-high. User-facing on the highest-visibility "show me what this does" entry path.**

**Repro:** Open command palette → "Load example Evaporating Cloud" → observe the canvas.

**Symptoms:**
- The verbalisation strip at the top of the canvas reads as placeholders despite the 5 boxes carrying real titles: "In order to achieve **the common objective**, we must **the first need**, because **no assumptions yet**…" — should read "In order to achieve **Be present for my family AND deliver at work**, we must **Spend evening time with my family**…"
- The "Injections (0)" chip shows 0 even though the example doc doesn't seed any injection — that part is correct, but the chip's value to the user is undermined by the broken verbalisation immediately above it.
- Per-slot guiding questions (Session 87 item #2) silently don't appear in the EntityInspector when the user clicks any of the 5 boxes — because the entities have no `ecSlot` field, the inspector's `showGuidingQuestion = doc.diagramType === 'ec' && ecSlot !== undefined` evaluates false. The feature looks unimplemented to anyone exploring via the example.
- The `ec-completeness` CLR rule fires 5 sub-warnings ("No assumption recorded on B → A", etc.) because the rule walks `ecSlot`-anchored entities and finds no edges between slot-typed sources/targets.
- No mutex edge between D and D′, so `ec-missing-conflict` fires too.

**Root cause:** `src/domain/examples/ec.ts` builds the 5 entities via `buildEntity('goal', …)` / `buildEntity('need', …)` / `buildEntity('want', …)` and creates 4 sufficiency edges (default in `buildEdge`). It does **not**:
1. Set `ecSlot: 'a' | 'b' | 'c' | 'd' | 'dPrime'` on the entities. The verbalisation walks `Object.values(doc.entities).filter(e => e.ecSlot === …)` — without ecSlot, the lookup fails.
2. Set `kind: 'necessity'` on the 4 directed edges. EC edges must be necessity-typed for the verbalisation arrows and CLR completeness checks to work.
3. Create a D↔D′ edge with `isMutualExclusion: true` — the canonical EC has 5 arrows, not 4.

The example doc carries `schemaVersion: 8` so the v6→v7 migration (which would auto-fill ecSlot by position) never runs.

**Fix sketch (small, one PR):**

```ts
// src/domain/examples/shared.ts — buildEntity gains ecSlot in extras
extras: Partial<Pick<Entity, 'ordering' | 'position' | 'unspecified' | 'description' | 'ecSlot'>>

// src/domain/examples/shared.ts — buildEdge gains kind override
export const buildEdge = (sourceId, targetId, opts?: { andGroupId?: string; kind?: EdgeKind; isMutualExclusion?: boolean }) => ({ … });

// src/domain/examples/ec.ts — pass ecSlot + necessity + mutex
const a = buildEntity('goal', '...', t, 1, { position: EC_POSITIONS.a, ecSlot: 'a' });
const b = buildEntity('need', '...', t, 2, { position: EC_POSITIONS.b, ecSlot: 'b' });
// ... c, d, dPrime similarly
const edges = [
  buildEdge(d.id, b.id, { kind: 'necessity' }),
  buildEdge(dPrime.id, c.id, { kind: 'necessity' }),
  buildEdge(b.id, a.id, { kind: 'necessity' }),
  buildEdge(c.id, a.id, { kind: 'necessity' }),
  buildEdge(d.id, dPrime.id, { kind: 'necessity', isMutualExclusion: true }), // NEW — the missing 5th arrow
];
```

Plus a test: `tests/domain/examples/ec.test.ts` (or extend the example-builders test) verifying loaded example has 5 ecSlot-bound entities + 5 necessity edges including 1 mutex.

**Effort:** S — ~30 min code + 30 min tests + commit + CI watch.

Worth pulling forward as a hotfix because the example is the most likely entry path for a first-time EC user evaluating the new Session 87 chrome.

---

## Visual nits not catchable by code reading

These would have been hard to surface without seeing the rendered app:

### V1. EC example doc title is verbose

**Title bar reads:** `"Work / family balance Evaporating Cloud (example)"` — 50 chars. Combined with the `Evaporating Cloud` badge to the right, the top-left chrome runs to ~60% of viewport width before the toolbar starts. The "(example)" suffix is informative but reads as low-signal once you know the source. Consider dropping "(example)" — the badge already says "Evaporating Cloud", and the title's job is the diagram's subject. Effort: trivial. Applies to every `examples/*.ts` title.

### V2. ECReadingInstructions strip + Verbalisation strip stack vertically

Both occupy the top of the canvas. At the example viewport, the combined height is ~110 px (~16% of a 700-px-tall canvas). Reading instructions has a dismiss button — once dismissed, the verbalisation alone takes ~70 px. The user can't tell from the canvas which surface "the EC chrome" refers to; the two strips visually merge. Consider a single collapsible wrapper that contains both (reading instructions + verbalisation), with a unified toggle. Effort: M.

### V3. Want nodes are off-screen at 1024-px viewport

The example uses canonical EC seed coordinates: Goal at x=100, Needs at x=450, Wants at x=800. With entity width = 248 px, the right-most edge of a Want sits at x=1048 — **off-screen** on a 1024 px viewport. The Fit View button repositions to bring everything in, but if a user pans manually they can easily lose the Wants. Two paths: (a) make the example use tighter coordinates (e.g. Wants at x=700), or (b) trigger Fit View automatically after loading any example. Effort: S for either.

### V4. EC node "EFFECT/GOAL/NEED/WANT" type label is very small

At 113% zoom (the default Fit View zoom on the example), the type-label uppercase text is ~6 px tall on screen. Below the entity title (which is larger). Readable but at the edge of comfortable. The label is the only way to tell a Need from a Want at a glance once a user customizes titles. Worth either bumping the font size, increasing letter-spacing for legibility, or color-coding the stripe more emphatically. Effort: S.

### V5. Inspector covers Want column on EC at desktop-narrow widths

Inspector is `min(85vw, 320px)` wide, fixed to the right edge. At 1024 px viewport with Inspector open, the right 320 px of canvas is occupied — eating most of the Want column (x=800-1048). Selecting a Want box opens the inspector and **the just-selected entity is now hidden behind the inspector itself.** Disorienting. Options: (a) shift canvas left when inspector opens (existing react-flow viewport machinery), (b) reduce inspector width to 280 px at viewports < 1100 px, (c) add a "snap to opposite side" toggle. Effort: M.

### V6. Annotation appendix `<aside>` is in the DOM and reachable by assistive tech

The accessibility snapshot reveals `aside` with role `complementary` containing "Annotation appendix" and a numbered list. The element is hidden via `print.css`'s `@media print` rules — but `display: none` isn't applied for screen reading; the element is in the a11y tree. Screen-reader users could be unexpectedly directed to a region that's invisible on screen. Add `aria-hidden="true"` when not actively printing, OR move the print-only DOM into the print-css generated content (or a portal mounted only during print-preview). Effort: S.

### V7. Browse Lock icon swap (static review item #1) — visually confirmed

The TopBar shows `Unlock` icon when unlocked, `Lock` when locked. At 1440 px width the icons are clear; at 1024 px (already on the smaller end of desktop) they're 12-px lucide glyphs and the distinction is subtle. The state-color (violet vs neutral) is the more legible signal. Picking one icon and toggling color is the right move, as flagged in the static review.

### V8. Command palette has duplicated `New <diagram>` + `Load example <diagram>` for 7 diagram types

That's 14 commands taking up the first half of the unfiltered palette. The kbd hints reveal no shortcuts on any of them. Either group them as a two-column sub-section ("Diagram types" header → 7 rows, each with "New" and "Example" actions side-by-side), or collapse into a single "New diagram…" command that opens a smaller picker. Effort: M. Pairs naturally with static review item #16 (palette icons).

### V9. Command palette: action commands shown regardless of applicability

"Spawn Evaporating Cloud from selected entity" appears in the unfiltered palette even with no selection. Same for "Reverse selected edge", "Group selected edges as AND/OR/XOR", "Swap selected entities", "Hoist into selected group", "Exit hoist", etc. The commands run as no-ops or fail with a toast. Either gate visibility on applicability (per-command `enabled(state): boolean` predicate the palette respects), OR show them greyed out with the disabled reason as a tooltip. Effort: M.

### V10. TopBar at 1024 px still shows full Commands button + every icon

Per the static review #12 / static comments, the breakpoint logic is `sm:` (640 px). At 1024 px everything fits without crowding. Good. Below 640 px the kebab menu kicks in — would benefit from a visual check at 480 px (the new `xs` breakpoint from Session 83) but that's a follow-up.

---

## Verified working as of agent commit `7719304`

The following Session 87 EC PPT comparison items are visibly rendering on screen (verified by accessibility snapshot + DOM inspection):

- **Reading-instructions strip** (`complementary` aria-label "Evaporating Cloud reading instructions") with the numbered "1) In order to… / 2) we must… / 3) because…" sequence and a "Dismiss reading instructions" button. ✅
- **Injection chip** at top-right of the canvas ("Open injections (N)" button, where N is the live count). ✅
- **EC inspector tab bar** (Inspector / Verbalisation / Injections) is present. ✅
- **TYPE list filtered by diagram type** — EC docs show only `Goal / Need / Want / Assumption / Note` (5 types) in the EntityInspector; CRT docs show 8 types. ✅

The following items couldn't be confirmed on the example EC because of the loader bug above:
- **Per-slot guiding questions** in the EntityInspector — needs `ecSlot` set, which the example doesn't have. Code-reading confirms the implementation is in `EntityInspector.tsx:39-53` referencing `EC_SLOT_GUIDING_QUESTIONS` from `src/domain/ecGuiding.ts`. Will work once the example loader is fixed.
- **Verbalisation slot interpolation** — same root cause; the verbalisation reads real titles when `ecSlot` is set.
- **D-first wizard mode** and **two-sided verbal style toggle** — not exercised in this walkthrough because the example skips the wizard. Need a fresh "New Evaporating Cloud" creation flow + opening the Document Inspector for the `ecVerbalStyle` toggle. Recommended follow-up.

---

## Recommended next steps

1. **Hotfix the example loader** (the bug above) as a single S-effort commit. Unblocks the verbalisation / per-slot question / mutex visualisation for first-time users. Add a test to prevent regression.
2. **Re-run the visual walkthrough** on the wizard + Document Inspector EC controls (D-first toggle, ecVerbalStyle toggle) — needs a fresh-create flow rather than the broken example.
3. **Visual nits V1-V6 + V8-V9** — bundle with the static review's "UI tidy" batch (the existing 9 quick wins). The combined batch is now ~15 small items and still ships as a single commit.
4. **V2 (combined reading instructions + verbalisation strip)** + **V5 (inspector width / canvas overlap)** — both touch EC canvas layout. Worth scoping together with the EC PPT item #5 (one-page workshop-handout export) since they're the same surface.
