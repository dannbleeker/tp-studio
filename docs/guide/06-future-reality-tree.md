# Chapter 6 — Future Reality Tree
### *What would it look like solved?*

> **🎯 What this process is for**
> A Future Reality Tree (FRT) tests whether your proposed injections actually solve the problem. It answers: "If I make these changes, what will the system produce instead?" The same causal model as a CRT, but starting from injections instead of root causes and reaching upward to *desired effects* instead of undesirable ones. The point is *prediction*: if the FRT is logically sound, the injections will work; if it isn't, they won't.

## The premise

A CRT diagnoses. An EC names the conflict and cracks it. An FRT designs the solution and tests it. Each is a deliberate step; skipping straight from EC to "let's implement the injection" loses the discipline of *checking your work before the rollout*.

The check matters for three distinct reasons.

**First: injections have second-order effects.** The thing you do to fix UDE-1 might cause UDE-7. In complex systems — and any system with more than a handful of people qualifies — the side-effects of an intervention often outweigh the intended effect. Goldratt called the unanticipated downstream UDE the **Negative Branch**, and the FRT is structured to make Negative Branches visible before the rollout, not after. The NB search is not a risk-management add-on; it is the core value proposition of the diagram.

**Second: prediction and hope are not the same thing.** A project plan expresses *intent* — "we will do X, then Y, then Z." An FRT expresses *causal claims* — "because X, Y will follow; because Y, Z will follow." The difference is that causal claims are falsifiable. You can disagree with a cause-effect arrow in an FRT; you cannot disagree with an action item in a Gantt. Drawing an FRT forces the team to surface the assumptions behind the chain, agree on which ones are solid, and name the ones they're betting on. That naming process is where most of the value lives.

**Third: FRTs reveal reinforcing loops.** A good injection doesn't just eliminate the current UDEs — it sets off a positive feedback cycle. The triage rubric the lead finally writes doesn't just reduce resolution time; it lets junior agents handle tickets they couldn't handle before, which reduces escalations, which frees senior time, which accelerates the next improvement. Drawing the loop makes the compounding explicit. It also makes the *turning point* explicit — the moment when the investment starts paying back faster than it's being spent, and the team stops feeling like it's swimming upstream.

The FRT is the only Thinking Process diagram that lets you read a plausible future as a logical argument. That's its power, and the discipline it demands: every edge is a bet, and you should know exactly what you're betting.

## The method, neutral of tool

1. **Start with the injections you drafted in the EC**, marked as `Injection` type. They are the bottom of the FRT — the things you will *do* or *introduce*. If you have multiple injections from the EC's InjectionWorkbench, bring them all; their independence (or interdependence) will become visible in the tree.
2. **Above each injection, list the immediate desired effects you expect.** "The team has protected drafting time." "The triage rubric exists." "Senior agents stop context-switching." Mark each as `Desired Effect`. Keep them to one concrete, observable thing per entity — not "everything improves" but "resolution time drops below 4h."
3. **Connect upward — sufficient causality, same grammar as the CRT.** "Because of injection X, desired effect Y." Verbalize each edge as you add it. If the sentence sounds weak — "because X, Y might happen, kind of" — the edge needs an AND companion or the claim needs tightening.
4. **Build the full chain to the elimination of each original UDE.** The FRT is correct when every CRT UDE has a path *down* to one or more of your injections. If a UDE is left dangling — no injection reaches it — either you need another injection or you misidentified the UDE's root cause in the CRT.
5. **Hunt for Negative Branches.** For each major desired effect, ask: "What new, bad thing might this *also* cause?" Don't just think about it — write each one down as a UDE entity and draw the branch. The act of drawing forces precision. "Training takes time" is a vague worry; "Queue load on existing seniors spikes by 30% during L2 training — SLA breaches increase" is a Negative Branch you can actually address.
6. **Trim each Negative Branch.** For every negative-branch UDE, draft a *trimming injection* whose whole job is to break the causal chain before the bad effect follows. The trimming injection is wired to the UDE with a negative-polarity edge: "because this injection is in place, the bad effect does *not* follow." Name it concretely — not "mitigate the training impact" but "hire one temp contractor for 8 weeks to cover queue during training."
7. **Flag Positive Reinforcing Loops.** When a desired effect causes something that causes the original desired effect more strongly, you've found a virtuous cycle. Tag the loop-closing edge as a back-edge in the Edge Inspector. Loops don't invalidate the diagram — they enrich it. They also raise a question you should answer explicitly: *when* does the loop become self-sustaining? That threshold is usually the first milestone worth measuring in the rollout.
8. **Verbalize the FRT** the same way you verbalized the CRT. Step through every edge with `Cmd+K → Start read-through`. If a chain reads as a plausible future — not as a wish-list — the FRT is ready. If a chain reads like hope dressed as prediction, find the assumption that's doing the load-bearing work and mark it explicitly on the edge.

