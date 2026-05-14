# TP Studio — User Guide

A practitioner's walkthrough. Assumes familiarity with the Thinking Process — this is about the tool, not the method.

## Contents

1. [Starting up](#starting-up)
2. [What you see](#what-you-see)
3. [Building a Current Reality Tree](#building-a-current-reality-tree)
4. [Working with entities](#working-with-entities)
5. [Connecting causes to effects](#connecting-causes-to-effects)
6. [Working with multiple entities](#working-with-multiple-entities)
7. [Finding and navigating](#finding-and-navigating)
8. [Quick Capture and CSV import](#quick-capture-and-csv-import)
9. [Groups (organize a region of the diagram)](#groups)
9. [AND groups (sufficient sets of causes)](#and-groups)
7. [Assumptions on edges](#assumptions-on-edges)
8. [The CLR panel](#the-clr-panel)
9. [Future Reality Trees](#future-reality-trees)
10. [Saving, exporting, and sharing](#saving-exporting-and-sharing)
11. [Templates library](#templates-library)
12. [Multi-goal Goal Trees](#multi-goal-goal-trees)
13. [Settings & themes](#settings--themes)
12. [Browse Lock](#browse-lock)
13. [Document details](#document-details)
14. [Keyboard reference](#keyboard-reference)
15. [Tips](#tips)

## Starting up

Open the dev server URL (typically http://localhost:5173). The first time you open it you'll see an empty canvas with a hint card centered on screen:

> **Empty diagram**
> Double-click anywhere to add your first entity.

Your work auto-saves to this browser on every change. Closing the tab and reopening it later picks up where you left off — no sign-in, no cloud.

## What you see

| Element | Where | What it does |
| --- | --- | --- |
| Title | Top-left | Click to rename the document. The badge next to it shows the diagram type (`CRT` or `FRT`); the small info icon opens the Document Inspector. |
| Commands button | Top-right | Opens the command palette (or press `Cmd/Ctrl+K`). |
| Lock button | Top-right | Toggles Browse Lock — read-only mode for safe sharing or screen-recording. |
| Help button (?) | Top-right | Opens the keyboard-shortcuts dialog. |
| Theme toggle (sun/moon) | Top-right | Switches between light and dark. (High-contrast lives in Settings.) |
| Canvas | Center | The infinite dot-grid where your diagram lives. |
| Zoom controls | Bottom-center | Zoom in, zoom out, fit-to-view. |
| Inspector | Right panel | Slides in when you select an entity or edge. Holds title, type, description, CLR warnings, and delete. |
| Toasts | Bottom-center, overlay | Brief confirmations: "Saved", "Loaded example CRT", "3 open CLR concerns", etc. |

## Building a Current Reality Tree

The fastest way to feel the tool out: open the palette with `Cmd/Ctrl+K` and pick **Load example Current Reality Tree**. You'll get six entities, five edges, and one AND group illustrating the convention. Click around, then start a new one with `Cmd/Ctrl+K` → **New Current Reality Tree** when you're ready.

To build from scratch:

1. **Double-click** the empty canvas. A blank node appears with the title field already focused.
2. Type your first **Undesirable Effect** — the thing customers actually feel. E.g., "Customer satisfaction is declining." Press `Enter`.
3. Click the node to select it (the inspector slides in on the right).
4. In the inspector's **Type** grid, click **Undesirable Effect**. The node's left stripe turns red.
5. With the node still selected, press `Shift+Tab` to create a parent — a candidate cause for the UDE. It appears below (CRT layout flows bottom-up; causes sit below effects).
6. Type the cause, press `Enter`. Repeat.

You can also drag from the small handle on the bottom edge of a node onto another node to connect them manually.

## Working with entities

CRTs use four entity types:

| Type | Stripe color | Role |
| --- | --- | --- |
| Undesirable Effect | Red | The terminal effects at the top — what the system painfully produces today. |
| Effect | Neutral grey | Intermediate effects between root causes and UDEs. |
| Root Cause | Amber | Terminal causes at the bottom — the leverage points. |
| Assumption | Violet | Side-attachments to edges that make CLR challenges explicit. |

FRTs replace `Undesirable Effect` and `Root Cause` with `Desired Effect` and `Injection` respectively.

**Goal-Tree extras (available in both CRT and FRT palettes).** Three additional types support Goal Tree / IO map work:

| Type | Stripe color | Role |
| --- | --- | --- |
| Goal | Sky-500 | The terminal objective at the top of a Goal Tree. |
| Critical Success Factor | Teal-600 | Conditions that must hold for the goal to be reachable. |
| Necessary Condition | Lime-500 | Sub-conditions and prerequisites underneath each CSF. |

**Notes (universal across diagram types).** A free-form annotation entity for "sticky notes" you want to pin next to the diagram without making them part of the causal logic.

| Type | Stripe color | Role |
| --- | --- | --- |
| Note | Yellow-500 | A pinned annotation. Not part of the causal graph — Notes can't be connected with edges, don't trigger CLR rules, and don't appear in reasoning narrative / outline exports. The card renders with a yellow body so it reads as a sticky note rather than a TOC-typed entity. |

Use Notes for caveats, open questions, references to external docs, or workshop captures that aren't yet ready to become entities. To create one: Inspector → Type grid → Note (or right-click → Convert to → Note).

**Type cues at a glance.** Every node carries two visual cues for its type: the coloured **stripe** down the left edge, and a small **icon** next to the type label (warning-triangle for UDEs, sprout for root causes, hammer for actions, and so on). The icon makes types readable even with the high-contrast / colorblind-safe palette on, where stripe colour alone is less reliable.

**Reading titles when zoomed out.** Below roughly 70 % zoom, node titles get hard to read in place. Hover (or select) any node and a larger overlay card surfaces above it with the full title, type label, and the first few lines of the description — rendered in screen coordinates, so it stays readable no matter how far out you've zoomed. The overlay disappears as soon as you stop hovering or zoom back in.

**Editing a title.** Click a node to select it, then either start typing in the inspector's Title field, or press `Enter` to edit inline on the canvas. `Esc` exits inline edit without committing what you were typing in that field; clicking elsewhere commits. Use **`Alt+Enter`** inside the inline editor to add a newline — useful when you want a two-line title without abbreviating. The on-canvas title clamps at two lines with ellipsis; hover any node to see the full title in a tooltip.

**Changing the type.** Inspector → Type grid → click the new type. The stripe color updates immediately. You can also right-click a node and pick a "Convert to ..." option.

**Adding a description.** The inspector has a longer notes field below Type. Use it for context, sources, or why this entity is included. **Markdown is supported** — `**bold**`, `*italic*`, lists, headings, tables, inline `code`, and external `[links](https://example.com)` all render in the Preview tab next to the editor. External links open in a new tab; internal references like `[see #14](#14)` (where `14` is an entity's annotation number) become click-to-jump chips that auto-expand any collapsed groups along the way. The Document Inspector's description field works the same way.

**Changing the title size.** Below the description field there's a three-button **Title size** group — Compact / Regular / Large. Useful for shrinking a noisy sub-tree's labels or enlarging a key entity for emphasis. Per-entity; default is Regular.

**Collapsing one entity's downstream.** Right-click an entity that has any downstream edges and pick **Collapse downstream**. Its successors disappear from the canvas; a small `▸ +N` chip on the entity shows how many descendants are hidden. Click the chip (or right-click → **Expand downstream**) to bring them back. This is per-entity; group-level collapse — for an entire labeled group — is described under [Groups → Collapse and expand](#collapse-and-expand).

**Custom attributes.** Below the WarningsList in the inspector there's an **Attributes** section where you can attach key/value metadata to any entity — text, integer, decimal, or yes/no. Useful for things the built-in fields don't cover: a source URL, a vendor name, a probability, a domain-specific flag. Click **+ Add attribute**, pick a name and a kind, save; the typed input appears in the row. Attributes round-trip through JSON export. **Edges carry the same Attributes section** in the Edge Inspector — handy for per-causality metadata like a probability or a citation slug.

**Deleting.** Press `Delete` (or `Backspace`) with a node selected. If the node has edges attached, you'll get a confirm prompt with the number of connections that will be cut. Cancel from the prompt to keep it.

## Connecting causes to effects

Three ways, in increasing order of speed:

1. **Drag.** Hover a node — handles appear on the top and bottom. Drag from one node's bottom handle onto another node. The first becomes the cause, the second the effect.
2. **Tab.** With a node selected, `Tab` creates a child entity *and* connects current → new. `Shift+Tab` creates a parent (new → current). Both put the new entity in edit mode so you can name it right away.
3. **Right-click.** Right-click an entity for **Add child** / **Add parent** entries.

The canvas re-flows automatically after each change, with a 300 ms ease-out animation. New nodes and edges fade in over ~220 ms; deletions fade out symmetrically. Both honor the **Animation speed** preference in Settings (Instant skips the fades entirely).

**Reversing a direction.** Right-click an edge → **Reverse direction**, or run the *Reverse edge* command from the command palette. The cause and effect swap. If the opposite-direction edge already exists, you'll get an info toast instead of a corrupted graph.

**Splicing a new entity into the middle of an edge.** Right-click an edge → **Splice entity into this edge**. The original edge is removed and a fresh entity is created at the diagram's default type, sitting between the original source and target with two new edges connecting them. The new entity is selected and put into inline-edit mode so you can type its title immediately. Useful when you realize a causal step is missing — say you have `Old system is slow → Customers churn` and want to say `Old system is slow → New onboardings stall → Customers churn`. The original edge's label, assumptions, and back-edge tag (if any) stay on the downstream half (the half closer to the effect). If the spliced edge was part of an AND group, the grouping is dropped on both new edges with a notification toast — re-AND if you want to reconstruct that structure.

**Adding a co-cause by dragging onto an edge.** When you want to say "this thing also has to hold for the effect to happen" — i.e. add an AND-joined co-cause to an existing edge — start a connection drag from the new cause-entity's handle and release the drag *on top of the existing edge*. TP Studio detects the edge as the drop target, creates the new edge to the original edge's target, and AND-groups the two so they converge through a single junctor. A toast confirms ("Added as a co-cause (AND-grouped)."). Different from Splice: splice puts the new entity *between* the two endpoints; drag-onto-edge puts it *alongside* the existing source as another sufficient cause.

**Tagging a back-edge (acknowledged loop).** Sometimes a causal loop is *the point* — a vicious circle in a CRT, a positive reinforcing loop in an FRT. Right-click the loop-closing edge → **Tag as back-edge** (or use the **Back-edge** checkbox in the Edge Inspector). The edge renders with a thicker dashed stroke and a `↻` glyph; the cycle CLR rule stops flagging that cycle as a defect. You can untag any time from the same menu / checkbox.

**Marking the conflict on an Evaporating Cloud.** An EC's diagnostic depends on its two Wants being mutually exclusive. Draw an edge between the two `want` entities (start a drag from one Want's handle, release on the other), select it, and tick the **Mutual exclusion (EC)** checkbox in the Edge Inspector. The edge renders red with a ⚡ lightning-bolt glyph, and the `ec-missing-conflict` CLR rule stops firing. The checkbox only appears in the inspector when both endpoints are Wants.

**EC inspector tabs (Session 77).** When the open document is an Evaporating Cloud, the right inspector grows a three-tab bar at the top:

- **Inspector** — the standard entity / edge inspector for whatever you've selected.
- **Verbalisation** — the full read-aloud form of the cloud ("In order to achieve {A}, we must {B}, because {assumption-count}…"). Each "{assumption-count}" anchor is clickable and jumps to the corresponding edge's Assumption Well.
- **Injections** — every `injection` entity in the doc with its linked assumptions. Use **+ link assumption** to wire an injection to the assumptions it would invalidate, then tick **Implemented** when you ship the change — the corresponding arrows go green.

**Assumption status chips.** On an EC edge, every assumption row has a small status chip (U / V / I / C) you click to cycle the status: **U**nexamined → **V**alid → **I**nvalid (often the breakthrough — usually means the arrow is broken) → **C**hallengeable (lights up the Injection Workbench). The chip is the most compact way to track the lifecycle of every "we're assuming X" claim.

**Press `A` on a selected edge** to add a new assumption directly without opening the inspector — same as clicking **+ New assumption**. On EC edges the new row is pre-seeded with `"…because "` so the canonical "we must obtain Want because of Assumption" reading falls out for free.

**Verbalisation strip across the top.** When you open an EC document, a thin italic strip at the top of the canvas reads the cloud's verbal form continuously. Edit any of the 5 slot titles and the strip updates live; click an assumption-count chip in the strip to jump straight to that edge's Assumption Well.

**Starting a Negative Branch from a UDE (FRT).** Right-click any entity in an FRT → **Start Negative Branch from this entity** (or use the palette command). Creates a new "Negative Branch" group (rose) rooted at that entity. The book's framing: when an FRT injection produces an unintended UDE, capture the branch leading to it and decide whether to mitigate the negative (add a corrective Action) or replace the injection. Add the causal chain leading to the UDE inside the group.

**Archiving pruned alternatives.** When you've considered a branch and decided not to pursue it, the book says don't delete — archive. Palette → **Move selection to Archive group** either creates a new "Archive" group (slate, collapsed) or appends to an existing one. The archive stays visible in the inspector but folded out of the canvas, preserving the path-not-taken as a record without cluttering the live diagram.

**Span of control / sphere of influence.** Each entity has an optional 3-value flag in the inspector: **Control** (I can act on this directly), **Influence** (I can affect it indirectly), or **External** (I can only observe it). When set, the node shows a small letter pill — green `C`, amber `I`, neutral `E`. The book's intro and CRT Step 7 ask "have you built down to causes you actually control or influence?" — a root cause flagged External in a CRT fires a soft CLR nudge prompting you to keep digging. FRT injections and other entity types are exempt (the warning would be noise on them).

## Working with multiple entities

Selecting more than one thing turns the right Inspector into a **bulk-actions** panel.

- **Build a multi-selection.** Click one entity to select it, then `Shift+click` further entities (or edges) to add or remove them. Or click-and-drag on the empty canvas to marquee-select everything inside the rectangle. Hold `Shift` while marquee-dragging to add to the current selection instead of replacing.
- **Bulk convert.** With several entities selected, the Inspector's "Convert all to…" grid converts every selected entity to the chosen type. Same on the right-click menu.
- **Bulk title size.** "Title size — apply to all" sets every selected entity's title to Compact / Regular / Large in one click. Picking Regular clears the per-entity override entirely (matches a freshly-created entity). The pill highlights when the whole selection already shares that size.
- **Renumber as steps.** With ≥2 entities selected, the Renumber control writes the `Step` annotation across the selection in order: pick a start number (default `1`), click *Apply N…N+k-1*. Useful after reordering a TT or PRT chain — you don't have to retype each step.
- **Swap entities.** Select exactly two entities → click "Swap entities" in the Inspector, or press `Cmd/Ctrl+Shift+S`. Their titles, types, and notes trade places while their edges stay attached to the same canvas positions — useful when you realize the diagram has cause and effect on the wrong nodes.
- **Bulk delete.** `Delete` / `Backspace` with a multi-selection fires one confirm prompt reporting the total cascade ("Delete 4 entities and 7 connections?") and deletes everything in one undo step.
- **Cut / copy / paste.** `Cmd/Ctrl+C` copies the entity multi-selection plus every edge that's fully inside it. `Cmd/Ctrl+V` pastes with fresh IDs and annotation numbers; pasting twice produces two independent copies. `Cmd/Ctrl+X` cuts.
- **Alt+click to connect.** With exactly one entity selected, Alt-clicking another entity creates an edge from the current to the clicked one — handy when you want to wire up several causes quickly.

**Selecting many entities.** Three ways to build a multi-selection:

1. **Shift+click** — adds (or removes) the clicked entity to/from the current selection. Works on both entities and edges; selection types stay homogeneous (entities or edges, not mixed).
2. **Marquee** — click and drag on empty canvas to rubber-band a rectangle; everything inside is selected. Hold `Shift` while marquee-dragging to add to the existing selection rather than replace it.
3. **Walk the graph by selection** — `Cmd/Ctrl+Shift+→` selects every downstream entity, `Cmd/Ctrl+Shift+←` selects every upstream entity, and palette → *Select path between selected entities* finds the path between two selected entities.

**Cut / copy / paste.** `Cmd/Ctrl+C` copies the current entity multi-selection plus every edge fully inside it. `Cmd/Ctrl+V` pastes with fresh IDs and annotation numbers — paste twice for two independent copies. `Cmd/Ctrl+X` cuts. Cross-document paste works: the clipboard is in-memory and survives a `setDocument` swap.

## Finding and navigating

Once a diagram has a couple of dozen entities, getting around becomes a separate skill from drawing. The tool ships four assists for that:

**Find (`Cmd/Ctrl+F`).** Opens a Find panel pinned near the top of the canvas. Type a query — entity titles, entity descriptions, and group titles match live. Toggle case-sensitive, whole-word, or regex modes from the icons on the right; the regex toggle also accepts the `/pattern/flags` shorthand. Press `Enter` to jump to the next match, `Shift+Enter` for the previous. The canvas pans to center each match, and any collapsed groups in the way are automatically expanded; if you're hoisted somewhere else, the tool unhoists so the match is reachable. While the panel is open and the query has at least one hit, non-matching nodes and edges fade to ~18% opacity so the matches stand out without losing the surrounding causal context.

**Minimap.** A small thumbnail of the whole diagram lives in the bottom-right of the canvas, with the current viewport drawn as a rectangle. Click or drag inside it to pan; scroll to zoom. Hide it from **Settings → Display → Show minimap** if you'd rather have the canvas space back.

**Zoom (`+` / `-` / `0`).** Plus zooms in, minus zooms out, `0` fits the view to all visible entities with comfortable padding. A small percentage indicator next to the bottom-center Controls shows the current zoom level.

**Walk the graph by selection.**

- `Cmd/Ctrl+Shift+→` — selects every entity downstream of the current selection (follows outgoing edges transitively).
- `Cmd/Ctrl+Shift+←` — selects every upstream entity.
- Palette → **Select path between selected entities** — with exactly two entities selected, finds the shortest directed path between them and selects every entity and edge on the way. Falls back to ignoring direction if no directed path exists. Toasts if the two are disconnected.

**Radial / sunburst layout.** A toolbar button (Orbit icon, between the Lock and Help buttons) flips the layout between the default top-down dagre flow and a radial sunburst — apex at the center, contributors radiating out on concentric rings. Useful for "see the whole tree at once" screenshots, posters, or alternative reading. Click again to flip back; the preference persists across reloads. **The toggle hides on Evaporating Cloud** since EC is hand-positioned — its 5-box geometry IS the diagnostic, so flipping to radial would erase the conflict.

**Pinning entities (drag-to-pin).** On any diagram, dragging an entity now persists its position — that entity becomes pinned in place. Auto-layout (dagre on CRT/FRT/PRT/TT, the radial sunburst, etc.) routes around the pin: it lays out every other entity normally and overwrites the dagre coords for pinned ones with your saved values. A small violet pin glyph appears at the bottom-right of pinned entities so you can spot them at a glance. To free a pin, right-click → **Unpin position (let layout reclaim)**, or run **Palette → Reset layout — unpin all entities** to clear every pin in the doc. Manual-layout diagrams (Evaporating Cloud) don't show the pin glyph because every entity is implicitly pinned to its slot there.

## Verbalizing a diagram (read-through + CLR walkthrough)

Two palette commands turn a diagram into a guided talking-out-loud pass — useful for presentations, audits, and your own discipline.

**Read-through.** Palette → **Start read-through (verbalize every edge)**. Walks every structural edge in topological order (root causes first, terminal effects last) and renders each as a complete English sentence in the diagram's natural reading. CRT/FRT/TT default to `"[Effect] because [Cause]"`; PRT/EC default to `"In order to obtain [Effect], [Cause] must hold."` Use `→` / Space to advance, `←` to go back, Esc to close. Each step has an "Open this edge in the inspector" button so you can stop and edit if a sentence reads wrong.

The reading word is controlled by **Settings → Display → Causality reading**:
- **Auto** — diagram-type-aware (recommended).
- **Because** / **Therefore** — sufficient-cause readings.
- **In order to** — necessity reading (manual override).
- **None** — no fallback label; per-edge labels still render.

**CLR walkthrough.** Palette → **Start CLR walkthrough**. Iterates over every *open* CLR warning one at a time. Each step shows the rule, tier (Clarity / Existence / Sufficiency), the entity or edge it targets, and the message. Two actions: **Resolve** (marks it resolved and advances) and **Open in inspector** (jumps to the item and closes the wizard so you can fix the underlying structure). When no open warnings remain, the palette command toasts "No open CLR concerns to walk through." rather than opening an empty wizard. The walkthrough is the deliberate version of the Inspector's at-a-glance WarningsList — designed to enforce the book's prescription to "consider each CLR question for each part of the diagram."

## Analysis: finding the Core Driver and recasting it as a Cloud

Drawing a CRT is half the job. The point of the diagram is to find the **Core Driver** — the single root cause whose elimination clears the most Undesirable Effects (Goldratt's Step 9). TP Studio gives you two views and one follow-up action:

**Palette → Find core driver(s).** Walks every candidate root cause (explicit `Root Cause`-typed entities, or graph leaves if none are typed), counts how many UDEs each one transitively reaches, and selects the top candidate(s). The toast tells you the score: `Core driver: "Order entry is manual" reaches 7 UDEs.` When several candidates tie for top — common on a mature CRT — they're all selected and the toast lists the comparison. No UDEs in the diagram? You'll get a friendly message instead of an empty selection.

**Settings → Display → Show UDE-reach badge.** Continuous view of the same signal: every entity that transitively reaches one or more UDEs gets a small amber `→N UDEs` pill at the bottom-left of its node. The higher the number on a leaf cause, the stronger that cause's case for being the Core Driver. The badge auto-hides on diagrams without UDEs (Prerequisite Tree, Transition Tree, Evaporating Cloud).

**Settings → Display → Show root-cause-reach badge.** The inverse view, also continuous: every entity gets a sky `←N root causes` pill at the bottom-right showing how many root causes transitively feed it. Useful for confirming UDEs have enough root-cause support (high number = many independent contributing causes), or for spotting orphan UDEs that need more downward work (low number).

**Right-click any CRT entity → Spawn Evaporating Cloud from this entity** (also Palette → **Spawn Evaporating Cloud from selected entity**). Once you've identified the Core Driver, the book's prescription is to recast it as the Core Conflict and explore it with an EC. This action opens a fresh Evaporating Cloud document seeded with the source entity's title in the **Want 1** slot, plus blank placeholders for Goal, Need 1, Need 2, and Want 2. Your CRT isn't lost — it's auto-snapshotted to the revisions panel as part of the document swap, and you can roll back to it any time. The new EC's title is prefixed `EC from "..."` so it's identifiable in the revision list.

## Transition-Tree discipline

A Transition Tree (TT) translates a plan into a sequence of structural "steps", each of which the book defines as `Outcome ← Precondition + Action` — the Action is the do-something; the Precondition is the existing reality that, together with the Action, sufficient-cause-produces the Outcome.

**Complete-Step CLR rule.** In TT documents, the inspector's CLR panel includes a new sufficiency-tier rule called `complete-step`. It fires on the edge from any Action to its Outcome when nothing else feeds that Outcome — i.e. the precondition slot is empty. The message: *"Action has no precondition — what existing condition lets it produce this outcome?"* The rule treats AND-joined siblings as fulfilling the precondition role; you don't have to explicitly group them. Other diagram types (CRT, FRT, PRT, EC) don't pick up this rule.

**Unspecified placeholders.** Sometimes you *know* there's a precondition (or cause, or condition) but can't yet name it — the book calls these "inarticulate reservations." The EntityInspector has an **Unspecified placeholder** toggle for exactly that case. When on:

- The entity-existence rule no longer fires on an empty title — the blank slot is deliberate.
- The node renders with a `?` glyph and an italic *"Unspecified — fill in later"* hint.
- The Complete-Step rule treats the placeholder as filling the precondition slot, so wiring `unspecified-placeholder + action → outcome` quiets the warning.

Toggle the flag back off once you've articulated whatever the placeholder stood for. The flag is generic — it works in any diagram type, not just TT — but the immediate use is filling out a TT step before you have all the language for it.

## Quick Capture and CSV import

Two ways to skip the one-click-per-node flow when you already have the structure in another tool (notes, a meeting transcript, a spreadsheet).

### Quick Capture

Press **`E`** (when you're not typing in a text field) or open the palette and pick **Quick Capture…**. A two-pane modal appears:

- On the **left**, paste or type a bulleted, indented list. One line per entity. Indent 2 spaces (or a tab) for each level of nesting.
- On the **right**, a live preview shows exactly what will be created, with `→` arrows at each indent level.

Hit **`Cmd/Ctrl+Enter`** (or the "Create N entities" button) to commit.

What gets normalized:

- Leading bullets are stripped: `-`, `*`, `•`, `>`, `1.`, `2)`.
- A single leading emoji + space is stripped: `✅ Win the day` → `Win the day`.
- Blank lines and lines that contain only a bullet are skipped.

Where the roots attach:

- If you had **exactly one entity selected** when you opened Quick Capture, every root in the captured tree attaches as a child of that selection. Build a sub-tree off any node in one paste.
- If you had nothing selected (or a group / multi-selection), the roots float free at the canvas root.

After commit, the newly created entities are pre-selected — handy for grouping (palette → Group selected entities) or undoing the whole capture (Cmd+Z).

### CSV import

Open the palette and pick **Import entities from CSV…**. A file picker opens. The header row is required:

| Column | Required | Description |
| --- | --- | --- |
| `title` | yes | The entity's title. |
| `type` | yes | One of `ude`, `effect`, `rootCause`, `injection`, `desiredEffect`, `assumption`. |
| `description` | no | Multi-line text supported via quoted fields. |
| `parent_title` | no | If set, wires an edge from the row whose `title` matches → this row. Resolves within the same import only. |

The parser is forgiving: quoted fields can contain commas; `""` escapes a literal quote inside a quoted field; header columns can appear in any order. Unknown types are rejected with a line-numbered toast — the import fails as a whole so you don't end up with a partial document.

Example:

```csv
title,type,description,parent_title
"Customer satisfaction is declining",ude,,
"Order entry is manual",rootCause,"Hand-keyed from email orders","Customer satisfaction is declining"
"Warehouse is understaffed",rootCause,,"Customer satisfaction is declining"
```

## Groups

A **group** is a visual container around a region of the diagram — useful when several entities relate to one operational area, one root cause cluster, or one slice of the system. Groups don't affect causal reasoning; they're purely a way to organize the canvas.

### Creating a group

1. Multi-select the entities you want to gather (Shift+click, marquee, etc.).
2. Open the palette (`Cmd/Ctrl+K`) → **Group selected entities**.
3. A dashed labelled rectangle appears behind the selected entities. Click its title to select the group itself.
4. With a group selected, the right-hand Inspector lets you rename it, pick a color (six tones — slate / indigo / emerald / amber / rose / violet), collapse / hoist it, and delete it.

### Nesting

Groups can contain other groups. Two paths:

- **Create a nested parent.** Multi-select a mix of entities and existing groups, run **Group selected entities**, and the new outer group holds them all.
- **Move an existing group under another.** Select the group you want to nest, then use the **Nest into parent group** dropdown in its inspector to pick the target. The dropdown excludes self and any group that would create a cycle.

Deleting a parent group preserves its children — they're promoted one level up rather than disappearing.

### Collapse and expand

A group can collapse into a **single big card** that stands in for everything inside. Toggle with the **Collapse / Expand** button in the inspector, the `→` (expand) / `←` (collapse) keys with the group selected, or **double-click** a collapsed card.

When a group is collapsed:
- Its member entities and any nested groups are hidden.
- Edges crossing the boundary route to/from the collapsed card instead.
- Multiple edges between the same pair of nodes are **aggregated** into one edge with a `×N` count badge.
- Edges entirely inside the collapsed group are dropped from view.

### Hoist

Hoisting **zooms the canvas into a group's interior**, hiding everything outside. Useful for working on a complex sub-area without the rest of the diagram in the way.

- Hoist with **Enter** on a selected group, the **Hoist into group** Inspector button, or the **Hoist into selected group** palette command.
- A breadcrumb at the top-center shows where you are (`Document › Outer › Inner`). Click any segment to jump to that level.
- Press **Esc** to unhoist one level. The breadcrumb's **×** exits hoist entirely.
- Cross-boundary edges (those connecting hoisted entities to entities outside) are temporarily hidden from view.

### Delete

Deleting a group preserves its members. If the group was nested inside a parent, the children are **promoted** into the parent in-place — they take the deleted group's old slot. Top-level group delete just leaves the members at the canvas root.

## AND groups

By default a single arrow from cause to effect means "X is sufficient to produce Y." When two or more causes are *jointly* required — neither alone is enough — group their edges as an **AND**:

1. **Shift+click** each edge that should be in the group. (Click one, hold Shift, click the next.)
2. Open the command palette (`Cmd/Ctrl+K`) and pick **Group selected edges as AND**. The edges turn violet and converge into a small **junctor circle** (a white circle outlined in violet with "AND" written inside) sitting just above the target. A single short arrow continues from the junctor down into the target — the same convention Flying Logic uses for AND vertices.

Constraints: every edge in a group must share the same target — the tool will refuse to group edges that don't.

To **ungroup**: select one of the AND-grouped edges; the inspector shows the group ID and an **Ungroup** button. Or use the palette's "Ungroup selected AND edges" command on a multi-selection.

The cause-sufficiency CLR warning automatically suppresses itself on edges that are part of an AND group.

### OR and XOR junctors

The same shift-click + "Group as …" pattern works for two more junctor kinds. Each junctor is its own circle with its own kind label and color:

- **AND** — violet circle, "AND" label. All causes jointly required. *(Default.)*
- **OR** — indigo circle, "OR" label. At least one cause suffices (explicit alternation).
- **XOR** — rose circle, "XOR" label. Exactly one cause holds (mutual exclusion across the group).

The three kinds are **mutually exclusive on a given edge**: an edge belongs to at most one junctor at a time. Trying to OR-group edges that are already AND-grouped gets a "junctor conflict" toast — ungroup first, then re-group.

Both OR and XOR live in the same right-click menu, MultiInspector, and command palette as AND: **Group as OR / XOR** and **Ungroup OR / XOR**. The Edge Inspector shows the group id with an Ungroup button matching whichever kind the edge belongs to.

### Edge polarity (positive / negative / zero)

The Edge Inspector carries a **Polarity** 4-button row (Default / Positive / Negative / Zero). The picker tags an edge's correlation:

- **Default** (unset, the common case) — positive sufficiency. The reading is "this cause produces this effect," the TOC default.
- **Positive** — explicit positive correlation. Equivalent to Default in semantics; use when you want the tag to be visible.
- **Negative** — *this cause reduces this effect.* A small rose `−` badge appears next to the edge label. Useful when you're sketching counter-causal arguments or marking inhibitory relationships explicitly. CLR rules don't change behavior on weight — it's a documentation field.
- **Zero** — neutral / non-influential. A neutral `∅` badge appears.

Polarity round-trips through JSON. Foreign-format exports (DOT / Mermaid / FL) drop it for now.

## Edge annotations

Edges carry three distinct kinds of attached text — each fills a different role:

- **Label** — a short pill rendered inline at the edge's midpoint, ≤30 chars. The "what is this edge" word: `because`, `therefore`, `within 30 days`, etc. Indexed by Find (`Cmd/Ctrl+F`).
- **Description** — long-form markdown explanation that opens in the inspector. The "why this edge holds" prose for context that doesn't deserve a separate Assumption entity but is too long for the label. Renders with bold/italic/lists/links/`#N` cross-references. When set, a small `📝` indicator appears mid-edge so you can spot annotated edges at a glance.
- **Assumptions** — linked Assumption entities for explicit CLR challenges (see below). Use these when an assumption is substantive enough to deserve its own entity that can be referenced from multiple edges.

## Assumptions on edges

The CLR are challenges to your causality. The tool models them as **assumptions** attached to edges — first-class entities you can name, describe, and reference.

1. **Click an edge.** The inspector shows source/effect titles, the edge kind, AND group info if any, and an **Assumptions** section with a `+ New assumption` button.
2. Click **+ New assumption**. A violet-tinted row appears with an inline input and the cursor focused.
3. Type the assumption — e.g., "Customers complete the checkout if shipping costs are visible upfront."
4. **Detach** any assumption from this edge with the small × button on its row. The entity itself remains; only the link is removed.
5. **Open** the assumption (the small ↗ arrow) to switch to its own inspector view. From there you'll see an **Attached to** section listing every edge that references it, so an assumption can support more than one edge.

When an assumption entity is deleted, every edge that referenced it is automatically scrubbed.

## The CLR panel

Whenever you select an entity or edge, the inspector renders any open CLR concerns at the bottom:

- **Open** warnings are amber.
- **Resolved** warnings are greyed out with a strikethrough; you can reopen them.
- Each warning has the rule name (e.g., `clarity`, `cause-sufficiency`) and a one-line description of the concern.

Hover a warning to reveal the Resolve / Reopen button. Resolution persists in the document and survives JSON export/import.

You can also see a total count at any time: `Cmd/Ctrl+K` → **Run validation** surfaces a toast with the open / resolved breakdown.

## Future Reality Trees

The mechanics are identical to CRT — only the entity palette and convention differ.

- Start one with `Cmd/Ctrl+K` → **New Future Reality Tree** (or load the example via **Load example Future Reality Tree**).
- The four available types are: **Injection** (the change you propose), **Effect** (intermediate consequences), **Desired Effect** (what the customer feels — the top of the tree), and **Assumption**.
- The same CLR rules apply with two FRT-specific tweaks: cause-effect-reversal does *not* fire (it's a CRT-only heuristic), and predicted-effect-existence kicks in when an injection has no consequences attached yet.

## Evaporating Clouds

An Evaporating Cloud (EC) surfaces a *conflict* between two strategies that both pursue the same underlying goal. The classic 5-box arrangement carries the diagnostic meaning — this is the only diagram type in TP Studio that's **hand-positioned** rather than auto-laid-out.

EC documents have a dedicated three-tab inspector and a top-of-canvas **verbalisation strip** that reads the cloud aloud in canonical book-form.

- Start one with `Cmd/Ctrl+K` → **New Evaporating Cloud** (or load the example via **Load example Evaporating Cloud**). A blank EC arrives with all 5 boxes pre-positioned in the canonical layout — you fill in the titles, you don't have to recreate the structure.
- The five boxes (reading right-to-left):
  - **Goal** (sky stripe, far left) — the common objective both parties share.
  - **Need 1 / Need 2** (amber, middle column) — the two prerequisites that *both* must hold for the goal to be reachable.
  - **Want 1 / Want 2** (fuchsia, far right) — the two strategies that satisfy each need but *conflict* with each other.
- The four arrows wire D → B → A and D′ → C → A: each want satisfies its need, each need supports the common goal. The conflict between D and D′ isn't a drawn edge — it's implied by the layout (top vs. bottom on the right side).
- **Drag any box to reposition it.** Positions persist to local storage and survive reload. Auto-layout is disabled for EC; the geometry IS the diagnostic.
- The palette also surfaces Assumption (violet) for edge side-attachments. CLR rules apply structurally (clarity, entity-existence, causality-existence, tautology); EC-specific rules ("are the two wants genuinely in conflict?") are parked for now.

## Transition Trees

A Transition Tree is a sequenced injection plan — the chain of actions that move you from current reality to a desired effect. Each action carries an explicit step number so the order stays legible after rearranging.

- Start one with `Cmd/Ctrl+K` → **New Transition Tree** (or load the example via **Load example Transition Tree**).
- The palette types are: **Action** (cyan, the step you take), **Effect** (grey, intermediate states the plan passes through, optional), **Desired Effect** (indigo, the outcome at the top), and **Assumption** (violet, edge side-attachments).
- Select an Action in the inspector to see a **Step #** numeric input. Set a step number and a small "Step N" badge appears at the node's top-left. Leave it blank to hide the badge — the step field is action-only today.
- Layout is regular dagre. If you connect the actions in order (Tab from action 1 to action 2 etc.), the flow naturally reads top-to-bottom; the step badges then act as a visible cross-check rather than the layout driver.
- No TT-specific CLR rules yet. The CRT/FRT heuristics simply don't fire on a TT.

## Prerequisite Trees

A PRT (Prerequisite Tree) surfaces what's between you and a goal — the obstacles, plus the intermediate objectives that overcome each one. Read bottom-up: do these IOs → defeat these obstacles → reach the goal.

- Start one with `Cmd/Ctrl+K` → **New Prerequisite Tree** (or load the example via **Load example Prerequisite Tree**).
- The palette types are: **Goal** (sky-500, the ambitious target at the top), **Obstacle** (rose-500, what's in the way), **Intermediate Objective** (blue-600, the steps that defeat each obstacle), and **Assumption** (violet, edge side-attachments).
- The canvas mechanics are identical to CRT — drag-to-connect, `Tab` for child, right-click for actions. Layout is the same dagre flow; nothing about PRT requires hand-positioning.
- No PRT-specific CLR rules yet. The CRT-only and FRT-only heuristics simply don't fire on a PRT.

## Creation wizards (Goal Tree + EC)

When you open a new Goal Tree or Evaporating Cloud, a small **"Get started" panel** appears at the top-left of the canvas and walks you through the canonical structure:

- **Goal Tree**: 5 steps — the Goal, then 3 Critical Success Factors, then your first Necessary Condition. Each `Next ›` commits the entity to the canvas (auto-laid-out by dagre) and connects it to its parent with a necessity edge.
- **Evaporating Cloud**: 5 steps — the shared objective A, then Need B, Need C, Want D, Want D′. Each `Next ›` fills the corresponding pre-seeded slot's title.

The wizard is **never blocking**. You can:

- **Skip step** to advance without filling that prompt.
- **Minimise** (chevron-up) to collapse the panel to a "Continue setup ›" pill that sits in the same spot — click it to expand again.
- **Dismiss** (X or Esc) to close the panel for this session; the entities you already created stay where they are.
- Tick **"Don't show this on new {Goal Trees|Evaporating Clouds}"** to silence the wizard for all future new diagrams of that type. Re-enable in **Settings → Behavior** or via the palette command **Reopen creation wizard** to bring it back for the current doc.

Want to skip straight to the canvas without the wizard? Either click Dismiss once, or turn the toggle off in Settings → Behavior. Both diagram types start with the canonical structure ready to edit — Goal Tree's empty canvas with the entity palette tuned, EC's 5 pre-seeded boxes waiting for titles.

## Strategy & Tactics Trees

A **Strategy & Tactics (S&T) Tree** is Goldratt's later-work pattern for cascading strategies down into the tactics that implement them, each layer carrying its assumption set. The TP Studio implementation uses the existing TOC entity types as facet carriers — the new diagram type is a thin shell that tunes the palette and provides a method checklist.

- Start one with `Cmd/Ctrl+K` → **New Strategy & Tactics Tree** (or load the example via **Load example Strategy & Tactics Tree**).
- The palette types map onto the S&T facets:
  - **Goal** (sky) — a *strategy* at this level (the apex or a sub-level objective).
  - **Injection** (emerald) — the *tactic* that achieves the strategy. Default entity type when you double-click the empty canvas.
  - **Necessary Condition** (lime) — the *necessary / parallel / sufficiency assumption* layer attached to a tactic. The book distinguishes three roles (NA / PA / SA); TP Studio uses the same entity type for all three and lets you label the role in the title or description.
  - **Effect** (grey) + **Assumption** (violet) + **Note** (yellow) round out the palette.
- Build top-down: place the apex strategy as a `goal`, place its tactic below as an `injection`, then attach `necessaryCondition` entities feeding the tactic for the assumption facets. Each tactic decomposes into the next layer down by becoming the parent of a child strategy.
- The Document Inspector's Method checklist carries six S&T steps (apex strategy → tactic → NA → PA → SA → decompose) so you can tick off the discipline as you go.
- **First-class 5-facet card.** Select any injection (tactic) on an S&T diagram; the inspector grows a new **S&T facets** section with four textareas — Strategy, Necessary Assumption, Parallel Assumption, Sufficiency Assumption. Filling any one of them flips the canvas card into a tall 5-row layout with the four facets stacked beneath the tactic title. The Strategy row gets an indigo accent so it stands out from the three assumption rows. Empty rows render as italic `(unset)` placeholders so the structural slot stays visible. This is the optional alternative to modeling each facet as its own entity — pick whichever style fits the level of detail you want.
- **CLR rules.** Structural set plus the S&T-specific **`st-tactic-assumptions`** rule: fires (clarity tier) on any tactic with fewer than three incoming `necessaryCondition` entities. The nudge prescribes Goldratt's three-facet pattern; resolve individual warnings if a tactic legitimately doesn't need all three.

## Freeform diagrams

A **Freeform Diagram** is the non-TOC mode: no built-in type pattern matching, no method checklist, no prescribed structure. Useful when you want the entity/edge canvas for argument-mapping, brainstorm boards, or dependency sketches that don't fit any TOC tree shape.

- Start one with `Cmd/Ctrl+K` → **New Freeform Diagram** (or load the example via **Load example Freeform Diagram**).
- The default palette has only three types: **Effect** (grey, the neutral box), **Assumption** (violet, side-claim on an edge), and **Note** (yellow sticky annotation outside the causal graph).
- Pair this with **Custom entity classes** (in the Document Inspector) to define your own typology — e.g. `Evidence`, `Belief`, `Claim` for an argument map, with their own labels, colors, and icons. Custom classes appear alongside the built-in three in the palette.
- CLR rules: only the **structural** set fires — entity-existence, causality-existence, clarity, tautology, cycle, indirect-effect. Type-pattern-matching rules (cause-effect-reversal, predicted-effect-existence, etc.) are skipped because their target entity types don't exist in the freeform palette.
- No method checklist; the Document Inspector hides the section.

## Saving, exporting, and sharing

**Autosave.** Every change is queued for write to your browser's local storage 200 ms after typing stops. `Cmd/Ctrl+S` forces an immediate flush and shows a confirmation toast. Closing the tab also forces a flush.

**Auto-recovery.** Alongside the debounced "committed" save, a *live draft* is written synchronously on every keystroke under a separate storage key. If the browser is killed or your machine crashes before the debounce flushes, reopening the tab brings back whatever you'd typed up to the last keystroke — not just the last debounced save. A third *backup* slot holds the previous-save snapshot, so if the main slot is ever corrupted (mid-write crash, external tampering), you fall back to the prior good save instead of starting over. The recovery is silent on the happy path; if a backup or live-draft fallback fires, you'll see an info toast telling you the previous session ended unexpectedly.

**Share a read-only link.** `Cmd/Ctrl+K` → **Copy read-only share link** generates a fully self-contained URL — your document is gzipped + base64-encoded into the URL's `#!share=` fragment, then copied to your clipboard. No server, no upload, no account. Paste it in an email / chat / issue tracker; when the receiver opens it, the diagram loads with Browse Lock auto-engaged so they can read and explore without accidentally editing. The receiver can toggle Browse Lock off any time to make their own working copy (the original autosaved doc is preserved as a revision they can roll back to). Soft size warning above ~4 KB: very large diagrams may get truncated by some chat clients, in which case fall back to JSON export. Share-links require a recent browser (`CompressionStream` API — Chrome 80+, Firefox 113+, Safari 16.4+).

**Self-contained HTML viewer (Session 77).** `Cmd/Ctrl+K` → **Export as self-contained HTML viewer** writes a single `.html` file with all CSS / JS inlined and the source JSON embedded. The receiver opens it in any browser; the file works offline, behind firewalls, and on shared file drives. The view renders the doc title, entities, EC verbalisation (where applicable), assumptions with status chips, and injections — read-only. No network calls. Best for sending a colleague a snapshot they can open without installing anything.

**Print preview (Session 77, extended Session 79).** `Cmd/Ctrl+K` → **Print / Save as PDF…** opens a print preview modal where you pick:

- **Mode**: Standard (default browser print), Workshop (high-contrast, large font, group rectangles bordered), Ink-saving (group shading removed, edges thinned, blacks softened).
- **Annotation appendix** (checkbox): when on, the printed output includes a numbered list of every entity's description + every edge note + every assumption-with-status as an appendix after the diagram.
- **Selection only** (checkbox, Session 79): when on, only selected entities + edges appear in the print output. The rest of the canvas is hidden (via `visibility: hidden` so layout positions stay intact — no edges re-route). The checkbox is disabled with a hint when you don't have a non-empty selection.
- **Header / footer templates**: free text with merge fields `{title}` / `{date}` / `{author}` / `{diagramType}`. The rendered values get a thin band at the top + bottom of every printed page.

Click **Open print dialog** to hand off to the browser's print/Save-as-PDF flow with the chosen mode applied. (A future iteration will add a true vector-PDF pipeline via `react-to-pdf`; the current flow uses the browser's print engine.)

**Export as JSON.** `Cmd/Ctrl+K` → **Export as JSON** downloads `<your-title>.tps.json`. The format is human-readable, version-stamped, and round-trip stable.

**Export as redacted JSON.** `Cmd/Ctrl+K` → **Export as redacted JSON** writes the same structure as a normal JSON export but replaces every entity title with `#N`, blanks descriptions and edge labels, retitles groups as `Group N`, and drops author / document-level description. IDs, types, edges, and AND-groups are preserved exactly. Useful when you want a colleague to see the *shape* of an analysis without leaking what each node says.

**Export as PNG.** `Cmd/Ctrl+K` → **Export as PNG (2×)** downloads `<your-title>.png` at 2× pixel density, theme-aware (white background in light mode, near-black in dark mode), cropped to fit your diagram with 32 px of padding.

**Export as JPEG / SVG.** Same as PNG, different format. JPEG is smaller for sharing in chat tools that resample PNGs. SVG is sharp at any zoom and importable into design tools (Figma, Illustrator).

**Print / Save as PDF.** `Cmd/Ctrl+P` (or palette → **Print / Save as PDF…**) opens the browser's print dialog. The print stylesheet hides every floating affordance (toolbar, inspector, palette, minimap, controls) and forces a light color scheme regardless of your current theme. The first page gets a header with the document title, optional author, and optional description; the last page gets a small "Exported YYYY-MM-DD · TP Studio" footer. Pick "Save as PDF" in the dialog for a clean PDF, or send it to a real printer.

**Export as CSV.** A single CSV file that captures every entity, edge, and group with a `kind` column discriminating them. Quoting follows RFC 4180. Entity rows are a structural superset of the format the CSV importer reads, so you can round-trip a subset of the data back in if needed.

**Annotations exports.** Two human-readable variants of "everything the diagram says": **Annotations as Markdown** (`# Title`, `## #N — entity` blocks with the description below) and **Annotations as text** (the same structure, indented). Both order entities by their stable annotation number, so the printed doc reads in a predictable order regardless of where the entities sit on the canvas.

**Outline / graph-tool exports.** Three one-way text exports for taking a diagram somewhere else:

- **Export as OPML outline** writes `<your-title>.opml` — an OPML 2.0 outline ready to open in OmniOutliner, Bike, Logseq, or any outliner that speaks OPML. Causal graphs are DAGs but outliners want a single-parent tree, so the export picks each entity's first outgoing edge as its outline parent; the rest of the graph (multi-parent links, assumptions) is dropped. Each outline carries the entity's type label, annotation number, and markdown description.
- **Export as Graphviz DOT** writes `<your-title>.dot` — a `digraph` directive paste-able into `dot`, `dreampuf.github.io/GraphvizOnline`, or VS Code's Graphviz Preview. `rankdir=BT` matches the in-app rendering (effects on top, causes below). Each node carries the stripe colour as a border; AND-grouped edges render bold.
- **Export as Mermaid diagram** writes `<your-title>.mmd` — Mermaid `graph BT` syntax that renders inline in GitHub READMEs, Notion code blocks, Obsidian notes, and GitLab MRs. Per-entity styling is preserved via Mermaid `classDef`. AND-grouped edges use the thick-arrow (`==>`) form.
- **Export as VGL (declarative)** writes `<your-title>.vgl` — a declarative text format with `entity { … }` and `edge a -> b` blocks. VGL-flavored rather than a strict Flying Logic VGL implementation; the format is documented in `src/domain/vglExport.ts` and is one-way (no companion importer yet).

OPML, DOT, and VGL are one-way exports. Mermaid is round-trippable: **Import from Mermaid diagram…** (in the palette → File group) parses the syntax our exporter emits — frontmatter title, `graph BT/TB/LR/RL`, bracketed nodes with `<br/>` line breaks and `&quot;` escapes, `-->` plain + `==>` AND-grouped edges, inline edge labels, and `class id type_xxx` entity-type assignments. Subgraph blocks parse for their contents but the grouping isn't reconstructed. Use **Export as JSON** or **Export as Flying Logic** for full-fidelity interchange that round-trips assumptions, groups, revisions, and everything else.

**Reasoning exports** (Markdown). Compiles the diagram's causal logic into a document the user can paste into a brief, deck, or postmortem. Two shapes:

- **Export reasoning as narrative (Markdown)** — sentences in topological causal order. CRT/FRT/TT read as "[Effect] because [Cause]"; PRT/EC read as "In order to obtain [Effect], [Cause] must hold." TT renders proper triples: "In order to obtain [Outcome], do [Action] given [Precondition]." Each export includes a preamble with the document title, type, author, and any filled System Scope answers. EC documents get a "The conflict" block stating both Wants. CRT documents get a "Likely Core Driver(s)" appendix using the same scoring as the Find Core Drivers palette command.
- **Export reasoning as outline (Markdown)** — same content reshaped as headings + nested bullets. Each terminal effect becomes an `### heading` with its causes nested underneath. EC, which isn't a tree, is rendered as a structured description of the 5-box layout plus the assumptions on each edge.

Both are one-way Markdown — paste them into a doc / wiki / chat. Pairs with the in-app Read-through overlay (palette → "Start read-through"), which walks the same sentences live for a verbal review.

**Import.** `Cmd/Ctrl+K` → **Import from JSON…** opens a file picker. The current document is pushed to undo history before the imported one takes over, so an accidental import is recoverable with `Cmd/Ctrl+Z`. Malformed JSON files are rejected with a descriptive error instead of corrupting state.

**Flying Logic interop.** Palette → **Open Flying Logic file…** accepts `.logicx`, `.logic`, and `.xlogic` (Flying Logic 4 desktop-save) files; **Export as Flying Logic file** writes a `.logicx`. The mapping covers entities, edges, AND-junctions (Flying Logic represents these as "junctor" vertices), and groups. The reader handles both the scripting-API XML layout (flat) and the desktop app's File → Save layout (nested under `logicGraph > graph`, with attributes wrapped in `<attributes>`). FL stock classes that don't have a structural CLR analogue in TP Studio — `Generic`, `Note`, `Knowledge` — land as plain `Effect` entities; `Desirable Effect` (FL's spelling variant) maps to our `Desired Effect`. Things to know:

- Flying Logic doesn't store node positions in the file — both apps auto-layout on open, so a hand-arranged layout won't survive a round-trip.
- Flying Logic has more junctor types than TP Studio (sufficient+necessary, OR, NOT-AND, etc.); we coerce everything to AND on import.
- Edge labels, group colors, and annotation numbers are TP-Studio-specific. They survive a TP → FL → TP round-trip via custom attributes, but Flying Logic itself won't surface them.
- The reader expects the flat XML body described in Flying Logic's public scripting docs. If a `.logicx` you receive is a ZIP archive, extract the inner XML first.

**Sharing.** Two practical paths today: send the `.tps.json` file (recipient runs **Import from JSON…**) or send the `.png`.

If the browser's storage quota is exceeded — usually because of an exceptionally large document or browser-wide storage pressure — you'll get a destructive toast: `Couldn't save to this browser: ...`. The in-memory document keeps working; export to JSON to preserve it.

## Templates library

`Cmd/Ctrl+K` → **New from template…** opens a picker with 10 curated templates spanning the three v3-brief diagram types:

- **Goal Trees (2)**: a generic SaaS-product Goal Tree (apex Goal + 3 CSFs + their NCs) and a Retail Operations Goal Tree tuned for store-level operations.
- **Evaporating Clouds (5)**: Sales vs. Marketing, Speed vs. Quality, Build vs. Buy, Centralise vs. Decentralise, Maker vs. Manager schedules — the five most-recurring strategic conflicts in operations and product work.
- **CRTs (3)**: a Retail Operations CRT, a SaaS Engineering CRT, and a Personal Productivity CRT. Each is a worked example with a half-dozen entities + edges showing the canonical UDE → cause cascade.

Each card shows a tiny SVG thumbnail of the diagram's shape (EC cards draw the 5-box layout with the red conflict line; trees show levels bottom-up), the diagram-type badge, the entity + edge counts, and a one-line description. Clicking a card replaces the current document with a freshly-instantiated copy of the template — your previous work is overwritten, so save first if you want to keep it. The picker traps focus, dismisses on Escape, and is keyboard-navigable.

Templates are starting points, not boilerplate — every entity is editable, deletable, and re-typable. Use them when you want to skip the "stare at a blank canvas" problem and start with the shape of the conversation.

## Multi-goal Goal Trees

Goal Trees are designed around a single apex Goal. The CLR engine flags any Goal Tree that has more than one `goal` entity with a soft **Multiple goals** warning, anchored on the oldest goal in the document. This is intentionally a soft warning, not a hard refusal — sometimes you genuinely need to capture two competing terminal objectives during a brainstorm.

The warning carries a one-click **Convert extras to CSFs** action. Clicking it keeps the oldest goal as the apex and re-types every other goal in the document into a `criticalSuccessFactor`. The "oldest" sort uses each entity's `annotationNumber` (the per-document monotonic counter assigned at creation time), so the result is deterministic even when goals were created in the same second.

If the second goal really is a peer to the first, dismiss the warning with **Resolve** — it stays dismissed across reloads (resolved warnings persist in the document), and re-fires only if you add yet another goal.

## Settings & themes

`Cmd/Ctrl+,` (or **Settings…** in the palette) opens the Settings dialog with three sections:

- **Appearance.** Pick a theme — seven options: `Light`, `Dark`, `High contrast` (pure black background, white text, thicker focus rings), or one of four named dark variants — `Rust` (warm dark, ember tones), `Coal` (near-black with blue tint), `Navy` (deep blue dark mode), `Ayu` (warm dark with golden accents drawn from the Sublime/VSCode theme). The four named variants layer on top of dark mode — only the body background and focus-ring accent change per variant; the rest of the UI palette stays consistent. Pick an edge color palette — `Default`, `Colorblind-safe` (Wong palette), or `Monochrome`.
- **Behavior.** Pick an animation speed — `Instant` / `Slow` / `Default` / `Fast`. Toggle **Browse Lock** (also reachable via the top-right lock button).
- **Display.** Toggle **Show annotation numbers**, **Show entity IDs**, **Show UDE-reach badge** (Session 52), **Show root-cause-reach badge** (Session 71), **Show minimap**, and **Ink-saving print mode**. Pick a **Causality reading** (none / auto / because / therefore / in order to). Pick a **Default direction for new documents** (auto / BT / TB / LR / RL) — set this when you prefer all new docs to start in a particular orientation; existing docs keep their own per-doc layout setting.

All settings persist across reloads.

The sun/moon button in the top-right toolbar quickly cycles between `Light` and `Dark`. High contrast and the other prefs live in the Settings dialog.

PNG exports respect the current theme — light theme exports get a white background; dark theme and high contrast both get a near-black background.

## Browse Lock

Browse Lock is a read-only mode useful for sharing your screen, reviewing with someone over a call, or letting a colleague click around without worrying they'll delete a node by mistake.

Toggle it three ways:

- The lock icon in the top-right toolbar. It turns violet when on.
- Settings → Behavior → **Browse Lock**.
- The palette command **Toggle Browse Lock**.

While locked:

- Double-click on the canvas does nothing.
- Drag-to-connect handles are disabled.
- The Inspector still opens but every input and button is greyed out.
- `Tab`, `Delete`, `Cmd+Z`, and `Cmd+Shift+Z` are no-ops.
- Palette commands that would mutate the document refuse to run.
- Each blocked attempt shows a single toast: "Browse Lock is on — unlock to make changes."

Read-only operations still work: panning, zooming, selection, the help dialog, validation, and JSON / PNG export.

## Document details

The small info icon to the right of the document title (or palette → **Document details…**) opens a dialog where you can set the document's title, an optional author, and a free-form description (goal, scope, audience). It also shows a small count of entities and edges. The author and description fields are saved as part of the JSON export.

The dialog also carries two collapsible sections drawn from the book's TOC method:

**System Scope.** Seven structured questions Goldratt's CRT method opens with — system goal, necessary conditions, success measures, boundaries, containing system, interacting systems, inputs/outputs. They generalize to every TOC tree, so the section is available regardless of diagram type. Answer them before you start drawing entities; the discipline pays back as the tree grows. The summary line shows how many of the seven are filled, and the section auto-expands when you re-open the dialog if you've already answered any.

**Method checklist.** The canonical recipe for the current diagram type — 9 steps for a CRT, 6 for an FRT/PRT/TT, 7 for an EC. Each step is roughly one focused work session: "List 3–5 critical UDEs", "Build down to root causes", "Apply CLR challenges at every step", "Identify the Core Driver". Tick steps off as you go. Many hints reference specific TP Studio features (Find Core Drivers, Unspecified placeholders, back-edge tagging, etc.) so the checklist doubles as a discoverability surface. Switching diagram type swaps the catalog automatically; checked steps are scoped per-diagram-type, so a CRT's progress isn't lost if you also work on an EC in the same document switch.

**Custom entity classes.** The 14 built-in entity types (UDE, Effect, Root Cause, …) cover the TOC textbook typology. If your domain doesn't map onto them — e.g. you want "Evidence" and "Belief" entities for an argument-mapping exercise — define your own classes here. Each class has an id (lowercased slug, no spaces), a label, a color, an optional icon (pick from a curated 17-icon palette in the add-form), and an optional "behaves as" mapping to one of the built-ins. The icon, label, and color show up in the inspector, the right-click "Convert to" menu, and on the canvas card. The **"behaves as"** mapping is consulted by the CLR validators — e.g. a custom class with `supersetOf: 'rootCause'` participates in the cause-effect-reversal check and gets counted by the root-cause-reach badge just like a built-in root cause. Custom classes are scoped to the current document — JSON export carries them; other documents don't pick them up unless you copy the class definitions over. **Removing a class doesn't retype existing entities** — they keep the class id, render with the slug as label, and you can pick a different type from the inspector to clean up.

System Scope and Method Checklist round-trip through JSON export. Flying Logic exports drop them (no FL analog).

## Revision history (snapshots, branches, diffs)

The history panel is a slide-in on the right edge (palette → **Open history…** or the clock icon in the top bar). Each document carries its own snapshot list, capped at 50 entries per doc. Snapshots autosave on document swaps and on every restore; "Snapshot now" at the top of the panel captures the live state manually.

### Comparing snapshots

Three ways to see what changed:

- **Diff summary** — every row in the history panel shows a one-line summary of changes between that snapshot and the live doc (`+2 entities, ~1 edge`, etc.).
- **Visual diff overlay (👁 button).** Highlights the live canvas in place: added entities get an emerald ring, changed entities get an amber ring. A banner at the top shows the compared snapshot's label and per-bucket counts. Esc exits.
- **Side-by-side dialog (⫼ button).** Opens a fullscreen modal with two panels: snapshot (left) + live (right). Each entity carries its diff status — added / changed / removed — in both panels. Removed entities ghost out in the snapshot panel with a strikethrough. Esc closes.

The two compare modes are independent — you can have the visual overlay active *and* the side-by-side open at the same time.

### Branches (🌿 button)

Branches are a lightweight way to fork "what-if" experiments without losing the main analysis. Click the branch icon on any snapshot row, type a name, and a new snapshot is created tagged with that branch name and linked back to the source revision via `parentRevisionId`. The live document is unaffected — branching is record-keeping.

The history panel groups revisions by branch with sticky headers (Main first, then named branches by most-recent activity). To activate a branch's state, click its **Restore** button — your live doc swaps to that snapshot (and a safety capture of the outgoing state lands in the same branch).

This is the MVP version: branches are an organizational layer over the flat revision list, not a full multi-document workspace. Subsequent snapshots after a restore land in the Main branch unless you branch again.

## Keyboard reference

Same content as the in-app `?` button (top-right).

**Global**

| Keys | Action |
| --- | --- |
| `Cmd/Ctrl+K` | Command palette |
| `Cmd/Ctrl+E` | Command palette, pre-filtered to Export |
| `Cmd/Ctrl+P` | Print / Save as PDF |
| `Cmd/Ctrl+,` | Settings |
| `Cmd/Ctrl+S` | Save (force flush + toast) |
| `Cmd/Ctrl+Z` | Undo |
| `Cmd/Ctrl+Shift+Z` | Redo |
| `Cmd/Ctrl+C / X / V` | Copy / cut / paste selected entities |
| `Cmd/Ctrl+Shift+S` | Swap two selected entities |
| `Cmd/Ctrl+F` | Find in document |
| `Cmd/Ctrl+Shift+→ / ←` | Select all successors / predecessors of the selection |
| `+ / - / 0` | Zoom in / out / fit view |
| `E` | Quick Capture (paste indented list) |
| `Esc` | Close dialog / palette / unhoist / deselect (in that order) |

**On a selected entity**

| Keys | Action |
| --- | --- |
| `Enter` | Rename |
| `Alt+Enter` (in title) | Newline (multi-line title) |
| `Tab` | Add child entity |
| `Shift+Tab` | Add parent entity |
| `↑` | Move selection to effect (target of an outgoing edge) |
| `↓` | Move selection to cause (source of an incoming edge) |
| `← / →` | Move selection to a same-rank sibling |
| `Del` / `Backspace` | Delete (with confirm if connected) |

**On a selected group**

| Keys | Action |
| --- | --- |
| `Enter` | Hoist into group |
| `→` | Expand (if collapsed) |
| `←` | Collapse (if expanded) |
| `Del` / `Backspace` | Delete group (members preserved) |

**Canvas**

| Action | Result |
| --- | --- |
| Double-click | New entity at cursor |
| Right-click | Context menu (single, or bulk on a multi-selection) |
| Shift+click | Add / remove an entity or edge from the current selection |
| Drag on empty canvas | Marquee — drag a rectangle to select everything inside |
| Alt+click another entity | With one entity selected, create an edge to the clicked entity |
| Drag from node handle | Connect entities |

## Narrow viewports

The app is designed for ≥1024 px but stays usable down to about 360 px:

- At **< 640 px** (small phones / split-screen) the minimap, live zoom percentage, and diagram-type badge hide to free up space; the "Commands" button collapses to a single Search icon, and the Layout Mode / History / Help / Theme buttons collapse into a **kebab menu (⋮)** at the right of the toolbar. Tap the kebab to reach those actions; the menu auto-closes after you pick one. The Lock button stays visible.
- At **< 768 px** the Layout Mode button is hidden from the toolbar (it stays inside the kebab on phone widths, and remains reachable from the palette on tablets in this range).
- At **< 1024 px** the inspector caps at 85 % of the viewport width so it doesn't dominate the canvas. A translucent backdrop appears behind the panel — tap anywhere outside the inspector to dismiss without aiming for the small × in the header. Everything else behaves the same.
- Long document titles truncate cleanly instead of pushing the toolbar off-screen.

If you're working on a phone, the kebab menu plus the command palette (`Cmd/Ctrl+K`, if you have a hardware keyboard) cover everything.

## Tips

- **Iterate fast with Tab.** Selecting a node and hammering `Tab` builds a chain of children quickly. Press `Shift+Tab` instead to build upward toward causes.
- **Don't try to fix every CLR warning before sketching.** Get the structure out first. The "causality-existence" warning fires once per edge by design — resolve them once you're confident in each causality, not as you draft.
- **Group AND edges early, when the cause set is small.** It's cleaner than retrofitting a single-cause edge into a group later.
- **Use Assumptions as your "yes, but" notebook.** Whenever someone in the room says "that only works if X is true" — add it as an assumption on the relevant edge. It captures the challenge without breaking the diagram's flow.
- **Cmd+S is psychologically helpful but unnecessary.** The toast confirms what already happened. The real safety net is `Cmd/Ctrl+Z` (100 steps deep) and the JSON export.
- **Light theme reads better on a projector.** Dark theme is easier on the eyes for long solo sessions.
