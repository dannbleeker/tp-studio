# TP Studio — Iteration 2 PRD

Single source of truth for the next build. Lifts seven bundles from the Flying Logic feature catalog in [NEXT_STEPS.md](../NEXT_STEPS.md), plus every item from the original parking lot (excluding anything that depends on the reasoning layer, which is out of project scope).

> **Status:** approved scope. Built from a Q&A session against the catalog. All clarifying questions answered; "you decide" items resolved as called out in the cross-cutting decisions table below.

## 1 — Summary

### In scope

Seven FL bundles (1, 2, 3, 5, 6, 11, 13), plus the original `NEXT_STEPS.md` recommended-priority items (minus reasoning), plus polish ideas, plus tooling/process foundations.

### Deliberately out of scope this iteration

- **FL Bundles** 4 (Layout Controls), 7 (Custom Entity Classes), 8 (Structural Edge Operators), 9 (Evaporating Cloud), 10 (Other TOC Trees), 12 (Multi-document)
- **Within in-scope bundles:** `FL-CA1` (User-Defined Attributes — skipped); `FL-EX4` (OPML — dropped)
- **Original parking lot:** Confidence field UI (conflicts with reasoning exclusion)

### Out of project scope (won't build, ever, per current decisions)

- Reasoning / confidence layer (`FL-RE*`, `FL-ED5`, `FL-IN4`)
- Project management (`FL-PM*`)
- Scripting interpreter (`FL-SC1`)

### Acceptance for the whole iteration

- All tests pass. Target ~150-180 cases after the iteration (current 87).
- TypeScript strict + `noImplicitReturns` + `noUncheckedIndexedAccess`: clean.
- Biome: clean.
- `pnpm build` green.
- Live preview verified for every observable feature.
- Documentation updated alongside code (per saved feedback rule): README, USER_GUIDE, CHANGELOG, NEXT_STEPS.

## 2 — Build order

| Phase | Bundle / theme | Effort | Cuttable? |
|---|---|---|---|
| 0 | Foundations: CI, pre-commit, conventional commits, .editorconfig, Storybook, schema-migration stub | Small | No |
| 1 | Bundle 13 + animated inspector + empty-state tier 2 | Small-medium | No |
| 2 | Bundle 2 + right-click multi-edge | Medium | No |
| 3 | Bundle 11 + AND-junction subtle arc | Large | No |
| 4 | Bundle 1 | Medium | If runway shortens |
| 5 | Bundle 3 | Small-medium | If runway shortens |
| 6 | Bundle 6 | Medium-large | If runway shortens |
| 7 | Bundle 5 | Medium | First to cut |
| 8 | Narrow-viewport pass + component RTL tests | Small-medium | Always cut last |

**Cut order if runway shortens** (last-built cut first): 8 → 7 → 6 → 5 → 4. Phases 0-3 are load-bearing for the rest and not cut candidates.

## 3 — Cross-cutting decisions

Resolved during Q&A, listed here so subsequent phases reference them.

| ID | Decision |
|---|---|
| X-Search-1 | Search UI is a slide-down panel below the title bar, full-width, ~40 px tall, opened via `Cmd/Ctrl+F`. |
| X-Search-2 | Search scope: entity titles + descriptions, assumption titles, edge annotations (once they exist), and any text inside groups. |
| X-Search-3 | Search highlights matches on the canvas (entity outline pulses) in addition to listing them. |
| X-Search-4 | Search "Select all matches" engages the multi-select model from Bundle 2. |
| X-Search-5 | Search jumping to a hidden entity (inside a collapsed group) auto-expands the containing group. |
| X-Clipboard-1 | Cut / copy / paste is within-document only. Paste mints new IDs; no preservation. Cross-document is a Bundle 12 concern, not this iteration. |
| X-Paste-1 | Pasted entities get new positions from a fresh dagre run; no cursor-based positioning. |
| X-Delete-1 | Bulk delete on N entities shows a single confirm: "Delete X entities and Y connections?". |
| X-Selection-1 | Multi-select entities uses Shift+click (matches Flying Logic and current edge multi-select). |
| X-Capture-1 | Quick Capture key is `E` when no entity is in edit mode and focus is not in a text field. |
| X-Capture-2 | Indentation in pasted text (two-space or tab) implies parent → child hierarchy. |
| X-Capture-3 | Bullet prefixes stripped: `-`, `*`, `•`, `1.`, `1)`, `>`. Leading emojis also stripped. |
| X-Capture-4 | New entities float (no edges) if nothing is selected; otherwise become children of the selected entity. |
| X-Group-1 | Schema: `doc.groups: Record<string, Group>`; each `Group` has its own `entityIds: EntityId[]`. Entities don't carry `groupId`. |
| X-Group-2 | Collapsed groups aggregate inbound/outbound edges to the group node ("3 edges enter this group"). |
| X-Group-3 | Hoisting renders external-but-connected entities as labelled stubs at the canvas edge. |
| X-Group-4 | Collapsed groups are atomic to dagre (treated as one bigger node). Internal positions are preserved in the schema so expand is instant. |
| X-Group-5 | CLR validation continues to run on collapsed entities; warning markers only display when the group is expanded. |
| X-Annotation-1 | Edge annotations and `Edge.assumptionIds` both exist. They're different: assumptions are first-class entities for CLR challenges; edge annotations are short text labels. |
| X-Annotation-2 | Multi-line titles wrap to **2 lines** on the canvas, truncate with ellipsis, full text in a tooltip. |
| X-Annotation-3 | Rich annotations render markdown (subset: bold/italic/lists/links/headings/inline code). No WYSIWYG. |
| X-Number-1 | Annotation numbers are persistent — assigned at entity creation, monotonically increasing per document, never reused. Stored in the schema. |
| X-Pref-1 | Preferences live in a new `SettingsDialog` opened via `Cmd/Ctrl+,` and a "Settings" command in the palette. |
| X-Pref-2 | Browse Lock is global, persisted to localStorage. Lock icon in the top-right toolbar indicates state. |
| X-Theme-1 | One new theme variant added this iteration: "high-contrast". Rust / Coal / Navy / Ayu skipped. |
| X-Domain-1 | Domain-first discipline applies. Schema changes land in `src/domain/` with tests before any UI work. |

