# TP Studio gap analysis — Oded Cohen, *TOC Thinking Processes: Basics* (TOCICO 2014)

**Status:** parked analysis (no code changed). Source: Oded Cohen, *TOC Thinking
Processes — Basics*, TOCICO 2014 Conference (© TOCICO). This is our own gap
mapping / commentary, not a reproduction of the presentation.

**Reviewed:** 2026-05-31.

## What the source is

Cohen's canonical map of the full TP toolset, framed as a **journey** rather than
a notation reference:

- **Four phases:** *What to change* (current reality) → *What to change to*
  (future reality) → *How to change* (transition) → *How to grow* (POOGI).
- **Spine:** the **U-Shape** (pinpoint the core problem on the down-stroke,
  construct the solution on the up-stroke, hinged on the **PIVOT**) and the
  **three questions**.
- **Engine:** the **Cloud** (Evaporating Cloud) used in escalating forms —
  UDE Cloud → Consolidated Cloud → Core Cloud — sitting at the base of the CRT.

## Already covered in TP Studio (verified against the codebase)

The *primitives* are essentially all present, so the gaps are workflow/meta, not
notation:

| Source element | TP Studio |
|---|---|
| CRT, FRT, PRT, Transition Tree, EC, S&T, Goal Tree / IO, NBR | all 9 diagram types |
| Necessity vs Sufficiency; the "banana" (sufficiency-with-several-causes = AND); OR / XOR | edge kinds + AND/OR/XOR junctors |
| Cloud conflict D↔D′ | mutex edges |
| **All seven CLR categories** — clarity, entity existence, causality existence, cause insufficiency, additional cause, cause-effect reversal, predicted-effect existence (+ tautology, cycle) | `src/domain/validators/*` |
| UDE / DE / Injection / Obstacle / Intermediate Objective / Action / Root cause | `EntityType` |
| S&T necessary / parallel / sufficiency assumptions | shipped Session 135 |
| Assumptions on edges; back-edges (acknowledged loops) | core |

## Gap map

| # | Gap (from the source) | TP Studio today | Suggested addition | Size |
|---|---|---|---|---|
| **1** | **Cloud progression** — UDE Cloud → Consolidated → Core Cloud, and the six cloud *types* (Dilemma, Conflict, UDE, Consolidated, Core, Firefighting) | generic EC; no cloud-type concept | a `cloudType` tag on EC docs + library **patterns** for UDE / Core / Firefighting clouds; later a "consolidate clouds" helper | patterns cheap; consolidation = feature |
| **2** | **The U-Shape spine** — CRT *core problem* → PIVOT → Core Cloud → FRT *injection* → PRT/TrT as one linked journey | each tree is a separate doc/tab; no cross-tree link | a "core problem" flag + **cross-document references** (a CRT's core problem ↔ its core cloud ↔ an FRT injection); a guided three-questions flow | bigger feature |
| **3** | **Injection Flower** — an injection as What/How + its DEs + its NBR(s) + its Implementation Plan | `injection` entities exist, no composite | injection "detail" linking an injection to its DEs, negative branch, and PRT/TrT | medium |
| **4** | **NBR trimming** — surface a negative branch off an injection, add a *trimming* injection | NBR diagram type + edge weights (pos/neg) exist | a "trim this branch" gesture that spawns + links a trimming injection | small–medium |
| **5** | **Gap Analysis framing** — every phase bracketed by *low ↔ high performance measurements* | none | optional performance-measurement anchors on a doc | small (facilitation frame) |
| **6** | **PRT → IO sequencing → project plan** | PRT exists; a CSV "task bridge" exists in history | sequence IOs by dependency → export a plan | medium |
| **7** | **CLR scrutiny *protocol*** (Round One / Round Two interactive review) | categories auto-flag, but no guided "scrutinize this edge" mode | a walk-the-categories review panel on a selected edge | small–medium |
| **8** | **Transition Tree richness** — per-step Need + Working Assumption + Obstacle | TT = Outcome ← (Precondition + Action) | optional per-step need / working-assumption fields | small |

## Out of scope (operational TOC, not TP diagramming)

The **PIVOT internals** — the Five Focusing Steps, constraint types, and **Buffer
Management Analysis** — are execution / DBR tools, not Thinking-Process
diagramming. Leave out unless TP Studio deliberately grows beyond TP.

## Recommendation

TP Studio is remarkably complete against this map; the missing piece is the
**connective tissue** — the Cloud progression (#1) and the U-Shape linkage (#2)
that turn a folder of separate trees into one reasoning journey. Those two are
the heart of the document.

Cheapest high-value start (consistent with the Session-149 EC clouds): **#1 as
patterns** — a *UDE Cloud*, a *Core Cloud*, and a *Firefighting (Lieutenant)
Cloud* in the library, plus an optional `cloudType` tag. The bigger, more
strategic piece is **#2** (cross-tree linkage / the three-questions journey).
