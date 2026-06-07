# Chapter 13 — The CLR — your validation conscience

> *The Categories of Legitimate Reservation are the discipline checks Goldratt taught for evaluating a causal claim. TP Studio surfaces them automatically as warnings. They are reservations a thoughtful colleague would raise. They are not errors.*

## The classical map

Before diving into how TP Studio implements them, here is the classical reference — the eight-box layout Dettmer's *The Logical Thinking Process* uses to teach the CLR, each box pairing the category's question with a tiny example diagram. Cards mirror TP Studio's canvas: amber stripe for causal nodes, neutral grey for effects, red-dashed for the missing element each category catches.

<!-- CLR_MAP -->
<!-- NOTE for editors: the placeholder above is NOT missing content. The book
     builders (scripts/build-book-pdf.mjs and build-book-epub.mjs) expand it at
     render time into the eight-box CLR figure, generated from the single source
     scripts/lib/clrMapHtml.mjs — so it renders at vector quality in the PDF and
     the Kindle EPUB. Preview locally: `node scripts/render-clr-map-native.mjs`
     (writes a gitignored PNG under docs/guide/diagrams/). Guarded by
     tests/scripts/clrMap.test.ts. -->

This map is the territory; TP Studio's warnings are the tools that walk it. Goldratt's original six are the first six boxes; *Predicted Effect* and *Tautology* are Dettmer's additions, used mainly when a stated cause is intangible (you cannot observe it directly, only its consequences).

## The six categories

Goldratt named six. The operationalization into validator-style rules that practitioner tools surface — what TP Studio does — owes a debt to William Dettmer's *The Logical Thinking Process* (2007), which formalized the categories for everyday use. Listed here in order of where they typically bite first as you draft a diagram:

1. **Clarity.** The reader can't tell what you mean. An empty title, a verb-less noun phrase, an abstraction so generic it could be glued to any tree.
2. **Entity existence.** You're asserting a state of the world. Is that state actually observable? "Engineering velocity is dropping" lives or dies on whether you can show it.
3. **Cause-effect existence.** The two entities exist; you've drawn an arrow between them; does the arrow correspond to anything in reality? "Engineering velocity dropped because Mercury went retrograde" fails here, however clean the diagram looks.
4. **Cause sufficiency.** This cause alone — without anything else lined up alongside it — produces this effect? Or does the effect require a co-cause that you haven't drawn? The category where AND-groups get born.
5. **Additional cause.** Is there a *different* cause that would also produce this effect? Two roads to the same destination — modelled with OR-junctors, often missed by single-path thinking.
6. **Cause-effect reversal.** Run the same arrow the other way around; does it still make sense? If the answer is "actually, maybe even more sense," you've inverted the causal direction. The classic trap inside a B2B sales org: "deals are slow because morale is low" — until someone points out the direction is "morale is low because deals are slow."

TP Studio's validator system implements rules drawn from each of these categories. The `Warnings` list in the Inspector surfaces them per-entity / per-edge. The `Start CLR walkthrough` palette command iterates them one at a time.

## How TP Studio surfaces them

Each validator carries:

- A **tier**: `clarity`, `existence`, or `sufficiency` — TP Studio's three groupings, not the eight teaching categories above. The tier governs how the Warnings list groups the rule (under **CLARITY** / **EXISTENCE** / **SUFFICIENCY** headers) and the order it appears in the walkthrough wizard.
- A **diagram-type scope**: most rules fire only on specific diagram types (e.g., `ec-missing-conflict` is EC-only; `complete-step` is TT-only).
- A **trigger predicate**: a pure function over the doc that returns the set of entities/edges to fire on.
- Optionally, a **one-click action**: a `WARNING_ACTIONS` registry entry that resolves the warning. Example: the `convert-extra-goals-to-csfs` action on the `goalTree-multiple-goals` warning.

The full list — every implemented rule, its tier, and the diagram types it fires on — is in [Appendix C](appendix-c-clr-rules.md).

**Beyond the classical six.** Most rules map onto a category Goldratt or Dettmer named. TP Studio adds two families the classical list never did — pure build-quality checks a tool is uniquely placed to compute:

- **CRT build-quality** (CRT only) — *is the tree well-formed?* A UDE with no cause feeding it; a branch that leads to no UDE; a UDE count outside the rough 3–15 band; a leading root cause that explains fewer than half the UDEs; two root causes tied for the lead (a hidden conflict — with a one-click *Spawn Evaporating Cloud*); or a UDE phrased as the absence of a solution.
- **System-dynamics lint** (CRT / FRT / TT / NBR, where loops live) — `logic-type-mismatch` (an edge whose kind fights the diagram's logic), `loop-polarity` (a balancing loop where you'd expect a reinforcing one), `long-arrow` (a jump across ≥ 3 causal levels), and `reinforcing-no-delay` (a feedback loop with no time lag).

Neither family is a textbook CLR category — they're the reservations the tool can raise automatically, leaving the contextual judgments to you.

## Reading warnings

Click any entity with an open warning. The Inspector's Warnings section lists them grouped under their tier — **CLARITY**, **EXISTENCE**, **SUFFICIENCY** — each with a one-line explanation; some carry a "Fix" button when a one-click action is available.

![CLR warnings visible in the Inspector for an entity with no incoming causes](screenshots/chapter13-clr-warnings-visible.png)

## The walkthrough

`Cmd+K → Start CLR walkthrough` opens a modal that iterates every open warning, one at a time, with **Resolve** / **Open in inspector** / **Dismiss** actions. Useful for ratcheting through a complex diagram's warnings without manually clicking each entity.