## The worked example

We continue from [Chapter 5](05-evaporating-cloud.md). The EC identified the breakable assumption and produced one primary injection: **Train 2 L2 agents on the hardest 20% of ticket types**.

### Step 1 — Open the FRT and bring the injection across

`Cmd+K → New diagram… → Future Reality Tree`. Empty FRT canvas opens.

You could create the injection by double-clicking and typing. But if you're working in the same session where the EC is open in an adjacent tab, there's a faster path: select the injection entity in the EC, then `Cmd+K → Carry this into a new FRT…`. TP Studio creates a new FRT document with the injection already placed and linked back to its EC source.

Mark or confirm its type as `Injection` via the Inspector. The stripe turns emerald.

### Step 2 — First-order desired effects

Ask: *if this injection lands, what will be true immediately — before any downstream chain fires?*

Three things follow directly:

- **Lead's queue load drops ~30%.** The L2s now handle a tranche of tickets that previously escalated to the lead.
- **Lead has 2 days/week of protected drafting time.** This is the direct expression of the cloud's dissolution: the conflict between queue responsiveness and drafting time no longer forces a choice.
- **L2 agents have a clearer career-development path.** Bonus desired effect — worth noting even if it wasn't in the original UDE list. The FRT often reveals value you weren't explicitly chasing.

Add each as a `Desired Effect` entity (indigo stripe). Connect each upward from the injection.

### Step 3 — Build the causal chain to UDE elimination

Now build upward, asking "and what does that cause?" at each layer.

The first chain:
- Because lead has protected drafting time → **triage rubric exists** → resolution time drops below 4h on average → **SLA met on >90% of tickets** → customer SLA expectations are met → **customers stop churning at renewal**.

The second chain:
- Because lead has protected drafting time → **consolidated answer base exists** → agents stop redoing prior work for common questions → **cost per ticket drops**.

The third chain:
- Because triage rubric exists AND agents have consistent guidance → **customers get consistent answers** → **NPS trend reverses**.

You now have three of the original CRT's UDEs addressed by traceable chains back to the single injection. Read each chain aloud. *"Because the lead has protected drafting time, a triage rubric exists. Because a triage rubric exists, resolution time drops below 4h. Because resolution time drops below 4h, SLA is met. Because SLA is met, customers stop churning."* Sounds right.

Notice that two chains share the "lead has protected drafting time" node. That convergence is structural good news: a single intervention is doing double duty. But it's also a fragility to mark: if the drafting time gets eroded — by a hiring spike, a product launch, any unexpected inbound surge — both chains fail simultaneously. The FRT makes that dependency legible.

### Step 4 — Hunt for Negative Branches

Now slow down. Walk through each major desired effect and ask: "What else might this cause? What could go wrong?"

**From "Lead has protected drafting time":**
- While the lead is off the queue, queue load on existing senior agents increases. If the L2 training hasn't fully landed yet, seniors handle both their normal escalations *and* the gap the lead left. UDE: **"Queue load on existing seniors spikes during the transition period."**

**From "L2 agents now handle hard tickets":**
- If the training program was rushed or shallow, L2 agents will misclassify some hard tickets and give customers incorrect answers. The pattern "every agent gives a different answer" — which the triage rubric was meant to fix — resurfaces, but now at L2. UDE: **"L2-resolved tickets are lower quality than L3-resolved ones — customer trust erodes."**

**From "consolidated answer base exists":**
- If the answer base is built by the lead in isolation and not validated with the broader team, agents will distrust it, stop using it, and fall back to tribal knowledge. UDE: **"Answer base is not adopted — agents revert to ad-hoc answers."**

Add all three as `Undesirable Effect` entities. Draw the branch from the relevant desired effect down to each UDE. The canvas now looks less clean — it should. A clean FRT is usually an incomplete one.

### Step 5 — Trim the Negative Branches

For each NB, draft a trimming injection.

**NB1 (queue spike):** Select the UDE. `Cmd+K → Trim this branch (add a trimming injection)`. TP Studio mints a trimming injection wired to the UDE with a negative edge. Name it: **"Engage one temp contractor for 8 weeks to cover L3 queue during L2 ramp."** This injection negatively causes the queue spike — it doesn't prevent the NB from starting, but it breaks the causal chain so the bad effect doesn't follow.