## 4 — Phase 0: Foundations

Foundations that catch regressions throughout the iteration. Land before any feature work.

### F0.1 — GitHub Actions CI

**What:** A single workflow that runs `pnpm install && pnpm lint && pnpm test && pnpm build` on every push and pull request.

**Spec:**
- New file: `.github/workflows/ci.yml`.
- Trigger: `push` and `pull_request` on any branch.
- Node 20 via `actions/setup-node@v4` + `actions/cache@v4` for `pnpm-store`.
- Run jobs in parallel where possible.

**Acceptance:** CI passes on the current `main` branch. Failing test / lint / typecheck blocks the workflow.

### F0.2 — Pre-commit hook

**What:** Pre-commit hook that runs Biome (lint + format) on staged files and runs the affected tests.

**Spec:** Use `simple-git-hooks` + `lint-staged` (lighter than husky). New files: `package.json` additions, `.simple-git-hooksrc`. Install runs via the existing `preinstall` slot.

**Acceptance:** A commit with a Biome violation fails. A commit with a failing affected test fails. Clean commits succeed.

### F0.3 — Conventional Commits guideline

**What:** A `commit-msg` hook that validates messages against a small allowlist of conventional types.

**Spec:** Add to `simple-git-hooks`. Allow `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`, `build:`, `ci:`, `perf:`. Allow scopes like `feat(canvas):`. Reject everything else with a hint.

**Acceptance:** `git commit -m "wip"` fails with a clear error. `git commit -m "feat: ..."` passes.

### F0.4 — `.editorconfig`

**What:** Cross-editor formatting baseline.

**Spec:** New `.editorconfig` at root. UTF-8, LF, 2-space indent, trim trailing whitespace, insert final newline. Match `*.{ts,tsx,md,json,yml}`.

**Acceptance:** Opening any source file in a fresh editor obeys the rules. Biome formatter and editorconfig don't fight.

### F0.5 — Storybook

**What:** Storybook installed with stories for the UI primitives that already exist.

**Spec:**
- `pnpm add -D storybook @storybook/react-vite @storybook/addon-essentials @storybook/addon-a11y`.
- Stories for: `Button` (every variant + size), `Modal`, `Field`, `WarningsList`.
- One story per relevant state for each component.
- `pnpm storybook` script.

**Acceptance:** `pnpm storybook` boots; all primitives show in the sidebar; each variant renders.

### F0.6 — Schema migration stub

**What:** A migration framework so future `schemaVersion` bumps are simple. Pre-stub so Bundles 11 and 6 (which add schema fields) can use it.

**Spec:**
- New file: `src/domain/migrations.ts`. Exports `migrateToCurrent(parsed: unknown): TPDocument` and a table of `Migration[]` keyed by `fromVersion`.
- Today's `importFromJSON` becomes: parse → migrate → validate. For `schemaVersion === 1` migrations is a no-op.
- A migration is `(doc: unknown) => unknown` that bumps schema version by 1.

**Acceptance:** Existing JSON imports work unchanged. Adding a fake `2 → 3` migration test demonstrates the path.

## 5 — Phase 1: Bundle 13 + polish

### 13.1 — Settings dialog scaffold (`Cmd+,`)

**What:** A new `SettingsDialog` modal reusing the existing `Modal` primitive. Home for all preferences.

**Spec:**
- New file: `src/components/settings/SettingsDialog.tsx`.
- Opened by `Cmd/Ctrl+,` and a `Settings` palette command.
- Uses the existing `Modal` shell, `Field` primitive, `Button`.
- Sections: **Appearance**, **Behavior**, **Display**. Each section gets a header.
- Preference state lives in `uiSlice` and persists to localStorage via the existing `storage.ts`.

**Acceptance:** Cmd+, opens the dialog. Changing a preference takes effect immediately. Reload preserves it. ESC and outside-click dismiss.