The walkthrough is scope-limited to *open* warnings — once you dismiss a warning, it doesn't reappear unless the underlying condition changes. That makes the walkthrough a *clearing* gesture: run it before declaring a diagram done; if it's empty, you've considered every reservation.

## Scrutinizing a single edge

The walkthrough clears what the validators *fired*. But absence of a warning is not absence of a reservation — a rule fires only when it can detect its trigger condition, and most of the CLR is too contextual for a predicate to catch. An edge can be warning-free and still be sloppy. The complementary move is to take one claim and interrogate it against the whole CLR by hand.

Select an edge and run **"Scrutinize this edge (walk the CLR questions)"** from the palette, or press the **"Scrutinize against the CLR"** button in the edge inspector. Either opens a walk through all eight canonical categories — Clarity, Entity existence, Causality existence, Cause sufficiency, Additional cause, Cause–effect reversal, Predicted-effect existence, Tautology — one at a time, *including the categories nothing flagged*. Each step states the category as a question, shows any warning the validators did raise on that edge, and gives you a checkbox to tick as you genuinely consider it. The button is read-only, so it works under Browse Lock — you can scrutinize a colleague's diagram in a review without touching it. Where the walkthrough is a clearing gesture across the diagram, scrutiny is a *deepening* gesture on one edge: it forces you to ask every reservation of a single claim, not just the ones a rule happened to notice.

## The long-arrow check and the missing-step prompt

One failure mode doesn't look like a failure: a clean arrow with no warnings, running across too many causal levels at once. An arrow from "we cut the QA budget" straight to "customers churn" is technically an existence claim — it asserts a cause–effect link — but it's almost certainly hiding one or more unstated intermediate effects. Goldratt called these *long arrows*, and Dettmer flags them as the classic *additional cause / missing step* concern: the stated cause may be necessary, but the path from it to the stated effect passes through at least one step nobody wrote down.

A new EXISTENCE-tier validator flags sufficiency arrows that skip three or more causal levels — measured by the shortest path between the two entities through any already-drawn intermediate nodes. When it fires, the Inspector shows an amber **"Arrow may skip intermediate steps"** warning on the edge. A **"Insert a step"** one-click action is available: it splices a blank intermediate entity into the middle of the over-long edge, wires the two shorter arrows in its place, and leaves the new entity selected and ready to name. You're not told what the missing step is — that's your job — but the seam is opened for you.

For the QA budget example, the check flags the single arrow and you insert the missing middle. A plausible fill: *"Escaped defects rise"* sits between the budget cut and *"customer trust erodes"*, which then connects forward to churn. Two shorter, more defensible arrows replace the one long leap.

**Companion check — reinforcing loop with no delay.** A second validator in the same tier watches for reinforcing feedback loops (A → B → A cycles, or longer) where no edge in the loop is marked as delayed. A reinforcing loop with no time lag reads as escalating instantly — which is almost never true and almost always a sign that one of the links needs a delay marker. When the check fires it flags the loop with a **"Reinforcing loop — consider adding a delay"** warning and highlights the edges involved. Mark one edge as delayed (the delay toggle is in the edge inspector) to resolve it.

## Dismissing warnings

Two ways to dismiss:

- **Resolve** — fix the underlying condition. The warning stops firing on its own.
- **Dismiss with explanation** — keep the condition, but record in the entity's `description` *why* you're accepting the reservation. The walkthrough stops surfacing this one. The audit trail lives in the description.

Don't dismiss without writing the explanation. A dismissed warning with no rationale is a debt you'll pay later when someone reads the diagram and asks "why does this UDE have no causes?"

## Sidebars

> **🛠 How TP Studio helps**
> - **Per-entity / per-edge Warnings list** in the Inspector.
> - **`Cmd+K → Start CLR walkthrough`** — modal that iterates open warnings.
> - **One-click actions** on a subset of warnings (e.g., `convert-extra-goals-to-csfs`).
> - **Tier grouping** in the warnings list: warnings sort under **CLARITY → EXISTENCE → SUFFICIENCY** headers.
> - **Dismissibility** — every warning can be dismissed; dismissals don't recur until the underlying state changes.
> - **`Scrutinize this edge (walk the CLR questions)`** — walks one edge through all eight CLR categories as questions, including the ones nothing flagged; read-only, so it works under Browse Lock.
> - **Long-arrow check** — EXISTENCE-tier validator flags sufficiency arrows spanning ≥3 causal levels; "Insert a step" action splices a blank intermediate entity into the over-long edge.
> - **Reinforcing-loop delay check** — flags reinforcing loops where no edge carries a delay marker.

> **💡 Practitioner tips**
> - **Walk-through *before* you present.** A reader will hit the warnings if you don't.
> - **Treat warnings as suggestions, not commands.** The CLR is a discipline framework; it doesn't always know your context. Apply judgment.
> - **The clarity tier is the most forgiving and most pedagogical.** If you're learning, work the clarity warnings until they're empty before tackling the higher tiers.

> **⚠ Common mistakes**
> - **Dismissing without explanation.** Each dismissal is a future-self bug if the rationale isn't recorded.
> - **Treating all warnings as equal.** The three tiers are deliberately ordered. An `existence` warning is structural — a missing entity or an unreal link; a `clarity` warning might just be a typo.

🔁 **Chain to next:** the CLR is the validation conscience. Iteration is the *building* conscience — revisions, branches, side-by-side compare are how a diagram improves over time.

---

→ Continue to [Chapter 14 — Iteration](14-iteration-revisions-branches.md)
