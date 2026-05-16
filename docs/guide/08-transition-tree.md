# Chapter 8 — Transition Tree
### *How do we get there?*

> **🎯 What this process is for**
> A Transition Tree (TT) is the *operational plan*: a sequenced set of (action, precondition, outcome) triples that take you from current state to the IOs identified in the PRT. It answers: "What exactly does Maria do on Tuesday morning?"

## The premise

The PRT names obstacles and pairs IOs. The TT decomposes each IO into the concrete *actions* that achieve it, each action gated on a *precondition*, each producing an *outcome*.

The triple structure (action + precondition → outcome) is the smallest unit of TOC's implementation grammar. It maps cleanly to: "Given X, do Y, expect Z." Project plans and operational runbooks live in this grammar.

## The method

1. **Start from the highest-priority IO** in the PRT (the one with the most downstream dependents, or the one with the longest lead time).
2. **For each IO, write the *outcome*** — what state of the world must exist when the IO is achieved? (Often the IO statement itself, slightly reworded as an outcome.)
3. **Write the *action*** — the verb-phrase describing what someone does. "Audit the last 6 months of escalated tickets." "Schedule a 2-hour rubric-drafting block on the lead's calendar each Tuesday."
4. **Write the *precondition*** — what must be true *before* the action is doable? "Audit-template is available." "Lead's calendar has been audited and 2-hour blocks identified." This often becomes the *outcome* of an earlier step, creating the sequence.
5. **Group action + precondition with an AND junctor** — both are needed to produce the outcome.
6. **Chain outcomes to next-step preconditions.** The outcome of step N becomes (part of) the precondition for step N+1. The TT reads as a directed chain of triples.
7. **Stop when each step is something a named person can do in a named day.**

## Worked example (continued)

From [Chapter 7](07-prerequisite-tree.md): IO `Ticket-type audit complete`. Let's decompose.

`Cmd+K → New diagram → Transition Tree`. Empty TT canvas opens.

Triple 1:

- **Action:** Pull last 6 months of escalated tickets via the helpdesk's API.
- **Precondition:** API token + read-access scoped to escalation tags.
- **Outcome:** A CSV of ~2400 escalated tickets with type tags and resolution times.

Add three entities (Action, Precondition, Outcome — TP Studio's TT palette gives you the slots). Group Action + Precondition as AND. Connect to Outcome.

Triple 2:

- **Action:** Bucket the CSV by type and compute escalation rate per bucket.
- **Precondition:** CSV exported AND a one-page categorization rubric agreed in advance.
- **Outcome:** A ranked list of ticket types by frequency-weighted resolution time.

Note Triple 2's precondition includes Triple 1's outcome ("CSV exported"). Connect Outcome-1 into Precondition-2's AND group.

Triple 3:

- **Action:** Mark the top 20% by impact and circulate to L2 candidates for sanity-check.
- **Precondition:** Ranked list available AND L2 candidates identified.
- **Outcome:** Hardest-20% list signed off by the L2 candidates and the lead.

Triple 4:

- **Action:** Publish the hardest-20% list as a workspace doc.
- **Precondition:** List signed off.
- **Outcome:** **IO achieved.** Hardest-20% list defined.

The TT now reads, top to bottom, as four executable steps, each with a precondition that points back to the prior outcome. A reader looking at it knows exactly what to do on Monday.

🛠 **How TP Studio helps:** The `complete-step` validator (CLR tier `sufficiency`, TT-only) fires on any Action whose outgoing edge to its Outcome lacks a non-action sibling (the precondition role). It nudges you toward the triple structure rather than letting you draw a chain of bare actions.

## Sidebars

> **🛠 How TP Studio helps**
> - `Cmd+K → New Transition Tree`.
> - **`action`** entity type (cyan stripe) — TT-specific.
> - **`complete-step` validator** flags actions without paired preconditions.
> - **AND-junctor grouping** is essential to the triple structure; the gesture is the same as elsewhere (select edges → Group as AND).
> - **Reasoning narrative export** turns the TT into a numbered list ("1. Given X, do Y to obtain Z. 2. Given Z, do…") that pastes into a project doc.

> **💡 Practitioner tips**
> - **Name the actor** in the Action title — "Maria pulls last 6 months of tickets" not "Pull last 6 months of tickets." Anonymous actions don't get done.
> - **Estimate effort in the description.** TT actions vary from "5 minutes" to "2 weeks." A reader needs to know which.
> - **Use Notes for caveats.** The TT is the canonical plan; caveats and contingencies live as Notes beside the chain so the canonical reading stays clean.

> **⚠ Common mistakes**
> - **Skipping preconditions.** A TT without preconditions is just a to-do list. The precondition is what makes the dependency structure visible — and what makes the diagram catch the case where two steps look ready but one is actually blocked.
> - **Triples too coarse.** "Build the rubric" is not a TT triple; it's an IO. The TT decomposes IOs into steps small enough for one person to do in one sitting. "Maria drafts the severity-1 rubric section" is a triple.

> **🛑 When to stop**
> - Every leaf action is sized to fit a person-day or less.
> - Every action has its precondition AND-grouped explicitly.
> - The outcome chain is traceable from the first action to the IO it produces.
> - The reasoning-narrative export reads as a runnable plan.

🔁 **Chain to next:** the TT is the operational plan. The Goal Tree (next chapter) is a *strategic* decomposition — the frame around the entire CRT→TT process when the constraint is the goal itself.

---

→ Continue to [Chapter 9 — Goal Tree](09-goal-tree.md)