### 13.2 — `FL-TO1` High-contrast theme

**What:** A third theme variant beyond light/dark, for accessibility.

**Spec:**
- Theme is now `'light' | 'dark' | 'highContrast'`.
- Tokens for the new theme: surface near-black, foreground pure white, entity stripes at full-saturation, edges thicker (2 px default), focus rings more prominent.
- Settings dialog: radio buttons in the Appearance section.

**Acceptance:** Toggling to high-contrast switches palette. Tokens flow from `src/domain/tokens.ts` (extended). Build remains green.

### 13.3 — `FL-TO2` Animation speed preference

**What:** Global multiplier on animation durations: `instant` (0×), `slow` (0.5×), `default` (1×), `fast` (1.5×).

**Spec:**
- New `animationSpeed: 'instant' | 'slow' | 'default' | 'fast'` in `uiSlice`.
- Applied to: layout transitions (`.react-flow__node` transform), inspector slide-in, modal fade.
- Implemented as a CSS variable `--anim-speed` set on `<html>` and consumed via `transition-duration: calc(300ms * var(--anim-speed))`.

**Acceptance:** Setting to `instant` makes layout/inspector snap with no transition. Setting to `fast` is visibly quicker. Default matches today's behavior.

### 13.4 — `FL-TO4` Edge color palette preference

**What:** User-pickable palette: `default` (current), `colorblind-safe`, `mono`.

**Spec:**
- Palette is a record of edge stroke colors (default / selected / AND / marker).
- Living in `src/domain/tokens.ts` as a `palettes` record.
- Settings dialog: dropdown in Appearance.

**Acceptance:** Switching palette repaints all edges immediately.

### 13.5 — `FL-DI2` Browse Lock toggle

**What:** Read-only viewing mode — clicks still select, but inline edits, double-click-to-create, drag-to-connect, and right-click menu are all disabled.

**Spec:**
- New `browseLocked: boolean` in `uiSlice`, persisted.
- Lock icon button in the top-right toolbar (lucide `Lock` / `Unlock`).
- Canvas event handlers check `browseLocked` and bail early; inspector inputs render as `disabled` / read-only paragraphs; keyboard shortcuts that mutate the doc are no-ops.
- Toast on first attempted edit while locked: "Browse Lock is on — toggle off in the toolbar."

**Acceptance:** Lock engaged: cannot create / edit / delete / connect. Selection and search still work. Refreshing the page preserves lock state.

### 13.6 — `FL-DI4` Annotation numbers (persistent)

**What:** Each entity gets a small badge with a stable per-document integer. Useful for referring to entities in conversation ("see #14").

**Spec:**
- New required field: `Entity.annotationNumber: number`.
- Assigned at creation. Each document tracks `doc.nextAnnotationNumber: number` starting at 1.
- Numbers are never reused. Deleted entities burn their number.
- `migrations.ts` v1→v2: walk entities, assign annotation numbers in id-sort order, set `nextAnnotationNumber` to max+1.
- Render: a small `#N` badge in the top-right corner of each node card. Toggle visibility via Settings → Display.

**Acceptance:** New entity → gets next number. Delete and re-add → new entity gets a fresh higher number, not the deleted one's. Import an old v1 JSON → numbers assigned on import. Round-trip preserves them.

### 13.7 — `FL-DI5` Entity ID toggle layer

**What:** Toggle that shows the entity's nanoid (or first 6 chars) as a tiny mono-font caption below the title, for debugging or precise references.

**Spec:**
- `showEntityIds: boolean` in `uiSlice`, persisted, default off.
- Settings dialog → Display section.

**Acceptance:** Toggling on shows e.g. `xK8mP3qN` below each title. Off hides them.

### 13.8 — `FL-IN2` Document Inspector

**What:** A dedicated dialog for document-level metadata: title (already exists, mirrored here), author, description, created/updated dates (read-only).

**Spec:**
- New fields on `TPDocument`: `author?: string`, `description?: string`.
- v2 migration adds them with default empty.
- New `DocumentInspector` reusing Modal. Opened via "Document settings…" palette command and a small "Document info" link near the title.

**Acceptance:** Editing title/author/description updates the doc + autosaves. Dates are read-only and surface from `doc.createdAt` / `doc.updatedAt`.

### 13.9 — Animated inspector slide-in (polish item)

**What:** Replace the current snap with a 200 ms transform transition.

**Spec:** Add `transition-transform` and a `duration` variable to the inspector `<aside>`. Use the new `animationSpeed` multiplier.

**Acceptance:** Selecting an entity slides the inspector in. Deselecting slides it out. With `animationSpeed: instant` it snaps as today.

### 13.10 — Empty-state second-tier hint (polish item)

**What:** After the user creates their first entity, the "Empty diagram" hint disappears (already), and a quieter "Press Tab to add a child" tip appears for ~30 seconds.

