# Chapter 7 — Prerequisite Tree
### *What's in our way?*

> **🎯 What this process is for**
> A Prerequisite Tree (PRT) surfaces the obstacles between *where you are* and *where the FRT says you want to be*, then pairs each obstacle with an *Intermediate Objective* (IO) — a state that, if achieved, dissolves the obstacle. It answers: "What has to be true *first* for the injections to land?"

## The premise

You've diagnosed (CRT), named the conflict (EC), designed the solution (FRT). Now you have to *execute*, and execution runs into obstacles: things you don't have, capabilities you can't yet exercise, dependencies that aren't ready. The PRT makes those obstacles explicit and pairs each with the IO that resolves it.

Goldratt's framing: every injection has a precondition tree underneath it. The PRT *is* that precondition tree, sequenced and obstacle-aware. What distinguishes the PRT from a plain task list is the obstacle. Without naming what's in the way, you're just writing a wishlist. The obstacle is the *reason* the IO is necessary — it converts a wish into a justified step.

This matters more than it sounds. When a real rollout stalls, it almost never stalls because somebody forgot to schedule the work. It stalls because an obstacle that was never named is quietly blocking progress — no budget approved, no second person trained, no agreement from a VP who hasn't been asked yet. The PRT's job is to drag every one of those silent blockers into the open *before* the effort starts, not after.

There is also a structural difference between the PRT and the trees that precede it. The CRT and FRT use sufficiency logic — "A causes B" means A is (at least part of) what's sufficient to produce B. The PRT uses necessity logic — "In order to achieve X, Y must hold." Both read upward toward a goal, but the interpretive frame is opposite. The CRT asks "why does this happen?" The PRT asks "what must be true first?" Keeping that distinction sharp prevents you from accidentally running a sufficiency analysis inside a necessity diagram. If you find yourself writing "because we did X, we now have Y" rather than "in order to have Y, we need X," you've drifted into FRT territory and the PRT isn't the right vehicle.

One more nuance on layout. The PRT shares the same vertical shape as a CRT: the apex sits at the top and the leaves settle at the bottom. Here the apex is the injection (or ambitious goal), and the leaf IOs are the earliest prerequisites — the ones you achieve first. TP Studio's Dagre layout strategy places the injection at the top and the independent leaf IOs at the bottom automatically. But the *sequence* builds bottom-up: you start at the leaves and work upward, each IO unlocking the one above it until the injection becomes reachable. Don't mistake the apex-at-top shape for top-down execution — the bottom of a PRT is where the work begins.

## The method, neutral of tool

1. **Start with the injection.** Place it at the top of the canvas — apex at top, leaf prerequisites at the bottom, the same vertical shape as a CRT.
2. **Below the injection, brainstorm obstacles.** For each, ask: "What is currently stopping us from achieving the injection directly?" The obstacle should describe a real *absence* or *barrier*, not a task. "We don't have a triage rubric document" is an obstacle. "Write a triage rubric" is the IO. Keep them distinct.
3. **For each obstacle, pair an IO.** "Two L2 agents reassigned with 40% capacity for training over 8 weeks." The IO is the *state* you need to reach, not the action you take to get there. "Draft circulated and signed off" is an IO. "Schedule the review meeting" is a sub-IO. If the IO is still too large to act on, descend: what obstacle blocks *the IO itself*?
4. **Necessity edges, not sufficiency.** The PRT edge reads: "In order to achieve [upper entity], [lower entity] must hold." TP Studio's default edge type for PRT diagrams is `necessity` — the verbaliser will auto-render it as "In order to obtain…" wording when the read-through overlay is active.
5. **Sequence the IOs.** Some IOs depend on others. Draw dependency edges between IOs: an arrow from IO-A to IO-B means "achieve A before B." A chain emerges from the bottom (independent IOs) upward to the injection. This sequencing is what turns the PRT from a flat list into an implementation plan with a critical path.
6. **Triage span-of-control.** For each IO, ask: is this in your `control` (you can do it unilaterally), `influence` (you need somebody else's cooperation), or `external` (it depends on a party you can't directly influence)? Mark each entity accordingly. The `external` ones need escalation plans — they won't self-resolve.
7. **Stop when the leaves are actionable.** If a leaf IO still has its own obstacle that requires a sub-IO, keep descending. The tree is done when every leaf is something you can genuinely start next week.

## The worked example

We continue from [Chapter 6](06-future-reality-tree.md). The FRT verified that the primary injection — **Train 2 L2 agents on the hardest 20% of ticket types** — is sufficient to produce the desired effects without spawning unacceptable negative branches. Now we need to get there.

