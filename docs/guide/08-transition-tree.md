# Chapter 8 — Transition Tree
### *How do we get there?*

> **🎯 What this process is for**
> A Transition Tree (TT) is the *operational plan*: a sequenced set of (action, precondition, outcome) triples that take you from current state to the IOs identified in the PRT. It answers: "What exactly does Maria do on Tuesday morning?"

## The premise

The PRT names obstacles and pairs IOs. The TT decomposes each IO into the concrete *actions* that achieve it, each action gated on a *precondition*, each producing an *outcome*.

The triple structure (action + precondition → outcome) is the smallest unit of TOC's implementation grammar. It maps cleanly to: "Given X, do Y, expect Z." Project plans and operational runbooks live in this grammar.

The distinction from the PRT is worth making sharp. A PRT answer is a *state*: "Ticket-type audit complete" is an IO — it says what the world must look like, not how you get there. A TT answer is an *action sequence*: "Maria pulls the last 6 months of escalated tickets on Monday morning, given that the API token is provisioned, and produces a CSV of ~2400 records." The PRT tells you where you're going; the TT tells you how to walk.

This also means the TT is the level at which implementation plans become testable. Each outcome is a specific, observable state; if the outcome hasn't been produced, the step isn't done. A TT built with that discipline is self-auditing: at any point during execution you can look at the canvas, check which outcomes are marked true, and know exactly what's complete, what's runnable next, and what's blocked.

One more thing the triple structure guards against: the assumption collapse. Every project plan carries hidden assumptions about what makes a step possible. When those assumptions are buried in someone's head they fail silently — the action gets "done" but the expected outcome doesn't appear, because the precondition was never actually met. Writing the precondition explicitly onto the canvas surfaces those assumptions before they fail.

## The method, neutral of tool

1. **Start from the highest-priority IO** in the PRT (the one with the most downstream dependents, or the one with the longest lead time).
2. **For each IO, write the *outcome*** — what state of the world must exist when the IO is achieved? (Often the IO statement itself, slightly reworded as an outcome.)
3. **Write the *action*** — the verb-phrase describing what someone does. "Audit the last 6 months of escalated tickets." "Schedule a 2-hour rubric-drafting block on the lead's calendar each Tuesday."
4. **Write the *precondition*** — what must be true *before* the action is doable? "Audit-template is available." "Lead's calendar has been audited and 2-hour blocks identified." This often becomes the *outcome* of an earlier step, creating the sequence.
5. **Group action + precondition with an AND junctor** — both are needed to produce the outcome.
6. **Chain outcomes to next-step preconditions.** The outcome of step N becomes (part of) the precondition for step N+1. The TT reads as a directed chain of triples.
7. **Name the actor.** Each action belongs to a specific person. If you can't name one, the step is not yet operational — it's still a plan on paper.
8. **Stop when each step is something a named person can do in a named day.**

The key test for step granularity: can the person doing the step start without asking any questions that aren't already answered by the precondition? If not, the step is still coarse; decompose further until the answer is yes.

## The need → action → expected-effect structure

The structural triple on the canvas (precondition + action → outcome) is the *implementation* layer. Below it sits the classical TT's *reasoning* layer — the internal logic that justifies why this action is the right one. That reasoning runs in the opposite direction: **Need → Action → Expected Effect**.

- The **Need** is the requirement the action is in service of. It links this step to the IO or outcome above it. "We need to know which ticket types are highest-impact so we can scope the training curriculum." Without a need, a step is a habit, not a decision.
- The **Action** itself: what you do.
- The **Expected Effect** — what you expect to be true immediately after the action completes, and why. The expected effect is not the same as the outcome: the outcome is the observable state the step produces; the expected effect is the mechanism. "After pulling and categorizing the CSV, we'll have ranked the ticket types by frequency-weighted resolution time — which means the training-scope decision is data-grounded rather than opinion-based."

