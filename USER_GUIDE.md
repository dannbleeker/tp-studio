# TP Studio — User Guide

A practitioner's walkthrough. Assumes familiarity with the Thinking Process — this is about the tool, not the method.

## Contents

1. [Starting up](#starting-up)
2. [What you see](#what-you-see)
3. [Working with multiple documents (tabs)](#working-with-multiple-documents-tabs)
3. [Building a Current Reality Tree](#building-a-current-reality-tree)
4. [Working with entities](#working-with-entities)
5. [Connecting causes to effects](#connecting-causes-to-effects)
6. [Working with multiple entities](#working-with-multiple-entities)
7. [Finding and navigating](#finding-and-navigating)
8. [Entity state and what-if analysis](#entity-state-and-what-if-analysis)
8. [Quick Capture and CSV import](#quick-capture-and-csv-import)
9. [Groups (organize a region of the diagram)](#groups)
9. [AND groups (sufficient sets of causes)](#and-groups)
7. [Assumptions on edges](#assumptions-on-edges)
8. [The CLR panel](#the-clr-panel)
9. [Review comments](#review-comments)
9. [Future Reality Trees](#future-reality-trees)
10. [Saving, exporting, and sharing](#saving-exporting-and-sharing)
11. [Importing](#importing)
11. [Templates library](#templates-library)
12. [Multi-goal Goal Trees](#multi-goal-goal-trees)
13. [Settings & themes](#settings--themes)
14. [App modes](#app-modes)
12. [Browse Lock](#browse-lock)
13. [Document details](#document-details)
14. [Accessibility](#accessibility)
15. [Keyboard reference](#keyboard-reference)
16. [Tips](#tips)

## Starting up

Open the dev server URL (typically http://localhost:5173). The first time you open it you'll see an empty canvas with a hint card centered on screen:

> **Empty diagram**
> Double-click anywhere to add your first entity.

Your work auto-saves to this browser on every change. Closing the tab and reopening it later picks up where you left off — no sign-in, no cloud.

## What you see

| Element | Where | What it does |
| --- | --- | --- |
| Home / logo | Top-left | The TP Studio mark; opens the **Start** workspace (your trees, templates, and the problem-led hero). See [The Start page](#the-start-page). |
| Title + type badge | Top-left | Click the title to rename the document. The badge shows the diagram type (`CRT`, `EC`, …); the small ⓘ icon opens the Document Inspector. |
| Command search | Top-center | Click it (or press `Cmd/Ctrl+K`) to open the command palette — the fastest route to any action. |
| Building Blocks rail | Left edge | Type-led entity creation for the current diagram — click a block to drop that entity at the canvas center. Collapsible. See [Building Blocks rail](#building-blocks-rail). |
| Method path | Strip under the top bar | Where the active diagram sits in the TP sequence, plus a suggested next step. See [Method path](#method-path). |
| Logic check chip | Top-right | Emerald **"all clear"** or amber **"N to review"** — click to open the CLR panel. See [The CLR panel](#the-clr-panel). |
| Undo / Redo | Top-right | Step backward / forward through edits. |
| History / Comments | Top-right | Revision history; review comments. |
| Share | Top-right | Copies a share link to the clipboard. |
| Export | Top-right (filled) | Opens the export picker (PNG / PDF / JSON / …). |
| Overflow (⋮) | Top-right | Theme, Browse Lock, Help, layout mode, and the rest. |
| Canvas | Center | The infinite dot-grid where your diagram lives. |
| Zoom controls | Bottom-center | Zoom in, zoom out, fit-to-view. |
| Inspector | Right panel | Slides in when you select an entity or edge. Holds title, type, description, CLR warnings, and delete. Shares the dock with the CLR panel — opening one closes the other. |
| Toasts | Bottom-center, overlay | Brief confirmations: "Saved", "Loaded example CRT", "3 open CLR concerns", etc. |

**The command palette.** The command-search field — or `Cmd/Ctrl+K` from anywhere — opens the palette, the fastest route to any action. Before you type, commands are grouped into labelled sections (**File / Edit / View / Review / Export / Help**) with your **five most-recent** commands pinned in a "Recent" group at the top; start typing and that structure gives way to a ranked search across every command. `Cmd/Ctrl+E` opens the palette pre-filtered to Export.

## Building Blocks rail

The rail down the left edge is the type-led way to add entities. It lists exactly the building blocks that belong to the **current** diagram — each as a coloured stripe chip with its icon, label, and a one-line plain-language meaning — so on a CRT you see UDEs, causes, and root causes; on an Evaporating Cloud you see the objective, needs, wants, and conflict; and so on.

- **Click a block** to create that entity and drop it at the centre of your current view, ready to name.
- Blocks that belong to **other** diagram types show dimmed, with a hint of where they live — a quiet map of the whole vocabulary without cluttering the active palette.
- **Collapse** the rail with the chevron in its header when you want more canvas; the choice is remembered per browser.

The rail is additive — double-clicking the canvas to create an entity still works exactly as before.

## Method path

A thin strip under the top bar situates the diagram you're editing in the canonical Thinking-Process sequence — **CRT → EC → FRT → PRT → TT** — with **Goal Tree** and **S&T** shown as a parallel planning branch. The current diagram is filled and marked with a green dot; sibling diagrams you already have open as tabs read as outlined "open" (click to switch to them); the rest are dashed "to-do" (click to create one and open it in a new tab).

When the diagram in front of you reaches a milestone, a suggestion appears on the right — for example, once a CRT has a **root cause**, the strip nudges you to *break it with an Evaporating Cloud*. Click the suggestion to jump straight there. It stays quiet until the next step is genuinely earned, so it guides without nagging.

## The Start page

TP Studio **opens on the Start page** — a full-screen workspace that sits in front of the editor — and the **logo** (top-left) returns you to it any time. It has a persistent left sidebar that switches the main view:

- **Start** — a problem-led hero: type what's going wrong and **Build a Current Reality Tree** mints a fresh CRT with that statement as its first UDE. Example chips do the same in one click, a worked-example callout opens a finished CRT to learn from, and a template strip sits beneath. Once you have work in progress, a **"Pick up where you left off"** row shows your most-recent trees.
- **All trees / Recent** — every tree you've made as a card (a mini preview + title + type + edited time) or a compact list. **Closing a tab keeps the tree here** — "All trees" is your library, not just the open tabs; hover a card and click the trash icon to delete one for good. Each carries a **Logic pill** — emerald *"Logic clear"* or amber *"N to review"* — reading the exact same validation as the editor's Logic chip, so a card can never disagree with the canvas.
- **Templates** — the full template library, grouped by diagram type; click any card to load it in a new tab.
- **Needs review** — only the trees with at least one open reservation: the CLR as triage. Open the workspace, see which trees still have logic to resolve, and click straight in.
- **Learn the method** — the User Guide, the keyboard reference, and the practitioner's book.

The sidebar badges are live: **All trees** counts every saved tree, **Needs review** counts the ones with open reservations. Clicking a tree card, a template, or **Build** drops you into the editor on that document; **New tree** opens the diagram-type picker. Trees live in the library until you delete them (or run `Cmd/Ctrl+K → Forget closed documents` to clear the closed ones in bulk).

## Working with multiple documents (tabs)

TP Studio holds several documents open at once, each in its own tab. The **tab strip** runs along the very top of the canvas:

- **Switch** — click a tab.
- **New tab** — click the **+** at the end of the strip (opens a blank CRT), or `Cmd/Ctrl+K → New tab`.
- **Close** — hover a tab and click its **✕**. Closing the last tab leaves a fresh blank one — there's never zero tabs.
- **Reorder** — drag a tab left or right.
- **Duplicate** — `Cmd/Ctrl+K → Duplicate tab` makes an independent copy (own id, own history, `(copy)` title).

Each tab is fully independent: its own undo/redo history, its own autosave, its own share link. Switching tabs parks one document's history and restores the other's. **Every open tab comes back when you reload** — close the browser and your whole working set is restored, not just the last document.

**Opening a document opens a new tab.** Importing a file, loading a pattern / template / example, opening a shared link, or spawning an Evaporating Cloud from a conflict all open in a *new* tab by default, leaving your current work untouched. To restore the old "replace the current document" behaviour, turn off **Settings → Behavior → "Open documents in new tabs."**

**Tab commands (palette, everywhere).** `Cmd/Ctrl+K` reaches **New tab**, **Duplicate tab**, **Close tab**, **Next tab**, **Previous tab**, and **Forget closed documents** — the last reclaims storage from documents you've closed (open tabs keep their history; it confirms first).

**Keyboard shortcuts (installed app only).** When you install TP Studio as a desktop / mobile app, the native tab keys work: **`Cmd/Ctrl+T`** new tab, **`Cmd/Ctrl+W`** close tab, **`Cmd/Ctrl+1`–`9`** jump to a tab (9 = last). In a normal browser tab those keys belong to the browser, so use the palette commands instead.

**Linking entities across tabs (Session 155).** Select an entity, then `Cmd/Ctrl+K` → **Link to entity in another tab…**, pick another open document and one of its entities — both entities get a *reciprocal* cross-document link. Each then shows a **"Linked to"** chip in the inspector; click it to jump to that tab and select the partner entity (walk a CRT core problem → its Core Cloud → an FRT injection in single clicks). The **×** on a chip removes the link and its mirror. It's purely a navigation aid — a link adds no causal edge and changes nothing about either diagram. If the partner's tab is closed, the chip becomes a muted **"Reopen linked tab"** — click it to reopen that document and jump straight to the partner entity, and the link goes live again (the document was never deleted, just closed; it lives in the Start page's **All trees** library meanwhile). This is the **U-Shape** linkage from Cohen's *TP Basics*.

**Building the U-Shape, step by step (Session 156).** Three guided moves assemble the journey on command — all opt-in, none changing the basic tools. **Mark / unmark as core problem** (`Cmd/Ctrl+K`, or the rose toggle in the Entity Inspector) flags a CRT entity as the hinge of your analysis. From there, **Create the Core Cloud from this entity…** opens a fresh Evaporating Cloud (pre-tagged as a *Core cloud*, titled after the problem) in a new tab, already linked back. Solve the cloud, then **Carry this into a new FRT…** opens a Future Reality Tree with that breakthrough as an injection, again linked back. At each step you get a new tab and a reciprocal **"Linked to"** chip, so the whole CRT → Core Cloud → FRT chain is one click apart in either direction.

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

**System-scope nudge.** The first time you open a Current Reality Tree whose **System Scope** is still empty, a one-time toast points you at the Document Inspector's [System Scope](#document-details) section — Goldratt's CRT method opens by naming the system's goal, boundaries, and measures before you draw effects. Dismiss it and it won't return for that document; fill in any scope answer and it's satisfied. (CRT only.)

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

**Choosing an icon (Session 179).** Below Title size, the **Icon** picker gives an individual entity a custom icon from the Lucide catalogue — handy for marking a key node or adding a visual cue beyond the entity-type colour. Click **None** to fall back to the entity type's default icon. Per-entity; round-trips with the document.

**Collapsing one entity's downstream.** Right-click an entity that has any downstream edges and pick **Collapse downstream**. Its successors disappear from the canvas; a small `▸ +N` chip on the entity shows how many descendants are hidden. Click the chip (or right-click → **Expand downstream**) to bring them back. This is per-entity; group-level collapse — for an entire labeled group — is described under [Groups → Collapse and expand](#collapse-and-expand).

**Owner.** Below Attestation the inspector has an **Owner** field — a free-form text input naming whoever's accountable for the entity (decision owner, action assignee, validation owner, etc.). The field feeds the `owner` column of the risk-register CSV export, and gives a reviewer reading the diagram six months from now a quick "ask this person" anchor without forcing a formal user model. Underneath the field is a **Mark validated** button that stamps the current timestamp into `entity.lastValidatedAt`; once stamped, the date plus the owner name reads back as "Last validated YYYY-MM-DD by …" so an audit trail accumulates across re-validations.

**Evidence.** Below the Owner block is an **Evidence** section — a structured list of citations, observations, measurements, stakeholder claims, and named assumptions backing the entity. Each row carries a description plus two cycling pills: a **source** (one of *Observed*, *Stakeholder*, *Metric*, *Policy*, *Assumption*) and a **strength** (*Weak*, *Moderate*, *Strong*). An optional URL field captures a citation link; the external-link icon next to it opens the URL in a new tab. A per-row **Mark validated** button stamps the current timestamp into the evidence item and credits the entity's Owner as the validator. Use the list to make provenance explicit at workshop time: "this UDE is a *strong/metric* — p95 = 740ms last week" reads very differently from "this UDE is a *weak/assumption*", and the difference often surfaces during the trim step of an FRT. Evidence items survive JSON export / share-link reload and feed the new `evidence` column of the risk-register CSV (rendered as `[strength/source] description (url)` entries, joined by semicolons).

**Deleting.** Press `Delete` (or `Backspace`) with a node selected. If the node has edges attached, you'll get a confirm prompt with the number of connections that will be cut. Cancel from the prompt to keep it.

## Connecting causes to effects

Three ways, in increasing order of speed:

1. **Drag.** Hover a node — handles appear on the top and bottom. Drag from one node's bottom handle onto another node. The first becomes the cause, the second the effect.
2. **Tab.** With a node selected, `Tab` creates a child entity *and* connects current → new. `Shift+Tab` creates a parent (new → current). Both put the new entity in edit mode so you can name it right away.
3. **Right-click.** Right-click an entity for **Add child** / **Add parent** entries.

The canvas re-flows automatically after each change, with a 300 ms ease-out animation. New nodes and edges fade in over ~220 ms; deletions fade out symmetrically. Both honor the **Animation speed** preference in Settings (Instant skips the fades entirely).

**Selecting an edge.** Edges are thin, so each one has a generous, mostly-invisible click zone around it — plus cues to find that zone. **Hover** an edge and it answers: it thickens a touch, picks up a soft grey glow, and the cursor becomes a pointer, so you can see exactly what a click would land on. **Click** anywhere in that zone — or click the edge's inline **label** — to select it. A selected edge is unmistakable: it draws in indigo with a crisp indigo *casing band* hugging it, distinct from the softer indigo glow an edge shows while you *drag a connection onto it* to AND-join (above). Once an edge is selected, the right-click actions below — and the Edge Inspector — act on it.

**Reversing a direction.** Right-click an edge → **Reverse direction**, or run the *Reverse edge* command from the command palette. The cause and effect swap. If the opposite-direction edge already exists, you'll get an info toast instead of a corrupted graph.

**Re-targeting a connector.** To change *what* an edge links without redrawing it, grab one of its endpoints and drag it onto a different entity. The edge re-parents in place, the diagram re-flows, and the move is undoable. Dropping onto the same node, onto the edge's other end (a self-loop), or where the result would duplicate an existing edge is refused with a toast and the endpoint snaps back; a drop on empty canvas also snaps back. If you move the **target** end of an AND/OR/XOR-grouped edge it leaves that junctor (the group is the set of causes converging on one effect); moving the **source** end keeps it. Aggregated connectors — the single line that stands in for several edges into a collapsed group — can't be re-targeted, since there's no one underlying edge to move.

**Splicing a new entity into the middle of an edge.** Right-click an edge → **Splice entity into this edge**. The original edge is removed and a fresh entity is created at the diagram's default type, sitting between the original source and target with two new edges connecting them. The new entity is selected and put into inline-edit mode so you can type its title immediately. Useful when you realize a causal step is missing — say you have `Old system is slow → Customers churn` and want to say `Old system is slow → New onboardings stall → Customers churn`. The original edge's label, assumptions, and back-edge tag (if any) stay on the downstream half (the half closer to the effect). If the spliced edge was part of an AND group, the grouping is dropped on both new edges with a notification toast — re-AND if you want to reconstruct that structure.

**Adding a co-cause by dragging onto an edge.** When you want to say "this thing also has to hold for the effect to happen" — i.e. add an AND-joined co-cause to an existing edge — start a connection drag from the new cause-entity's handle and release the drag *on top of the existing edge*. TP Studio detects the edge as the drop target, creates the new edge to the original edge's target, and AND-groups the two so they converge through a single junctor. A toast confirms ("Added as a co-cause (AND-grouped)."). Different from Splice: splice puts the new entity *between* the two endpoints; drag-onto-edge puts it *alongside* the existing source as another sufficient cause.

**Grabbing one of several overlapping edges.** When several edges converge on one entity, clicking the bundle used to just select whichever was on top. Two aids fix that. First, **hover** any edge in the convergence and the whole group **fans apart** at the shared entity — the overlapping strands spread sideways so each is visible and separately grabbable, snapping back when you move away (it fans only direct, un-detoured edges, so an obstacle-routed edge keeps its path). Second, a left-click that lands on a stack of two or more edges pops a small menu listing them ("Cause → Effect") — pick the one you mean. A click on a lone edge still selects it directly. Combine with the inspector re-wire below to then re-point the chosen edge without any canvas drag.

**Redirecting an edge's cause or effect (Edge Inspector).** Select an edge and the inspector's **Cause** and **Effect** fields are dropdowns of the document's entities, listed by title. Pick a different one to re-point that end of the edge — no canvas drag. This is the reliable way to fix the case where several edges converge on one entity and clicking the stack keeps grabbing the wrong one: select any edge in the pile, then redirect its source or target precisely from the inspector. The lists update live as you rename entities; the opposite endpoint is greyed out (an edge can't loop onto itself); and a redirect that would duplicate an existing edge is declined with a toast. Re-pointing the *effect* of an edge that belongs to an AND/OR/XOR junctor takes it out of that group (junctors are defined per shared target). Note-edges keep the plain read-out — they aren't a causal cause→effect pair. Pairs with the on-canvas drag-to-reconnect gesture; both go through the same validation.

**Tagging a back-edge (acknowledged loop).** Sometimes a causal loop is *the point* — a vicious circle in a CRT, a positive reinforcing loop in an FRT. Right-click the loop-closing edge → **Tag as back-edge** (or use the **Back-edge** checkbox in the Edge Inspector). The edge renders with a thicker dashed stroke and a `↻` glyph; the cycle CLR rule stops flagging that cycle as a defect. You can untag any time from the same menu / checkbox.

**Naming a loop and recording behaviour over time.** Once an edge is tagged as a back-edge, the Edge Inspector gains a **Loop name** field and a **Behaviour over time** textarea. Type a short name (e.g. "Delay spiral") and it renders as a label beside the R / B badge on the canvas. Use the behaviour-over-time field to note the expected system archetype or dynamic — a free-text memo that travels with the document. You can also reach the name field via right-click → **Name this loop…** on the back-edge.

**Delay markers on edges.** Mark any edge as delayed to signal a time lag between cause and effect — common in feedback loops where the response arrives after a gap. Toggle the marker with right-click → **Mark as delayed** (or the **Delayed** checkbox in the Edge Inspector). A `//` glyph appears at the edge midpoint; removing the marker restores the plain edge. Delay markers are purely documentary — they don't affect layout or CLR logic type-checks — but they feed the **reinforcing-loop-with-no-delay** CLR validator described below.

**Marking the conflict on an Evaporating Cloud.** An EC's diagnostic depends on its two Wants being mutually exclusive. Draw an edge between the two `want` entities (start a drag from one Want's handle, release on the other), select it, and tick the **Mutual exclusion (EC)** checkbox in the Edge Inspector. The edge renders red with a ⚡ lightning-bolt glyph, and the `ec-missing-conflict` CLR rule stops firing. The checkbox only appears in the inspector when both endpoints are Wants.

**EC inspector tabs (Session 77).** When the open document is an Evaporating Cloud, the right inspector grows a three-tab bar at the top:

- **Inspector** — the standard entity / edge inspector for whatever you've selected.
- **Verbalisation** — the full read-aloud form of the cloud ("In order to achieve {A}, we must {B}, because {assumption-count}…"). Each "{assumption-count}" anchor is clickable and jumps to the corresponding edge's Assumption Well.
- **Injections** — every `injection` entity in the doc with its linked assumptions. Use **+ link assumption** to wire an injection to the assumptions it would invalidate, then tick **Implemented** when you ship the change — the corresponding arrows go green.

**Assumption status chips.** On an EC edge, every assumption row has a small status chip (U / V / I / C) you click to cycle the status: **U**nexamined → **V**alid → **I**nvalid (often the breakthrough — usually means the arrow is broken) → **C**hallengeable (lights up the Injection Workbench). The chip is the most compact way to track the lifecycle of every "we're assuming X" claim.

**Press `A` on a selected edge** to add a new assumption directly without opening the inspector — same as clicking **+ New assumption**. On EC edges the new row is pre-seeded with `"…because "` so the canonical "we must obtain Want because of Assumption" reading falls out for free.

**Verbalisation strip across the top.** When you open an EC document, a thin italic strip at the top of the canvas reads the cloud's verbal form continuously. Edit any of the 5 slot titles and the strip updates live; click an assumption-count chip in the strip to jump straight to that edge's Assumption Well.

**Starting a Negative Branch from a UDE (FRT).** Right-click any entity in an FRT → **Start Negative Branch from this entity** (or use the palette command). Creates a new "Negative Branch" group (rose) rooted at that entity. The book's framing: when an FRT injection produces an unintended UDE, capture the branch leading to it and decide whether to mitigate the negative (add a corrective Action) or replace the injection. Add the causal chain leading to the UDE inside the group.

**Trimming a negative branch (Session 157).** Once the branch is drawn, select the undesirable effect at its tip and run `Cmd/Ctrl+K` → **Trim this branch (add a trimming injection)**. TP Studio mints a **trimming injection** wired to that effect with a *negative* edge — the formal "inject this and the bad effect won't follow" move. Name the injection to say what breaks the branch; it's one undoable step, and it changes nothing about the rest of the diagram.

**The injection flower (Session 161).** Select an `injection` entity and click **View the injection flower** in its inspector (or `Cmd/Ctrl+K` → **View the injection flower…**). It gathers everything you've linked to that injection across other tabs and groups it into the three sides Cohen vets an injection from — **Desired effects** (a linked Future Reality Tree), **Negative branch** (a linked NBR), and **Plan** (a linked Prerequisite Tree) — plus an "Other links" catch-all. A side you haven't linked yet shows a prompt ("No negative branch linked yet — ask 'what could go wrong?'…"), and the header reads "N of 3 sides developed", so it doubles as a quick completeness check. Build the links with **"Link to entity in another tab…"**; each flower row jumps to its target. It's read-only, so it works under Browse Lock.

**Archiving pruned alternatives.** When you've considered a branch and decided not to pursue it, the book says don't delete — archive. Palette → **Move selection to Archive group** either creates a new "Archive" group (slate, collapsed) or appends to an existing one. The archive stays visible in the inspector but folded out of the canvas, preserving the path-not-taken as a record without cluttering the live diagram.

**Locus (previously "Span of control").** Each entity has an optional 3-value flag in the inspector labelled **Locus**: **Control** (I can act on this directly), **Influence** (I can affect it indirectly), or **External** (I can only observe it). When set, the node shows a small letter pill — green `C`, amber `I`, neutral `E`. The book's intro and CRT Step 7 ask "have you built down to causes you actually control or influence?" — a root cause flagged External in a CRT fires a soft CLR nudge prompting you to keep digging. FRT injections and other entity types are exempt (the warning would be noise on them). Schema field name remains `spanOfControl` for backward compatibility — only the user-visible label changed.

## Selection toolbar

When you select something on the canvas — an entity, an edge, a group, or multiple entities/edges via marquee or shift-click — a small floating toolbar appears above the selection with 3–5 verbs scoped to its kind. The toolbar bridges the gap between *"I know which node I mean"* (you've selected it) and *"I know which verb I want"* (you click the button). The same actions live in Cmd+K and the right-click menu; the toolbar just brings them within arm's reach.

**Per-selection verb list:**

- **Single entity (any diagram)** — Add child · Add parent · Delete
- **Single entity in a CRT or FRT** — *plus* Mark as UDE · Mark as root cause (skipped when the entity already has that type)
- **Single entity in a Goal Tree** — *plus* Add necessary condition · Promote to Goal (skipped when the entity is already a Goal)
- **Single entity in an EC, on a Want (D / D′)** — *plus* Add prerequisite need (creates the upstream Need with a necessity edge)
- **Single edge** — Reverse direction · Add assumption · Cycle polarity (default → positive → negative → zero → default) · Splice · Delete
- **Single group** — Toggle collapsed · Cycle group color (6-color palette) · Unhoist
- **Multiple entities** — Group · *Swap* (when exactly 2 selected) · Delete N
- **Multiple edges** — Group as AND / OR / XOR · Ungroup AND / OR / XOR (when applicable) · Delete N

Each button's tooltip shows the equivalent keyboard shortcut, so the toolbar doubles as a discovery surface for the keyboard bindings. Clicking a button runs the same palette command Cmd+K would — Browse Lock guards apply, undo history records as normal.

**When the toolbar hides itself:** while you're typing into an entity title (so it doesn't compete with the editor for clicks), while the command palette or any modal is open (those layers take precedence), while you're dragging a node or panning the canvas (would otherwise jitter), and when nothing is selected. **Browse Lock also hides write-verbs** — and since every verb the toolbar surfaces today is a write, the toolbar disappears entirely while Browse Lock is on. The verbs come back the moment you unlock.

**Disabling the toolbar.** Some users prefer keyboard-only flow with no floating chrome. Settings → Behavior → **Selection toolbar** turns it off; the palette and the right-click menu cover every verb the toolbar surfaces. The toggle persists across reloads.

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

Once a diagram has a couple of dozen entities, getting around becomes a separate skill from drawing. The tool ships several assists for that:

**Find (`Cmd/Ctrl+F`).** Opens a Find panel pinned near the top of the canvas. Type a query — entity titles, entity descriptions, and group titles match live. Toggle case-sensitive, whole-word, or regex modes from the icons on the right; the regex toggle also accepts the `/pattern/flags` shorthand. Press `Enter` to jump to the next match, `Shift+Enter` for the previous. The canvas pans to center each match, and any collapsed groups in the way are automatically expanded; if you're hoisted somewhere else, the tool unhoists so the match is reachable. While the panel is open and the query has at least one hit, non-matching nodes and edges fade to ~18% opacity so the matches stand out without losing the surrounding causal context.

**Minimap.** A small thumbnail of the whole diagram lives in the bottom-right of the canvas, with the current viewport drawn as a rectangle. Click or drag inside it to pan; scroll to zoom. Hide it from **Settings → Display → Show minimap** if you'd rather have the canvas space back.

**Zoom (`+` / `-` / `0`).** Plus zooms in, minus zooms out, `0` fits the view to all visible entities with comfortable padding. A small percentage indicator next to the bottom-center Controls shows the current zoom level.

**Walk the graph by selection.**

- `Cmd/Ctrl+Shift+→` — selects every entity downstream of the current selection (follows outgoing edges transitively).
- `Cmd/Ctrl+Shift+←` — selects every upstream entity.
- Palette → **Select path between selected entities** — with exactly two entities selected, finds the shortest directed path between them and selects every entity and edge on the way. Falls back to ignoring direction if no directed path exists. Toasts if the two are disconnected.

**Radial / sunburst layout.** A control in the overflow (⋮) menu — **Radial layout** / **Flow layout** — flips the layout between the default top-down dagre flow and a radial sunburst — apex at the center, contributors radiating out on concentric rings. Useful for "see the whole tree at once" screenshots, posters, or alternative reading. Click again to flip back; the preference persists across reloads. **The toggle hides on Evaporating Cloud** since EC is hand-positioned — its 5-box geometry IS the diagnostic, so flipping to radial would erase the conflict.

**Pinning entities (drag-to-pin).** On any diagram, dragging an entity now persists its position — that entity becomes pinned in place. Auto-layout (dagre on CRT/FRT/PRT/TT, the radial sunburst, etc.) routes around the pin: it lays out every other entity normally and overwrites the dagre coords for pinned ones with your saved values. A small violet pin glyph appears at the bottom-right of pinned entities so you can spot them at a glance. To free a pin, right-click → **Unpin position (let layout reclaim)**, or run **Palette → Reset layout — unpin all entities** to clear every pin in the doc. Manual-layout diagrams (Evaporating Cloud) don't show the pin glyph because every entity is implicitly pinned to its slot there.

**Smart edge routing.** Edges that would otherwise vanish behind a non-endpoint node now route around it. A visibility-graph + A\* pathfinder computes a corner-by-corner detour through the layout; the resulting curve still uses smooth beziers so the visual identity stays organic (no orthogonal Manhattan polylines). The router runs only when dagre re-lays-out the diagram (entity adds / removes / drags), so prose edits don't trigger a re-route. Toggle from **Settings → Display → Edge routing**: **Smart** (default) routes around obstacles; **Direct** restores the pre-routing behavior where every edge is a plain bezier between its source and target handles. The Direct option is the escape hatch for users who prefer the simpler look on small diagrams or want to see exactly where a "hidden" edge passes through. Smart mode also chooses **which side of each node** an edge meets — top, bottom, left, or right — taking whichever pairing gives the shortest unobstructed line rather than always running bottom-to-top, and it makes a second **crossing-reduction** pass: when two unrelated edges cross, it reroutes the cheaper one around the other, but only when that strictly lowers the crossing count and doesn't push the edge against the diagram's flow direction.

## Verbalizing a diagram (read-through + CLR walkthrough)

Two palette commands turn a diagram into a guided talking-out-loud pass — useful for presentations, audits, and your own discipline.

**Read-through (step through).** Palette → **Start read-through (step through every edge)**. Walks every structural edge in topological order (root causes first, terminal effects last) and renders each as a complete English sentence in the diagram's natural reading. CRT/FRT/TT default to `"[Effect] because [Cause]"`; PRT/EC default to `"In order to obtain [Effect], [Cause] must hold."` Use `→` / Space to advance, `←` to go back, Esc to close. Each step has an "Open this edge in the inspector" button so you can stop and edit if a sentence reads wrong.

**Read entire diagram at once.** Palette → **Read entire diagram at once (one-shot)**. Alternative to the step-through overlay — opens a scrollable dialog rendering every edge's sentence in topological order in a single view, with a **Copy all** button that drops the full transcript into the clipboard. Use this when a 50+ edge diagram makes the step-through tedious, or when you want to paste the full verbal form into a brief, deck, or postmortem. Same sentence wording as the step-through; the two modes are complementary (step-through for discipline, all-at-once for artefact).

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

**Settings → Display → Show action-eligibility badge.** Surfaces the Transition Tree action-eligibility readout (otherwise inspector-only) as an at-a-glance pill on the right edge of each Action node: emerald `✓` (eligible — every precondition is true), rose `✗` (blocked — a precondition is false), or amber `…` (pending — preconditions undecided). It folds the same effective entity states the inspector uses, so it tracks what-if speculation live. Off by default because on a fresh Transition Tree — where no states are set yet — every action reads "pending", which is noise; turn it on once you've started marking states. Only Action nodes with a precondition slot show the badge.

**Right-click any CRT entity → Spawn Evaporating Cloud from this entity** (also Palette → **Spawn Evaporating Cloud from selected entity**). Once you've identified the Core Driver, the book's prescription is to recast it as the Core Conflict and explore it with an EC. This action opens a fresh Evaporating Cloud document seeded with the source entity's title in the **Want 1** slot, plus blank placeholders for Goal, Need 1, Need 2, and Want 2. Your CRT isn't lost — it's auto-snapshotted to the revisions panel as part of the document swap, and you can roll back to it any time. The new EC's title is prefixed `EC from "..."` so it's identifiable in the revision list.

## Entity state and what-if analysis

Beyond drawing the structure, you can record **what you believe is true** about each entity and let the tool propagate that belief through the causal graph.

**Set an entity's state.** Select any entity and the inspector's **State** section offers four choices — **Unknown** (the default), **True**, **False**, or **Disputed**. Use it to claim presence or absence: "this root cause is present today", "that desired effect isn't here yet". The state round-trips through JSON export and share links.

**Read the propagated state.** From the states you've set, TP Studio derives a state for every other entity by following the edges — a True cause on a sufficiency edge implies a True effect, a negative edge flips it, AND / OR / XOR junctors merge their inputs, and tagged back-edges are skipped so a feedback loop can't spin forever. When the derived state disagrees with the claim you typed, a caption under the picker says so (e.g. *"Graph implies False; your claim is True"*) — a prompt to reconsider either the claim or the causal links between them. On a Transition Tree the same propagation drives the on-canvas **action-eligibility badge** (**Settings → Display → Show action-eligibility badge**, described under [Analysis](#analysis-finding-the-core-driver-and-recasting-it-as-a-cloud)); on other diagram types the derived state lives in the inspector caption.

**Test a change without committing — Speculate.** `Cmd/Ctrl+K` → **Speculate: what changes if… (what-if overlay)** turns on a hypothesis sandbox. Pick a state for any entity and the downstream cascade updates live on the canvas, but **nothing is written to the document** — a banner across the top reads "Speculating" with a count of hypothetical changes and two buttons: **Commit** writes the overrides into the document as a single undo step, and **Revert** (or `Esc`) discards them. Use it to answer "if we fix this one cause, what clears?" before touching the real diagram.

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

### Pattern library

Need a starter diagram for a common scenario? Open the palette and pick **Pattern library…**. The dialog lists curated starter diagrams across every TOC diagram type — software-team CRTs, classic teaching ECs, the canonical Outcome ← (Precondition + Action) TT shape, and so on. Filter by diagram type via the chip row at the top, or scroll through everything. Click a card to load it; Undo from the success toast restores your previous doc. The Evaporating Cloud set includes the **change-resistance / buy-in** clouds — *Resistance to change (Efrat's cloud)*, *Speak up vs stay safe*, and *Transformation vs this quarter* — the generic conflict behind why a sound change keeps getting resisted.

It also includes the **system archetypes** (Session 179) — Senge's recurring dynamics rendered as TP trees: *Fixes that Fail*, *Escalation*, *Shifting the Burden*, and *Eroding Goals* (reinforcing CRTs), plus *Limits to Growth* (a balancing FRT). Each is a feedback loop, so the **R / B badge** on its back-edge tells you at a glance whether it's a self-amplifying spiral (R) or a self-correcting limit (B). A separate **cost-accounting / product-costing CRT** captures Goldratt's "cost world" critique — a fully-loaded product cost spraying undesirable effects — and pairs with the *Cost world vs throughput world* cloud.

The library is distinct from **Load example…** (which loads the one canonical example per diagram type). Patterns are many-per-type and the library grows over time — if you author a new shape worth keeping, drop a builder in `src/domain/patterns/` and register it in the `PATTERNS` array.

### Paste from whiteboard (Miro / Mural)

Open **Import…** in the palette and pick **Paste from whiteboard**. A dialog opens with a textarea — paste sticky-note content from Miro, Mural, FigJam, Lucidspark, or any text source (a bulleted Markdown list, meeting transcript, even chat output). One entity is minted per non-empty line. Bullet markers (`-`, `*`, `•`, `1.`, `1)`) are stripped, and a tab-separated paste (spreadsheet → clipboard) keeps only the first column. Pick the entity type from the dropdown — it defaults to the first entry in the current diagram's palette.

Connectors aren't inferred. Miro / Mural don't export arrow structure in any client-accessible format, so this path gets the entities into the canvas; you wire causality after import. The fresh entities are pre-selected so you can immediately auto-layout (Cmd+L) or group them.

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

**Path A — multi-select then group.** Best for grouping ≥ 3 edges at once.

1. **Shift+click** each edge that should be in the group. (Click one, hold Shift, click the next.)
2. Open the command palette (`Cmd/Ctrl+K`) and pick **Group selected edges as AND** — or use the selection toolbar's **AND** verb that surfaces automatically on multi-edge selection. The edges turn violet and converge into a small **junctor circle** (a white circle outlined in violet with "AND" written inside) sitting just above the target. A single short arrow continues from the junctor down into the target — the same convention Flying Logic uses for AND vertices.

**Path B — click one edge, then click another.** Best for pairing two existing edges.

1. Select a single edge.
2. Click the selection toolbar's **AND-join…** verb (or run `Cmd+K → AND-join with another edge…`). A status chip appears reading "Click another edge to AND-join."
3. Click the second edge anywhere on the canvas. Both edges get AND-grouped. Esc, clicking the source edge again, or clicking the pane all cancel.

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

Beyond these three, an edge can also carry **custom key/value attributes** — a hidden metadata channel with no dedicated editor on the canvas. It exists so foreign-format fields survive a round-trip (for example data carried in from Flying Logic) and is preserved through JSON export.

## Assumptions on edges

The CLR are challenges to your causality. The tool models them as **assumptions** attached to edges — first-class entities you can name, describe, and reference.

1. **Click an edge.** The inspector shows source/effect titles, the edge kind, AND group info if any, and an **Assumptions** section with a `+ New assumption` button.
2. Click **+ New assumption**. A violet-tinted row appears with an inline input and the cursor focused.
3. Type the assumption — e.g., "Customers complete the checkout if shipping costs are visible upfront."
4. **Detach** any assumption from this edge with the small × button on its row. The entity itself remains; only the link is removed.
5. **Open** the assumption (the small ↗ arrow) to switch to its own inspector view. From there you'll see an **Attached to** section listing every edge that references it, so an assumption can support more than one edge.

When an assumption entity is deleted, every edge that referenced it is automatically scrubbed.

## The CLR panel

**The Logic check (status chip + panel).** The top bar carries a **Logic** chip that reads the whole diagram at a glance — emerald **"all clear"** when nothing is open, amber **"N to review"** when concerns remain. Click it to open the **CLR panel** down the right side: every reservation, grouped by tier (**Clarity → Existence → Sufficiency**), with the open / resolved breakdown in the header. Each row names its target and the rule that fired; click a row to **select and centre** the entity or edge it's about, **Resolve / Reopen** it in place, or apply a one-click **remedy** where the rule offers one. A **guided walk** steps through the open concerns one at a time. The panel shares the right dock with the Inspector — opening the Logic check closes the Inspector, and selecting something reopens it.

**Per-selection warnings.** Whenever you select an entity or edge, the inspector also renders that item's open CLR concerns at the bottom:

- **Open** warnings are amber.
- **Resolved** warnings are greyed out with a strikethrough; you can reopen them.
- Each warning has the rule name (e.g., `clarity`, `cause-sufficiency`) and a one-line description of the concern.

Hover a warning to reveal the Resolve / Reopen button. Resolution persists in the document and survives JSON export/import.

You can also see a total count at any time: `Cmd/Ctrl+K` → **Run validation** surfaces a toast with the open / resolved breakdown.

**CRT build-quality checks (Session 179).** On a Current Reality Tree the validators add a set of soft construction nudges drawn from the classic CRT method: an entity that **leads to no UDE** (prune it, or connect it into the chain); a **UDE with no cause feeding it** (the tree is incomplete there); the **leading root cause explaining fewer than half the UDEs** (the tree may have two independent clusters); **two root causes tied** for the most UDEs (a hidden conflict may sit beneath — consider an Evaporating Cloud); a UDE phrased as the **absence of a solution** ("lack of…", a leading "No…") rather than an observable effect; and a **UDE count** outside the rough 3–15 range. All are dismissible like any other CLR warning.

**NBR shape checks (Session 181).** On a Negative Branch Reservation, two EXISTENCE-tier rules verify the canonical walk the method checklist teaches (injection → forward chain → UDEs): once you've started tracing forward from the candidate injection but captured **no UDE yet**, a nudge reminds you the document still reads as an FRT — the negative branch is the point; and a **UDE that doesn't trace back to any injection** is flagged, because an off-chain UDE can't inform the adopt / modify / reject decision (and the Risk Register export — whose mitigation inference follows the same chain — would show it as a permanently open risk). Both are dismissible; a UDE with no causes at all is left to the regular *additional-cause* nudge, which on an NBR now covers both UDEs and Desired Effects. Custom entity classes participate via their `supersetOf` — a class marked "kind of UDE / injection" counts everywhere the built-in does (validators *and* the Risk Register export).

**Document-level warnings.** A few rules describe the diagram as a whole rather than any one box — the CRT **UDE-count** scope guard and the NBR **no-negative-branch** nudge. These carry a *document* target: they appear in the **Document Inspector** (the ⓘ button next to the title) under "Document-level warnings", and in the **CLR walkthrough**, rather than in any selection's inspector. Their dismissal is keyed to the document, so it survives adding, deleting, or re-wiring entities.

**Reinforcing-loop-with-no-delay warning.** A CLR validator fires on any reinforcing loop (R badge) where *none* of the loop's edges carries a delay marker. Real reinforcing dynamics almost always contain a lag — if every edge in the loop is instantaneous, the structure may be missing a step or the delay is simply unacknowledged. The warning appears on the back-edge in the CLR panel; resolve it by marking at least one edge in the loop as delayed, or dismiss it if the instantaneous reading is intentional.

**Long-arrow / missing-step warning (EXISTENCE tier).** A sufficiency edge that skips three or more causal levels — judged by the topological distance between its source and target — triggers an EXISTENCE-tier CLR warning. The diagnostic: a large skip usually means intermediate causes are assumed rather than shown, which makes the arrow hard to challenge. The warning surfaces in the CLR panel with a one-click **Insert a step** action that splices a blank entity into the middle of the edge (identical to right-click → **Splice entity into this edge**), leaving you to name the missing step.

**Logic-type and loop checks (Session 179).** A **logic-type** nudge flags an edge whose kind contradicts the diagram's primary logic (sufficiency for CRT/FRT/TT/NBR; necessity for a Goal Tree). And for diagrams with a feedback loop, a **loop-polarity** check reads the loop as **Reinforcing (R)** or **Balancing (B)** — the product of the edge polarities around it — and flags a balancing (self-correcting) loop where a reinforcing (self-amplifying) one is expected. The loop-closing back-edge also carries a small **R / B badge** on the canvas, so you can see at a glance whether a cycle is a vicious/virtuous spiral (R) or a goal-seeking damper (B).

**Scrutinize a single link.** Select an edge and click **Scrutinize against the CLR** in its inspector (or `Cmd/Ctrl+K` → **Scrutinize this edge**). A guided stepper walks the eight canonical Categories of Legitimate Reservation — Clarity, Entity existence, Causality existence, Cause sufficiency, Additional cause, Cause–effect reversal, Predicted-effect existence, Tautology — **one question at a time** for that single cause→effect arrow. Any warning the validators already flagged on the edge appears under the matching question; the rest are prompts for your own judgment, with a checkbox to tick each as you consider it (the ticks are a session aid — nothing is saved). This is the complement to **Start CLR walkthrough**: the walkthrough clears the warnings that *did* fire across the whole diagram, while scrutiny makes you ask *every* reservation of the link in front of you, including the ones nothing flagged. It's read-only, so it stays available under Browse Lock.

## Review comments

Mark up a diagram with questions and notes — for your future self or for a colleague reviewing the same file. Comments live **inside the document**, so they travel with a JSON export, a share link, or an HTML export; nothing is sent to a server.

**Open the panel.** Click the speech-bubble icon in the top bar (or `Cmd/Ctrl+K` → **Comments**). It slides in from the right, over the inspector.

**Write a comment.**

1. Optionally **select an entity or edge** first — the composer anchors the comment to it ("Commenting on _Root cause_"). With nothing selected (or a multi-selection), it anchors to the whole diagram. A checkbox lets you switch an anchored comment back to the whole diagram.
2. Set your name once in the **"Signing as"** field — it's remembered for next time (blank comments are signed "Anonymous"). This is a local label, not a login.
3. Optionally tag the comment with a **CLR reservation** (Session 179) from the dropdown — one of the seven Categories of Legitimate Reservation. This turns "I disagree" into the non-threatening "I have a _causality-existence_ reservation" that TP facilitation teaches; the category shows as a small badge on the comment, and a filter appears in the panel once any comment is tagged.
4. Type your note and click **Comment** (or press `Cmd/Ctrl+Enter`).

**Work a thread.** Each comment shows **Reply** (one level of replies), **Resolve** (and **Reopen**), and — on hover — **Edit** / **Delete**. Deleting a comment that has replies removes the whole thread (with a confirm).

**Find what a comment is about.** Click the anchor chip at the top of a thread to select that entity/edge and center the canvas on it.

**Spot comments at a glance.** Any entity or edge with open comments shows a small indigo speech-bubble badge with the count; click it to jump straight into that thread in the panel. You can also start a comment without opening the panel first — select an entity or edge and click **Add comment** on the floating selection toolbar.

**Pin a comment anywhere.** Right-click an empty spot on the canvas → **Add comment here** drops a free-floating pin at that point (handy for "this whole region needs rework" notes that don't belong on any single node). The pin shows on the canvas, tracks pan/zoom, and clicking it opens the panel; its thread is anchored to the spot rather than to an entity or edge.

**Filter.** The **Open / Resolved / All** tabs scope the list; the panel header shows the open count. Resolving a comment greys it out and moves it out of the default Open view.

Comments anchored to an entity or edge are automatically removed if you delete that entity/edge; whole-diagram comments always stay. Everything is undoable with `Cmd/Ctrl+Z`.

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
- The palette also surfaces Assumption (violet) for edge side-attachments. CLR rules apply structurally (clarity, entity-existence, causality-existence, tautology) **plus the EC-specific `ec-completeness` rule** (Session 77) that bundles five brief-prescribed checks (both wants present, both needs present, all four necessity edges, mutex flag, single conflict). The mutex-edge rule (`ec-missing-conflict`) flags when neither D ↔ D′ edge carries the lightning-bolt mutex marker.

### Rapid 3-cloud diagnosis

A fast on-ramp to a Core Cloud when you don't yet have a full Current Reality Tree. Open the palette and pick **Rapid 3-cloud diagnosis…**. A two-step overlay walks you through the 3-cloud method:

1. **Capture three symptoms.** Name three undesirable effects, and for each the conflict you feel behind it — what you *do* (D) versus what you feel you *should do instead* (D′).
2. **Consolidate.** With the three conflicts shown side by side, write the single Core Cloud that sits under all of them: the shared objective (A), the two needs it protects (B / C), and the two opposing wants (D / D′).

On finish you get a new Evaporating Cloud document tagged as a **Core cloud**, opened in its own tab, with the three source conflicts recorded in the document description (visible in the Document Inspector). Nothing you were working on is touched — the overlay only creates the new cloud when you click **Create core cloud**. From there it's an ordinary EC: edit the boxes, mark the D ↔ D′ conflict, run the CLR checks, or carry an injection forward into an FRT.

### EC canvas chrome (Session 87, refined Session 89)

EC documents carry three workshop-oriented artifacts above the canvas, each surfacing something the BESTSELLER workshop PPT keeps prominently visible. **The reading guide is hidden by default since Session 89** — toggle it on via the palette command **Toggle EC reading guide** when you want workshop-style prompts visible above the canvas:

- **Reading-instruction strip** — when shown, pinned across the top. A compact "Read every arrow: 1) In order to… 2) we must… 3) because…" reminder of the canonical 3-step reading pattern. Click the × to dismiss for the rest of the session.
- **Verbalisation strip** — when shown, sits directly below the reading instructions. Reads the active cloud aloud in canonical prose, with click-through chips for each arrow's assumption count.
- **Injections (N) chip** — top-right corner, just below the toolbar (Session 89 moved it down to clear the toolbar buttons). Live count of injection entities on the doc; click to jump the inspector to its **Injections** tab. Visible even when N = 0 so the affordance is discoverable; brightens (emerald) when injections exist.

### Per-slot guiding questions (Session 87)

Select any of the five EC slot entities (A, B, C, D, or D′) and the **EntityInspector** surfaces the canonical guiding question for that slot above the Title field — the same question the wizard prompts with, kept available for re-reading after the wizard closes.

### Verbal style: neutral vs. two-sided (Session 87)

Open **Document settings** (the doc-title menu, or palette command "Document settings") on an EC document to see the **EC verbal style** toggle:

- **Neutral** (default) — the workshop voice: "In order to A, we must B."
- **Two-sided** — the explicit negotiation framing the BESTSELLER PPT uses: "they want to" on the D side, "I want to" on the D′ side. Surfaces the felt conflict between two parties.

The toggle persists on the document (round-trips through save/load) and updates the verbalisation strip live.

**Cloud type (Session 154).** Below the verbal-style toggle, an EC document also has an optional **Cloud type** dropdown — *Dilemma, Conflict, UDE, Consolidated, Core,* or *Firefighting* — that labels the cloud's role in Cohen's *TP Basics* progression (UDE cloud → Consolidated → Core). It's purely a label: pick one and a small sky-blue chip appears next to the title; leave it "— Untyped" (the default) and nothing shows. Three ready-made clouds — **UDE cloud**, **Core cloud**, and **Firefighting cloud** — live in the **Pattern library…** picker, each pre-tagged. Nothing about drawing or reading an EC changes; the tag is just a way to record "this is the Core Cloud of my analysis."

### Reverse-direction wizard walk (Session 87)

When the EC creation wizard is open, look at the top of the panel for the **A → D′ / D → A** toggle. The default walks the structural top-down order (A → B → C → D → D′). The D-first option flips to the PPT's "start from the felt conflict" order (D → D′ → C → B → A) — closer to how practitioners actually experience a conflict. Either order leaves the canvas in a useful state at every step.

### Clickable assumption badge on each arrow (Session 87)

Every edge that carries assumptions now shows a small violet "A" / "A_N_" pill mid-edge. Click it to select the edge AND open the EC inspector on its Assumption Well — no second click needed.

## Transition Trees

A Transition Tree is a sequenced injection plan — the chain of actions that move you from current reality to a desired effect. Each action carries an explicit step number so the order stays legible after rearranging.

- Start one with `Cmd/Ctrl+K` → **New Transition Tree** (or load the example via **Load example Transition Tree**).
- The palette types are: **Action** (cyan, the step you take), **Effect** (grey, intermediate states the plan passes through, optional), **Desired Effect** (indigo, the outcome at the top), and **Assumption** (violet, edge side-attachments).
- Select an Action in the inspector to see a **Step #** numeric input. Set a step number and a small "Step N" badge appears at the node's top-left. Leave it blank to hide the badge — the step field is action-only today.
- The same Action inspector also has optional **Need** and **Working assumption** fields (Session 158) — *why* the step is needed, and the belief that makes the action sufficient. With the Action and its Step #, they form the canonical Transition-Tree step (Action ← Need ← Working Assumption). Both are free text and optional; leave them blank and nothing changes.
- Layout is regular dagre. If you connect the actions in order (Tab from action 1 to action 2 etc.), the flow naturally reads top-to-bottom; the step badges then act as a visible cross-check rather than the layout driver.
- **Export the plan as a task list.** `Cmd/Ctrl+K` → **Export…** → **Task tracker CSV** turns the actions into a sequenced to-do list — one row per Action, ordered by step number (annotation-number tie-break), with columns step / action / precondition / outcome / owner / due date / status / success criteria, ready to paste into Jira, Trello, Planner, or Asana. The option only appears on a document that has Action entities (a Transition Tree is the canonical case, but any diagram with Actions exports).
- No TT-specific CLR rules yet. The CRT/FRT heuristics simply don't fire on a TT.

## Prerequisite Trees

A PRT (Prerequisite Tree) surfaces what's between you and a goal — the obstacles, plus the intermediate objectives that overcome each one. Read bottom-up: do these IOs → defeat these obstacles → reach the goal.

- Start one with `Cmd/Ctrl+K` → **New Prerequisite Tree** (or load the example via **Load example Prerequisite Tree**).
- The palette types are: **Goal** (sky-500, the ambitious target at the top), **Obstacle** (rose-500, what's in the way), **Intermediate Objective** (blue-600, the steps that defeat each obstacle), and **Assumption** (violet, edge side-attachments).
- The canvas mechanics are identical to CRT — drag-to-connect, `Tab` for child, right-click for actions. Layout is the same dagre flow; nothing about PRT requires hand-positioning.
- No PRT-specific CLR rules yet. The CRT-only and FRT-only heuristics simply don't fire on a PRT.
- **Export an ordered plan (Session 162).** `Cmd/Ctrl+K` → **Export…** → **Prerequisite plan (CSV)** turns the tree into a sequenced to-do list: it topologically sorts the dependency edges and emits one row per Intermediate Objective, *prerequisite-first* (an IO that another IO depends on comes earlier). Columns: step / objective / **overcomes** (the obstacle it targets) / **depends on** (earlier IOs) / owner / due date / status / notes — ready to paste into Jira, Trello, or a spreadsheet. Where a Transition Tree's task export reads explicit step numbers, the PRT has none, so the order comes from the dependencies you've drawn. The option only appears on a doc that has Intermediate Objectives.

## Creation wizards (Goal Tree + EC)

When you open a new Goal Tree or Evaporating Cloud, a small **"Get started" panel** appears at the top-left of the canvas and walks you through the canonical structure:

- **Goal Tree**: 5 steps — the Goal, then 3 Critical Success Factors, then your first Necessary Condition. Each `Next ›` commits the entity to the canvas (auto-laid-out by dagre) and connects it to its parent with a necessity edge.
- **Evaporating Cloud**: 5 steps — the shared objective A, then Need B, Need C, Want D, Want D′. Each `Next ›` fills the corresponding pre-seeded slot's title.

The wizard is **never blocking**. You can:

- **Skip step** to advance without filling that prompt. A small grey notice flashes for ~2.5s ("Step skipped — you can fill it in directly on the canvas later") so an accidental empty-Enter isn't silent.
- **Minimise** (chevron-up) to collapse the panel to a "Continue setup ›" pill that sits in the same spot — click it to expand again.
- **Dismiss** (X) to close the panel for this session.
- **Esc** to dismiss. If you have **unsaved typed text** in the current step, the first Esc surfaces an amber band ("Press Esc again to discard this draft and close the wizard") — second Esc within ~2.5s closes for real. Empty drafts close on the first press.
- Tick **"Don't show this on new {Goal Trees|Evaporating Clouds}"** to silence the wizard for all future new diagrams of that type. Re-enable in **Settings → Behavior** or via the palette command **Reopen creation wizard** to bring it back for the current doc.

Keyboard hint shown below the textarea: **Enter to commit · Shift+Enter for a newline · Esc to dismiss**.

Want to skip straight to the canvas without the wizard? Either click Dismiss once, or turn the toggle off in Settings → Behavior. Both diagram types start with the canonical structure ready to edit — Goal Tree's empty canvas with the entity palette tuned, EC's 5 pre-seeded boxes waiting for titles.

## Strategy & Tactics Trees

A **Strategy & Tactics (S&T) Tree** is Goldratt's later-work pattern for cascading strategies down into the tactics that implement them, each layer carrying its assumption set. The TP Studio implementation uses the existing TOC entity types as facet carriers — the new diagram type is a thin shell that tunes the palette and provides a method checklist.

- Start one with `Cmd/Ctrl+K` → **New Strategy & Tactics Tree** (or load the example via **Load example Strategy & Tactics Tree**).
- The palette types map onto the S&T facets:
  - **Goal** (sky) — a *strategy* at this level (the apex or a sub-level objective).
  - **Injection** (emerald) — the *tactic* that achieves the strategy. Default entity type when you double-click the empty canvas.
  - **Necessary Condition** (lime) — the *necessary / parallel / sufficiency assumption* layer attached to a tactic. The book distinguishes three roles (NA / PA / SA); TP Studio uses the same entity type for all three and lets you label the role in the title or description.
  - **Effect** (grey) + **Note** (yellow) round out the palette. (Assumptions aren't a palette node type — they're annotations you add to an *edge* via the Assumption Well.)
- Build top-down: place the apex strategy as a `goal`, place its tactic below as an `injection`, then attach `necessaryCondition` entities feeding the tactic for the assumption facets. Each tactic decomposes into the next layer down by becoming the parent of a child strategy.
- The Document Inspector's Method checklist carries six S&T steps (apex strategy → tactic → NA → PA → SA → decompose) so you can tick off the discipline as you go.
- **First-class 5-facet card.** Select any injection (tactic) on an S&T diagram; the inspector grows a new **S&T facets** section with four textareas — Strategy, Necessary Assumption, Parallel Assumption, Sufficiency Assumption. Filling any one of them flips the canvas card into a tall 5-row layout with the four facets stacked beneath the tactic title. The Strategy row gets an indigo accent so it stands out from the three assumption rows. Empty rows render as italic `(unset)` placeholders so the structural slot stays visible. This is the optional alternative to modeling each facet as its own entity — pick whichever style fits the level of detail you want.
- **Inline canvas editing (Session 81).** You can now edit any of the four facet rows directly on the card without opening the inspector — **double-click** a row's value to swap it for a textarea, type, then Enter (or click outside) to commit. Esc cancels and reverts to the previous value. Shift+Enter inserts a newline. An empty input clears the facet entirely. Browse Lock blocks the edit gesture, same as for the title.
- **CLR rules.** Structural set plus the S&T-specific **`st-tactic-assumptions`** rule: fires (clarity tier) on any tactic with fewer than three incoming `necessaryCondition` entities. The nudge prescribes Goldratt's three-facet pattern; resolve individual warnings if a tactic legitimately doesn't need all three.
- **Typing an assumption's role.** Any assumption attached to an edge carries a small **kind chip** in its row of the Assumption Well that cycles untyped → **N**ecessary → **P**arallel → **S**ufficient — the three assumption roles the S&T pattern distinguishes (NA / PA / SA), each colour-coded. It's optional and works on every diagram type, but it's most useful here for labelling which facet an assumption fills; leave it untyped and nothing shows.

## Freeform diagrams

A **Freeform Diagram** is the non-TOC mode: no built-in type pattern matching, no method checklist, no prescribed structure. Useful when you want the entity/edge canvas for argument-mapping, brainstorm boards, or dependency sketches that don't fit any TOC tree shape.

- Start one with `Cmd/Ctrl+K` → **New Freeform Diagram** (or load the example via **Load example Freeform Diagram**).
- The default palette has only three types: **Effect** (grey, the neutral box), **Assumption** (violet, side-claim on an edge), and **Note** (yellow sticky annotation outside the causal graph).
- Pair this with **Custom entity classes** (in the Document Inspector) to define your own typology — e.g. `Evidence`, `Belief`, `Claim` for an argument map, with their own labels, colors, and icons. Custom classes appear alongside the built-in three in the palette.
- CLR rules: only the **structural** set fires — entity-existence, causality-existence, clarity, tautology, cycle, indirect-effect. Type-pattern-matching rules (cause-effect-reversal, predicted-effect-existence, etc.) are skipped because their target entity types don't exist in the freeform palette.
- No method checklist; the Document Inspector hides the section.

## Saving, exporting, and sharing

**Autosave.** Every change is queued for write to your browser's local storage 200 ms after typing stops. `Cmd/Ctrl+S` forces an immediate flush and shows a confirmation toast. Closing the tab also forces a flush.

**Stale example titles.** Documents loaded before Session 87 (which dropped the `(example)` suffix from example titles) keep their original title in your localStorage — the title is part of the saved document, not derived from the example template. If you reopen an old auto-saved example you'll still see e.g. `"Customer-satisfaction Current Reality Tree (example)"`. Either edit the title manually or re-load the example via the command palette to get the fresh title.

**Auto-recovery.** Alongside the debounced "committed" save, a *live draft* is written synchronously on every keystroke under a separate storage key. If the browser is killed or your machine crashes before the debounce flushes, reopening the tab brings back whatever you'd typed up to the last keystroke — not just the last debounced save. A third *backup* slot holds the previous-save snapshot, so if the main slot is ever corrupted (mid-write crash, external tampering), you fall back to the prior good save instead of starting over. The recovery is silent on the happy path; if a backup or live-draft fallback fires, you'll see an info toast telling you the previous session ended unexpectedly.

**Share a read-only link.** `Cmd/Ctrl+K` → **Copy read-only share link** generates a fully self-contained URL — your document is gzipped + base64-encoded into the URL's `#!share=` fragment, then copied to your clipboard. No server, no upload, no account. Paste it in an email / chat / issue tracker; when the receiver opens it, the diagram loads with Browse Lock auto-engaged so they can read and explore without accidentally editing. The receiver can toggle Browse Lock off any time to make their own working copy (the original autosaved doc is preserved as a revision they can roll back to). Soft size warning above ~4 KB: very large diagrams may get truncated by some chat clients, in which case fall back to JSON export. Share-links require a recent browser (`CompressionStream` API — Chrome 80+, Firefox 113+, Safari 16.4+).

**Self-contained HTML viewer (Session 77).** `Cmd/Ctrl+K` → **Export as self-contained HTML viewer** writes a single `.html` file with all CSS / JS inlined and the source JSON embedded. The receiver opens it in any browser; the file works offline, behind firewalls, and on shared file drives. The view renders the doc title, entities, EC verbalisation (where applicable), assumptions with status chips, and injections — read-only. No network calls. Best for sending a colleague a snapshot they can open without installing anything.

**Print preview (Session 77, extended Sessions 79 + 80).** `Cmd/Ctrl+K` → **Print / Save as PDF…** opens a print preview modal where you pick:

- **Mode**: Standard, Workshop (high-contrast, large font, group rectangles bordered), Ink-saving (group shading removed, edges thinned, blacks softened).
- **Page setup** (Session 178): **Size** (A4 / Letter), **Orientation** (Portrait / Landscape), and **Scale** (Fit page / Fit width). Size + orientation apply to **both** the vector PDF and browser-print (they set the PDF's page format and the browser's `@page` size). **Scale** is browser-print only: *Fit page* fits the whole tree onto one page (the overview), *Fit width* scales the tree to the page width and flows it down across multiple pages for readable detail (nodes may split at page edges — use the vector **Save as PDF** for clean multi-page slicing). The choice is remembered, so a bare `Cmd/Ctrl+P` uses it too.
- **How-to-read legend** (checkbox, Session 178, on by default): a one-line, type-specific reading rule printed under the title — e.g. a CRT prints "read bottom-up; the core driver is the root cause that feeds the most UDEs", an EC prints the *in order to / we must / because* conflict reading, a Goal Tree prints the Goal → CSF → NC chain. Makes a printout self-explanatory for a reader who doesn't know the Thinking Process. Persisted, so a bare `Cmd/Ctrl+P` includes it too. Works in **both** the browser-print and vector-PDF paths (Session 179 — in the PDF it's wrapped under the header on every diagram page so each sheet of a multi-page export stays self-explanatory); freeform diagrams have no legend.
- **Annotation appendix** (checkbox): when on, the output includes a numbered list of every entity's description as an appendix after the diagram.
- **Reasoning narrative** (checkbox): when on, the diagram's cause→effect read-out — one numbered sentence per link in reading order, the same narrative the on-screen verbalisation and the Markdown reasoning export produce — prints after the diagram (and after the annotation appendix when both are on). Works in both the browser-print and vector-PDF paths.
- **Selection only** (checkbox, Session 79): when on, only selected entities + edges appear in the output. The rest of the canvas is hidden (via `visibility: hidden` for browser-print so layout positions stay intact, or by filtering the source node list for the vector PDF). Disabled when there's no selection.
- **Header / footer templates**: free text with merge fields `{title}` / `{date}` / `{author}` / `{diagramType}`. The PDF path also resolves `{pageNumber}` / `{pageCount}` per page; browser-print leaves them blank and relies on the browser's running headers.

Two export paths:

- **Save as PDF** (primary, Session 80) downloads a true **vector PDF** built with `jspdf` + `svg2pdf.js`. Text stays text (selectable + searchable), strokes stay resolution-independent, multi-page when the diagram exceeds one page-height (sliced vertically, scaled to page-width). The annotation appendix is paginated automatically. **Font note**: the embedded fall-back is Helvetica (Latin-1 only). Diagrams containing CJK / Cyrillic / accented characters should use the browser-print path below for accurate glyph rendering.
- **Open print dialog** hands off to the browser's print / Save-as-PDF flow with the chosen mode applied. Use this when you need system-font Unicode coverage or want to print to a real printer rather than a PDF.

**The Export picker.** Everything below is reachable from one dialog: `Cmd/Ctrl+K` → **Export…** (or `Cmd/Ctrl+E`) opens a picker that groups every export by category — Images, Documents, Data, Annotations & reasoning, and Share. A few options surface only when they apply: **Risk Register CSV** when the document has UDEs, **Task tracker CSV** when it has Actions, **Prerequisite plan CSV** when it has Intermediate Objectives, and the **EC Workshop Sheet** on Evaporating Clouds. The individual `Export as …` commands below still work if you know the name; the picker is just the one-stop entry point.

**Export as JSON.** `Cmd/Ctrl+K` → **Export as JSON** downloads `<your-title>.tps.json`. The format is human-readable, version-stamped, and round-trip stable.

**Export as redacted JSON.** `Cmd/Ctrl+K` → **Export as redacted JSON** writes the same structure as a normal JSON export but replaces every entity title with `#N`, blanks descriptions and edge labels, retitles groups as `Group N`, and drops author / document-level description. IDs, types, edges, and AND-groups are preserved exactly. Useful when you want a colleague to see the *shape* of an analysis without leaking what each node says.

**Export as PNG.** `Cmd/Ctrl+K` → **Export as PNG (2×)** downloads `<your-title>.png` at 2× pixel density, theme-aware (white background in light mode, near-black in dark mode), cropped to fit your diagram with 32 px of padding.

**Export as JPEG / SVG.** Same as PNG, different format. JPEG is smaller for sharing in chat tools that resample PNGs. SVG is sharp at any zoom and importable into design tools (Figma, Illustrator).

**Print / Save as PDF.** `Cmd/Ctrl+P` opens the browser's own print dialog directly (the app doesn't intercept the shortcut). The diagram is automatically framed for the page using your saved **Page setup** (set it once in **Print / Save as PDF…** — see above): *Fit page* puts the whole tree on one page, *Fit width* scales to the page width and flows across multiple pages; Size + Orientation pick the paper. You don't have to zoom-to-fit first, and your on-screen pan/zoom is restored as soon as the print dialog closes. The print stylesheet hides every floating affordance (toolbar, inspector, palette, minimap, controls, comments panel) and forces a light color scheme regardless of your current theme. The page gets a header with the document title, optional author, and optional description, and a small "Exported YYYY-MM-DD · TP Studio" footer. Pick "Save as PDF" in the dialog for a clean PDF, or send it to a real printer. For clean multi-page slicing (selectable text, the annotation appendix, the reasoning narrative), use **Print / Save as PDF…** → **Save as PDF** instead.

**PowerPoint deck.** **Export…** → **PowerPoint deck (.pptx)** generates a workshop-ready `.pptx` with: a cover slide (doc title, diagram type, author, date on an indigo brand band), a System scope slide when any of the seven scope fields are filled, an embedded screenshot of the canvas, an EC-only "conflict" slide for Evaporating Clouds, paginated reasoning slides (one bullet per edge sentence in topological order, ≤7 per slide), a "Likely Core Driver(s)" slide for CRTs that have one, and a Method-checklist progress slide when any step is ticked. The PowerPoint vendor (~123 KB gz) is lazy-loaded behind this menu item — users who never export don't pay for it.

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

**Save to file / Open from file (Chromium).** On Chrome / Edge, three extra palette commands let you work with a *real file on disk* instead of the browser's download / upload flow. **Open from file…** reads a `.tps.json` into a new tab. **Save to file** writes the current document back — and here's the convenience: the first save (or an open) *remembers* the file, so every **Save to file** after that **re-writes the same file in one click**, no picker. **Save to file as…** always opens the picker, for saving a copy somewhere new. A small link-chip beside the document title shows which file you're bound to. These are purely additive — autosave to local storage, the tabs, `Cmd/Ctrl+S`, and the Export/Import commands above all behave exactly as before; this just adds a file on disk as a target for the same JSON. The commands are hidden on browsers without the File System Access API (Firefox / Safari), where **Export as JSON** + **Import from JSON…** remain the path. **OneDrive tip:** save into your synced `OneDrive\…` folder and the OneDrive client backs the file up and syncs it across your devices with no account linking — **Open from file…** the same file on another machine to carry on, then **Save to file** to write straight back. (If the bound file is later moved or deleted, the next **Save to file** tells you and falls back to a fresh pick.)

**Flying Logic interop.** Palette → **Open Flying Logic file…** accepts `.logicx`, `.logic`, and `.xlogic` (Flying Logic 4 desktop-save) files; **Export as Flying Logic file** writes a `.logicx`. The mapping covers entities, edges, AND-junctions (Flying Logic represents these as "junctor" vertices), and groups. The reader handles both the scripting-API XML layout (flat) and the desktop app's File → Save layout (nested under `logicGraph > graph`, with attributes wrapped in `<attributes>`). FL stock classes that don't have a structural CLR analogue in TP Studio — `Generic`, `Note`, `Knowledge` — land as plain `Effect` entities; `Desirable Effect` (FL's spelling variant) maps to our `Desired Effect`. Things to know:

- Flying Logic doesn't store node positions in the file — both apps auto-layout on open, so a hand-arranged layout won't survive a round-trip.
- Flying Logic has more junctor types than TP Studio (sufficient+necessary, OR, NOT-AND, etc.); we coerce everything to AND on import.
- Edge labels, group colors, and annotation numbers are TP-Studio-specific. They survive a TP → FL → TP round-trip via custom attributes, but Flying Logic itself won't surface them.
- The reader expects the flat XML body described in Flying Logic's public scripting docs. If a `.logicx` you receive is a ZIP archive, extract the inner XML first.

**Sharing.** Two practical paths today: send the `.tps.json` file (recipient runs **Import from JSON…**) or send the `.png`.

If the browser's storage quota is exceeded — usually because of an exceptionally large document or browser-wide storage pressure — you'll get a destructive toast: `Couldn't save to this browser: ...`. The in-memory document keeps working; export to JSON to preserve it.

## Importing

Most ways into the canvas live behind one command: `Cmd/Ctrl+K` → **Import…** opens a picker of sources —

- **TP Studio JSON** — a `.tps.json` file you (or a colleague) exported.
- **Flying Logic file** — `.logicx` / `.logic` / `.xlogic` (the mapping is detailed under [Flying Logic interop](#saving-exporting-and-sharing) above).
- **Mermaid diagram** — the `graph` syntax our Mermaid export emits.
- **Entities CSV** — the header-row format described under [CSV import](#quick-capture-and-csv-import).
- **Paste from whiteboard** — sticky-note text from Miro / Mural / FigJam / a transcript.

All but CSV open the result in a **new tab**, leaving your current work untouched; CSV appends its rows to the current document. The detailed mechanics of each format are covered in the sections cross-referenced above — the picker just gathers them in one place.

**Import a single entity from another document.** `Cmd/Ctrl+K` → **Import entity from another doc…** opens a file picker for a `.tps.json`, then lets you choose **one** entity from it to copy into the current diagram. The copy keeps a read-only **"Imported from"** card in its inspector recording the source document's title and the date — provenance that travels with the entity, so months later you can still see where a borrowed UDE or injection came from. (This one-way provenance is distinct from the live cross-tab [**"Linked to"** chips](#working-with-multiple-documents-tabs) that navigate between open documents.)

**Draft a diagram from a description (AI).** If you have access to Claude, the **`tp-studio-import`** skill turns a plain-language description — a problem, a goal, a conflict, a plan — into a valid TP Studio document. Describe what you're working through (e.g. "a Current Reality Tree for why onboarding churns"), run the skill, and it produces a `.json` you load with **Import… → TP Studio JSON** and edit from there. It covers every diagram type and is a fast way past the blank canvas; the structure it emits is checked against the same importer the app uses, so it can't drift from the schema.

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
- **Display.** Toggle **Show annotation numbers**, **Show entity IDs**, **Grow cards to fit text** (Session 181 — lets an entity card grow taller to show its full title, up to six lines, instead of clamping to two; off by default), **Show UDE-reach badge** (Session 52), **Show root-cause-reach badge** (Session 71), **Show action-eligibility badge** (Session 135), **Show minimap**, and **Ink-saving print mode**. Pick a **Causality reading** (none / auto / because / therefore / in order to). Pick a **Default direction for new documents** (auto / BT / TB / LR / RL) — set this when you prefer all new docs to start in a particular orientation; existing docs keep their own per-doc layout setting.

All settings persist across reloads.

The **Theme** item in the overflow (⋮) menu cycles between `Light` and `Dark`. High contrast and the other prefs live in the Settings dialog.

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

## App modes

TP Studio runs in one of **five app modes** — a persisted preference that retunes the whole interface for a task. Switch from the command palette: `Cmd/Ctrl+K` → **Switch to Expert / Guided / Workshop / Presentation / Reader mode**, and a toast confirms the change. (There's no mode switcher in the toolbar — the palette is the way in. In Reader and Presentation mode the chrome is minimal, but an **Exit** affordance is always shown.)

- **Expert** *(default)* — every affordance available. The full editing experience the tool ships with.
- **Guided** — for a first-time author. The creation wizard for a new **Goal Tree** or **Evaporating Cloud** always appears, even if you previously ticked "don't show this again" (see [Creation wizards](#creation-wizards-goal-tree--ec)). Otherwise identical to Expert.
- **Workshop** — for projecting to a room. Node text is enlarged so entity titles stay legible on a shared screen.
- **Presentation** — for read-only projection. The top bar, inspector, selection toolbar, and zoom controls are hidden, and **Browse Lock auto-engages** so a stray click can't edit the projected diagram (leaving the mode does *not* auto-unlock). A **step-through** control appears bottom-centre: the **‹** / **›** buttons — or the `←` / `→` arrow keys — walk the diagram's entities one at a time, by explicit step order first then annotation number, centring each in turn, so you can lead an audience through the causal chain without speaker notes.
- **Reader** — a distraction-free teaching mode with coaching tooltips; it has its own section ([Reader / trainee mode](#reader--trainee-mode)) below.

Switching modes is non-destructive — it changes only what's shown and (for Presentation / Reader) the lock state, never the document.

## Reader / trainee mode

Reader mode is a fifth app mode alongside Expert, Guided, Workshop, and Presentation. It is designed for someone encountering a finished diagram for the first time — a stakeholder review, a training session, or a self-study pass through an archived analysis.

Enter it from the command palette (`Cmd/Ctrl+K` → **Switch to Reader mode**) — see [App modes](#app-modes) above. While you're in it the top bar collapses to a **Reader mode** pill, an **Exit** button, and the help icon.

While in Reader mode:

- **Edit chrome is hidden.** The selection toolbar, drag handles, inline-edit affordances, and destructive inspector buttons are suppressed — the canvas looks clean, not locked.
- **Coaching tooltips on hover.** Hovering any entity or edge surfaces a short explanation of *what that element type is and how to read it* (e.g. "Root Cause — a terminal driver at the bottom of the tree; this is where leverage lives"). The tooltips are type-specific, not entity-specific, so they teach the method rather than paraphrase the title.
- **"How to read this" banner.** A dismissible banner across the top of the canvas gives a one-sentence diagram-type reading rule (the same text as the print legend). Dismiss it for the session with the × or leave it visible for new readers.
- **"Challenge this arrow" flow.** Right-clicking an edge in Reader mode offers **Challenge this arrow** instead of the usual edit options. It opens the comment composer pre-configured in CLR-reservation-first mode — the reservation category dropdown is mandatory before the text field activates, prompting the reader to name *which* Category of Legitimate Reservation they're raising rather than just writing a freeform objection. The resulting comment is tagged with the reservation and anchored to the edge, ready for the diagram author to review.

Switching away from Reader mode (back to any other app mode) restores all edit chrome immediately.

## Using TP Studio offline

TP Studio is a Progressive Web App: after the first time you open it on a network, the browser quietly caches every asset (HTML, JS, CSS, icons, fonts) via a service worker. From that point on the app loads without a network round-trip — works on a plane, on a hotel Wi-Fi captive portal, behind a corporate firewall that blocks the host, or while your VPN reconnects.

Your documents live in the browser's `localStorage`, exactly where they were before the PWA went live, so offline-mode is purely about loading the app shell. Saving, importing, exporting — anything that touches the canvas — works the same on or off network.

**Install as a desktop / mobile app.** Chrome and Edge offer an Install affordance after a couple of visits — look for an Install icon in the address bar, or open the command palette (`Cmd/Ctrl+K`) and pick **Install TP Studio…**. Installing strips the browser chrome (no address bar, no tab strip) and gives you a launcher-icon entry on macOS / Windows / Linux / Android. Uninstall via the normal OS-app uninstall path.

**Updates.** A toast appears in the corner whenever a new build is available — click **Refresh now** to drop the old cache and reload, or dismiss and the next natural reload picks up the change anyway. The update flow is explicit (not silent) so you never lose mid-edit state to an unexpected reload.

**Forcing an update check.** Normally the service worker checks for new builds on its own cadence (each page load + every ~24 h). To force one on demand, open `Cmd/Ctrl+K` → **Check for updates**. The result is always explicit:
- *"You're on the latest version of TP Studio."* — green toast; you're current.
- *"New version of TP Studio is available."* — info toast with a **Refresh now** action; click to apply.
- *"New version found — the refresh prompt will appear once it finishes downloading."* — info toast; the canonical Refresh-now prompt fires automatically once the new worker reaches the `waiting` state.
- *"Update checks aren't available here (the service worker isn't running)."* — info toast; happens on plain `http://`, in private windows that block service workers, or during a fresh first visit before the worker has registered.

iOS Safari has weaker PWA support; Install adds the icon to the home screen but offline support and update prompts are best-effort. macOS / Windows / Android Chrome and Edge are the supported install targets today.

**About, and the practitioner book.** `Cmd/Ctrl+K` → **About TP Studio…** opens an info panel with the build version and links to everything around the app: the User Guide, the security audit, third-party notices, the source repository, and the companion book *Causal Thinking with TP Studio* in two formats — a **PDF** and an **EPUB**. The EPUB reflows for e-readers, so you can email it to your Kindle or open it in any reading app; both are cached for offline reading once you've opened the app online.

## Document details

The small info icon to the right of the document title (or palette → **Document details…**) opens a dialog where you can set the document's title, an optional author, and a free-form description (goal, scope, audience). It also shows a small count of entities and edges. The author and description fields are saved as part of the JSON export.

The dialog also carries two collapsible sections drawn from the book's TOC method:

**System Scope.** Seven structured questions Goldratt's CRT method opens with — system goal, necessary conditions, success measures, boundaries, containing system, interacting systems, inputs/outputs. They generalize to every TOC tree, so the section is available regardless of diagram type. Answer them before you start drawing entities; the discipline pays back as the tree grows. The summary line shows how many of the seven are filled, and the section auto-expands when you re-open the dialog if you've already answered any.

**Performance frame (Session 163).** Two optional anchors that frame the gap the diagram closes: a **Low** note (the measure's current, unacceptable level) and a **High** note (its target). It's the gap-analysis framing from Cohen's *TP Basics* — name where a metric sits now vs. where you want it, e.g. "On-time delivery at 60%" → "Reach 98% within two quarters." General to every diagram type, collapsed by default, with a summary that shows how many of the two anchors are filled (and auto-expands when either is set). Both anchors round-trip through JSON export.

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

## Accessibility

TP Studio targets WCAG 2.1 AA and ships a real keyboard-only authoring path — useful for screen-reader users, motor-disability users, and anyone who prefers to keep their hands on the home row.

**On the canvas:**
- **Every node + edge announces itself.** Screen readers read out the human type label + title + (where set) ordering step, locus, propagated state (with `(speculative)` marker on Phase 1C what-if overlays), and action-eligibility status. Edges announce `Edge from <source> to <target>` plus back-edge / mutual-exclusion / assumption-count modifiers. Group rectangles read `Group: <title> (<N> entities)` with collapsed / archived markers; collapsed-root cards read `Collapsed group: <title> (<N> entities hidden)`.
- **Tab + Shift+Tab walk the canvas;** a visible focus ring marks where you are (distinct from the selection halo so you can tell "where will my Enter land" from "what's chosen").
- **Arrow keys walk the graph.** With a node focused, ←/↑/→/↓ jumps focus + selection to the connected neighbour in that direction. Picks the connected entity whose center is most in the pressed direction; ignores back-edges and mutual-exclusion markers.
- **Keyboard edge creation.** Two-step palette flow: select source → `Cmd/Ctrl+K → Start edge from selected entity… (keyboard)`; select target (Tab or arrow keys) → `Cmd/Ctrl+K → Complete edge to selected entity (keyboard)`. The StatusStrip chip "Select target, then palette → Complete edge" shows while an edge is pending; click it (or press Esc) to cancel.

**Dialogs and the palette:**
- Help, About, Settings, the Export picker, the Import-entity picker, the Template picker, and Print preview all trap focus inside themselves while open (no Tab escapes), close on Esc, and return focus to the element that opened them.
- `Cmd/Ctrl+K` opens the command palette from anywhere; every primary action is reachable by search.
- The Esc cascade prioritises the innermost surface: editing-textarea → pending-keyboard-edge → AND-join mode → hoist → selection.

**Themes and contrast:**
- The default light and dark themes meet AA contrast for body text; `High contrast` (white on pure black + thicker focus rings) gives full AAA contrast.
- Four named dark variants (`Rust` / `Coal` / `Navy` / `Ayu`) drive the focus-ring accent through `:focus-visible`, so the ring colour matches the theme without losing visibility.

**What automated tests guard:**
- Axe scans on the canvas (CRT and EC variants), the canvas-with-SelectionToolbar surface, and the Help / About / Settings dialogs — every commit fails CI if a `critical` or `serious` axe finding lands.
- Focus-trap and Esc-close pins for each dialog.
- Tab-cycle smoke check (focus doesn't get stuck on the canvas).

**What still needs a human pass** is the "feels right" portion: screen-reader voice quality on the announcement strings, focus-order coherence across a busy CRT, contrast on theme variants. `docs/MANUAL_A11Y_WALKTHROUGH.md` is the checklist; rows already backed by code carry a 🤖 marker.

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

- The **overflow (⋮)** menu at the right of the top bar is always present and holds Theme, Browse Lock, Help, and Layout mode. As the window narrows, the top bar collapses by **content priority** instead of wrapping: the **undo/redo** and **history/comments** clusters fold into the overflow first (below ~1024 px), then **Share** sheds its label to an icon and the **command-search** field collapses to a single Search icon. The **Export** button stays visible throughout. Tap the kebab to reach the folded actions; the menu auto-closes after you pick one.
- At **< 640 px** (small phones / split-screen) the minimap, live zoom percentage, and diagram-type badge also hide to free up space.
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