**Spec:**
- Renders only when `doc.entities.length === 1` and the entity is selected, and a flag in `uiSlice` indicates the tip hasn't been dismissed.
- Auto-dismisses after 30 s or on Tab press.
- Bottom-center caption, opacity 0.6.

**Acceptance:** First entity created → hint appears. Tab pressed → hint dismissed permanently for this document.

## 6 — Phase 2: Bundle 2 + right-click multi-edge

### 2.1 — `FL-SE1` Multi-select entities with Shift+click

**What:** Clicking an entity with Shift held toggles its membership in the selection. Clicking without Shift clears and replaces.

**Spec:**
- Selection model becomes: `selection: { kind: 'none' } | { kind: 'entities'; ids: EntityId[] } | { kind: 'edges'; ids: EdgeId[] }`. Backwards-compatible alias for the single-entity case where convenient.
- React Flow's built-in `selected` flag on nodes is the source of truth; the store mirrors via `onSelectionChange`.
- Inspector adapts: when N > 1 entities selected, render a "N entities selected" summary with bulk actions (Convert all to…, Delete all).

**Acceptance:** Shift+click toggles. Plain click replaces. Multi-selected → inspector shows summary. Shift+click on an edge during entity multi-select preserves the entity selection (separate state).

### 2.2 — `FL-SE2` Marquee selection

**What:** Click-and-drag on the empty canvas draws a rectangle; entities (and edges) inside on release are selected.

**Spec:**
- React Flow exposes `selectionOnDrag` — enable it. Shift held during drag adds to selection.
- Default cursor on empty canvas: crosshair while dragging.
- Disabled while `browseLocked === true`? No — selection is read-only, allow.

**Acceptance:** Drag-rectangle selects entities. Shift-drag adds. Click empty canvas deselects.

### 2.3 — `FL-SE3` Cut / copy / paste

**What:** `Cmd+X` / `Cmd+C` / `Cmd+V` operate on the entity multi-selection. Within-document only.

**Spec:**
- New module: `src/services/clipboard.ts`. Module-scoped clipboard buffer; no system clipboard for now.
- Copy: serialize `{ entities: Entity[], edges: Edge[] }` where `edges` is restricted to those whose both endpoints are in the copied set.
- Cut: copy + delete.
- Paste: mint new IDs (`nanoid`) across the set, remap edge endpoints, drop the new entities into the doc. Layout re-runs.
- New entities receive new annotation numbers (`nextAnnotationNumber`).
- Toast on paste: "Pasted N entities, M edges."

**Acceptance:** Copy 3 entities + 2 edges → paste produces 3 new entities with new IDs and 2 new edges with remapped endpoints. Cut removes. Paste twice produces two independent copies.

### 2.4 — `FL-SE6` Element swap

**What:** With exactly two entities selected, the "Swap entities" command swaps their content (title, type, description, annotations) while leaving the edges incident to each in place. So the entity in position A now has B's title/type but A's connections.

**Spec:**
- Palette: "Swap selected entities" (enabled only when `selection.kind === 'entities' && ids.length === 2`).
- Keyboard: `Cmd+Shift+S` (mnemonic).
- Implementation: swap the `entities` map values, keep `id`s pinned to their slots → edges stay attached to ids.
- Actually we need: swap title/type/description/annotationNumber/createdAt/updatedAt, keep `id` in the same slot.
- Or simpler: swap `id`s in the entities map AND in every edge that references them. Math is equivalent.
- Use the first approach (swap contents) — fewer edge updates.

**Acceptance:** Two entities selected → run command → titles/types are now swapped, edges still connect the same canvas positions.

### 2.5 — `FL-SE7` Alt+click to connect

**What:** With one entity selected, Alt+click on an unselected entity creates an edge from selected → clicked.

**Spec:** Canvas `onNodeClick` checks `altKey`; if set and a single entity is currently selected, call `store.connect(selectedId, clickedId)` instead of changing selection.

**Acceptance:** Click A → Alt+click B → edge A→B created, B becomes selected.

### 2.6 — Right-click on multi-selected edges → "Group as AND"

**What:** When two or more edges are multi-selected, right-click anywhere brings up a context menu with "Group as AND" / "Ungroup AND" as the primary action.

**Spec:** Extend ContextMenu to read the current multi-selection. The pane right-click path already exists; add a check for "multiple edges selected" and shape the menu accordingly.

**Acceptance:** Shift+click two edges → right-click → "Group as AND" is the top item. Selecting it creates the group as if via the palette.

### 2.7 — Bulk delete with single confirm (X-Delete-1)

**What:** Pressing `Delete` with N entities or edges selected fires one confirm dialog: "Delete X entities and Y connections?" then deletes the whole set in one action.

**Spec:**
- `confirmAndDeleteSelection(selection)` in `src/services/confirmations.ts`.
- Bypasses the per-entity `confirmAndDeleteEntity` when N ≥ 2.
- Cascade: edges that touch a deleted entity are dropped (existing behavior); assumption ids are scrubbed (existing).

**Acceptance:** Select 3 connected entities → Delete → one prompt → all gone with cascade. Cancel → nothing changes.