`Cmd+K → New diagram…` → Prerequisite Tree. Empty PRT canvas opens. Add the injection at the top as an `Injection` entity.

### Step 1 — Brainstorm obstacles

Below the injection, brainstorm everything that is currently stopping you from performing that training tomorrow:

- *Obstacle:* We don't have a list of "the hardest 20% of ticket types" — nobody's audited the queue.
- *Obstacle:* Both candidate L2 agents have full queues already; there is no slack to take training.
- *Obstacle:* No training curriculum exists.
- *Obstacle:* No budget has been allocated for the contractor backfill needed to create queue slack (this was FRT injection I2).

Add each as an `obstacle` entity via the Inspector's Type grid. TP Studio gives them a rose stripe — the visual contrast from the injection's syringe icon tells you at a glance "this is the barrier layer, not the goal layer."

### Step 2 — Pair each obstacle with an IO

For each obstacle, write the IO that dissolves it. Keep the IO as a *state to be achieved*, not an action:

- *IO:* Ticket-type audit complete; "hardest 20%" defined by escalation count + resolution time. (`intermediateObjective` type, blue stripe.)
- *IO:* L2 capacity freed by re-routing approximately 40% of their existing tickets to L1 with escalation rules in place.
- *IO:* Curriculum drafted and reviewed: four modules of two hours each, approved by the support lead.
- *IO:* Budget request approved by Finance for eight weeks of contractor backfill.

Connect each IO to its obstacle (IO → obstacle), and each obstacle to the injection (obstacle → injection). The canvas now shows a wide, flat structure: four IO–obstacle pairs feeding the injection.

🛠 **How TP Studio helps:** Select any `obstacle` entity and run `Cmd+K → Add Intermediate Objective for this Obstacle (PRT)`. TP Studio mints a new `intermediateObjective` entity, opens its title for editing, and connects it to the selected obstacle automatically. You can also use `Cmd+K → Mark entity as Obstacle (PRT)` and `Cmd+K → Mark entity as Intermediate Objective (PRT)` to retype entities you've already written as plain effects.

### Step 3 — Add dependency edges

Some IOs depend on others and must be sequenced:

- "L2 capacity freed by re-routing" depends on "Ticket-type audit complete" — you need to know what the hardest 20% looks like before you can decide which tickets to re-route to L1.
- "Curriculum drafted and reviewed" also depends on the ticket-type audit — the curriculum must be calibrated to the actual hard cases, not a guess about them.

Add those edges: IO → IO, the same necessity direction. The PRT now reads: audit first, then in parallel the capacity-freeing and the curriculum, and only once both of those hold can the training actually run.

The "Budget approved" IO has no dependency on the others — Finance doesn't need the audit before they can approve the headcount. So that leaf sits at the same level as the audit, and both can start immediately.

The tree has just surfaced the critical path: audit → (capacity + curriculum in parallel) → injection. Anyone who wants to know "what do we do first?" can read the answer directly off the dependency edges.

### Step 4 — Set span-of-control

Click each IO and set span-of-control in the Inspector:

- Ticket-type audit: `control` — the support lead can run this without asking anyone.
- L2 re-routing: `influence` — requires agreement from the two L2 agents and probably their manager.
- Curriculum drafting: `control`.
- Budget approval: `influence` — requires Finance; this is the IO most likely to become a blocker if nobody starts the conversation early.

The `influence` IOs are the ones to watch. Each one names somebody outside your immediate team who needs to say yes. In a real rollout, the budget IO is the one that kills momentum at week three because nobody filed the request at week one.

> **🛑 When to stop**
> - Every leaf IO is something you can start next week (or whatever short timescale matters for your context).
> - Every IO is paired with a named obstacle it resolves.
> - Sequencing dependencies are explicit edges, not implicit.
> - Span-of-control is set on each IO so the rollout owner knows what's `control` vs. `influence`.
> - You can read the tree top-down aloud, edge by edge, and each "In order to obtain…, we must…" sentence sounds like a real constraint, not a bureaucratic formality.

## Exporting an ordered plan

A PRT carries no explicit step numbers. Its order lives entirely in the dependency edges — the IO another IO depends on *is* the earlier step, even though nothing on the canvas says "1, 2, 3." That's correct for thinking, but it's awkward to hand to someone who just wants the to-do list.

`Export… → Prerequisite plan (CSV)` does the translation: it topologically sorts the tree so that every IO appears prerequisite-first (an IO that others depend on comes before them) and writes one row per Intermediate Objective — `step / objective / overcomes / depends_on / owner / due_date / status / notes`.

