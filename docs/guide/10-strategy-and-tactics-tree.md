# Chapter 10 — Strategy & Tactics Tree
### *Deploying operationally*

> **🎯 What this process is for**
> A Strategy & Tactics Tree (S&T) is the deployment-grade decomposition of a strategy across an organization, from CEO-level down to individual contributor. Each node is a 5-facet card holding Necessary Assumption (why the strategy matters), Strategy (what), Parallel Assumption (why this specific approach), Tactic (how), and Sufficiency Assumption (why that's enough). Used for cross-functional rollouts, big strategic programs, and as the working document for a TOC-style strategic deployment.

## The premise

The Goal Tree is *what success looks like*. The S&T tree is *what each person does on Monday morning when we deploy the strategy across 30 teams*.

S&T came late to the TOC tradition — Goldratt formalized it in the early 2000s — and is the most operationally specific of the thinking processes. The earlier TPs are all diagnostic: CRT finds the problem, EC names the conflict, FRT tests the fix, PRT sequences the move, TT specifies the steps. The S&T is different. Its job is not diagnosis but *argument*. Every node is a self-contained micro-case: this is the situation, this is our chosen response, this is why we chose it over the alternatives, this is what success looks like, this is why we trust that the action delivers it. The tree as a whole is the organization's argument-for-its-own-strategy, spelled out node by node.

That framing has a consequence: the S&T's value is not primarily in drawing it, but in *reading and challenging* it. A well-built S&T tree exposes every implicit bet the strategy rests on — and does so in a form that invites targeted disagreement. When a department head says "I don't agree with this strategy," the S&T converts that vague objection into a pointed question: *which facet, on which node, do you think is wrong?* That conversion — from diffuse resistance to specific, answerable challenge — is most of what the S&T is for.

The facet names that follow are Goldratt's. The one-line characterizations are how this book reads them in practice.

| Facet | A reading |
| --- | --- |
| **Necessary Assumption** (NA) | The world-state above us has changed enough that *not* acting at this layer has become unacceptable. Captures the trigger handed down from the parent node — why this level of the strategy tree must exist at all. |
| **Strategy** | A statement of the result we commit to deliver at this layer — what good looks like, not how we get there. Phrased as an outcome, not an action. |
| **Parallel Assumption** (PA) | Of the strategies that *could* respond to the NA, why this one. Captures the comparative choice — the alternatives considered and what made this one the right pick. |
| **Tactic** | The concrete things people will do. Verbs, not aspirations. Granular enough that you can tell whether they happened. In TP Studio, the entity *title* is the tactic. |
| **Sufficiency Assumption** (SA) | If we complete the tactic, the strategy is fulfilled. Captures the bet that Tactic → Strategy is a real causal chain, not a hopeful one. |

Notice the structure: NA frames *why act here*, Strategy commits *to what*, PA defends *why this way*, Tactic tells *who does what*, and SA asserts *this will work*. Together they trace the full argument from environmental pressure (NA) through the chosen response (Strategy + Tactic) to the trust that the response actually closes the loop (SA). Every missing facet is a hidden assumption — one the team is making implicitly, and therefore cannot challenge.

A complete S&T tree at organizational scale might be 40-100 nodes, decomposed across 4-6 levels. Few teams ever build one. The skill matters mostly when you're either *running* a TOC-style deployment or *evaluating one someone else built*. For most practitioners the S&T is a reading tool as much as a drawing tool — you sit down with a strategy document and ask, node by node, whether the five facets are actually there, and whether they're any good.

## The method, neutral of tool

1. **State the apex strategy.** The top-level node is the entire program's commitment. Fill all five facets before doing anything else. If you can't fill the NA for the apex, you don't yet understand why the program exists.
2. **Name the tactic that achieves it.** The apex's tactic is the highest-level action — the "we will do X" from which everything else decomposes.
3. **Decompose into 3-5 child strategies.** Each child S&T node represents a sub-strategy that *contributes to fulfilling* the parent's tactic. The parent tactic is the child's context; the child's NA captures what it inherits from the parent.
4. **Fill all five facets at every level before going deeper.** Partially-filled nodes are worse than no nodes — they imply completeness they don't deliver. The `st-tactic-assumptions` validator fires on any tactic that lacks all three assumption types.
5. **Continue down until the leaf tactic is operational** — a thing a named team can plan against within their existing decision-making authority.
6. **Audit the completed tree.** Read each chain of argument from root to leaf. Every parent's tactic should be reachable by the children's strategies in combination. If there are gaps — places where the children's combined output doesn't quite cover the parent's tactic — the tree is incomplete, not the children.

## Understanding the five facets deeply

### The Necessary Assumption — why this matters

The NA is the trigger, the environmental pressure that makes this level of the tree non-optional. At the apex, the NA answers: *what changed in the world, in the market, or in the organization that made this program necessary?* Lower in the tree, the NA inherits from the parent: *given that the parent tactic commits to X, why does this particular sub-strategy have to exist?*

A good NA is falsifiable. "It's important for us to grow" is not an NA — it's a value that's always been true. "Without 30% growth by Q3 next year, we miss Series C metrics, and our runway ends in Q4" is an NA: it could be wrong, you can check it, and if it's wrong, the strategy it anchors has no foundation.

The NA is also the canary for strategic drift. If you complete a tactic and then revisit the NA six months later, has the underlying trigger still held? If not, the tactic may have been appropriate for a world that no longer exists.

### The Strategy — what good looks like here

The Strategy names the outcome this level commits to. It is not the tactic (which comes next) and it is not the NA (which explains why). It answers: *if the tactic succeeds, what condition will exist that didn't exist before?*

Write it as a present-tense fact about the future state: "We are the preferred vendor for mid-market healthcare SaaS compliance," not "we will pursue the healthcare vertical." The tactic covers the pursuit; the strategy names the destination.

### The Parallel Assumption — why this path, not another

The PA is the most commonly skipped facet and the most intellectually honest one. It forces you to name the alternatives. A strong PA reads: "Strategy X chosen over Strategy Y because [reason], and over Strategy Z because [reason]." If you have never written that explicitly, you have not seriously considered the alternatives — you've committed to a path by default.

The PA also carries the information that makes the tree revisable. If the assumption under the PA turns out to be wrong — if the reason you chose X over Y no longer holds — you now know exactly which node needs to change, and which alternatives are already documented and ready to reconsider.

### The Tactic — what people do on Monday

The tactic is action-shaped and observable. "Establish relationships with healthcare CISOs" is a tactic. "Prioritize healthcare" is not. If you cannot imagine how you would check whether the tactic has happened, it isn't a tactic yet.

At organizational scale, the tactic at one level becomes the *strategy* at the next level down. The decomposition works because each child node asks: *to achieve this parent tactic as its strategy, what does this team specifically do?* That recursive structure is why the S&T can span from CEO level to an individual contributor's sprint backlog without losing the thread.

### The Sufficiency Assumption — the bet that connects action to outcome

The SA is where most strategic plans are the weakest. It says: *doing the tactic will produce the strategy outcome*. That is a causal claim. It can be wrong. Write it as an explicit assertion that can be challenged: "Hiring 2 healthcare-specialist account executives will generate 3 design-partner logos within 6 months, which will generate 12 paid logos within 18 months, sufficient to hit the vertical revenue target." Now you know the mechanism you're betting on, and you can check it.

If the SA turns out to be wrong — the design partners don't convert — you haven't just learned "the strategy didn't work." You've learned *which facet was wrong*, and the tree points you to the NA and PA of the child node responsible, which in turn tells you what the alternative tactic should be.

## The worked example

We'll build a 2-level S&T tree for a fictional but realistic situation: **a $10M ARR B2B SaaS company deploying a focused vertical-entry strategy for the next 18 months**.

The setup: the board and CEO have agreed that scattered horizontal GTM is preventing the company from winning competitive deals. The decision is to focus on one vertical for an 18-month push, establish reference customers, and build a moat. You're facilitating the S&T build with the leadership team.

### Step 1 — Open an S&T diagram

`Cmd+K → New diagram…`. In the picker, select **Strategy & Tactics Tree**. The canvas opens empty with the method checklist visible in the Document Inspector — six steps, all unchecked. Check off the first two (`st.apex` and `st.tactic`) as you complete them.

### Step 2 — The apex node

Double-click the canvas. Type the tactic for the apex: **"Run an 18-month focused vertical go-to-market for the healthcare compliance segment."** Press Enter. The entity is created. In the Inspector's Entity Type grid, it should already be typed as `injection` for an S&T diagram — this is the tactic type.

Now open the **S&T facets** section in the Inspector (it appears automatically for injection entities in an `st` diagram). Fill the four companion facets:

- **Strategy:** "We are the recognized go-to vendor for mid-market healthcare compliance automation."
- **Necessary Assumption:** "Horizontal GTM has limited deal velocity and win rate. Without a focused wedge we cannot win competitive deals against point-solution specialists, and we will miss our Series B metrics by Q4 next year."
- **Parallel Assumption:** "Healthcare chosen over FinTech because the compliance moat (HIPAA, HITRUST) is more durable and the ICP is more willing to pay for integration. EdTech chosen against because procurement cycles are 2x longer. Healthcare chosen over Manufacturing because our existing integrations are 80% already compliant."
- **Sufficiency Assumption:** "3 design-partner healthcare logos → 12 paid within 12 months → $2M ARR new vertical revenue, sufficient to justify a dedicated vertical pod and hit Series B metrics."

As soon as you fill in the Strategy facet, the canvas node expands from a single-row entity into the tall **5-row card** with each facet visible as its own labeled row. Click any row directly on the canvas to inline-edit it.

![S&T example diagram](screenshots/chapter10-st-example.png)

Read the apex node aloud, facet by facet. "Because horizontal GTM is limiting us (NA), we're committing to become the recognized healthcare compliance vendor (Strategy). We chose healthcare over FinTech and EdTech because (PA). We'll execute this by running an 18-month focused vertical GTM push (Tactic). We trust this will work because 3 design partners → 12 paid → $2M ARR (SA)." The argument should sound like something a board member would recognize from the off-site.

### Step 3 — Three child strategies

The apex tactic — running the focused GTM — decomposes into three parallel sub-strategies. Each is its own full S&T node. Add each one by double-clicking the canvas, then connect them to the apex with a downward edge (the apex's tactic is each child's parent context).

**Child 1: Product readiness for healthcare**

- **Tactic:** "Build HIPAA-compliant audit logging and two HITRUST-mapped feature flags by Q2."
- **Strategy:** "Product is healthcare-compliant out of the box — no custom implementation work needed for design partners."
- **NA:** "Healthcare CISOs will not approve a vendor that requires custom compliance work — our current product requires 3-4 weeks of post-sale configuration, which killed two deals last quarter."
- **PA:** "Audit logging + 2 feature flags chosen over a full HITRUST certification (18 months, $300K) because certification can follow design-partner acquisition; it's a prerequisite for scaling, not for closing the first 3 logos."
- **SA:** "When design-partner security reviews begin, our product passes baseline checks without custom work, removing the deal blocker that killed Q3 deals."

**Child 2: Sales motion for the vertical**

- **Tactic:** "Hire 1 healthcare-specialist AE and retrain 2 existing AEs on healthcare-specific discovery and objection handling."
- **Strategy:** "Sales team can run a healthcare-specific discovery call and close motion without generalist toolkits."
- **NA:** "Current AEs use horizontal messaging; healthcare buyers consistently say they 'didn't feel understood.' Of 6 healthcare POCs last year, 4 stalled at discovery."
- **PA:** "Specialist AE hire chosen over sales training alone because healthcare discovery requires institutional knowledge our team doesn't have. External hire can mentor the two retrained AEs, creating a pod."
- **SA:** "A 3-person specialist pod running vertical discovery will convert 50% of qualified healthcare opportunities to POC, up from 17% today."

**Child 3: Reference engine**

- **Tactic:** "Sign 3 design-partner healthcare logos at 60% list price; deliver weekly executive sponsors for mutual case studies."
- **Strategy:** "We have 3 named, referenceable healthcare logos within 12 months."
- **NA:** "Healthcare procurement is reference-heavy — the top objection in every deal is 'we've never heard of you.' Without logos, sales cycles are 6+ months regardless of product quality."
- **PA:** "Design partner model chosen over standard discounting because design partners provide structured feedback + case study rights in exchange for pricing, yielding both product intelligence and references simultaneously."
- **SA:** "3 referenceable logos reduce average healthcare sales cycle from 6 months to 3 and convert the 4 currently-stalled opportunities, yielding $1.2M ARR in the first 12 months."

### Step 4 — Verbalize and challenge each node

Read each child node back to the team. For each one, the most valuable questions are not "do we agree with the strategy?" but:

- "Is the NA still true?" (Could someone argue that horizontal GTM is actually working and we're over-indexing on a few bad deals?)
- "Is the PA defensible?" (Why not EdTech? Why not certification-first?)
- "Is the SA realistic?" (3 logos in 12 months — what's our assumption about deal cycle time?)

The facet structure converts strategic disagreement from vague ("I'm not sure about healthcare") into specific ("I think the PA for Child 1 is wrong — I believe certification is a prerequisite for closing the first logo, not just scaling"). Specific challenges are answerable. Vague ones aren't.

### Step 5 — Check completeness

Open the CLR walkthrough panel. The `st-tactic-assumptions` validator fires on any `injection` entity in an S&T diagram that has fewer than three incoming `necessaryCondition` edges. In the TP Studio S&T model, NA, PA, and SA are all represented as `necessaryCondition` entities feeding into the tactic node. If you've filled the four facets in the Inspector's S&T facets section, TP Studio creates those edges automatically — but if you added assumptions manually as separate entities without using the facets section, check that each tactic has all three.

Check the method checklist in the Document Inspector. Tick off `st.na`, `st.pa`, `st.sa`, and `st.decompose` as you complete them. When all six steps are checked, you're through the prescribed method.

### Step 6 — Stop

How do you know the S&T is done?

- Every node has all five facets. No empty rows on any canvas card.
- Leaf tactics are operational: a named team can schedule the work this sprint.
- Each parent's tactic is covered by the children's strategies in combination — no coverage gap.
- You've challenged at least the PA on every node. If you haven't, you haven't used the tree.
- You can hand the tree to a deployment lead and they build a rollout calendar from it without structural questions.

## S&T vs. Goal Tree vs. project plan

Three tools that can look similar from a distance but do different jobs:

**Goal Tree** (Dettmer's IO Map): a *necessity* tree that answers "what conditions must all simultaneously hold for the goal to be met?" It is structural and declarative — no assumptions about how conditions are achieved, no sequencing, no agent assignment. Its logic is AND-logic: all the CSFs must hold. Use it to define and communicate *what success looks like in totality*.

**S&T Tree**: an *argument* tree that answers "what is the organization's case for its own strategy?" Each node carries not just a what (Strategy) and a how (Tactic) but three explicit assumptions that constitute the argument. Use it to deploy a strategy with accountability — and to make disagreement productive.

**Project plan / Transition Tree**: a *sequence* plan that answers "what do we do in what order, and what must be true to do each step?" Sequencing, dependencies, preconditions. Use it to execute a tactic whose argument is already agreed.

The typical flow in a full TOC deployment: Goal Tree sets the destination → CRT/EC diagnose why you're not there yet → FRT specifies the fix → S&T deploys the fix across the organization → PRT/TT sequence and execute each piece.

## Decomposition across organizational levels

The S&T's recursive structure maps naturally onto organizational hierarchy, but the levels are strategic levels, not org-chart levels. The apex strategy belongs to whoever owns the whole program — CEO, VP, program lead. The first decomposition belongs to whoever leads each workstream. The second decomposition belongs to team leads. Leaf tactics belong to named people.

The handoff point between levels is the parent tactic becoming the child strategy. The parent says: "we will run a focused healthcare GTM" (tactic). The child inherits that as its strategy: "given that we're running a focused healthcare GTM, my workstream commits to product readiness" (strategy). The NA at each child level captures what the parent tactic implies for that child: "the focused GTM requires compliant product or deals stall."

This handoff is where strategy most often breaks down in practice. The parent believes the tactic is clear; the child interprets it differently; the children's combined output doesn't add up to the parent's tactic; and nobody notices until the program review six months later. The S&T tree makes the handoff explicit — it's the PA and SA at the parent level that define what the children must collectively deliver, and the NA at each child level that confirms the child understood what was handed down.

> **💡 Practitioner tip:** when reviewing a multi-level S&T tree for the first time, check the parent's SA against each child's Strategy. If the child's Strategy doesn't obviously contribute to the parent's SA being true, there's a coverage gap — the parent's bet that "doing the tactic will achieve the strategy" isn't supported by the children. This is the most common structural defect in large S&T trees.

## Why facet-level disagreement is productive

Most strategy processes either avoid surfacing disagreement (the HIPPO wins) or surface it too late and too diffusely ("this initiative isn't going well"). The S&T's five-facet structure creates a third option: *early, targeted, answerable disagreement*.

When you and a colleague disagree about a child strategy, the S&T makes you both more precise. Instead of "I don't think this is the right approach," you say: "I accept the NA. I accept the Strategy outcome. I disagree with the PA — I think FinTech compliance has a more durable moat than healthcare compliance, and here's the evidence." That's answerable. You go look at the evidence. You update the PA or you don't. Either way you've had a real conversation about the strategy rather than a political one.

Facet-level disagreements cluster, and the clustering tells you something useful. If everyone agrees with the NA and Strategy but multiple people flag the SA, the team's shared concern is *whether the tactic actually delivers* — a causal chain doubt. If everyone flags the PA, the team's concern is *whether this was the right choice among alternatives* — a comparative judgment. Those are different conversations requiring different evidence, and the S&T lets you have them without conflating them.

## Sidebars

> **🛠 How TP Studio helps**
> - `Cmd+K → New diagram…` → select **Strategy & Tactics Tree** to start a fresh S&T canvas.
> - `Cmd+K → Load example…` → select **Strategy & Tactics Tree** to load a 2-level reference tree demonstrating the 5-facet rendering.
> - **5-facet card rendering**: an `injection` entity in an `st` diagram with any of the four reserved attribute keys (`stStrategy` / `stNecessaryAssumption` / `stParallelAssumption` / `stSufficiencyAssumption`) filled in renders as a tall 5-row card with labeled rows. Click any row on the canvas to inline-edit it. The entity title is always the Tactic row.
> - **S&T facets section** in the Entity Inspector — surfaces automatically for injection entities in `st` diagrams. The four input fields map to the four reserved attribute keys; filling any one triggers the tall-card layout.
> - **`st-tactic-assumptions` validator** (CLR clarity tier) fires on any `injection` entity in an S&T diagram with fewer than three incoming `necessaryCondition` edges — one for NA, one for PA, one for SA. The warning message names how many facets are missing.
> - **`st-tactic-rollup` validator** (CLR sufficiency tier) fires on a non-apex tactic (`injection`) with no child tactics feeding up into it — a layer that should decompose into the next level down but doesn't. Add its children, or accept it as a genuine leaf.
> - **6-step method checklist** in the Document Inspector (`st.apex` → `st.tactic` → `st.na` → `st.pa` → `st.sa` → `st.decompose`) — tick each step as you complete it. Tracks progress on the prescribed build sequence and surfaces in any PPTX export.

> **💡 Practitioner tips**
> - **Fill the PA before you fill the Tactic.** Writing the PA forces you to name the alternatives you rejected, which sharpens the tactic you chose. If you write the Tactic first, the PA tends to become post-hoc justification rather than genuine comparative reasoning.
> - **NA and SA are about argument, not summary.** "NA: It's important to grow" is useless. "NA: Without 30% growth we don't hit Series C metrics, and Series C is needed by Q3 2027" is an NA: it could be wrong, you can check it, and if it's wrong, the node needs to change.
> - **The SA is your public bet.** Write it as a falsifiable causal claim: "doing X will produce Y within Z months because [mechanism]." Now your team — and you, six months from now — can check whether the bet held and why it did or didn't.
> - **A full org-scale S&T is rarely built.** For most purposes the two-level version (apex + 3-5 children) is the sweet spot: it's presentable in an hour, it exposes the major assumptions, and it surfaces the primary decomposition disagreements. Go deeper only when the children's tactics need their own argument defended — when there's genuine ambiguity about whether the child's approach is right.
> - **Read the tree from leaf to apex for a coherence check.** Starting at any leaf, ask: does this tactic's SA contribute to its parent strategy? Does the parent's SA contribute to *its* parent's strategy? A leaf whose SA doesn't eventually ladder up to the apex strategy outcome is either misplaced or working on the wrong thing.

> **⚠ Common mistakes**
> - **Skipping facets to "get to the point."** The facets *are* the point. Without them the S&T tree is just a project plan with extra boxes — no assumptions declared, no alternatives documented, no causal claims to challenge. You save 20 minutes of thinking and lose most of the tree's value.
> - **Writing vague tactics.** "Improve customer relationships" is not a tactic. "Assign a named CSM to each of our top-20 accounts and run a quarterly executive business review" is a tactic. If someone can't tell whether it happened, it isn't a tactic yet.
> - **Treating the S&T as a Gantt chart with extra steps.** S&T isn't sequencing. It doesn't say A must happen before B. It says B exists to contribute to A's strategy. Sequencing lives in the PRT and TT; the S&T is the argument for *what* those plans must accomplish.
> - **Filling the PA with "we considered X but ruled it out."** That's the beginning of a PA, not the end. The PA must also say *why* it was ruled out — what assumption, fact, or judgment made X the wrong choice for this moment. Without the "because," the PA can't be challenged.
> - **Building the whole tree before challenging any node.** An S&T built by one person in isolation is just that person's assumptions, formalized. The value comes from presenting each node — especially the PA and SA — to the people who will execute it, and watching where they push back.

> **🛑 When to stop**
> - Every node has all five facets filled. No empty rows on any canvas card.
> - The `st-tactic-assumptions` validator has no open warnings — each tactic has a NA, PA, and SA.
> - Leaf tactics are operational: a named team can schedule the work without needing to ask structural questions.
> - Each parent's tactic is covered by the combined strategies of its children. No coverage gap.
> - Every PA names the alternatives that were rejected and why.
> - You can hand the tree to a deployment lead and they build a rollout calendar from it without coming back with structural questions.

> **✏️ Now you try.** Take a strategy you're rolling out. Open an S&T tree (`Cmd+K → New Strategy & Tactics Tree`), place the apex strategy as a Goal and its tactic below as an Injection, then fill the tactic's **S&T facets** in the inspector — Necessary Assumption, Strategy, Parallel Assumption, Sufficiency Assumption. Writing the Parallel Assumption (the alternatives you rejected) *before* the Tactic is the move that sharpens the choice.

🔁 **Chain to next:** the seven structured TPs (CRT, EC, FRT, PRT, TT, Goal Tree, S&T) are the canonical kit. The freeform diagram is for *when the structure doesn't fit*.

---

→ Continue to [Chapter 11 — Freeform diagrams](11-freeform-diagrams.md)
