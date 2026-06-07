# Appendix C — The CLR rules in detail

> *One entry per implemented validator. Each rule carries a **tier** (`clarity`, `existence`, or `sufficiency`) and a set of diagram types it fires on. Tier governs how the Inspector's Warnings list groups the rule — under **CLARITY**, **EXISTENCE**, or **SUFFICIENCY** headers — matching how TOC practitioners talk through reservations in a workshop.*

TP Studio implements **three tiers**, not the classical eight CLR categories one-for-one. The categories are a *teaching* taxonomy (see [Chapter 13](13-the-clr.md)); the tiers are how the tool *groups what it can detect automatically*. Many rules map onto a classical category (`cause-effect-reversal` ↔ Cause-effect reversal); others are structural build-quality checks the classical list never named (`crt-dead-branch`, `long-arrow`). A rule fires only when a pure predicate can detect its trigger — most of the CLR is too contextual for that, which is why **[edge scrutiny](13-the-clr.md)** exists to walk every category by hand.

## Structural rules (every diagram type)

These read titles, edge endpoints, and connectivity only — they assume nothing about which entity types exist, so they run on all nine diagram types (CRT, FRT, PRT, TT, EC, Goal Tree, S&T, Freeform, NBR).

| Rule | Tier | Fires on | Catches |
| --- | --- | --- | --- |
| `clarity` | clarity | Any non-note entity | A title over 25 words (tighten to one statement) **or** a title ending in `?` (make it declarative). |
| `entity-existence` | existence | Any entity | An empty title — the slot asserts a state of the world but doesn't say what. |
| `causality-existence` | existence | Each edge | A standing once-per-edge reservation: does this drawn arrow correspond to something real? Resolve it once you're confident in the link. |
| `tautology` | clarity | Each edge | A cause that merely restates its effect — a relabel, not a causal step. |
| `indirect-effect` | existence | Converging edges | Too many causes pointing straight at one effect — the *breadth* twin of `long-arrow`; a consolidating intermediate effect is probably missing. |

> The former `cycle` rule was retired in Session 176: the auto-detected back-edge colour now signals a loop on the canvas, so a separate warning was redundant. A defended loop is tagged as a back-edge and stops drawing CLR fire.

## Diagram-specific rules

### CRT — Current Reality Tree

| Rule | Tier | Catches |
| --- | --- | --- |
| `cause-sufficiency` | sufficiency | A sufficiency edge that probably needs a co-cause — where AND-groups are born. |
| `additional-cause` | sufficiency | A UDE that a *different*, independent cause could also produce (model with an OR-junctor). |
| `cause-effect-reversal` | existence | An edge whose typed reading suggests the arrow points the wrong way. |
| `external-root-cause` | clarity | A root cause flagged Locus = **External** — push one level deeper; the real driver is usually within control or influence. |
| `crt-ude-count` | clarity | A CRT scoped to too few (< 3) or too many (> 15) UDEs. |
| `crt-ude-no-upstream` | existence | A UDE with no incoming cause — the tree is incomplete there. |
| `crt-dead-branch` | clarity | A non-UDE entity that leads to no UDE — trim it, or connect it into the chain. |
| `crt-low-core-driver-coverage` | clarity | The leading root cause explains fewer than half the UDEs — the tree may hold two independent clusters. |
| `crt-tied-core-drivers` | clarity | Two or more root causes tie for the most UDEs — a hidden conflict may sit beneath. Carries a one-click **Spawn Evaporating Cloud** action. |
| `crt-ude-wording` | clarity | A UDE phrased as the *absence of a solution* ("lack of…", a leading "No…") rather than an observable effect. |

### FRT — Future Reality Tree

| Rule | Tier | Catches |
| --- | --- | --- |
| `cause-sufficiency` | sufficiency | An injection/cause that probably needs a co-cause. |
| `additional-cause` | sufficiency | A desired effect a different cause could also produce. |
| `predicted-effect-existence` | existence | An injection whose predicted *second* effect should be observable somewhere — confirm it exists, or the claim is suspect. |

### NBR — Negative Branch

Runs the FRT-style set (a negative branch is an FRT subtree that ends in UDEs): `cause-sufficiency`, `additional-cause`, and `predicted-effect-existence` (all as above), plus the cross-diagram lint below.

### TT — Transition Tree