**NB2 (quality drop):** Trim. Name: **"Run a 2-week L2/L3 shadowing program before L2s handle hard tickets solo."** This injects a quality gate between the training injection and the solo-handling capability.

**NB3 (answer-base adoption):** Trim. Name: **"Co-author the answer base in 4 team workshops — agents contribute and own the content."** Ownership, not mandate, is the mechanism. When agents helped build it, they use it.

Three trimming injections, each named to say *what* breaks the branch, not just "mitigate the risk."

### Step 6 — Check for Positive Reinforcing Loops

Look for the virtuous cycle that your injections might set off.

Here's one: the triage rubric and consolidated answer base together reduce escalation volume. Reduced escalations mean the lead's queue load stays low even as the business grows. A lower ongoing queue load means the lead can *keep* taking drafting time — not just for the initial build, but for continuous improvement. That continuous improvement produces more structure, which reduces escalations further.

The loop closes: "Lead has protected drafting time" causes "consolidated answer base improves over time" causes "escalation volume stays manageable" causes "lead keeps having protected drafting time."

Add an edge from the "escalation volume stays manageable" effect back up to "Lead has protected drafting time." Select this loop-closing edge and turn on the **Back-edge toggle** in the Edge Inspector. The edge renders differently — a curved back-arc — marking it as the loop-closing move. Tag the group containing the loop with the **Positive Reinforcing Loop** group preset (emerald).

### Step 7 — Verbalize and stop

`Cmd+K → Start read-through`. Walk every edge.

The FRT is done when:

- Every CRT UDE traces down to at least one injection.
- Each injection has at least one desired effect above it.
- You've genuinely looked for Negative Branches at each major desired effect — not just gestured at the question.
- Each NB has either a trimming injection that suppresses it, or an explicit "we accept this risk" note on the entity.
- Any reinforcing loops are tagged with back-edges.
- The read-through sounds like a plausible future, not a marketing document.

You now have 4 injections (one primary, three trimming), 5+ desired effects, 3 negative-branch UDEs each trimmed, one reinforcing loop, and a clean path from the injections to the elimination of the original 3 CRT UDEs.

## A second worked example — a simpler case

Not every FRT is this layered. Consider a lighter problem: a product team whose sprint velocity keeps undershooting. The EC uncovered a single injection: **Cap WIP at 3 items per developer per sprint, enforced on the board**.

The FRT for this is sparser. One injection directly causes:

- **Stage queues drain to 1-2 items per sprint.**
- **Engineers finish tickets before pulling new ones** — the "start to finish" shift that WIP-cap produces.

Both flow upward to:

- **Hand-off friction becomes visible at the cap line** — because the queue is thin enough that blockers surface while there's still time to act.

Which causes:

- **Per-ticket lead-time variance narrows.**

Which causes:

- **Lead time drops below two weeks at p95.** (Desired effect, measurable, the one the team actually cares about.)

The NB hunt: with a WIP cap, what could go wrong? If the cap is set too aggressively, developers idle while waiting for review. NB: **"Developers block on review wait — perceived productivity drops."** Trim it: **"Add a daily async review slot (15 min) as a forcing function."**

That's a 6-entity FRT with one trimming injection. It's not shallow — it's *appropriately sized for the problem*. The depth bar for an FRT isn't the number of nodes; it's whether you've traced the causal chain honestly and looked for what could go wrong.

---

## Trimming a negative branch

Finding a negative branch is only half the move. Once you've drawn the unintended UDE that your injection would also cause, the corrective answer in Goldratt's grammar is to *trim* it — to add a second injection whose whole job is to break the link so the bad effect won't follow.

TP Studio makes that a single gesture. Select the undesirable effect at the tip of the branch and run **"Trim this branch (add a trimming injection)"** from the palette. It mints a trimming injection wired to that effect with a negative-polarity edge — the formal "inject this, and the bad effect doesn't follow" construction, rendered so the polarity is unmistakable. It's one undoable step, so trimming costs you nothing to try.

All that's left is to name the new injection to say *what* breaks the branch — the contractor backfill, the shadowing programme, the co-authoring workshops — turning a spotted risk into a concrete countermeasure on the canvas.

A trimmed FRT is a *realistic* FRT. An untrimmed one is a plan drawn by someone who's never had a plan fail.

## Prediction vs. hope — the central discipline

The distinction between prediction and hope deserves a full paragraph because it's where most FRTs go wrong.

