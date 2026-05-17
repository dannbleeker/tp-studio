# Chapter 1 — The system has a goal

> *If you skip this chapter, the rest of the book will still work mechanically. But the diagrams in Part 2 will feel like notation exercises rather than thinking. Read this chapter even if you're TOC-fluent — the vocabulary established here is what the rest of the book leans on.*

## The premise

Every Theory of Constraints analysis rests on one assumption, and it is the assumption that distinguishes TOC from the rest of process-improvement.

> **The premise:** Every system has a *goal*, and every system's performance is limited by *one* thing — the constraint. Improving anything else does not improve the system. Improving the constraint does.

That second sentence is the part most people skip past on first read, and the part that matters most. TOC is a *constraint-centric* view of systems. Everything else — the diagrams, the validators, the cloud, the focusing steps — is machinery for finding and dismantling constraints.

This sounds obvious until you actually try to make the obvious version stick in a room of people who are used to thinking about averages, about local efficiency, about doing-more-of-the-good-stuff. The obvious version, when taken seriously, has consequences:

- Improving anything that isn't the constraint produces no system-level gain.
- The constraint is almost never where people think it is.
- The constraint can be physical, but more often it is policy, behavior, or measurement.
- Once you fix one constraint, a new one appears — somewhere else in the system. The work never ends; the leverage just relocates.

The Thinking Processes are the toolset for finding and addressing constraints that aren't physical — and that's almost all of them, in the modern white-collar economy. A constraint of "we don't have enough drilling machines" is something a budget solves. A constraint of "our incentive structure rewards individual heroics and punishes the documentation that would prevent them" needs a Thinking Process. That's most of what we do in real organizations, and that's the gap the trees in Part 2 are built for.

## The Five Focusing Steps

Goldratt's canonical sequence for working with constraints. Worth keeping in mind throughout the rest of the book, because *every* thinking-process tree is in service of one of these steps.

1. **Identify** the system's constraint.
2. **Exploit** the constraint — make it work to its full current capacity before adding more.
3. **Subordinate** everything else to the constraint — local optimums that fight the constraint are net-negative for the system.
4. **Elevate** the constraint — invest, change, expand. Only when 2 and 3 are exhausted.
5. **Go back to step 1** — the constraint will have moved.

The Thinking Processes map cleanly onto these steps:

| Thinking Process | Maps to | What it gives you |
| --- | --- | --- |
| Current Reality Tree | Identify | The actual constraint, traced from symptoms backward. |
| Evaporating Cloud | Identify (the *policy* constraint) | The conflict that holds the current reality in place. |
| Future Reality Tree | Elevate | The system as it would be once the constraint is broken. |
| Prerequisite Tree | Subordinate / Elevate | The obstacles to getting from current to future. |
| Transition Tree | Subordinate / Elevate | The sequenced actions that dismantle the obstacles. |
| Goal Tree | Step 1 *before* the iteration starts | The objective the constraint is interfering with. |
| Strategy & Tactics Tree | Elevate (when the elevation is itself a large program) | Deployment-grade decomposition of strategy into tactics. |

You will not use all of these every time. Most analyses center on a CRT, dissolve one or two clouds, draft an FRT, and stop there. The PRT and TT come out only when implementation needs sequencing. The Goal Tree is usually the *frame* you draw around the whole investigation, not a separate analysis. S&T is for larger programs — multi-team rollouts, strategy decomposition, the kind of thing you don't sit and draw on a Tuesday afternoon.

## Vocabulary you'll need

This book uses the standard TOC vocabulary throughout. Most of these words mean what you'd guess they mean; a few have specific TP Studio analogues worth pinning down once.

