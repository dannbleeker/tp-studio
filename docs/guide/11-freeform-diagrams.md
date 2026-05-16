# Chapter 11 — Freeform diagrams
### *When none of the above fits*

> **🎯 What this process is for**
> A Freeform diagram is TP Studio's escape hatch. No built-in TOC entity types; no per-diagram CLR validators; just the canvas plus whatever custom types and attributes you define. Useful when the situation is causal-but-not-canonical: stakeholder mapping, system architecture, knowledge graphs, an early-stage think where you haven't yet decided which TP it'll become.

## When freeform is honest

- **The structure is causal, but the TOC types don't fit.** "Adoption curve diagram with cohorts" — UDE/effect/root-cause doesn't apply. Freeform with custom entity classes does.
- **You're at the "I don't know what I'm doing yet" stage.** Sometimes you sit down with a messy problem and need to draw things while you figure out *what kind of analysis it'll become*. Freeform lets you start without committing.
- **The diagram is a deliverable, not an analysis.** Documentation. A reference model. A team's shared mental model. Freeform gives you the same canvas affordances without prescribing methodology.

## When freeform is dishonest

- **You're avoiding the discipline of a real TP.** "I'll just use freeform for now" is sometimes a flag that you haven't decided what you're really doing, and the cost of that ambiguity is high. A CRT *forces* you to find root causes; freeform lets you avoid them. If you find yourself drawing freeform when one of the structured types would apply, that's a signal.
- **You want to skip the CLR.** The CLR validators don't fire on freeform diagrams (other than the universal `empty-title` clarity check). That's a feature for genuine non-causal diagrams; a bug for "I want my CRT but without the warnings."

## Custom entity classes

The real power of freeform is **custom entity classes** — per-document user-defined types. Open the Document Inspector → Custom entity classes section. Click "Add class".

For each class, set:

- **Label.** What it's called. "Stakeholder", "System Boundary", "Risk", whatever.
- **Color.** From a curated palette.
- **Icon.** One of 57 Lucide icons.
- **`supersetOf`.** Optional. Pick a built-in type the custom class *extends* — `effect`, `rootCause`, etc. Validators that fire on the built-in will also fire on your custom class. Useful when you want a renamed type ("Friction Point" superseding `effect`) but want the validators to still apply.

Custom classes live on the document, so they travel with JSON exports + share links. The class palette appears in the Entity Inspector's Type grid alongside the built-ins.

## Custom attributes

Each entity carries a `Entity.attributes` record — typed key/value pairs (`string` / `int` / `real` / `bool`). The Entity Inspector exposes a key/value editor below the warnings list. Use it when an entity needs structured metadata beyond the standard fields:

- A stakeholder entity with `decisionAuthority: int`, `name: string`, `lastEngaged: string`.
- A risk entity with `likelihood: real`, `impact: real`, `mitigation: string`.
- A system component entity with `slaTarget: int`, `currentMTBF: int`.

Attributes round-trip through JSON, CSV exports, and OPML exports.

## Sidebars

> **🛠 How TP Studio helps**
> - `Cmd+K → New Freeform diagram`.
> - **Custom entity classes** + **icon picker** (57 Lucide icons) in the Document Inspector.
> - **Per-entity attributes** key/value editor in the Entity Inspector.
> - **No diagram-type CLR firing** — only the universal `empty-title` clarity check applies.
> - **Group presets** still work — you can structure regions of a freeform diagram with Negative Branch / Reinforcing Loop / Archive presets.

> **💡 Practitioner tips**
> - **Use freeform sparingly.** If 30% of your TP Studio docs are freeform, look at whether you'd benefit from being more disciplined about TP selection.
> - **Promote when you're ready.** If a freeform doc starts to look like a CRT-in-progress, switch the diagram type (Document Inspector → Diagram type). Built-in types and validators activate. The structure you already drew survives.

> **⚠ Common mistakes**
> - **Using freeform as "default" because you didn't read this book.** The structured TPs exist because they catch errors freeform won't. Reach for them.
> - **Inventing 12 custom entity classes for a 20-entity doc.** Custom classes are powerful; they're also confusing for readers. Three classes is a lot.

> **🛑 When to stop**
> - The diagram answers the question it was drawn to answer.
> - You haven't accumulated CLR-style mistakes (freeform won't catch them; you have to catch them yourself).
> - The set of custom entity classes is small and understandable to a future reader.

🔁 **Chain to next:** Part 2 is done — you know every TP and when to use each. Part 3 covers the cross-cutting skills: groups, the CLR in depth, iteration via revisions and side-by-side compare.

---

→ Continue to [Chapter 12 — Groups, assumptions, injections](12-groups-assumptions-injections.md)