This three-part reasoning structure — **Need → Action → Expected Effect** — is where reviewers find the real flaws in a plan. "Is that the right action for this need?" and "does that action reliably produce that expected effect?" are the two questions that catch wrong steps before you build the wrong thing.

In TP Studio, the Need and Working Assumption fields on each Action entity in the Inspector carry this reasoning. The **Working Assumption** is the belief that makes the action sufficient: "a 6-month lookback is long enough to represent the ticket-type distribution." Write it down. If the assumption turns out to be wrong mid-execution, you'll know exactly which step to revisit.

## The worked example

From [Chapter 7](07-prerequisite-tree.md): IO `Ticket-type audit complete`. Let's decompose.

`Cmd+K → New diagram…` → select **Transition Tree**. An empty TT canvas opens.

### Step 1 — Triple 1

The IO gives you the terminal outcome. Work backward from it.

- **Outcome:** A CSV of ~2400 escalated tickets with type tags and resolution times.
- **Action:** Pull last 6 months of escalated tickets via the helpdesk's API.
- **Precondition:** API token + read-access scoped to escalation tags.

Add three entities. Set the Action to type `action` (cyan stripe — use the Inspector Type grid, or `Cmd+K → Mark entity as Action (TT)`). The precondition and outcome entities stay as type `effect`. Group Action + Precondition as AND (`Cmd+K → Group as AND`, or select both edges and right-click → Group as AND). Connect to Outcome.

In the Action's Inspector, add:
- **Need:** Know the shape of escalations so training scope is data-grounded.
- **Working assumption:** 6 months of data is representative of steady-state escalation patterns; seasonal spikes don't distort the type distribution.

### Step 2 — Triple 2

- **Outcome:** A ranked list of ticket types by frequency-weighted resolution time.
- **Action:** Bucket the CSV by type and compute escalation rate per bucket.
- **Precondition:** CSV exported AND a one-page categorization rubric agreed in advance.

Note Triple 2's precondition includes Triple 1's outcome ("CSV exported"). Connect Outcome-1 into Precondition-2's AND group. The tree now has a chain: produce the CSV, then use it.

The second precondition ("categorization rubric agreed") is independent — it's something the team prepares in parallel. Mark it as a separate effect node, AND-grouped with the CSV.

> **💡 Practitioner tip:** When a precondition needs to be produced by a different work stream, make it an independent entity and mark it `effect`. Don't embed it in the action text — that hides the dependency. The explicit node lets you see clearly that two things must converge before this step runs.

### Step 3 — Triple 3

- **Outcome:** Hardest-20% list signed off by the L2 candidates and the lead.
- **Action:** Mark the top 20% by impact and circulate to L2 candidates for sanity-check.
- **Precondition:** Ranked list available AND L2 candidates identified.

Connect Outcome-2 into Precondition-3's AND group. The "L2 candidates identified" node is a separate precondition that may come from a parallel step in another TT decomposing a different IO.

### Step 4 — Triple 4

- **Action:** Publish the hardest-20% list as a workspace doc.
- **Precondition:** List signed off.
- **Outcome:** **IO achieved.** Hardest-20% list defined.

The TT now reads, top to bottom, as four executable steps, each with a precondition that points back to the prior outcome. A reader looking at it knows exactly what to do on Monday.

### Verbalizing

`Cmd+K → Start read-through` opens the walkthrough overlay. For a TT the overlay iterates in topological order. Listen for what sounds awkward: an expected effect that doesn't follow from the action, a precondition that sounds downstream rather than upstream, an outcome that's vaguer than the action that produces it.

For Triple 1: *"In order to obtain 'A CSV of ~2400 escalated tickets with type tags and resolution times', do 'Pull last 6 months of escalated tickets via the helpdesk's API' given 'API token + read-access scoped to escalation tags'."* Sounds right.

For Triple 2: *"…given 'CSV exported AND categorization rubric agreed'."* Pause here. Is the rubric agreed *before* the pull, or *before* the bucketing? It should be before the bucketing. Confirm the structure is correct.