| Term | Meaning | TP Studio analogue |
| --- | --- | --- |
| **UDE** — Undesirable Effect | A symptom the system produces that nobody wants. The starting point of a CRT. | Entity type `undesirableEffect`, red stripe. |
| **Root Cause** | A terminal cause at the bottom of a CRT — the leverage point. | Entity type `rootCause`, amber stripe. |
| **Effect** | An intermediate node — caused by something, causing something else. | Entity type `effect`, neutral grey stripe. |
| **Injection** | A change you propose to make. The hypothesis you'd test. | Entity type `injection`, emerald stripe. |
| **Desired Effect** | What the system would produce instead, after the injection lands. | Entity type `desiredEffect`, indigo stripe. |
| **Assumption** | A claim that an arrow in the diagram depends on — and that someone could plausibly challenge. | Entity type `assumption`, violet stripe; surfaces in the AssumptionWell on EC docs. |
| **CLR** — Categories of Legitimate Reservation | The six discipline-checks that distinguish a good causal claim from a sloppy one. | The validator system; warnings surfaced in the inspector. |
| **Core Driver** | The root cause that ladders up to the most UDEs. The constraint, in CRT form. | The reach-badge value; the `Find core driver(s)` palette command. |
| **EC** — Evaporating Cloud | A 5-box conflict diagram showing why a chronic problem is *held in place* by a real tension between two real needs. | Diagram type `ec`. |
| **CSF** — Critical Success Factor | A must-be condition for a Goal. The middle layer of a Goal Tree. | Entity type `criticalSuccessFactor`. |
| **NC** — Necessary Condition | A sub-condition feeding a CSF. The lower layer of a Goal Tree. | Entity type `necessaryCondition`. |
| **AND group** | A set of causes that are individually necessary but only jointly sufficient. Rendered as a junctor circle in TP Studio. | The `andGroupId` field on edges; JunctorOverlay renders it. |
| **Sufficiency vs. necessity** | A cause is *sufficient* if it alone produces the effect; *necessary* if the effect can't happen without it. | Edge `kind: 'sufficiency'` vs. `'necessity'`. |
| **CRT** — Current Reality Tree | The "Why is it this way?" diagram. Bottom-up causality. | Diagram type `crt`. |
| **FRT** — Future Reality Tree | The "What would it look like solved?" diagram. Same causal model, different starting node — an injection instead of a root cause. | Diagram type `frt`. |
| **PRT** — Prerequisite Tree | "What's in our way?" The obstacles between current and future, paired with intermediate objectives. | Diagram type `prt`. |
| **TT** — Transition Tree | "How do we get there?" Action / precondition / outcome triples. | Diagram type `tt`. |
| **S&T** — Strategy & Tactics Tree | A deployment decomposition; each node is a 5-facet card (Necessary Assumption, Strategy, Parallel Assumption, Tactic, Sufficiency Assumption). | Diagram type `st`. |
| **Verbalisation** | Reading a diagram aloud, edge by edge, in natural language. The discipline that catches what scanning silently misses. | The Verbalisation Strip; the walkthrough overlay; the reasoning narrative export. |
| **Browse Lock** | A read-only mode you turn on before sharing or demoing the doc to prevent accidental edits. | The lock icon in the TopBar; the `browseLocked` flag. |

## Why a tool

You can do a CRT on paper. You can do an EC on a whiteboard. Practitioners have done so for decades. The reason a tool helps is *iteration*.

A CRT done well is not the diagram you draw on Monday. It is the diagram you have on Friday — after you've moved entities around five times, deleted three you thought were causes but turned out to be re-statements of the UDE, found the cloud that the conflict was hiding behind, added the assumption you didn't realize you were making, run the verbaliser and caught the gap, captured a revision, branched to explore an alternative, compared the two side by side, and came back to the original.

A tool — any tool — collapses the marginal cost of those revisions. Whiteboards have erasers, but erasers don't preserve the prior state. PowerPoint preserves state but punishes restructuring. A purpose-built TOC canvas lets you treat the diagram as something *you're allowed to be wrong about*, repeatedly, cheaply.

TP Studio is one such canvas. Where comparable practitioner guides have assumed Flying Logic, this book assumes TP Studio. Most of what follows would transpose to another canvas with light edits. What is specific to TP Studio is mostly *which palette command you press*, not *what you're doing when you press it*.

## What's next

The next chapter ([Your first canvas](02-your-first-canvas.md)) is the 30-minute tool tour. After that, [Chapter 3 — Reading a diagram](03-reading-a-diagram.md) covers the notation: causality conventions, edge polarity, AND / OR / XOR, the CLR. Then Part 2 opens with the Current Reality Tree, which is where the real work begins.

🔁 **Chain to next:** orient yourself to the surface, then learn to read what you'll later draw, then start drawing.

---

→ Continue to [Chapter 2 — Your first canvas](02-your-first-canvas.md)