## 7 — Phase 3: Bundle 11 + AND-junction arc

### 11.1 — `FL-GR1` Groups schema and rendering

**What:** A group is a shaded enclosure with a title and a color, containing a set of entities. Visually it's a rounded rectangle drawn behind its members.

**Spec:**
- Schema (v3 migration): `TPDocument.groups: Record<string, Group>` where `Group = { id: GroupId; title: string; color: string; entityIds: EntityId[]; collapsed: boolean; createdAt: number; updatedAt: number }`.
- New brand type `GroupId`.
- Rendering: React Flow doesn't natively support group "shapes," but it supports `parent` nodes. We'll render groups as a custom node type that draws a labelled rounded rectangle behind member positions and is non-interactive on its body (clicks on member entities still register).
- Layout: a group's bounding box is computed from its members' positions. Padding 24 px around members.
- Color: from a fixed palette of 6 tones (no freeform picker for now).

**Acceptance:** New "Group selected entities" command in palette. Creates a group containing the multi-selected entities. The shaded rectangle renders behind them.

### 11.2 — `FL-GR2` Nested group hierarchy

**What:** A group can contain entities AND other groups.

**Spec:**
- `Group.entityIds` becomes `Group.memberIds: (EntityId | GroupId)[]`. Discriminate by lookup.
- Cycle detection: a group cannot contain itself transitively. Validators enforce.
- Layout: compute bounding box recursively.

**Acceptance:** Select group A + entity B, run "Group selected" → outer group containing A and B. Cycle attempts throw a descriptive error in the store action.

### 11.3 — `FL-GR3` Collapse / expand

**What:** A group has a collapsed state. When collapsed, its members aren't rendered as separate nodes; instead the group shows as a single bigger node with the title and a member count.

**Spec:**
- Group node has a chevron button — toggles `collapsed`.
- Per X-Group-4: collapsed group is atomic to dagre. Internal positions are preserved in the schema.
- Per X-Group-2: aggregated edges. Compute "edges that connect any member to any non-member" → render as edges from/to the group node, with a small badge `n` indicating how many edges are aggregated there.
- Keyboard: with a group selected, `→` to expand, `←` to collapse.

**Acceptance:** Collapse a 5-entity group → group renders as a single node, internal entities + edges hidden, external edges re-route to the group, count badge shows. Expand → original layout restored exactly.

### 11.4 — `FL-GR4` Hoist into a group

**What:** "Hoist" a group means temporarily view its contents as the entire canvas. External entities not in the group are hidden; cross-boundary edges show as labelled stubs at the canvas edges.

**Spec:**
- UI state: `uiSlice.hoistedGroupId: GroupId | null`.
- A breadcrumb at the top of the canvas: `[document title] / [Group A] / [Group B (hoisted)]`. Click any segment to unhoist to that level.
- Per X-Group-3: cross-boundary edges render as stubs labelled with the external entity's title and a clickable affordance to navigate to it (which unhoists).
- Keyboard: `Enter` on a selected group hoists into it. `Esc` while hoisted (and nothing else open) unhoists one level.

**Acceptance:** Select a group → Enter → canvas now shows only that group's members, stubs at edges for external connections, breadcrumb reflects depth. Unhoist via breadcrumb or Esc.

### 11.5 — `FL-GR5` Promote children on group delete

**What:** Deleting a group does not delete its members. Children are promoted up one level (to the parent group or the document root).

**Spec:** `deleteGroup(id)` removes the group from `doc.groups`; its `memberIds` are appended to the parent group's `memberIds` (or remain at root). Selection clears.

**Acceptance:** Delete a group containing 3 entities + 1 sub-group → the 3 entities + 1 sub-group are now at the parent level. None lost.

### 11.6 — CLR + groups interaction (X-Group-5)

**What:** Validation runs on collapsed entities (correctness). Warning markers only render when their containing group is expanded.

**Spec:**
- `validate(doc)` unchanged.
- Inspector and on-canvas warning indicators check `entity.id`'s containing group chain and suppress if any ancestor is collapsed.
- Open count summary in toasts still counts everything.

**Acceptance:** Resolve a warning inside a collapsed group → reflected in the open-count toast. Visual marker reappears on expand.

### 11.7 — Search + groups interaction (X-Search-5)

**What:** Search jumping to a hidden entity auto-expands its containing group chain.

**Spec:** When `setSelection({ kind: 'entities', ids: [id] })` runs and the entity is inside a collapsed group, expand all collapsed groups in the ancestor chain. Phase 4 will wire this up.

### 11.8 — AND-junction subtle arc (parking-lot polish)

**What:** The existing AND-junction dot becomes a small connecting arc when 2+ AND-grouped edges share a target.

**Spec:**
- New `ANDOverlay.tsx` rendered inside React Flow. Uses `useReactFlow` to read edge geometries via `getInternalNode`.
- For each `andGroupId` with 2+ edges sharing a target, draw a quadratic-bezier arc connecting the dot positions just before the target.
- Stroke: violet (`ENTITY_STRIPE_COLOR.assumption`), 1.5 px, no marker.

