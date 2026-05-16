# Chapter 12 — Groups, assumptions, injections

> *Three cross-cutting features. Each is a small addition to your repertoire, but each one shows up in nearly every Part 2 chapter, so this chapter is the canonical reference.*

## Groups

A **group** in TP Studio is a labeled rectangle around a set of entities. It's structural metadata (which entities belong together) plus a visual chrome (the boundary box on the canvas). Use groups when a region of your diagram has a coherent meaning that the entities alone don't convey.

Three operations:

- **Create a group:** Multi-select entities (shift-click or marquee), then `Cmd+K → Group selected as new group`. The dialog asks for a title.
- **Nest groups:** A group's Group Inspector exposes a "Nest into parent group" picker. Groups can hold sub-groups indefinitely.
- **Collapse a group:** Click the chevron on the group title bar OR Group Inspector → Collapse. The group's contents disappear; the group renders as a single "collapsed-root card" the user can re-expand.

**Group presets** are the most useful feature here. TP Studio ships five preset (title, color) pairs derived from canonical TOC group naming:

| Preset | Color | Use when… |
| --- | --- | --- |
| **Negative Branch** | Slate | The grouped entities are a NB sub-tree (FRT-specific). |
| **Positive Reinforcing Loop** | Emerald | The grouped entities form a reinforcing loop. |
| **Archive** | Slate (collapsed by default) | The grouped entities have been trimmed out of the active analysis but you want to preserve them. |
| **Step** | Indigo | Marking a step of a multi-stage method (often used in S&T trees). |
| **NSP Block** | Amber | Marking "Negative Side Product" — a class of negative branch. |

Use them. They keep your diagrams legible to other TOC practitioners who read your work.

🛠 **`Cmd+K → Move selection to Archive group`** is a one-shot that finds the existing Archive group or creates one (with the Archive preset) and moves the selected entities into it. Useful for cleaning a working diagram before presenting.

## Assumptions

Assumptions are first-class entities (since schema v7). They sit beside the diagram — not on the causal path — and attach to a specific edge they pertain to.

**On a CRT/FRT:** Assumptions appear as a small violet pill on the edge they pertain to. The pill is clickable; clicking it selects the edge and opens the Inspector to the assumption.

**On an EC:** Assumptions live in the **AssumptionWell**, an Inspector tab specifically for the EC. Each assumption record carries:

- A title (the claim).
- A `status`: `open`, `valid`, `invalid`.
- A free-text rationale (description).
- A link to a related injection (when valid: false → "and here's the fix").
- An `implemented` flag (used in the InjectionWorkbench for FRT carry-forward).

The status field is what turns the assumption list from a brainstorm into a decision record. *Open* = "we haven't decided yet"; *valid* = "we've concluded this assumption holds"; *invalid* = "we've concluded this assumption is wrong" → this is where the cloud evaporates.

🛠 **Press `A`** with an edge selected to add an assumption to that edge.

## Injections

An injection is an entity of type `Injection`. It represents a proposed change — a thing you would *do* to the system. Injections show up:

- In FRTs as the bottom-of-tree entities driving the desired-effect chain.
- In ECs as the resolution to a broken assumption (linked from the AssumptionWell).
- In TT and PRT as the top-of-tree thing being decomposed.

Two Inspector flags worth knowing:

- **`implemented`**: a per-injection toggle. The **InjectionWorkbench** lists all injections in a doc; toggling `implemented` marks one as "done", visually distinct. Useful for tracking rollout progress against an FRT.
- **Linked assumption**: when an injection was drafted as a response to a `valid: false` assumption, the link is stored explicitly so the AssumptionWell and the InjectionWorkbench cross-reference.

## Sidebars

> **🛠 How TP Studio helps**
> - **Group presets** (`Cmd+K → Group inspector → Preset`).
> - **AssumptionWell** in the EC Inspector — first-class assumption records with status + injection links.
> - **InjectionWorkbench** in the EC Inspector — listing + status of all injections in the doc.
> - **`A` shortcut** with an edge selected — adds an assumption.

> **💡 Practitioner tips**
> - **Use the Archive group preset early.** When you're refining a CRT, you'll discover entities that are wrong or redundant. Don't delete them — Archive them. You'll often want to revisit "why did I think this?" later.
> - **Surface assumptions before they're broken.** The most useful assumptions are the ones you *don't* yet know are false. List liberally; classify later.

> **⚠ Common mistakes**
> - **Treating groups as visual chrome only.** Groups are structural — they affect exports, copy-paste, and the hoist-into-group feature. Use them for *meaningful* clustering.
> - **Letting assumptions accumulate without classification.** A list of 30 open assumptions is no better than no list. Classify them. Or remove them.

🔁 **Chain to next:** the CLR is the discipline that makes assumptions into real reservations. Next chapter goes deep.

---

→ Continue to [Chapter 13 — The CLR](13-the-clr.md)