| Rule | Tier | Catches |
| --- | --- | --- |
| `complete-step` | sufficiency | An Action whose edge to its Outcome has no precondition feeding it — what existing condition lets the action produce the outcome? |
| `tt-action-locus-unset` | clarity | An Action with no **Locus** set (control / influence / external) — state it in a way you can act on. |

### EC — Evaporating Cloud

| Rule | Tier | Catches |
| --- | --- | --- |
| `ec-missing-conflict` | existence | Neither D ↔ D′ edge carries the lightning-bolt mutex marker — the conflict isn't declared. |
| `ec-completeness` | existence | The brief's structural set: both Wants and both Needs present, all four necessity edges, an assumption on each arrow, at least one injection. |

### S&T — Strategy & Tactics Tree

| Rule | Tier | Catches |
| --- | --- | --- |
| `st-tactic-assumptions` | clarity | A tactic with fewer than three Necessary-Condition feeders (the NA / PA / SA facet pattern). |
| `st-tactic-rollup` | sufficiency | A non-apex tactic with no child tactics — a layer that should decompose but doesn't. |

### Goal Tree

| Rule | Tier | Catches |
| --- | --- | --- |
| `goalTree-multiple-goals` | clarity | More than one apex Goal entity. Soft + dismissible; carries a one-click **Convert extras to CSFs** action. |

## Cross-diagram lint (the System-Dynamics lens)

These ride the same edge/loop structure across several diagram types:

| Rule | Tier | Fires on | Catches |
| --- | --- | --- | --- |
| `logic-type-mismatch` | clarity | CRT · FRT · TT · Goal Tree · NBR | An edge whose kind (sufficiency vs necessity) contradicts the diagram's primary logic. |
| `loop-polarity` | clarity | CRT · FRT · NBR | A balancing (self-correcting) loop where a reinforcing (self-amplifying) one is expected, or vice versa. |
| `long-arrow` | existence | CRT · FRT · TT · NBR | A sufficiency edge skipping three or more causal levels — the *depth* twin of `indirect-effect`. Carries a one-click **Insert a step** action. |
| `reinforcing-no-delay` | clarity | CRT · FRT · NBR | A reinforcing loop none of whose edges carries a delay marker — it would escalate instantly; a lag is probably un-modelled. |

## Diagram-type scoping matrix

`✓` = the rule runs on that diagram type. Blank = it doesn't. PRT and Freeform run the structural rules only.

| Rule | CRT | FRT | PRT | TT | EC | Goal | S&T | Free | NBR |
| --- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| `clarity` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `entity-existence` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `causality-existence` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `tautology` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `indirect-effect` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `cause-sufficiency` | ✓ | ✓ | | | | | | | ✓ |
| `additional-cause` | ✓ | ✓ | | | | | | | ✓ |
| `cause-effect-reversal` | ✓ | | | | | | | | |
| `predicted-effect-existence` | | ✓ | | | | | | | ✓ |
| `external-root-cause` | ✓ | | | | | | | | |
| `crt-ude-count` | ✓ | | | | | | | | |
| `crt-ude-no-upstream` | ✓ | | | | | | | | |
| `crt-dead-branch` | ✓ | | | | | | | | |
| `crt-low-core-driver-coverage` | ✓ | | | | | | | | |
| `crt-tied-core-drivers` | ✓ | | | | | | | | |
| `crt-ude-wording` | ✓ | | | | | | | | |
| `complete-step` | | | | ✓ | | | | | |
| `tt-action-locus-unset` | | | | ✓ | | | | | |
| `ec-missing-conflict` | | | | | ✓ | | | | |
| `ec-completeness` | | | | | ✓ | | | | |
| `st-tactic-assumptions` | | | | | | | ✓ | | |
| `st-tactic-rollup` | | | | | | | ✓ | | |
| `goalTree-multiple-goals` | | | | | | ✓ | | | |
| `logic-type-mismatch` | ✓ | ✓ | | ✓ | | ✓ | | | ✓ |
| `loop-polarity` | ✓ | ✓ | | | | | | | ✓ |
| `long-arrow` | ✓ | ✓ | | ✓ | | | | | ✓ |
| `reinforcing-no-delay` | ✓ | ✓ | | | | | | | ✓ |

Freeform receives only the structural rules by design — see [Chapter 11](11-freeform-diagrams.md). PRT's method-specific checks ("a goal with no IOs feeding the obstacles below") are intentionally parked; the structural set still applies.
