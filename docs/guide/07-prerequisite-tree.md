# Chapter 7 — Prerequisite Tree
### *What's in our way?*

> **🎯 What this process is for**
> A Prerequisite Tree (PRT) surfaces the obstacles between *where you are* and *where the FRT says you want to be*, then pairs each obstacle with an *Intermediate Objective* (IO) — a state that, if achieved, dissolves the obstacle. It answers: "What has to be true *first* for the injections to land?"

## The premise

You've diagnosed (CRT), named the conflict (EC), designed the solution (FRT). Now you have to *execute*, and execution runs into obstacles: things you don't have, capabilities you can't yet exercise, dependencies that aren't ready. The PRT makes those obstacles explicit and pairs each with the IO that resolves it.

Goldratt's framing: every injection has a precondition tree underneath. The PRT *is* that precondition tree, sequenced and obstacle-aware.

## The method

1. **Start with the injection.** Place it at the top of the canvas. (PRTs read top-down, unlike CRT/FRT which read bottom-up. TP Studio's layout strategy for PRT respects this.)
2. **Below the injection, list obstacles.** "We don't have an L2 agent with capacity to take on training." "We don't have a triage rubric document anyone has agreed to."
3. **For each obstacle, pair an IO.** "Two L2 agents reassigned with 40% capacity for training over 8 weeks." "Draft rubric circulated, reviewed, and signed off by the support lead and customer-success VP."
4. **Necessity edges, not sufficiency.** "In order to achieve [IO], we must overcome [Obstacle]." The TP Studio default for PRT edges is `necessity` — TP Studio handles this automatically.
5. **Sequence the IOs.** Some IOs depend on others. Connect them in dependency order. A chain emerges from the bottom (independent IOs) to the top (the injection).
6. **Stop when the leaves (lowest IOs) are things you can do *now*.** If a leaf IO still has its own obstacle that requires a sub-IO, keep descending. The tree is done when every leaf is actionable.

## Worked example (continued)

From [Chapter 6](06-future-reality-tree.md): primary injection is **Train 2 L2 agents on the hardest 20% of ticket types**.

`Cmd+K → New diagram → Prerequisite Tree`. Empty PRT canvas opens. Add the injection at the top as an `Injection` entity.

Below it, brainstorm obstacles:

- *Obstacle:* We don't have a list of "the hardest 20% of ticket types" — nobody's audited the queue.
- *Obstacle:* Both candidate L2s have full queues already.
- *Obstacle:* No training curriculum exists.
- *Obstacle:* No budget allocated for the contractor backfill (FRT injection I2).

For each, pair an IO:

- *IO:* Ticket-type audit complete; "hardest 20%" defined by escalation count + resolution time. (`intermediateObjective` type, blue stripe.)
- *IO:* L2 capacity freed by re-routing ~40% of their existing tickets to L1 with escalation rules.
- *IO:* Curriculum drafted; 4 modules × 2 hours each; lead reviews.
- *IO:* Budget request approved by Finance for 8 weeks of contractor backfill.

Connect each IO upward through the obstacle to the injection. The PRT now shows: *to get to the injection at top, we must overcome these obstacles, which means achieving these IOs.*

Some IOs depend on others:

- "L2 capacity freed by re-routing" depends on "Ticket-type audit complete" (you need to know what the hardest 20% IS before you can re-route the other 80%).
- "Curriculum drafted" depends on the audit too.

Add those dependency edges. The PRT now reads as a *sequenced plan* — the lowest IOs first, the injection last.

## Sidebars

> **🛠 How TP Studio helps**
> - `Cmd+K → New Prerequisite Tree` to start fresh.
> - **`obstacle`** entity type (rose stripe) and **`intermediateObjective`** type (blue stripe) — PRT-specific.
> - **Necessity edges by default** for PRT diagrams — the verbaliser reads "In order to / we must" wording.
> - **Dagre top-down layout** — PRT lays itself out with the injection at top, IOs descending.
> - **Span-of-control** flags help you triage IOs by who owns them. Mark each `control` / `influence` / `external`.

> **💡 Practitioner tips**
> - **Pair every obstacle with an IO.** An obstacle without an IO is a complaint. The IO turns "we can't" into "we will, once X."
> - **Surface the boring IOs.** "Get budget approved." "Schedule training time on calendars." These are the things that derail real rollouts. They belong in the PRT.
> - **Use Notes for context.** When an IO has nuance ("this requires Finance approval and we have a window before the next QBR"), capture it in the IO's description or as a sticky Note nearby.

> **⚠ Common mistakes**
> - **Skipping the obstacle and going straight to IOs.** Without the obstacle, the IO floats — it's not clear *why* it's necessary. The pairing is the point.
> - **Bottoming out at "we need executive buy-in."** That's a meta-IO. Sub-decompose it: what specifically does the executive need to know / agree to / approve? Each is a sub-IO.

> **🛑 When to stop**
> - Every leaf IO is something you can do *next week* (or whatever short timescale matters for your context).
> - Every IO is paired with a named obstacle it resolves.
> - Sequencing dependencies are explicit edges, not implicit.
> - Span-of-control is set on each IO so the rollout owner knows what's `control` vs. `influence`.

🔁 **Chain to next:** the PRT shows *what's in the way*. The TT shows *the actions that dismantle each obstacle, in order*.

---

→ Continue to [Chapter 8 — Transition Tree](08-transition-tree.md)