The read-through on a TT is checking two things the structural validator can't: that the precondition is genuinely prior to the action (not a simultaneous concern), and that the outcome is genuinely produced by the action (not just correlated with it).

🛠 **How TP Studio helps:** The `complete-step` validator (CLR tier `sufficiency`, TT-only) fires on any Action whose outgoing edge to its Outcome lacks a non-action sibling (the precondition role). It nudges you toward the triple structure rather than letting you draw a chain of bare actions. The `Cmd+K → Add precondition to Action (TT)` command short-circuits the wiring: select a bare Action, run the command, and TP Studio creates the precondition entity and wires it into the same Outcome automatically.

## The second example — a very different domain

The support-team worked example is a *data-pipeline* TT: a series of analytical steps where each outcome is an artifact. Here's a second example in a different shape: a **people-process** TT for onboarding an engineer to production access.

The IO (from a hypothetical PRT): *New engineer has a merged PR in production.*

Work backward. The terminal outcome is "engineer's PR merged and deployed." What action produces it? A reviewer approves the PR. What precondition must hold? The engineer has submitted a PR that meets quality bar.

Now the next layer back: the engineer can only submit a PR once they have a working local environment and a starter ticket. That's the precondition for the "submit PR" action. And a working local environment requires the laptop provisioned AND the dev environment documented. And so on.

Triple sequence:

- **Triple A:** Given *laptop provisioned*, do *provision dev environment via the setup script*, obtain *environment boots clean with all test suites green*.
- **Triple B:** Given *environment boots clean* AND *starter ticket assigned*, do *engineer implements the starter ticket*, obtain *code review-ready PR submitted*.
- **Triple C:** Given *PR submitted* AND *reviewer identified*, do *reviewer runs checklist + submits feedback*, obtain *PR approved with no blocking comments*.
- **Triple D:** Given *PR approved*, do *engineer merges and monitors deploy*, obtain *IO achieved: first production merge landed*.

Notice how the actor changes at each step. Triples A and B belong to the engineer; Triple C belongs to the reviewer; Triple D is a handoff back to the engineer. A TT that doesn't name actors becomes a responsibility-free checklist. When each action specifies who does it, execution is unambiguous.

The **working assumption** discipline pays off here too. For Triple C, the working assumption is: "One reviewer pass is sufficient for a starter ticket." That's probably true for a small ticket and an experienced reviewer — but if the starter ticket is unusually complex, this assumption fails and the step needs an extra review loop. Writing the assumption down means a reviewer reading the plan can flag it early, rather than discovering it after the engineer has already waited a week.

> **💡 Practitioner tip:** When you have a TT where actors change across steps, number each action with the **Step #** field in the Inspector (1, 2, 3…). The **Task tracker CSV** export (`Cmd+K → Export… → Task tracker CSV`) then walks the actions in Step # order and emits one row each — `step / action / precondition / outcome / owner / due_date / status / success_criteria` — a runnable handoff you can paste straight into Jira, Trello, or a spreadsheet without editing.

## Need and working assumption

The action / precondition / outcome triple is the *structural* unit on the canvas. The classical Transition Tree carries a second layer that lives inside the action itself — the reasoning that justifies it. Besides its Step # ordering, a TT **Action** exposes two optional fields in the Inspector: a **Need** ("why is this step needed?") and a **Working assumption** ("the belief that makes this action sufficient"). Read together with the action, these two fields complete the *Need → Action → Expected Effect* reasoning from earlier in the chapter: the **Need** is why the step exists, and the **Working assumption** is the belief that makes the action sufficient to produce its expected effect. That's the discipline that stops a TT from degrading into an unexamined checklist: every step should be able to say *why* it's there and *what it's betting on*.