A *hope* statement looks like a cause-effect claim but isn't: "Because we train L2 agents, customer satisfaction will improve." There's a causal structure implied, but the mechanism is missing. *How* does training lead to satisfaction? Via what intermediate steps? Under what conditions?

A *prediction* statement makes those intermediate steps explicit and therefore checkable: "Because L2 agents are trained on the hard 20% of ticket types, they handle those tickets without escalation. Because escalations to the lead drop, lead time on hard tickets falls below the SLA threshold. Because SLA is met, the specific customers who were churning due to SLA misses stay at renewal."

The difference isn't semantic. The prediction exposes three assumptions you can evaluate right now: (1) training will actually produce competency on the hard tickets, (2) the SLA threshold is the actual churn driver (and not, say, price), (3) the customers at risk are the SLA-sensitive ones specifically. Each is falsifiable. If any one is wrong, the chain breaks at that link, and you can fix the FRT — and the rollout plan — before you've deployed anything.

The practical test: can someone disagree with a specific edge in your FRT? If every edge feels self-evidently true and no one pushes back, you're drawing hope. Good FRT edges make people say "wait, does that actually follow?" — and that conversation is the value.

## FRT scope and the "desired future state" question

One thing practitioners find uncomfortable about the FRT: *how far forward do you draw?* The CRT had a natural stopping point (root cause reached). The EC had a natural stopping point (injection drafted). The FRT, in principle, could go on forever — every desired effect causes more desired effects.

The practical answer is this: **draw to the elimination of your CRT's UDEs, plus one more layer.** That extra layer serves two purposes. First, it confirms the desired effects are actually desirable in their downstream consequences — sometimes an intermediate effect that sounds good causes a problem one step further up. Second, it usually reveals the reinforcing loop, which is worth drawing.

Beyond that, stop. The FRT is a *design tool*, not a utopian scenario exercise. When the tool starts generating "and then everything will be wonderful forever," it has stopped being causally disciplined and started being motivational. Motivational is fine for a vision deck; it's not useful for checking your work.

The Document Inspector's "System Scope" section lets you write a short statement of what the desired future state *is*. Do that before drawing. A one-sentence scope — "Support team meets SLA on 90%+ of tickets, at current headcount, within 6 months" — gives you a terminus. When the FRT reaches the entities that express that scope, it's done.

## Sidebars

> **🛠 How TP Studio helps**
> - `Cmd+K → New diagram… → Future Reality Tree` to start fresh; `Load example…` for a reference FRT.
> - `Cmd+K → Carry this into a new FRT…` — from a selected injection in an EC, spawns a new FRT with the injection pre-placed and cross-linked.
> - **Group presets**: Negative Branch (rose), Positive Reinforcing Loop (emerald), Archive (slate, collapsed) — Group Inspector → Preset. Catalog in `src/domain/groupPresets.ts`.
> - **Back-edge toggle** in the Edge Inspector — marks the loop-closing edge of a reinforcing cycle. The edge renders as a back-arc so the loop is visually unmistakable.
> - **Edge polarity** — `Cmd+K → Cycle edge polarity` or the Edge Inspector's polarity picker. A negative-polarity edge means "this injection *prevents* the effect" — essential for trimming injections. A polarity badge on each edge makes suppression relationships visible at a glance.
> - **`Trim this branch (add a trimming injection)`** — select the UDE at a negative branch's tip; mints a trimming injection wired to it with a negative edge, in one undoable step.
> - **`Start Negative Branch from selected entity`** — palette command (also right-click context menu); creates a rose-coloured Negative Branch group rooted at the selected entity. Use it to keep NB sub-trees visually separated within the FRT.
> - **Injection Flower** — select an injection entity, then `Cmd+K → View the injection flower (desired effects · negative branch · plan)`. The flower dialog shows all three cross-doc petals (FRT / NBR / PRT) linked to this injection, surfacing gaps: an injection whose "negative branch" petal is empty hasn't been vetted for risks.
> - **`Speculate: what changes if… (what-if overlay)`** — `Cmd+K → Speculate: what changes if…` lets you set a hypothetical state on any entity and see the downstream cascade propagated across the FRT without committing the change. Useful for "what if the L2 training doesn't land — which desired effects collapse?"
> - **`Start read-through`** / **`Read entire diagram at once`** — two verbalisation modes for the FRT. Read-through steps edge by edge (the discipline pass); read-all-at-once generates the full causal narrative in one view (useful for sharing with a stakeholder who wants the logic in one scroll).
> - **Annotation numbers** (Settings → Display → "Show annotation numbers") — assigns a `#N` badge to each entity. With numbers on, you can reference "injection I1" in a rollout plan and link back to the entity it describes. The annotation badge is also how cross-document entity references (`#42`) resolve.
> - **CLR walkthrough**: `Cmd+K → Start CLR walkthrough` — fires the relevant validators (sufficiency, clarity, predicted-effect existence). The `predicted-effect existence` check is the one that fires most often in FRTs: "does this predicted intermediate effect actually exist in the world you're describing?"