**Acceptance:** Example CRT loads → the two AND edges from "Order entry is manual" and "Shipping label generator..." → arc visible connecting the dots near "Wrong items ship to customers."

## 8 — Phase 4: Bundle 1 — Navigation & Search

### 4.1 — `FL-NA1` Find / search panel

**What:** Slide-down panel below the title bar, full-width, opened with `Cmd/Ctrl+F`. Input field, match count, Next/Previous buttons, regex / case-sensitive / whole-word toggles, Close.

**Spec:**
- New `SearchPanel.tsx` in `src/components/search/`.
- New `searchSlice` (or fields on `uiSlice`): `searchOpen`, `searchQuery`, `searchRegex`, `searchCase`, `searchWhole`, `searchMatchIndex`.
- Per X-Search-2: scope = entity titles + descriptions, assumption titles, edge annotations, group titles.
- Pure search function in `src/domain/search.ts`: `findMatches(doc, query, opts) → Match[]` where `Match = { kind: 'entity' | 'edge' | 'group'; id: string; field: 'title' | 'description' | …; preview: string }`. Pure, tested.
- Match list rendered inline in the panel (scrollable). Click a match to navigate (selects + scrolls into view + per X-Search-5 expands containing group).

**Acceptance:** Cmd+F opens. Typing filters. Next/Prev cycles. Match-count updates live. Regex toggle accepts `/pattern/flags`. Auto-expand groups on jump.

### 4.2 — `FL-NA2` Minimap

**What:** A miniature view of the whole graph in the bottom-right corner showing the current viewport.

**Spec:** React Flow's `<MiniMap>` with theme-aware colors. Hide-toggle in Settings → Display.

**Acceptance:** Minimap renders. Clicking on it scrolls the viewport. Hide toggle works.

### 4.3 — `FL-DI1` Explicit zoom controls

**What:** Keyboard `+` / `=` zooms in, `-` / `_` zooms out, `0` resets. Alt+wheel zooms at cursor (React Flow already does this). Zoom percentage shown in the bottom-center near the Controls.

**Spec:** Add to `useGlobalKeyboard`. Display the zoom level by reading `useReactFlow().getZoom()`. Help dialog updated.

**Acceptance:** Shortcuts work. Zoom percentage updates live.

### 4.4 — `FL-SE4` Select Path Between

**What:** With exactly two entities multi-selected, the "Select path between" command finds the shortest (in edges) directed path between them and selects every entity + edge on the path.

**Spec:**
- New domain helper: `findPath(doc, fromId, toId) → { entityIds: EntityId[]; edgeIds: EdgeId[] } | null`. BFS on the directed graph; ignore direction if no path direct (try both).
- Palette: "Select path between selected entities" enabled only for 2 entities.
- Toast on no-path: "No path found between selected entities."

**Acceptance:** Two entities selected with a 3-edge path between them → command selects all 4 entities + 3 edges. Two disconnected entities → toast.

### 4.5 — `FL-SE5` Select Successors / Predecessors

**What:** With at least one entity selected, "Select all successors" walks all outgoing reachable entities; "Select all predecessors" walks all incoming.

**Spec:**
- Domain helpers in `src/domain/graph.ts`: `reachableForward(doc, fromIds)`, `reachableBackward(doc, fromIds)`.
- Two palette commands. Keyboard: `Cmd+Shift+→` for successors, `Cmd+Shift+←` for predecessors.

**Acceptance:** Select a root cause → command selects every entity downstream. Select a UDE → command selects every entity upstream.

## 9 — Phase 5: Bundle 3 — Quick Capture

### 3.1 — `FL-QC1` Quick Capture dialog

**What:** Modal with a multi-line textarea. Press `E` (when not in a text field) to open. Paste / type bulleted lines; submit (`Cmd+Enter` or Enter on empty line) creates one entity per line.

**Spec:**
- New `QuickCaptureDialog.tsx` reusing Modal. ~400 px wide, textarea ~10 rows.
- Below the textarea: live preview of detected hierarchy (indented tree of what will be created).
- Per X-Capture-3: strip leading bullets (`-`, `*`, `•`, `1.`, `1)`, `>`) and leading emoji.
- Per X-Capture-2: 2-space or tab indents mean parent → child.
- Per X-Capture-4: roots in the parsed tree are connected as children of the currently-selected entity (if any), otherwise float.
- Default entity type: same as current diagram's `defaultEntityType` (effect for CRT/FRT).

**Acceptance:** Open with E. Paste a 5-item indented list. Submit. 5 entities created with the correct parent/child edges. Floating roots if no selection.

### 3.2 — `FL-QC2` Bulk CSV import

**What:** Command-palette item "Import CSV…" opens a file picker. CSV with header row; each non-header row is an entity.

**Spec:**
- CSV format: `title, type, description, parent_title` (parent_title optional, used to wire edges by matching titles within the import).
- Validation: reject rows with unknown type. Other columns optional. Trim whitespace.
- New file: `src/services/csvImport.ts`. Pure function `parseEntitiesCsv(text: string) → { entities, edges } | { errors }`.
- Toast on success: "Imported N entities, M edges."

