# TP Studio — external TOC/TP source review (feature candidates)

**Status:** parked analysis (no code changed). These are *proposals for Dann to
review*, not committed work. Cross-checked against `TP_BASICS_GAP_ANALYSIS.md`
(Oded Cohen) and the live `src/` tree so nothing already shipped is re-proposed.

**Reviewed:** 2026-06-06 (Session 179). Method: seven sources mined in parallel,
every candidate then filtered against an authoritative capability inventory of
the codebase.

> **Headline:** TP Studio is *extremely* complete against the classic TP canon —
> the entire Cohen "TP Basics" arc (gaps #1–#8) shipped in Sessions 154–163, and
> the guided **CLR edge-scrutiny stepper**, `Entity.attributes`, back-edges,
> Browse Lock, performance anchors, and the Core-Driver/UDE-reach analysis are
> all already present. The remaining opportunities cluster in **two cheap, novel
> themes** plus a handful of bigger strategic bets.

---

## The sources (what each is, how accessible)

| # | Source | Accessibility | Net value |
|---|---|---|---|
| 1 | **Mabin & Cavana 2024, *System Dynamics Review* (DOI 10.1002/sdr.1768)** — a framework combining TOC TP with qualitative System Dynamics | Paywalled (402); abstract via RePEc mirror + SD canon | **Highest novelty** — the SD lens (feedback-loop semantics) is genuinely new |
| 2 | **Flying Logic — "How to create a CRT"** + FL docs | Public, fully read | High — the canonical commercial TP tool; UX/feature parity ideas |
| 3 | **a-dato — "A deep dive into TOC TP"** | Public but thin/introductory | Medium — value is the *execution/facilitation* framing (a-dato is a CCPM vendor) |
| 4 | **Mabin, TOCICO 2013 "TP Basics" (PDF)** | Scanned-image PDF, no text layer; reconstructed from TP/CLR canon | Medium — overlaps Cohen heavily; residue is CLR *communication* nuance |
| 5–7 | **3× Scribd CRT docs** (Abstract of TOC&TP Tools; Building a CRT; CRT presentation) | Login-walled; reconstructed from Dettmer-lineage canon | Medium — concrete CRT build heuristics expressible as soft warnings |

Honesty note: sources 1, 4, 5–7 were not directly readable. Their findings are
reconstructed from the well-documented TOC/SD canon those documents teach from,
and are labelled as such below. The *ideas* are sound regardless of provenance;
treat the attributions as "the kind of thing this source emphasises."

---

## Filtered out — already shipped (verified in code)

Recorded so the rigor is visible. Several agents proposed these before the
cross-check; all are present today:

- **Guided CLR scrutiny / "scrutinize this edge" walkthrough** → `clrScrutiny.ts`
  + `EdgeScrutinyDialog.tsx` (Session 160). *This was the single most-cited "gap"
  across sources — and it's done.*
- **User-defined structured attributes on entities** → `Entity.attributes`
  (B7), incl. an `owner` path.
- **Back-edge / vicious-loop construct** → `backEdges.ts` + `backEdgeLoop.ts`
  (distinct visual, silences the cycle CLR).
- **Edge polarity / negative weight** → `Edge.weight` (positive/negative/zero).
- **Gap-analysis performance framing** → `performanceAnchors` (Session 163).
- **PRT → ordered project-plan CSV** (Session 162); **TT need / working-assumption
  fields** (Session 158); **Injection Flower** (Session 161); **NBR trim**
  (Session 157); **cloud progression + U-Shape cross-doc links** (154–156).
- **Alt+Enter multi-line titles, Browse Lock, low-zoom hover card, AND/OR/XOR,
  EC verbalisation, all 7 CLR categories + tautology + cycle.**

---

## Theme A — Loop semantics enrichment (the System-Dynamics lens)

*Sources: Wiley SDR #1/#3, Flying Logic #3. Multiple sources converge here — high
confidence.* TP Studio already has back-edges, but treats a cycle as a single
"acknowledged loop." System Dynamics offers a richer, **acyclic-model-safe**
vocabulary that can ride entirely on metadata we already store.

| Candidate | Tag | Size | Notes |
|---|---|---|---|
| **A1. Loop-polarity readout (R / B)** | GAP | **S** | Compute the product of `edge.weight` around each detected cycle → **Reinforcing (R)** or **Balancing (B)** badge on the back-edge arc. Pure derived read — reuses `backEdges.ts` + existing weights. **The standout cheap-novel idea.** |
| **A2. Diagram-type-aware loop CLR** | PARTIAL | **S** | Extend the cycle rule: a CRT R-loop = *vicious* (problem if not acknowledged); an FRT R-loop = *virtuous* (intended — info, not warning); an FRT B-loop = "a self-limiting injection — intentional?". `diagramType` is already in validators. |
| **A3. Loop naming + behavior-over-time note** | GAP | **M** | Right-click a back-edge → "Name this loop" ("Burnout spiral (R)") + an optional free-text *dynamic narrative* ("escalates over 3–6 months…"). Brings the SD communication idiom in without simulation. |
| **A4. Delay marker on edges** | GAP | **S** | `Edge.delay` (bool or short/med/long) → `//` glyph mid-arc. CLR hint: "a reinforcing loop with no delay escalates instantaneously — did you mean a lag?" |

**Out of bounds (philosophically risky):** stocks/flows, BOT *simulation*, and
quantitative loop dynamics would abandon the acyclic-sufficiency model. Keep loop
work at the *annotation* level, never the *simulation* level.

---

## Theme B — CRT build-quality soft warnings (cheap, on-brand)

*Sources: Scribd CRT docs (Dettmer canon), Mabin wording-pitfall.* Each is a new
soft CLR-style warning that slots into the existing validator registry and reuses
caches we already compute (`udeReachCounts`, `coreDriver.ts`, `graphReach.ts`,
`clarity`). This is the most idiomatic batch for TP Studio.

| Candidate | Tag | Size | Notes |
|---|---|---|---|
| **B1. `crt-dead-branch`** | GAP | **S** | A non-UDE entity with zero forward UDE-reach → "doesn't lead to any UDE; prune or archive." Reuses `udeReachCounts`. Implements Dettmer's "trim the tree." |
| **B2. `crt-ude-no-upstream`** | GAP | **S** | A `ude` with no incoming causal edge → "tree is structurally incomplete here." More precise than the generic disconnect check. |
| **B3. `crt-low-core-driver-coverage`** | GAP | **S** | Top core driver explains < ~50% of UDEs → "the tree may have two independent clusters." Reuses `coreDriver.ts` (`reachedUdeCount`). |
| **B4. Two-equal-root-causes → spawn-EC nudge** | PARTIAL | **S** | When `findCoreDrivers` returns ≥2 near-equal candidates → "a hidden conflict may sit at the bottom — spawn an Evaporating Cloud?" Reuses the existing EC-spawn mechanic. |
| **B5. UDE wording lint** | PARTIAL | **S** | Extend `clarity`, scoped to CRT `ude`: flag absence-of-solution phrasing ("lack of / no X / insufficient / absence of"), noun-phrase (no verb), and "X and Y" double-effects. Gentle hints, not errors. |
| **B6. `crt-ude-count` range** | PARTIAL | **S** | < 3 UDEs ("too few to trust a system-wide root cause") or > ~15 ("scope too wide — split the tree"). The checklist mentions a range; no warning enforces it. |

These six are individually tiny and collectively a strong, coherent "CRT
build-assist" session.

---

## Theme C — CLR as a communication protocol

*Source: Mabin (TP Basics).* The CLR isn't only logical validation — it's a
*non-threatening disagreement vocabulary* ("I have a **causality-existence**
reservation" rather than "you're wrong"). TP Studio has review comments and the
scrutiny stepper, but comments can't carry a CLR category.

| Candidate | Tag | Size | Notes |
|---|---|---|---|
| **C1. CLR-labelled review comments** | GAP | **S** | Optional CLR-category dropdown on a comment; render the category as a badge; filter comments by category. Reuses the comments feature; surfaces the *communication* function of CLR. |
| **C2. Logic-type consistency lint** | GAP | **S** | Flag an edge whose `kind` (sufficiency/necessity) contradicts the diagram's primary logic ("this CRT is sufficiency logic — does this read as *if A then B*?"). Catches the classic novice mix-up. |

---

## Theme D — Workflow & analysis ergonomics

| Candidate | Tag | Size | Source | Notes |
|---|---|---|---|---|
| **D1. Select-all-successors / -predecessors** | GAP | **S** | FL #4 | Transient flood-select downstream/upstream of an entity (right-click + palette). Reuses `reachableForward/Backward`. Speeds Core-Driver tracing. Confirmed absent (`collapse downstream` ≠ selection). |
| **D2. Per-entity icon slot** | PARTIAL | **S–M** | FL #11 | Class-level icons exist; an optional per-entity icon enriches workshop vocabulary. |

---

## Theme E — Strategic / facilitation bets (bigger, more opinionated)

These are genuinely novel but larger or more debatable in scope — present for
Dann's pick, not recommended as a first slice.

| Candidate | Tag | Size | Source | Notes |
|---|---|---|---|---|
| **E1. System-archetype pattern library** | GAP | **L** | Wiley #2 | 5–6 named CRT/FRT archetypes — "Fixes that Fail", "Escalation", "Limits to Growth", "Shifting the Burden", "Eroding Goals". Cross-methodology diagnostic vocabulary; pairs with Theme A. Content-heavy. |
| **E2. Layers-of-Resistance review panel** | GAP | **M** | a-dato | The 6 buy-in layers as a reviewer checklist, each linked to the TP tool that addresses it (L1→CRT, L3→FRT, L4→NBR, L5→PRT). Operationalises buy-in inside the review workflow. |
| **E3. 3-Cloud rapid-diagnosis wizard** | GAP | **S–M** | a-dato | Guided 3-UDE → 3 ECs → "consolidate to core cloud". A fast on-ramp alternative to a full CRT; reuses the EC wizard + cloud progression. |
| **E4. T/I/OE impact tags + heatmap** | PARTIAL | **S/M** | a-dato | Lightweight Throughput/Inventory/Operating-Expense directional tags (↑/→/↓) on injections/IOs + optional heatmap overlay. The attribute mechanism exists (`Entity.attributes`); the *structured tag set + overlay* is the novel part. Bridges to sponsor language. |
| **E5. Long-arrow / missing-step warning** | GAP | **M** | Mabin + Scribd | Flag a sufficiency edge that skips too many logical levels. Higher false-positive risk; keep as a dismissible hint. |
| **E6. Reader / trainee mode** | PARTIAL | **M** | a-dato | A simplified, edit-hidden view with "how to read this" tooltips + "challenge this arrow". Overlaps Browse Lock + presentation + the scrutiny stepper — incremental. |
| **E7. Leverage-point flag** | GAP | **S** | Wiley #7 | `entity.isLeveragePoint` badge. Marginal — TOC's constraint is *already* the leverage point (root-cause/core-driver), so largely redundant. |

---

## Explicitly out of scope / known-rejected

- **Confidence / weight *propagation*** and Flying Logic's probabilistic operators
  (Sum, Product, Proportion, MIN/MAX…) — the deliberate won't-build (H5).
- **Stocks & flows, BOT simulation, quantitative SD** — conflicts with the
  acyclic-sufficiency model.
- **DBR / buffer management / CCPM scheduling / Gantt / MS Project** — operational
  TOC, not TP diagramming (the thin end is already served by the task-tracker CSV).
- **Multi-user collaborative construction** — out of scope per Session 135
  (local-first, single-user).

---

## Recommendation

The cheapest high-value, most on-brand next slice is a **two-theme batch** —
everything reuses machinery that already exists:

1. **Theme A1 + A2 — loop-polarity readout (R/B) + diagram-type-aware loop CLR.**
   The standout novel idea (the SD lens), genuinely surprising, and tiny because
   it derives from `edge.weight` + the existing cycle detection. Makes "is this
   loop a feature or a bug?" answerable at a glance.
2. **Theme B (B1/B2/B3 first) — the CRT build-quality warning batch.** Four to six
   tiny soft warnings reusing `udeReachCounts` / `coreDriver` / `clarity`. Pure
   TP-Studio idiom; high facilitation value; near-zero new infrastructure.

**C1 (CLR-labelled comments)** and **D1 (select successors/predecessors)** are
strong cheap follow-ons. The Theme-E bets (especially **E1 archetype patterns**
and **E3 the 3-Cloud wizard**) are the more strategic, higher-effort options if a
bigger push is wanted.
