# Chapter 9 — Goal Tree
### *What does success look like?*

> **🎯 What this process is for**
> A Goal Tree (originally Dettmer's Intermediate Objective Map) decomposes a single Goal into Critical Success Factors (CSFs) and Necessary Conditions (NCs). It answers: "If success means X, what would have to be true?" Often drawn *before* a CRT to set the frame; sometimes drawn instead of one, when the problem is "we don't know where to start" rather than "we know things are bad."

## The premise

The CRT works bottom-up from symptoms. The Goal Tree works top-down from objective. The two are duals; you can sometimes infer one from the other.

That duality is worth understanding precisely, because it tells you when to reach for each tool. A CRT asks: *given that these painful effects exist, what cause-structure would explain them?* A Goal Tree asks: *given that this objective matters, what conditions must hold for it to be reached?* The first is a diagnosis; the second is a design brief. Both arrive at a structured map of the same system. When a Goal Tree is drawn for an objective whose non-attainment is itself a UDE — "we are not profitable" — the CSFs and NCs that would have to be true for the Goal tend to map onto the same structural territory as the root causes in the CRT. The NC you're missing is often the root cause you found.

That correspondence is not a coincidence; it reflects the same first principle: a system's underperformance traces to a small number of missing or violated conditions. The CRT names what's wrong. The Goal Tree names what right would look like. Done in sequence, one validates the other.

The Goal Tree is the right starting move when:

- The organization is *planning* (annual strategy, new product launch) rather than *diagnosing* (chronic UDEs).
- You have a high-level goal and need to know what success would actually entail.
- You're trying to align stakeholders before the work starts — the Goal Tree is a shared map of what everyone must agree matters.
- A CRT root cause has just been identified and you want to frame the solution space positively: "what must be true in a world where that cause is gone?"

The structure: one Goal at top; 3-5 CSFs in the middle (the must-be conditions for the Goal); 5-15 NCs at the bottom (sub-conditions feeding each CSF). Each layer connects to the next with necessity edges. Every edge in the tree reads the same way: *"In order to achieve [parent], we must have [child]."* That single reading direction — downward-necessity — is the tree's discipline. When an edge won't submit to that reading, it either belongs in a different diagram or the node is at the wrong level of the hierarchy.

## The method

1. **Write the Goal.** One sentence. Specific. Time-bounded if possible. "Hit $10M ARR by EOY 2026." "Ship Customer Portal v2 with 80%+ adoption by Q3." If you can't time-bound it, add at least a measurability criterion: "Hit $10M ARR, measured as MRR × 12 against the last close date." Vague goals produce vague trees.
2. **Brainstorm 3-5 Critical Success Factors.** "What would have to be true for the Goal to be achieved?" Each CSF should be a *condition*, not an action. "Sales pipeline is healthy" is a CSF; "Hire 3 AEs" is not (that's a NC, or a TT action). The CSF layer captures the strategic shape — the few structural realities that are jointly sufficient for the goal. Think of them as the answer to: "What has to be *already in place*, as a state of affairs, for the Goal to be reachable?"
3. **Test necessity at the CSF layer.** For each CSF, ask: "Could the Goal still be reached without this condition?" If yes, the CSF isn't necessary — demote it or reframe it. The CSFs should pass the Dettmer test: remove any one of them, and the Goal becomes unreachable. Add them all together, and the Goal becomes reachable. That's the conjunctive standard.
4. **Under each CSF, list Necessary Conditions.** Sub-conditions that feed the CSF. Aim for 2-4 per CSF. Apply the same necessity test: "If this NC were absent, would the CSF still hold?" If yes, the NC is nice-to-have, not necessary.
5. **Use necessity edges throughout.** "In order to achieve [Goal], we must satisfy [CSF]." "In order to satisfy [CSF], we must have [NC]." The direction is always bottom-up in meaning even when drawn top-down in layout. The tree reads upward — each layer is a *prerequisite* for the layer above.
6. **Walk the tree bottom-up.** Starting from a leaf NC, walk up to the Goal. The chain should read aloud as a coherent argument. "In order to achieve the Goal, we must have CSF-2. In order to have CSF-2, we must have NC-4." If the sentence sounds forced or requires an unstated bridge, there's a missing NC.
7. **Look for missing conditions.** Conjoin all children of a parent. If their conjunction doesn't guarantee the parent, you're missing a NC. That gap is valuable — it names something the planning process hadn't named yet.
8. **Stop when each NC is something you can plan against.** NCs that are themselves wide open (need their own Goal Tree) get bumped to the next iteration; mark them as "needs decomposition" via the Inspector's description field. At the stopping point, every leaf NC should be a condition specific enough that someone could tell you, on any given day, whether it's satisfied.

## Worked example — the B2B SaaS GM

Switch gears from the support-team CRT in Chapters 4 and 5. Imagine you're the new GM of a B2B SaaS product line, planning your first year.

`Cmd+K → New diagram…` → select Goal Tree. The **Creation Wizard** opens at step 1, prompting for the Goal.

![Goal Tree creation wizard](screenshots/chapter09-goal-tree-wizard.png)

🛠 **How TP Studio helps:** The Goal Tree creation wizard mirrors the EC wizard's pattern: 5 steps, each prompting for one slot (Goal → CSF 1 → CSF 2 → CSF 3 → first NC). Each step commits live so partial walks leave the canvas in a useful state. The wizard's layout engine places entities in the canonical layered arrangement — Goal at top, CSFs beneath it, NCs at the base — so the structural shape is immediately visible when you dismiss.

Wizard step 1: **Goal**. Type **Hit $10M ARR by EOY 2026**. Next.

Step 2: **CSF 1**. *What's one thing that has to be true for that goal?* **Sales pipeline coverage of 3x quota each quarter.** Next.

Step 3: **CSF 2**. **Net retention >= 110%.** Next.

Step 4: **CSF 3**. **Two new vertical-specific use cases shipped and adopted.** Next.

Step 5: **First NC**. Pick a CSF to decompose. Take "Sales pipeline coverage of 3x quota" — what's required? **AE headcount of 8 by end of Q1.** Commit.

Wizard closes; the canvas now has a Goal Tree with one Goal, three CSFs, and one NC. Continue building manually:

- Under "Sales pipeline coverage", add NCs: **Marketing-qualified-lead flow at 200/mo by Q2**, **Pipeline-review cadence weekly with consistent definition of "qualified"**.
- Under "Net retention >= 110%", add NCs: **Customer success function staffed at 1:1.5M ARR**, **Quarterly business review cadence with strategic accounts**, **Expansion playbook documented + trained**.
- Under "Two new vertical use cases", add NCs: **Product-research effort sized at 1 PM + 1 designer for 8 weeks per vertical**, **2 design-partner contracts signed per vertical**.

You now have a Goal Tree of 1 Goal, 3 CSFs, 7 NCs. Walk it bottom-up and read each chain aloud:

*"In order to hit $10M ARR by EOY 2026, we must have sales pipeline coverage of 3x quota each quarter. In order to have sales pipeline coverage of 3x quota, we must have AE headcount of 8 by end of Q1."* Coherent.

*"In order to have net retention >= 110%, we must have a quarterly business review cadence with strategic accounts."* Sounds right — the QBR cadence is what surfaces expansion signals. Mark it.

*"In order to have two new vertical use cases shipped and adopted, we must have two design-partner contracts signed per vertical."* Sounds right — without committed design partners, there's no feedback loop to validate the vertical use case.

Now apply the missing-condition check. Conjoin all three CSFs: pipeline coverage AND net retention AND vertical use cases shipped. Does that conjunction guarantee $10M ARR? Almost — but there's a gap: what about unit economics? A company can have strong pipeline, strong retention, and new use cases while burning through cash at a rate that makes the revenue number moot. You add a fourth CSF: **Gross margin per customer above 65% at the cohort level**. The tree now has the shape it should.

### When the Goal Tree and CRT overlap

You're the same GM. Two months in, you now have a CRT too — drawn from the UDEs the team surfaces in weekly reviews: customers are churning, the sales cycle is elongating, delivery dates are slipping. The CRT resolves to two root causes: no repeatable delivery process, and no structured onboarding playbook.

Look at the Goal Tree. Under "Net retention >= 110%", one of the NCs is "Expansion playbook documented + trained." That NC is exactly what the CRT root cause is pointing at: there is no playbook, and its absence is causing churn. The Goal Tree and the CRT are naming the same gap from opposite directions. That convergence is the strongest possible confirmation that you've found a real structural issue — not an interpretation artifact, but a thing that shows up whether you're reasoning from desired state or from existing symptoms.

When you see this, flag it. In TP Studio: select the NC from the Goal Tree, open the Inspector's description field, and add a cross-reference note to the CRT entity. The formal linking mechanism between diagrams is a cross-doc entity import (`Cmd+K → Import entity from another doc…`) which creates a shadow copy with a back-reference; for a soft annotation, a description note is sufficient. Either way, the convergence becomes visible in a team review.

## Worked example II — a product-function transformation

A second example, at a different altitude: a Head of Product who has just taken over a struggling product function. The team ships late, morale is low, and stakeholder confidence is near zero. She needs to align her VP on what recovery looks like before diving into diagnosis.

She opens a new Goal Tree and writes the Goal as: **Product function is a credible delivery and learning system by end of year, as measured by: stakeholders trust our estimates, on-time delivery is >75%, and team NPS >50.**

Three CSFs emerge from her conversation with the VP:

- **Stakeholders trust the team's commitments** — without this, no amount of delivery improvement matters at the political level.
- **The team learns from every cycle** — without this, the function can't self-correct.
- **Work is scoped and sequenced so delivery is predictable** — without this, the other two can't be sustained.

Under "stakeholders trust commitments", she identifies NCs:

- **Estimates are derived from a shared sizing rubric, not gut feel**
- **A delivery date, once committed, is changed by process not by silence**
- **Postmortem findings reach stakeholders, not just the team**

Under "team learns from every cycle":

- **Blameless postmortem within 5 working days of each delivery**
- **Product-metric review cadence monthly, with decisions recorded**
- **Team retrospective bi-weekly with concrete follow-through tracking**

Under "work is scoped and sequenced":

- **Discovery phase explicitly gated from build phase**
- **No more than 3 concurrent discovery-stage projects at any time**
- **Roadmap visible 2 quarters out, with confidence levels marked**

She reads each chain aloud. Most survive. One doesn't: *"In order to have stakeholders trust our commitments, we must have postmortem findings reach stakeholders."* Does that read as necessary? Actually, no — stakeholder trust is built through delivery consistency, not through sharing postmortems. Postmortem visibility is nice but it's not load-bearing. She demotes that NC to a "nice to have" annotation in the Inspector description and removes the necessity edge.

The resulting tree has 1 Goal, 3 CSFs, 8 NCs. She exports the reasoning narrative (`Cmd+K → Export… → Reasoning as narrative (Markdown)`) and sends it to her VP before the alignment meeting. The VP reads it in two minutes and has substantive disagreements about two of the NCs — exactly the kind of early feedback the Goal Tree is designed to surface. The alignment meeting becomes a 30-minute refinement session rather than a two-hour argument about priorities.

## Multi-goal Goal Trees

Sometimes the strategic frame has two or three top-level goals. Conventional Goal Tree practice says no — the Goal Tree's discipline is its singular goal. But organizations do sometimes have legitimate dual top-level objectives ("Hit $10M ARR AND keep team headcount under 60").

The multi-goal problem is almost always a framing problem in disguise. The second "goal" is usually one of three things: a constraint on the first goal (headcount cap), a CSF of a higher-level goal you haven't named yet (a board-level objective that includes both ARR and efficiency), or a different planning horizon (the $10M goal is a 12-month target; the headcount discipline is a 36-month sustainability condition). In the first two cases, the right move is to reframe: add the higher-level goal as the apex, or demote the constraint to a CSF.

TP Studio supports this diagnosis with a *soft* warning: the `goalTree-multiple-goals` validator fires (clarity tier) when a Goal Tree has more than one Goal. The warning is dismissible. The warning's one-click action is `Convert extras to CSFs` — which downgrades every Goal except the oldest to a Critical Success Factor. That's usually the right move: the second "Goal" is actually a constraint on the first.

If you genuinely need two Goals, dismiss the warning and proceed. Just be honest about whether the constraint framing fits better — most of the time, re-framing to a single apex goal produces a richer, more coherent tree.

## Sidebars

> **🛠 How TP Studio helps**
> - `Cmd+K → New diagram…` → select **Goal Tree** → opens the **Creation Wizard** (Goal → CSF1 → CSF2 → CSF3 → first NC, 5 steps).
> - **`goal`** entity type (sky stripe), **`criticalSuccessFactor`** (teal stripe), **`necessaryCondition`** (lime stripe) — Goal-Tree-specific palette types visible in the Inspector's Type grid.
> - **`Add NC`** verb: select any CSF or NC in a Goal Tree, single-entity toolbar → **Add NC**. Creates a `necessaryCondition` child connected via a necessity edge. The fastest way to extend the tree after the wizard closes.
> - **`Mark CSF`** verb: select any entity that isn't a `criticalSuccessFactor` or `goal` → single-entity toolbar → **Mark CSF**. Useful when an entity was created via Quick-Capture and arrived as a plain `effect` rather than the intended tier.
> - **`Promote to Goal`** verb: select any non-goal entity → **Promote to Goal**. Useful when building bottom-up and discovering that one NC is actually the real strategic objective.
> - **`goalTree-multiple-goals`** validator with the **`Convert extras to CSFs`** one-click action — fires when more than one `goal` entity exists; demotes all but the oldest.
> - **Pattern library** (`Cmd+K → Pattern library…`) ships six Goal Tree starters: *Goal Tree starter* (generic 3-layer), *Sustainable product organization*, *Profitable subscription business*, *Trustworthy ML system*, *Effective sales team*, and *Generic IT-function goals*. Each arrives with realistic NC numbers as a calibration anchor.
> - **Load example** (`Cmd+K → Load example…` → Goal Tree) — the canonical 8-entity "Customer-first" example, useful for studying the structural shape before drawing your own.
> - **Reasoning narrative export** (`Cmd+K → Export… → Reasoning as narrative (Markdown)`) — compiles the tree into a top-down necessity argument sentence-by-sentence, suitable for a stakeholder brief or alignment doc.
> - **Method checklist** (Document Inspector) — five Goal Tree steps tracked per document: State the Goal; List 3–5 CSFs; Identify NCs per CSF; Test necessity at every layer; Look for missing conditions. Useful for a team of analysts working the same document across sessions.

> **💡 Practitioner tips**
> - **Time-bound the Goal.** "Hit $10M ARR" is weaker than "Hit $10M ARR by EOY 2026." The time bound is what makes the tree falsifiable — and falsifiability is what makes it a planning tool rather than a wish list.
> - **CSFs are conditions, not projects.** "Healthy pipeline" is a condition. "Run the pipeline-improvement project" is not. If your CSF is a project, you've skipped a level: the project produces a condition, and it's the condition you want in the CSF slot.
> - **Calibrate NC specificity to a planning horizon.** NCs should be specific enough that someone can answer "is this satisfied today?" If the answer requires its own Goal Tree to determine, you're one level too coarse. If it requires a 3-minute data pull, you're probably at the right level.
> - **Goal Tree first, CRT second** when you're planning. **CRT first, Goal Tree implicit** when you're diagnosing existing pain. Both flows are valid; pick based on what the room knows. Starting with a CRT when the organization is in denial about having problems produces useful diagnosis but poor alignment. Starting with a Goal Tree when the symptoms are acute produces a nice vision doc but no traction.
> - **Use the Goal Tree as a reading test for your CRT root causes.** If you've drawn both, overlay them informally: every root cause in the CRT should correspond to a missing or violated NC in the Goal Tree. When a root cause has no corresponding NC, either the Goal Tree is missing a branch or the root cause is a symptom rather than a cause.
> - **Re-draw the Goal Tree annually.** Last year's strategic frame ages out. The CSFs that were true in year one (acquiring initial customers) are different in year three (retaining and expanding them). If the Goal Tree has been static for two years, you've stopped using it.

> **⚠ Common mistakes**
> - **Too many CSFs.** Three is a sweet spot; five is okay; seven means you haven't decided what matters. The CSF layer is the strategic shape of the goal — it should be small enough that every person in the room can hold it in working memory simultaneously. When you feel compelled to add a sixth CSF, ask yourself whether two of the existing ones could be merged or whether one is really an NC of another.
> - **CSFs and NCs at the wrong level.** "Increase MRR 10% MoM" is too granular for a CSF (that's a metric to track, not a structural condition). "Have a pipeline" is too vague for an NC. The calibration rule: a CSF should be specific enough to be falsifiable but abstract enough that you couldn't work on it directly — you work on NCs that feed it. An NC should be specific enough that it has an owner and a measure.
> - **Confusing Goal Tree with the to-do list.** The Goal Tree is *what would be true*, not *what would be done*. Actions belong in the PRT or TT downstream. If you find yourself writing "Hire 3 AEs" as a CSF, you've written a task. Reframe: "AE headcount sufficient to cover quota" is the condition; "hire 3 AEs" is how you get there.
> - **Leaving necessity untested.** Every edge should survive the challenge: "Could the parent be achieved without this child?" If you haven't asked the question, you haven't drawn a Goal Tree — you've drawn a mind map with a nice shape. The necessity discipline is the whole point.
> - **Treating the first draft as done.** The real value of the Goal Tree surfaces in the second pass — after you've walked the tree aloud and found the edges that don't sound right, after you've applied the missing-condition check, and ideally after someone who wasn't in the room has read the reasoning narrative and pushed back. First-draft Goal Trees are usually at the right shape but wrong specificity.

> **🛑 When to stop**
> - One Goal, time-bounded, specific, measurable.
> - 3-5 CSFs, each a condition (not an action), each genuinely necessary.
> - 2-4 NCs per CSF, each specific enough to have an owner and a check date.
> - Necessity tested at every edge — every child passes "is this really necessary for the parent?"
> - Missing-condition check applied at every parent — the conjunction of children is sufficient for the parent.
> - Read-aloud passes at every chain, without invented bridge-sentences.
> - You can describe the strategic frame in one sentence that the Goal-Tree vocabulary makes precise.

🔁 **Chain to next:** the Goal Tree is the strategic frame. The S&T tree is the *deployment* of that frame across the organization, one operational level at a time.

---

→ Continue to [Chapter 10 — Strategy & Tactics Tree](10-strategy-and-tactics-tree.md)