> **💡 Practitioner tips**
> - **Look for Negative Branches actively, not passively.** The FRT's value is mostly in catching them. Don't ask once; ask once per major desired effect. Walk through the list: queue behaviour, team morale, adjacent teams' workloads, supplier relationships, customer expectations. Each is a dimension where an unintended consequence might live.
> - **The FRT is a draft.** It will be wrong about some second-order effects. The rollout will reveal which ones. Keep the FRT open after the rollout and annotate it: "this edge didn't fire because…", "this NB fired even though we had a trimming injection because…". An FRT annotated against reality is one of the most valuable post-mortems you can do.
> - **Name injections with verbs.** "Train 2 L2 agents" is an injection. "Better training" is not. The verb-first naming convention makes it clear what someone actually has to *do*, and it makes the FRT easier to read aloud.
> - **The bonus desired effect is real.** When the FRT reveals a benefit you weren't explicitly chasing — improved agent career development, reduced hiring overhead, earlier customer relationships — write it down. It belongs in the business case for the injection, and it often unlocks stakeholder buy-in that the primary benefit alone wouldn't.
> - **Use the Archive group preset for paths not taken.** When you draw a Negative Branch and then trim it, the unsuppressed version (injection without trimming) is a considered alternative. Archive it rather than deleting it: select the group, then choose **Preset → Archive** in the Group Inspector (slate, collapsed). The reasoning stays visible without cluttering the live diagram.

> **⚠ Common mistakes**
> - **Trivial FRT.** If your FRT is a single injection → single desired effect → "and the UDE goes away", you haven't done the work. Real systems have second-order effects; if you didn't find any, you didn't look hard enough. The minimum useful FRT has at least two layers of intermediate effects and at least one NB search attempt (even if no NBs emerge).
> - **Confusing prediction with hope.** "We hope this will lead to improved customer satisfaction" is not a cause-effect claim. Every edge in the FRT is a prediction you should be able to defend: "I believe A causes B because of mechanism M, under conditions C." If you can't state M and C, the edge is hope. Mark the assumption explicitly on the edge using `Cmd+K → Add assumption to selected edge`; come back to defend it or restructure the chain.
> - **Skipping the Negative Branch hunt.** This is the single highest-value step in FRT drawing. Skipping it produces FRTs that read like project plans and predict like horoscopes. The NBR hunt should take as long as the initial tree construction; if it felt fast, you weren't trying hard enough.
> - **Drawing the FRT before the EC is complete.** The FRT tests injections; the EC surfaces the conflict and produces the injection. If the injection isn't yet grounded in the conflict structure — if it's a solution you already had before the EC — the FRT will confirm whatever you believed going in. Let the EC's assumption analysis do its job first.
> - **Not connecting the FRT back to every CRT UDE.** The FRT is done when each original UDE has a path down to an injection. If a UDE is unreachable, either there's a missing injection or the CRT was wrong about that UDE's root cause. Either way, the gap is information.
> - **Letting the reinforcing loop be implicit.** "Everyone knows it'll become a virtuous cycle" is not a reinforcing loop; it's a hope. Draw the loop, tag the back-edge, name the mechanism. If you can't draw it precisely, you don't yet understand why it would be self-sustaining.

> **🛑 When to stop**
> - Every CRT UDE has a path *down* to at least one injection.
> - Each injection has at least one desired effect spelled out above it, connected by a sentence you're prepared to defend.
> - You've looked for Negative Branches against every major desired effect — actively, not by gesture.
> - Each NB has either a trimming injection that suppresses it, or an explicit "we accept this risk" annotation on the entity.
> - Any reinforcing loops are tagged with back-edges.
> - Verbalisation reads as a plausible future, not a wish-list. You'd be comfortable presenting each edge as a prediction to a skeptical colleague.
> - The desired future state you wrote in the Document Inspector's System Scope section is visible somewhere in the top layer of desired effects.

🔁 **Chain to next:** the FRT tells you *what* will happen if the injections land. The Prerequisite Tree tells you *what is in the way of making them land* — the obstacles between here and there.

---

→ Continue to [Chapter 7 — Prerequisite Tree](07-prerequisite-tree.md)
