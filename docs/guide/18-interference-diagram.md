# Chapter 18 — Interference Diagram

### *What's stealing what we want?*

> **🎯 What this process is for**
> An Interference Diagram (ID) is the fast, intuitive route to "what to change" — it lists everything getting in the way of something you want *without* building a full Current Reality Tree. You put the objective in the centre and surround it with the *interferences* that block it, optionally quantifying the time each one costs, and pair each with the fix that removes it. It answers, in an afternoon rather than a week: "What's stopping us, and where do we start?"

## The premise

The Thinking Processes you've met so far are logic tools. A CRT connects undesirable effects with sufficiency; an Evaporating Cloud surfaces a conflict with necessity; a Goal Tree decomposes a goal into conditions. They are rigorous, and rigour takes time — a real CRT can take a team days of careful, disputed work to build well.

Sproull and Nelson's *Epiphanized* (Appendix 4) documents a lighter tool that the TOC community had used for years without writing down: the Interference Diagram, first drawn by Bob Fox at the TOC Center in the mid-1990s. Its insight is disarmingly simple. When five teams analyse the same problem and each produces a *different* "core problem," and each is plausible, what they've actually surfaced isn't five competing root causes — it's a **list of interferences**, all of them real, all of them worth removing. Rather than force that list through the single-answer discipline of a CRT, the ID keeps it as a list and gets to work.

This is why the ID's arrows are unlike every other diagram in this book: **they carry no logic.** An arrow from an interference to the objective doesn't assert "this is sufficient to cause that" or "this is necessary for that" — it just says "this gets in the way of that." The direction is intuition, not inference. Because there's no logical claim on the arrows, none of the Categories of Legitimate Reservation apply to an ID; you won't be asked to defend causality or check for additional causes. That's the trade you're making: you give up logical rigour to gain speed, and you get it back later when you carry the ID forward into a Prerequisite Tree or a Goal Tree.

The ID also has a distinctive shape. It isn't a tree with an apex — it's a **hub and spokes**. The objective sits at the centre; the interferences radiate outward around it; each interference's fix sits one ring further out. TP Studio always draws an ID this way (the flow/radial layout toggle other diagrams offer is hidden here — a radial ID *is* the diagram), so the picture you build on the canvas is the picture the book draws.

## The method, neutral of tool

The book describes two ways to use an ID. Both share the same four moves; they differ only in what sits at the hub.

1. **Put the objective at the centre.** State the one thing you want more of. For *constraint exploitation*, it's a specific constraint: "more throughput from the XYZ line." For *strategy development*, it's a higher-level goal that has to matter to everyone in the room: "increase yearly revenue." Keep it short.
2. **Surround it with interferences.** Ask "what stops us from getting more of that?" and write each answer as a spoke. Let the people who do the work name them — the operators at the constraint, the cross-functional team for a strategy. Keep the statements short and honest, and filter personal gripes from real system interferences.
3. **Quantify the time each steals** — for the constraint case. Estimate the minutes per day (or per week) each interference costs, in consistent units. This is the step that turns a brainstorm into a decision: it lets you rank the interferences by impact and attack the *vital few* rather than the trivial many. For a strategy ID the interferences are usually event-driven rather than time-driven, and you can skip the numbers.
4. **Pair each interference with a fix.** For every interference ask "what must exist so this is no longer a problem?" That answer is the *intermediate objective* — the injection that removes or reduces the interference. One fix per interference.

> **💡 Practitioner tip**
> Step 3 is where an ID earns its keep. A list of interferences with no numbers invites everyone to argue for *their* pet problem; a list with minutes attached ends the argument — the Pareto ranking shows the top two or three interferences accounting for most of the lost time, and that's where you start. Some interferences can't be removed (breaks and lunch are owed to people); for those, ask whether you can *off-load* the constraint during them (a relief operator) rather than eliminate them.

## The worked example

We'll build the constraint-exploitation ID from the book — the J40 tank line whose throughput is too low.

`Cmd+K → New diagram…` → Interference Diagram. The canvas opens radial with a single central objective node. Rename it to **More throughput from the J40 tank line**.

### Step 1 — Surround it with interferences

Double-click empty canvas to add each interference the operators name. TP Studio's default type on an ID is `obstacle` (an interference *is* an obstacle here), so each new node is already the right type:

- *Interference:* Operators search and wait for the parts they need.
- *Interference:* The constraint sits idle through lunches and breaks.
- *Interference:* Operators walk to supply to sign out tools.
- *Interference:* Reworking mold-related surface defects.
- *Interference:* Waiting for engineering to update the run specs.