**Acceptance:** Import a 10-row CSV → 10 entities created with edges where `parent_title` matches. Bad-type row → toast with line number.

## 10 — Phase 6: Bundle 6 — Rich Annotations & Text

### 6.1 — `FL-AN1` Multi-line titles

**What:** Alt+Enter inside the title field adds a newline. Canvas renders 2 lines max with ellipsis. Tooltip shows the full title on hover.

**Spec:**
- TPNode textarea: handle Alt+Enter → insert `\n`. Enter alone still commits.
- Rendered title: `display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis`.
- Tooltip: `title` attribute on the node container.

**Acceptance:** Multi-line titles round-trip through save/load. Long titles truncate at 2 lines with "…". Tooltip on hover shows full.

### 6.2 — `FL-AN2` Markdown entity annotations

**What:** The `description` field is now interpreted as markdown. Rendered with a subset: bold, italic, lists, links, headings, inline code, paragraphs.

**Spec:**
- Add `micromark` (with `micromark-extension-gfm` if list/link parity matters) as a runtime dep. Smaller and tree-shakeable compared to `marked` — ~14 kB vs ~30 kB. Sanitize the output with `dompurify` (~12 kB) to prevent XSS.
- Inspector renders the description in a small markdown preview below the edit textarea. Toggle between "edit" and "preview."
- Markdown renderer lives in `src/services/markdown.ts`: `renderMarkdown(src: string) → SafeHtml`.

**Acceptance:** Typing `**bold**` in description → preview shows bold. `[Click](https://example.com)` → renders an anchor with `target="_blank"` and `rel="noopener noreferrer"`. `<script>` injection is stripped.

### 6.3 — `FL-AN3` / `FL-ED7` Edge annotations

**What:** Each edge gains an optional short text label (mid-edge). Distinct from assumption entities — these are labels, not first-class entities.

**Spec:**
- Schema (v4 migration): add `Edge.label?: string`.
- Edit UX: edge inspector gains a "Label" input.
- Rendering: per X-Annotation-1, always-visible if ≤30 chars (mid-edge text rendered via `EdgeLabelRenderer`), tooltip otherwise.
- Indexed by search per X-Search-2.

**Acceptance:** Add a label to an edge → text appears at the bezier midpoint. Round-trips through JSON. Searchable.

### 6.4 — `FL-AN4` Styled text (markdown subset)

**What:** Same markdown rendering used for descriptions also works in… (nothing else has long text yet). Mostly subsumed by 6.2.

**Spec:** Covered by 6.2. Document inspector's description field (from 13.8) also renders markdown.

**Acceptance:** Document description supports markdown.

### 6.5 — `FL-AN5` Hyperlinks

**What:** Markdown links work out of the box (6.2). Additionally, links of the form `#entity:abc123` (or `#42` where 42 is an annotation number) are resolved to internal entity references — clicking selects that entity.

**Spec:**
- Markdown renderer post-processes anchor `href`s. If `href.startsWith('#entity:')` or `href === '#' + integer`, replace with a `data-entity-ref="ID"` attribute and intercept clicks via event delegation.
- Click handler: select the referenced entity. If it's inside a collapsed group, auto-expand (per X-Search-5).

**Acceptance:** `[see #14](#14)` in a description, click → selection jumps to that entity.

## 11 — Phase 7: Bundle 5 — Export Pack

### 5.1 — `FL-EX1` + `FL-EX7` PDF via print stylesheet

**What:** `Cmd+P` triggers `window.print()`. Print stylesheet hides inspector / toolbar / palette / minimap, expands the canvas to full page, paginates if needed.

**Spec:**
- New file: `src/styles/print.css`. `@media print { … }` rules.
- Print preview includes: title at top, optional author/description from document inspector, the diagram, a footer with date.
- Color theme for print: force light mode regardless of current theme.

**Acceptance:** Cmd+P → browser print dialog → "Save as PDF" produces a clean diagram with the title and meta.

### 5.2 — `FL-EX2` JPEG export

**What:** Command "Export as JPEG" alongside the existing PNG.

**Spec:** Mirror `exportPNG` but call `toJpeg` from `html-to-image`. Quality 0.92. Same 2× pixel ratio, padding, background.

**Acceptance:** Export produces a `.jpg` file that looks identical to PNG except for JPEG artifacting.

### 5.3 — `FL-EX3` SVG export

**What:** Command "Export as SVG".

**Spec:** Call `toSvg` from `html-to-image`. Inline SVG with bitmap fallbacks for things like icons.

**Acceptance:** Exported SVG opens in a browser and renders. File size reasonable (similar order to PNG).

### 5.4 — `FL-EX5` CSV export

**What:** Single CSV file with a `kind` column.