That row shape is deliberately spreadsheet- and tracker-shaped: paste it straight into Jira, Trello, or a sheet and you have a backlog ordered the way the analysis says it must be done, with each item still tied to the obstacle that justifies it. The `overcomes` column is what makes it different from any other task export — it answers the question "why is this step here?" without requiring the reader to open the original diagram.

The export appears only on a document that has at least one `intermediateObjective` entity. Ownership and due-date columns are populated from the entity's `owner` field and `dueDate` attribute respectively; the `status` column shows `done` when you've toggled `implemented` on the entity (matching the TT task export convention). This means a PRT can pull double duty as a living tracker — mark IOs done in TP Studio and re-export to refresh the sheet.

## A second worked example — product launch gate

The SaaS-support scenario above is a single-injection PRT with one clear critical path. Not every PRT is that tidy. Here is a different shape: a pre-launch PRT with a cross-functional critical path where several `external` IOs require escalation.

**Scenario:** your team has designed a pricing experiment (FRT injection): ship a segment-specific pricing tier to mid-market accounts. The FRT validated the injection. Now the PRT asks: what's in the way?

Obstacles that surface in a brainstorm with engineering, legal, and marketing:

- Legal hasn't approved the new pricing language for the product surface.
- The billing service doesn't support per-segment price codes.
- The A/B framework can't target by account segment without a feature flag rework.
- Marketing hasn't built the in-app announcement copy or the email sequence.
- Finance requires a formal pricing-authority memo before any tier change ships.

Pair each with an IO:

- *IO:* Legal review complete; pricing language approved and embedded in the UI copy.
- *IO:* Billing service supports per-segment price codes (new column in the price table + API).
- *IO:* Feature-flag service extended to support account-segment targeting.
- *IO:* In-app and email copy complete, reviewed by brand, staged in the CMS.
- *IO:* Pricing-authority memo signed by CFO and VP Product.

Dependency sequencing: the A/B framework change and the billing change can start in parallel, independent of each other. Legal review and marketing copy can also start immediately. But the pricing-authority memo is a dependency of *all of them* — Finance won't sign until both legal and billing confirm capability. So the memo is not a leaf; it depends on legal and billing finishing first.

When you draw those edges, the critical path emerges: billing + legal → memo → (A/B + marketing + pricing UI) → launch. The longest chain runs through the legal review (two weeks) and then through Finance (one week sign-off window). That is where a project manager should focus first — not on the marketing copy, which is internal and fast.

Mark the CFO sign-off IO as `external`. Mark the legal review as `external` (it depends on outside counsel). Mark the A/B framework change as `control`. Now the `influence` and `external` IOs are flagged on the canvas at a glance — exactly the ones that need conversations started this week.

> **💡 Practitioner tip:** the `external` IOs are almost always the ones that blow up the schedule, because people underestimate how long it takes to get a decision out of someone outside the team. Surface them early, escalate early, and in the PRT make them explicit dependencies of the IOs that need them. Then the project manager can see the critical path without asking.

## Sidebars

> **🛠 How TP Studio helps**
> - `Cmd+K → New diagram…` → Prerequisite Tree to start fresh.
> - `Cmd+K → Load example…` → Prerequisite Tree for a reference doc (product-launch PRT) to study before drawing your own.
> - **`obstacle`** entity type (rose stripe, Mountain icon) and **`intermediateObjective`** type (blue stripe, Milestone icon) — PRT-specific entities in the Inspector Type grid.
> - **`Cmd+K → Mark entity as Obstacle (PRT)`** and **`Cmd+K → Mark entity as Intermediate Objective (PRT)`** — type-flip the selected entity without opening the Inspector.
> - **`Cmd+K → Add Intermediate Objective for this Obstacle (PRT)`** — from a selected `obstacle`, mints a paired `intermediateObjective` entity, opens it for editing, and wires the IO → obstacle edge automatically.
> - **Necessity edges by default** for PRT diagrams — the read-through verbaliser renders "In order to obtain…, …must hold." wording automatically (PRT and EC share the `in order to` causality mode).
> - **Dagre layout (apex at top)** — PRT auto-lays out with the injection at the apex and IOs descending to the leaf prerequisites. Run layout again after adding new entities to keep the canvas readable.
> - **Span-of-control** flags (`control` / `influence` / `external`) in the Inspector — mark each IO and obstacle so the rollout owner can triage at a glance.
> - **`Start read-through`** (`Cmd+K → Start read-through`) — steps through every edge in topological order, rendering each as "In order to obtain [IO], [obstacle] must be overcome." Discipline for verifying the tree before handing it off.
> - **`Export… → Prerequisite plan (CSV)`** — topologically sorts the IOs prerequisite-first into a `step / objective / overcomes / depends_on / owner / due_date / status / notes` row, ready to paste into Jira, Trello, or a spreadsheet. Appears only when the document has `intermediateObjective` entities; the `status` column reflects the entity's `implemented` toggle.
> - **Pattern library…** (`Cmd+K → Pattern library…`) — five curated PRT starters: *Prerequisite Tree starter*, *Database migration*, *New-market entry*, *Performance-review rollout*, and *Zero-defect manufacturing*. Load one as a reference shape before drawing your own.