Both are free text and both are optional; a fresh step shows neither. Fill them when a step's rationale isn't self-evident — especially the working assumption, which is exactly the place a reviewer will push ("are we sure that's enough?") and exactly the kind of belief worth writing down before the rollout proves it right or wrong.

## Action eligibility

Once your steps carry entity states ([Chapter 3](03-reading-a-diagram.md)), the TT stops being a static plan and starts telling you *what's runnable right now*. Select an action and the Entity Inspector shows an **eligibility readout** that folds the effective states of that action's preconditions:

| Status | Meaning |
| --- | --- |
| **Eligible** (emerald) | Every precondition feeding the action's outcome is `true`. Go. |
| **Blocked** (rose) | At least one precondition is `false`. The readout names the offender so you know exactly what's in the way. |
| **Pending** (amber) | A precondition is `unknown` or `disputed` — the step isn't blocked, but it isn't confirmed ready either. |
| **n/a** | The action has no precondition slot (a bare action with nothing to gate it). |

Only the *true* preconditions count: sibling actions and assumptions feeding the same outcome are ignored, and a precondition that derives `true` from propagation (without a manual state) still makes the step eligible. Combined with what-if speculation (`Cmd+K → Speculate: what changes if…`), this answers the live planning question — "if I flip this upstream outcome to done, which steps unblock?" — without editing the saved plan.

Prefer it on the canvas? **Settings → Display → Show action-eligibility badge** mirrors the readout as an at-a-glance pill on each Action node's right edge — emerald `✓` eligible, rose `✗` blocked, amber `…` pending — so you can scan a whole tree for what's runnable without selecting each step. It's off by default (a state-less tree would read all-pending) and reflects speculation live, just like the inspector readout.

## Sequencing multiple IOs

A PRT typically produces several IOs, not just one. The question of how to sequence them across multiple TTs — or whether to combine them into one — is worth getting explicit.

Each IO gets its own TT when the work streams are independent: different actors, different timelines, no shared preconditions between streams. You draw three TTs for three IOs, and the relationship between them lives at the PRT level (this IO unlocks that one), not inside the TT.

Combine IOs into one TT when they share structure: a common early precondition, the same actor at certain steps, or an outcome of one IO that's a precondition of another's action. The combined TT makes the shared structure visible; the separated TTs would hide it, requiring someone to mentally re-connect what you've deliberately disconnected.

The practical tell: if you find yourself writing the same precondition into the bottom of two separate TTs, combine them and share the node.

## Sidebars

> **🛠 How TP Studio helps**
> - `Cmd+K → New diagram…` → select **Transition Tree** to start fresh.
> - `Cmd+K → Load example…` → select **Transition Tree** to load a worked example with the canonical triple structure. Five TT pattern templates also ship in `Cmd+K → Open Pattern Library…`: Support triage, Engineer onboarding, Incident response, Feature-flag rollout, Enterprise deal close — each demonstrating a different domain shape.
> - **Inspector Type grid** — click `action` (cyan stripe) to mark an entity as an Action. `Cmd+K → Mark entity as Action (TT)` and `Cmd+K → Mark entity as desired Outcome (TT)` are the palette shortcuts.
> - `Cmd+K → Add precondition to Action (TT)` — select a bare Action and run this command to auto-create a precondition entity wired into the same Outcome. Faster than building the triple by hand.
> - **`complete-step` validator** (CLR tier `sufficiency`, TT-only) — flags any Action whose outgoing edge to an Outcome has no non-action sibling (unpaired precondition slot).
> - **AND-junctor grouping** is essential to the triple structure; the gesture is the same as elsewhere (select edges → `Cmd+K → Group as AND`, or right-click → Group as AND).
> - **Action Inspector fields** — **Step #** (ordering), **Need** (why this step exists), **Working assumption** (the belief that makes the action sufficient).
> - **Action-eligibility readout** in the Entity Inspector — eligible / blocked / pending / n/a, folded from precondition states. Mirrors as an at-a-glance ✓ / ✗ / … badge via **Settings → Display → Show action-eligibility badge**.
> - **Speculate: what changes if…** (`Cmd+K → Speculate: what changes if…`) — flip any precondition state to true/false without committing, and watch eligibility cascade live across the whole tree.
> - **Reasoning as narrative export** (`Cmd+K → Export… → Reasoning as narrative (Markdown)`) — turns the TT into a numbered list of triple sentences ("In order to obtain X, do Y given Z.") that pastes into a project doc or ticket.
> - **Start read-through** (`Cmd+K → Start read-through`) — iterates each structural edge in topological order for verbalisation discipline.

