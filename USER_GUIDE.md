# TP Studio — User Guide

A practitioner's walkthrough. Assumes familiarity with the Thinking Process — this is about the tool, not the method.

## Contents

1. [Starting up](#starting-up)
2. [What you see](#what-you-see)
3. [Building a Current Reality Tree](#building-a-current-reality-tree)
4. [Working with entities](#working-with-entities)
5. [Connecting causes to effects](#connecting-causes-to-effects)
6. [AND groups (sufficient sets of causes)](#and-groups)
7. [Assumptions on edges](#assumptions-on-edges)
8. [The CLR panel](#the-clr-panel)
9. [Future Reality Trees](#future-reality-trees)
10. [Saving, exporting, and sharing](#saving-exporting-and-sharing)
11. [Themes](#themes)
12. [Keyboard reference](#keyboard-reference)
13. [Tips](#tips)

## Starting up

Open the dev server URL (typically http://localhost:5173). The first time you open it you'll see an empty canvas with a hint card centered on screen:

> **Empty diagram**
> Double-click anywhere to add your first entity.

Your work auto-saves to this browser on every change. Closing the tab and reopening it later picks up where you left off — no sign-in, no cloud.

## What you see

| Element | Where | What it does |
| --- | --- | --- |
| Title | Top-left | Click to rename the document. The badge next to it shows the diagram type (`CRT` or `FRT`). |
| Commands button | Top-right | Opens the command palette (or press `Cmd/Ctrl+K`). |
| Help button (?) | Top-right | Opens the keyboard-shortcuts dialog. |
| Theme toggle (sun/moon) | Top-right | Switches between light and dark. |
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

**Editing a title.** Click a node to select it, then either start typing in the inspector's Title field, or press `Enter` to edit inline on the canvas. `Esc` exits inline edit without committing what you were typing in that field; clicking elsewhere commits.

**Changing the type.** Inspector → Type grid → click the new type. The stripe color updates immediately. You can also right-click a node and pick a "Convert to ..." option.

**Adding a description.** The inspector has a longer notes field below Type. Use it for context, sources, or why this entity is included.

**Deleting.** Press `Delete` (or `Backspace`) with a node selected. If the node has edges attached, you'll get a confirm prompt with the number of connections that will be cut. Cancel from the prompt to keep it.

## Connecting causes to effects

Three ways, in increasing order of speed:

1. **Drag.** Hover a node — handles appear on the top and bottom. Drag from one node's bottom handle onto another node. The first becomes the cause, the second the effect.
2. **Tab.** With a node selected, `Tab` creates a child entity *and* connects current → new. `Shift+Tab` creates a parent (new → current). Both put the new entity in edit mode so you can name it right away.
3. **Right-click.** Right-click an entity for **Add child** / **Add parent** entries.

The canvas re-flows automatically after each change, with a 300 ms ease-out animation.

## AND groups

By default a single arrow from cause to effect means "X is sufficient to produce Y." When two or more causes are *jointly* required — neither alone is enough — group their edges as an **AND**:

1. **Shift+click** each edge that should be in the group. (Click one, hold Shift, click the next.)
2. Open the command palette (`Cmd/Ctrl+K`) and pick **Group selected edges as AND**. The edges turn violet, an **AND** badge appears at the midpoint of each, and a small violet dot appears where they converge near the target.

Constraints: every edge in a group must share the same target — the tool will refuse to group edges that don't.

To **ungroup**: select one of the AND-grouped edges; the inspector shows the group ID and an **Ungroup** button. Or use the palette's "Ungroup selected AND edges" command on a multi-selection.

The cause-sufficiency CLR warning automatically suppresses itself on edges that are part of an AND group.

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

## Saving, exporting, and sharing

**Autosave.** Every change is queued for write to your browser's local storage 200 ms after typing stops. `Cmd/Ctrl+S` forces an immediate flush and shows a confirmation toast. Closing the tab also forces a flush.

**Export as JSON.** `Cmd/Ctrl+K` → **Export as JSON** downloads `<your-title>.tps.json`. The format is human-readable, version-stamped, and round-trip stable.

**Export as PNG.** `Cmd/Ctrl+K` → **Export as PNG (2×)** downloads `<your-title>.png` at 2× pixel density, theme-aware (white background in light mode, near-black in dark mode), cropped to fit your diagram with 32 px of padding.

**Import.** `Cmd/Ctrl+K` → **Import from JSON…** opens a file picker. The current document is pushed to undo history before the imported one takes over, so an accidental import is recoverable with `Cmd/Ctrl+Z`. Malformed JSON files are rejected with a descriptive error instead of corrupting state.

**Sharing.** Two practical paths today: send the `.tps.json` file (recipient runs **Import from JSON…**) or send the `.png`.

If the browser's storage quota is exceeded — usually because of an exceptionally large document or browser-wide storage pressure — you'll get a destructive toast: `Couldn't save to this browser: ...`. The in-memory document keeps working; export to JSON to preserve it.

## Themes

`Cmd/Ctrl+K` → **Toggle dark mode**, or click the sun/moon button in the top-right toolbar. The choice persists across reloads.

PNG exports respect the current theme — light theme exports get a white background; dark theme gets `#0a0a0a`.

## Keyboard reference

Same content as the in-app `?` button (top-right).

**Global**

| Keys | Action |
| --- | --- |
| `Cmd/Ctrl+K` | Command palette |
| `Cmd/Ctrl+E` | Command palette, pre-filtered to Export |
| `Cmd/Ctrl+S` | Save (force flush + toast) |
| `Cmd/Ctrl+Z` | Undo |
| `Cmd/Ctrl+Shift+Z` | Redo |
| `Esc` | Close help / palette / deselect |

**On a selected entity**

| Keys | Action |
| --- | --- |
| `Enter` | Rename |
| `Tab` | Add child entity |
| `Shift+Tab` | Add parent entity |
| `↑` | Move selection to effect (target of an outgoing edge) |
| `↓` | Move selection to cause (source of an incoming edge) |
| `← / →` | Move selection to a same-rank sibling |
| `Del` / `Backspace` | Delete (with confirm if connected) |

**Canvas**

| Action | Result |
| --- | --- |
| Double-click | New entity at cursor |
| Right-click | Context menu |
| Shift+click on edges | Multi-select for AND grouping |
| Drag from node handle | Connect entities |

## Tips

- **Iterate fast with Tab.** Selecting a node and hammering `Tab` builds a chain of children quickly. Press `Shift+Tab` instead to build upward toward causes.
- **Don't try to fix every CLR warning before sketching.** Get the structure out first. The "causality-existence" warning fires once per edge by design — resolve them once you're confident in each causality, not as you draft.
- **Group AND edges early, when the cause set is small.** It's cleaner than retrofitting a single-cause edge into a group later.
- **Use Assumptions as your "yes, but" notebook.** Whenever someone in the room says "that only works if X is true" — add it as an assumption on the relevant edge. It captures the challenge without breaking the diagram's flow.
- **Cmd+S is psychologically helpful but unnecessary.** The toast confirms what already happened. The real safety net is `Cmd/Ctrl+Z` (100 steps deep) and the JSON export.
- **Light theme reads better on a projector.** Dark theme is easier on the eyes for long solo sessions.