> **💡 Practitioner tips**
> - **Pair every obstacle with an IO.** An obstacle without an IO is a complaint. The IO turns "we can't" into "we will, once X." When you're tempted to leave an obstacle un-paired because it "goes without saying," write the IO anyway — the act of writing it often surfaces a dependency you hadn't noticed.
> - **Surface the boring IOs.** "Get budget approved." "Schedule training time on calendars." "Get VP to sign the authority memo." These are the things that derail real rollouts. They belong in the PRT. The tendency is to focus the tree on the meaty technical work and skip the organizational prerequisites. Don't. The boring IOs are often on the critical path.
> - **The IO is a state, not an action.** "Send the curriculum draft to the lead" is an action. "Lead has reviewed and approved the curriculum draft" is an IO. The state framing matters because it defines a clear done-criterion — you can't argue about whether the action "counted"; either the state is true or it isn't.
> - **Descend until leaves are startable.** If an IO still feels too large — "we need executive buy-in" — sub-decompose it into what that specifically means: what does the executive need to know, agree to, or approve, and what must be true first before you can ask? Each sub-element becomes its own obstacle–IO pair. A well-decomposed PRT has leaves that a single person can start on Monday without a meeting.
> - **Use Notes for context.** When an IO has nuance ("this requires Finance approval and we have a window before the next QBR — missing that window costs six weeks"), capture it in the IO's description or as a `note` entity nearby. The note is non-causal and won't affect the CLR checks, but it preserves the timing context that would otherwise live only in someone's head.
> - **Read the critical path before handing off.** After layout, scan the longest chain from leaf to injection. That chain is what constrains the timeline, no matter how many parallel tracks exist. Communicating the critical path explicitly prevents the team from optimizing the fast parallel tracks while the slow critical one drifts.

> **⚠ Common mistakes**
> - **Skipping the obstacle and going straight to IOs.** Without the obstacle, the IO floats — it's not clear *why* it's necessary. The pairing is the point: the obstacle is the reason for the IO, and the reason is what prevents the IO from being dismissed as gold-plating.
> - **Writing IOs as actions rather than states.** "Train two L2 agents" is an action. "Two L2 agents certified on the hardest 20% of ticket types" is a state. States give you a binary done-criterion. Actions leave room for the "we started it, does that count?" conversation.
> - **Bottoming out at "we need executive buy-in."** That's a meta-IO. Sub-decompose it: what specifically does the executive need to know, agree to, or approve? Each is a sub-IO. An undiscovered sub-IO here is often the one that blows the schedule at week six.
> - **Omitting the `external` IOs.** The natural tendency is to only draw what's inside your team's control. But the `external` obstacles are the most dangerous ones — they don't self-resolve, they don't show up in sprint planning, and nobody escalates them until the day before the deadline. Naming them in the PRT is what forces the conversation early.
> - **Drawing the PRT before the FRT is stable.** The PRT derives its injection from the FRT. If the FRT still has open negative branches or unchecked desired effects, the injection it hands you may change — and with it, the obstacles change. Stabilize the FRT first, then draw the PRT. Doing it the other way around creates rework you'll blame on "the analysis process" when the real culprit was sequencing.
> - **Conflating obstacle and IO.** The obstacle is what is currently preventing you. The IO is the state you need to reach. If they look the same, one of them is wrong. "No training curriculum" is an obstacle. "Training curriculum drafted and approved" is the IO. They are inverses: the obstacle describes the absence; the IO describes the presence. When you can't tell them apart, re-read aloud: "We don't have X" is an obstacle; "We have X" is the IO.

🔁 **Chain to next:** the PRT shows *what's in the way*. The TT shows *the concrete actions that dismantle each obstacle, in order*, with explicit preconditions and expected outcomes at each step.

---

→ Continue to [Chapter 8 — Transition Tree](08-transition-tree.md)
