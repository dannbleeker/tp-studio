# Appendix G — Troubleshooting your diagram

> *A reverse index: start from the symptom — "this diagram feels wrong" — and work back to the cause and the fix. Where a TP Studio CLR validator catches the smell automatically, the rule is named (see [Appendix C](appendix-c-clr-rules.md) for the full registry). Many smells are too contextual for a rule, so the fix is a habit, not a warning.*

A finished diagram that's subtly wrong is more dangerous than an obviously unfinished one — it carries false confidence. This appendix collects the smells that recur in real work, what each usually means, and how to clear it.

## Smells that apply to any causal tree

| The smell | What it usually means | Catches it | The fix |
| --- | --- | --- | --- |
| **It reads like a to-do list** — every node is an action ("hire a PM", "buy the tool"). | You've drawn a *plan* (PRT/TT), not a *diagnosis* (CRT). | — (judgment) | Restate each node as an *effect* or state of the world, not a deed: "Onboarding is slow", not "speed up onboarding". |
| **A node could be glued to any tree** — "Communication is poor", "There's no alignment". | The entity is too abstract to observe or challenge. | `clarity` (overlong titles only — vagueness slips under it) | Make it observable: what would you *see* if it were true? "Release notes ship after the release, not before." |
| **An arrow makes you wince but you can't say why.** | The link is doing too much work, or runs the wrong way. | `cause-effect-reversal`, `long-arrow` | Run **Scrutinize this edge** ([Chapter 13](13-the-clr.md)) and ask each CLR question of it by hand. |
| **One leap covers three steps** — "We cut QA → customers churn." | A *long arrow* hiding unstated intermediate effects. | `long-arrow` (existence) | Use the one-click **Insert a step** action; name the missing middle. |
| **A cause feels necessary but not enough.** | A co-cause is missing. | `cause-sufficiency` (CRT/FRT/NBR) | AND-group the co-cause in — or accept the warning if it genuinely is sufficient. |
| **The tree is a pile of disconnected fragments.** | Separate analyses, or missing links. | `indirect-effect` | Connect them, or split into separate documents. |
| **You dismissed a warning and can't recall why.** | An undocumented judgment call — a debt for the next reader. | — | Dismiss *with* an explanation in the entity's description. |

## Per-diagram smells

### Current Reality Tree

| The smell | Catches it | The fix |
| --- | --- | --- |
| Two or more root causes tie for "explains the most UDEs". | `crt-tied-core-drivers` | A hidden conflict may sit beneath — use the one-click **Spawn Evaporating Cloud** and dissolve it. |
| The leading root cause explains fewer than half the UDEs. | `crt-low-core-driver-coverage` | The tree may hold two independent clusters; split it, or keep digging for the deeper shared cause. |
| A UDE has no cause feeding it. | `crt-ude-no-upstream` | The tree is incomplete there — ask "why?" once more. |
| A UDE is phrased as a missing solution — "No triage rubric." | `crt-ude-wording` | Restate it as the *effect* of the absence: "Tickets are re-triaged from scratch each time." |
| Fewer than 3, or more than ~15, UDEs. | `crt-ude-count` | Too few and the analysis is thin; too many and you're boiling the ocean — cluster or scope down. |
| A leaf "root cause" flagged External. | `external-root-cause` | Push one level deeper; the real lever is usually inside your control or influence. |

### Evaporating Cloud

| The smell | Catches it | The fix |
| --- | --- | --- |
| The two Wants don't actually conflict. | `ec-missing-conflict` | If both can be true at once it isn't a cloud — you've drawn two parallel needs. Find the real either/or and mark the D ↔ D′ mutex. |
| The cloud is structurally incomplete (a missing need, edge, or assumption). | `ec-completeness` | Fill the five boxes, the four necessity edges, and an assumption per arrow. |
| No injection after the analysis. | — | A cloud you can't break is a complaint. Keep cycling assumption statuses until one reads **Invalid** — that's the lever. |

### Future Reality Tree / Negative Branch

| The smell | Catches it | The fix |
| --- | --- | --- |
| The FRT has no negative branches. | — | You haven't looked hard enough. For each injection, ask "what could this break?" and start a negative branch. |
| An injection's predicted second effect appears nowhere. | `predicted-effect-existence` | If A→B is real, B's other consequences should show too. Draw them, or doubt the claim. |

### Transition Tree

| The smell | Catches it | The fix |
| --- | --- | --- |
| An action has no precondition feeding its outcome. | `complete-step` | Name the existing condition the action relies on, or AND-group the co-cause. |
| An action's locus isn't set. | `tt-action-locus-unset` | Mark it control / influence / external — a step outside your control needs a different plan. |

### Goal Tree / Strategy & Tactics

| The smell | Catches it | The fix |
| --- | --- | --- |
| More than one apex Goal. | `goalTree-multiple-goals` | One-click **Convert extras to CSFs**, or genuinely split the analysis. |
| An S&T tactic has fewer than three assumption facets. | `st-tactic-assumptions` | Add the Necessary / Parallel / Sufficiency assumptions — the facets *are* the argument. |
| A non-apex tactic has no children. | `st-tactic-rollup` | Decompose it into the next level, or mark it a genuine leaf. |

## The meta-fix: read it aloud

Most of these smells surface the instant you *verbalise* the diagram — `Cmd+K → Start read-through` ([Chapter 15](15-verbalisation-walkthroughs.md)). The sentence that makes you hesitate is the smell; the rule, where one exists, just tells you which kind. When no rule fires and the sentence still reads wrong, trust the sentence.