> **💡 Practitioner tips**
> - **Name the actor** in the Action title — "Maria pulls last 6 months of tickets" not "Pull last 6 months of tickets." Anonymous actions don't get done.
> - **Estimate effort in the description.** TT actions vary from "5 minutes" to "2 weeks." A reader needs to know which. The description field is the right place — the Action title stays clean.
> - **Use Notes for caveats.** The TT is the canonical plan; caveats and contingencies live as Notes beside the chain so the canonical reading stays clean.
> - **Write the working assumption before you're confident the step is right.** The temptation is to fill it in retrospectively ("oh yes, we assumed X"). Write it while designing the step — that's when it's most likely to surface a wrong assumption before any work is done.
> - **When an upstream IO feeds multiple TTs, mark the shared outcome node's state as `true` as soon as that IO lands.** Eligibility propagates immediately, and everyone working the downstream TTs sees the unblock without a coordination meeting.
> - **Trace backward from the IO to verify the chain.** Once you've built a TT forward (action by action), trace it backward: starting from the IO outcome, ask "what's the last step that produces this?" then "what produces that step's precondition?" The chain should be gapless. Any gap is a missing triple.

> **⚠ Common mistakes**
> - **Skipping preconditions.** A TT without preconditions is just a to-do list. The precondition is what makes the dependency structure visible — and what makes the diagram catch the case where two steps look ready but one is actually blocked. The `complete-step` validator flags these; treat them as errors, not suggestions.
> - **Triples too coarse.** "Build the rubric" is not a TT triple; it's an IO. The TT decomposes IOs into steps small enough for one person to do in one sitting. "Maria drafts the severity-1 section of the rubric (≤ 2 hours)" is a triple.
> - **Mixing IO-level language into TT outcomes.** An IO says "ticket-type audit complete" — a state. A TT outcome should say "a CSV of 2400 rows with type tags and resolution times exists in the shared drive" — specific, observable, checkable by anyone. If your outcome could have come from the PRT verbatim, it's still coarse.
> - **Writing the precondition as a future state.** The precondition is what's true *before* the action, not what the action will produce. "API token provisioned" is a precondition; "API token will be provisioned" is a plan, not a precondition. Tense discipline matters.
> - **Treating the TT as a one-person artifact.** If you built the TT alone and then handed it to the team, expect resistance. A TT built *with* the actors — especially the precondition and working-assumption fields — is a commitment, not an assignment. The build process is part of the alignment.

> **🛑 When to stop**
> - Every leaf action is sized to fit a person-day or less, with a named actor.
> - Every action has its precondition AND-grouped explicitly; the `complete-step` validator shows no open warnings.
> - The outcome chain is traceable from the first action to the IO it produces, with no gaps.
> - Every action has a Working assumption (or you've decided the rationale is genuinely self-evident for that step).
> - The reasoning-narrative export reads as a runnable plan that a new team member could execute without additional briefing.
> - You've run what-if speculation to confirm that completing each IO's terminal outcome correctly unblocks the next IO's first step.

🔁 **Chain to next:** the TT is the operational plan. The Goal Tree (next chapter) is a *strategic* decomposition — the frame around the entire CRT→TT process when the constraint is the goal itself.

---

→ Continue to [Chapter 9 — Goal Tree](09-goal-tree.md)