**Spec:**
- New file: `src/services/csvExport.ts`. Pure function `exportToCsv(doc) → string`.
- Schema:
  - `kind, id, type, title, source_id, target_id, parent_group_id, and_group_id, annotation_number, description`
  - For entity rows: `kind=entity`, type filled, source/target empty.
  - For edge rows: `kind=edge`, source/target filled, type empty.
  - For group rows: `kind=group`, title filled, type empty.
- Escape commas and quotes per RFC 4180.

**Acceptance:** Export → round-trippable CSV (a corresponding `csvImport.ts` from 3.2 can read it back).

### 5.5 — `FL-EX6` Annotations-only export

**What:** Export a document listing every entity's annotation number, title, and description, ordered by annotation number.

**Spec:**
- Two output formats from the palette: "Export annotations as Markdown" (`.md`) and "Export annotations as text" (`.txt`).
- Format:
  ```
  #1 Customer satisfaction is declining (Undesirable Effect)
     This entity covers churn, NPS drops, and so on.

  #2 Order entry is manual (Root Cause)
     ...
  ```

**Acceptance:** Export produces a readable document. Markdown variant preserves description formatting.

### 5.6 — Print dialog with header/footer (covered by 5.1)

**Spec:** The print stylesheet adds `@page { margin: 1in }` and a small footer block via `position: running()`.

**Acceptance:** Print preview shows the date + page numbers in the footer.

## 12 — Phase 8: Narrow-viewport + component tests

### 8.1 — Narrow-viewport pass (`< 1024 px`)

**What:** The brief said "responsive down to 1024 px is enough"; on smaller screens, basic functionality should not break.

**Spec:**
- At `< 1024 px`: inspector becomes a slide-out (swipe / icon to open). Default collapsed.
- At `< 768 px`: top-right toolbar collapses commands/help/theme into a kebab menu.
- Title input gets a max-width to prevent overlap with the toolbar at any size.
- Minimap and zoom controls reposition or hide at `< 640 px`.

**Acceptance:** Resize Chrome to 800 px / 600 px / 400 px → app remains usable, no overlapping UI.

### 8.2 — Component-level tests

**What:** RTL tests for the canvas, inspector, command palette, and context menu.

**Spec:**
- Use `@testing-library/react` `render` with a `ReactFlowProvider` wrapper helper in `tests/helpers/`.
- Manual `cleanup()` per existing pattern (no global vitest setup).
- Coverage targets:
  - Inspector: selecting an entity shows the right fields; toggling a warning persists; ungroup button appears on AND edge.
  - ContextMenu: right-click options correct per target; "Convert to" mutates the entity type.
  - CommandPalette: arrow / Enter navigation; pre-filtered query honored.
  - Canvas: double-click creates an entity in edit mode.

**Acceptance:** ~25-40 new tests pass. Total suite reaches ~150-180.

## 13 — Documentation deliverables

Per the saved feedback rule, the four root docs ride along with code changes. By the end of the iteration:

- **README.md** — keyboard map extended with `Cmd+F`, `Cmd+,`, `E`, `Cmd+Shift+S`, `Cmd+Shift+←/→`. Architecture section expanded with the new modules: `search.ts`, `migrations.ts`, `csvImport.ts`, `csvExport.ts`, `markdown.ts`, `clipboard.ts`. CLR rules table unchanged. Data model section updated with `groups`, `annotationNumber`, `Edge.label`.
- **USER_GUIDE.md** — new sections: "Multi-select", "Groups", "Quick Capture", "Search", "Themes & preferences", "Markdown annotations". Keyboard reference refreshed.
- **CHANGELOG.md** — one entry per phase (or one per session), commit hashes inline, test counts.
- **NEXT_STEPS.md** — completed bundles marked done; remaining bundles (4, 7, 8, 9, 10, 12) move to top of "candidates" section.

Update docs in the same commit as code where possible. Treat doc drift as a regression.

## 14 — Risk and open issues

- **Bundle 11 (Groups) is the largest schema change** in the project's history. The `parent` group-node pattern in React Flow has some quirks — early prototype recommended in Phase 3 day 1.
- **Conventional commits hook** may friction-burn against my LF/CRLF habit on Windows. May need a `.gitattributes` to settle this.
- **`micromark` + `dompurify`** add ~26 kB combined to the bundle. Mitigation: dynamic-import the markdown renderer the way `html-to-image` is dynamic-imported today.
- **Schema migrations are forward-only.** Old `v1` JSON imported into a `v2`-aware app gets `annotationNumber`s assigned on import; no rollback path. Document this clearly.
- **The `selection` shape change in Phase 2** ripples through `useSelectedEntity` / `useSelectedEdge` etc. Plan a back-compat layer or a clean swap (preferred — single commit covering all consumers).

## 15 — When picking this up

Resume runbook:

```bash
cd C:\dev\tp-studio
git status            # should be clean
pnpm install
pnpm dev              # http://localhost:5173
pnpm test             # 87 tests at start
pnpm storybook        # available from Phase 0 onward
```

Open this PRD plus [NEXT_STEPS.md](../NEXT_STEPS.md), pick the next phase, build in vertical slices: one feature per commit, doc updates in the same commit when possible.
