# Chapter 12 — Groups, assumptions, injections

> *Three cross-cutting features. Each is a small addition to your repertoire, but each one shows up in nearly every Part 2 chapter, so this chapter is the canonical reference.*

## Groups

A **group** in TP Studio is a labeled rectangle around a set of entities. It's structural metadata (which entities belong together) plus a visual chrome (the boundary box on the canvas). Use groups when a region of your diagram has a coherent meaning that the entities alone don't convey.

Three operations:

- **Create a group:** Multi-select entities (shift-click or marquee), then `Cmd+K → Group selected entities`. Rename it from the Group Inspector.
- **Nest groups:** A group's Group Inspector exposes a "Nest into parent group" picker. Groups can hold sub-groups indefinitely.
- **Collapse a group:** Click the chevron on the group title bar OR Group Inspector → Collapse. The group's contents disappear; the group renders as a single "collapsed-root card" the user can re-expand.

**Group presets** are the most useful feature here. TP Studio ships five preset (title, color) pairs derived from canonical TOC group naming:

| Preset | Color | Use when… |
| --- | --- | --- |
| **Negative Branch** | Rose | The grouped entities are a NB sub-tree (FRT-specific). |
| **Positive Reinforcing Loop** | Emerald | The grouped entities form a reinforcing loop — pair with back-edge tagging on the closing edge. |
| **Archive** | Slate (collapsed by default) | The grouped entities have been trimmed out of the active analysis but you want to preserve them. |
| **Step** | Indigo | Wrapping one (Action + Precondition → Outcome) triple as a unit in a Transition Tree. |
| **NSP Block** | Amber | An S&T tree's Necessary condition / Sufficient action / Parallel assumption triple. |

Use them. They keep your diagrams legible to other TOC practitioners who read your work.

🛠 **`Cmd+K → Move selection to Archive group`** is a one-shot that finds the existing Archive group or creates one (with the Archive preset) and moves the selected entities into it. Useful for cleaning a working diagram before presenting. Any existing group can also be **archived in place** — Group Inspector → *Archive (preserve, hide)*, or palette → *Archive / unarchive selected group* — which dims it out of the way; *Show / hide archived groups* brings archived groups back when you need to re-read the path-not-taken.

## Assumptions

Assumptions are **edge annotations** — records attached to the specific arrow they pertain to, sitting beside the diagram rather than on the causal path. They are deliberately *not* an entity type: you won't find "Assumption" in any Type grid. You add one from the **Assumption Well** in the Edge Inspector (or press `A` with the edge selected), and it renders as a violet annotation card near its edge, with a faint dashed line tying the card to the arrow it challenges. Double-click the card (or use the Well) to edit it. The Well works the same on every diagram type — EC, CRT, FRT, all of them. Each assumption record carries:

- A title (the claim).
- A `status` you pick directly: `unexamined`, `valid`, `invalid`, or `challengeable`.
- A free-text rationale (description).
- A link to a related injection (when valid: false → "and here's the fix").
- An `implemented` flag (used in the InjectionWorkbench for FRT carry-forward).
- A **kind** sub-type — `Necessary`, `Parallel`, `Sufficient`, or untyped. A compact chip cycles through the three roles plus untyped, mirroring the S&T facet vocabulary ([Chapter 10](10-strategy-and-tactics-tree.md)): a *necessary* assumption is the trigger that makes acting unavoidable, a *parallel* assumption is why *this* approach over the alternatives, a *sufficient* assumption is the bet that the chosen tactic actually delivers. Tagging assumptions by kind lets an S&T reviewer see at a glance which part of each micro-argument an assumption is propping up.

The status field is what turns the assumption list from a brainstorm into a decision record. *Unexamined* = "we haven't decided yet"; *valid* = "we've concluded this assumption holds"; *invalid* = "we've concluded this assumption is wrong" → this is where the cloud evaporates; *challengeable* = "worth attacking" → it lights up the Injection Workbench.

🛠 **Press `A`** with an edge selected to add an assumption to that edge.

## Injections

An injection is an entity of type `Injection`. It represents a proposed change — a thing you would *do* to the system. Injections show up:

- In FRTs as the bottom-of-tree entities driving the desired-effect chain.
- In ECs as the resolution to a broken assumption (linked from the Assumption Well).
- In TT and PRT as the top-of-tree thing being decomposed.

Two Inspector flags worth knowing:

- **`implemented`**: a per-injection toggle. The **InjectionWorkbench** lists all injections in a doc; toggling `implemented` marks one as "done", visually distinct. Useful for tracking rollout progress against an FRT.
- **Linked assumption**: when an injection was drafted as a response to an invalid assumption, the link is stored explicitly so the Assumption Well and the InjectionWorkbench cross-reference.

### The injection flower

In Cohen's *TP Basics* an injection is never vetted from one angle. You probe it from three sides: the **Desired effects** it should produce (a Future Reality Tree), the **Negative branch** it might trigger (an NBR), and the **Plan** to implement it (a Prerequisite Tree). In TP Studio those three live as separate documents, stitched together with the "Link to entity in another tab…" cross-document links you met above — which is faithful to the method but scatters one injection's vetting across tabs, where it's easy to lose track of which side you haven't done yet.

**"View the injection flower"** gathers it back up. From an injection's inspector (or the palette command "View the injection flower…") it pulls that injection's cross-document links into the three petals — Desired effects, Negative branch, Plan — plus an "Other links" catch-all, and reads its development at a glance: the header says "N of 3 sides developed," and any side you've left empty shows a prompt rather than a blank ("No negative branch linked yet — ask 'what could go wrong?'"). Each row jumps to the linked entity, so the flower doubles as a launchpad back into whichever tab needs more work. It's the one view that answers "is this injection actually finished?" without your having to remember where you put the pieces.

## Sidebars

> **🛠 How TP Studio helps**
> - **Group presets** (`Cmd+K → Group inspector → Preset`).
> - **Assumption Well** in the Edge Inspector (every diagram type) — per-edge assumption records with status + injection links.
> - **InjectionWorkbench** in the EC Inspector — listing + status of all injections in the doc.
> - **`View the injection flower`** — gathers one injection's cross-document links into Desired effects / Negative branch / Plan petals (+ Other links) and shows "N of 3 sides developed."
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