Connect each interference to the central objective (interference → objective). The canvas fans them out around the hub.

> **🛠 How TP Studio helps**
> Select any node and the floating toolbar offers **Mark as interference** and **Mark as fix** to retype nodes you captured as plain effects, and **Add fix for this interference** on an interference — it mints the paired intermediate objective and wires it up in one click (the same working set as a Prerequisite Tree). All three also live in `Cmd+K`.

### Step 2 — Quantify the time each steals

Select each interference and, in its inspector, fill in **Time lost** — the minutes per day it costs. From the book's shop-floor estimates:

- Searching and waiting for parts — 90
- Lunches and breaks — 60
- Walking to supply for tools — 45
- Mold-defect rework — 30
- Waiting for spec updates — 30

The number rides a reserved attribute, so it round-trips through export and share links like everything else on the canvas.

### Step 3 — Rank the interferences

`Cmd+K → Rank interferences by impact`. TP Studio highlights every interference and reads them back in descending order of lost time, each with its share of the total — the Pareto move. Parts-related interference dominates, so that's where the biggest win is. To take the table into a meeting, `Export… → Interference ranking (CSV)` writes one row per interference (rank / interference / minutes / % of total / paired fix).

### Step 4 — Pair each interference with a fix

For each interference, add the injection that removes it (select the interference → **Add fix for this interference**):

- Parts not available → *Stage kitted parts at the line before each run.*
- Idle through breaks → *A relief operator covers breaks and lunch.*
- Walking for tools → *A shadow-board tool kit lives at the machine.*
- Mold-defect rework → *Refurbish the mold surfaces on a PM schedule.*
- Waiting for specs → *Freeze the run specs before the job is scheduled.*

TP Studio nudges you here: an interference with no paired fix raises a soft reservation, because an ID isn't actionable until every interference you intend to attack has a fix. (The only other check on an ID guards the hub — more than one central objective means two analyses are sharing a canvas; give the second its own diagram.)

> **⚠ Common mistake**
> Restating the interference as the "fix." "We wait for parts" → "Don't wait for parts" isn't a fix, it's the interference with a *not* in front of it. The fix is a *state that must exist* — "parts are kitted and staged at the line" — the same discipline the Prerequisite Tree demands of an Intermediate Objective. If your fix column just negates the interference column, you haven't decided anything yet.

> **🛑 When to stop**
> Stop when the interferences are comprehensive enough that the team recognises the real blockers (not when the list is *exhaustive* — there's always one more), every interference you plan to attack has a concrete fix, and — for a constraint ID — the top few interferences by time are clearly identified. You don't need a fix for interferences you've consciously decided to live with; you *do* need to have made that decision out loud.

## Carrying it forward — the ID/IO Simplified Strategy

An ID answers "what to change" fast, but it's a springboard, not a destination. The book pairs it with two follow-on tools, and TP Studio wires both as one-click spawns that mint a new document and leave your ID untouched:

- `Cmd+K → Spawn Prerequisite Tree from this Interference Diagram` turns the hub-and-spoke into a dependency plan: the objective becomes the PRT's apex goal, each interference an obstacle, and each fix the Intermediate Objective that overcomes it. Now you sequence them ([Chapter 7](07-prerequisite-tree.md)).
- `Cmd+K → Spawn Goal Tree from this Interference Diagram (the IO map)` takes the *strategy* route: the objective becomes the Goal and each fix a Critical Success Factor beneath it, seeding the IO map you then decompose into Necessary Conditions ([Chapter 9](09-goal-tree.md)). This is the book's **ID/IO Simplified Strategy** — the ID surfaces the obstacles, the IO map arranges the fixes into the necessity structure that reaches the goal.

> **🔁 Chain to next**
> If you started with a constraint, spawn the **Prerequisite Tree** and sequence the fixes into a plan. If you started with a strategic objective, spawn the **Goal Tree** and build out the IO map. Either way the ID has done its job: it got you from a vague "throughput is too low" to a ranked, fix-paired list of exactly what to change — without a week of tree-building.

> **✏️ Now you try**
> Pick a constraint in your own work — a machine, a queue, a person everyone waits on. Build a constraint-exploitation ID: the constraint at the hub, the interferences that steal its time around it, a **Time lost** estimate on each, and a fix for each. Run **Rank interferences by impact** and look at the top two. Then spawn the Prerequisite Tree and see how little rework it took to have a real plan.
