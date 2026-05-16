# Appendix C — The CLR rules in detail

> *One entry per implemented validator. Tier color and the diagram-types it fires on.*

## Clarity tier

The most pedagogical layer. These warnings are about *legibility* — would a reader understand what you mean?

| Rule | Fires on | Suggests |
| --- | --- | --- |
| `empty-title` | Any entity / edge / group with no title | Add a meaningful title. |
| `clarity-word-limit` | Entities whose titles exceed ~25 words | Shorten — long titles indicate compound claims that should be split into multiple entities. |
| `goalTree-multiple-goals` | Goal Tree docs with more than one Goal entity | One-click action: `convert-extra-goals-to-csfs` downgrades all but the oldest to CSF. |
| `disconnected-graph-floor` | Diagrams with more than 3 connected components | Check whether the components are genuinely separate analyses (split into separate docs) or whether you forgot to connect them. |
| `goalTree-multiple-goals` *(soft)* | Goal Tree docs with > 1 Goal | Soft warning — dismissible. Reclassify or accept. |
| `clarity-similarity` | Two entities with > 85% similar titles | Likely duplicates. Merge or rename. |

## Sufficiency tier

About logical structure — is the causal claim complete?

| Rule | Fires on | Suggests |
| --- | --- | --- |
| `cause-sufficiency-missing-co-cause` | CRT/FRT edges where the analyst has indicated a sufficient-cause claim that probably needs an AND-group | Group with co-causes. |
| `complete-step` (TT-only) | Actions in a TT whose outgoing edge to an Outcome lacks a non-action sibling (precondition) | Add the missing precondition. |
| `st-tactic-assumptions` (S&T-only) | Tactics with fewer than three necessaryCondition feeders | Add supporting NCs. |
| `ec-missing-conflict` (EC-only) | EC docs where no want↔want edge is flagged `isMutualExclusion` | Tag the conflict edge as mutex. |

## Causality tier

About direction — is the arrow pointing the right way?

| Rule | Fires on | Suggests |
| --- | --- | --- |
| `cause-effect-reversal` | Edges where the typed natural reading suggests the arrow direction is wrong | Reverse or rewrite. |
| `external-root-cause` (CRT-only) | Root causes flagged `span: external` | Push one level deeper — the real root cause is usually within `control` or `influence`. |

## Predicted-effect tier

About implications — does the diagram make a prediction that should be visible elsewhere?

| Rule | Fires on | Suggests |
| --- | --- | --- |
| `predicted-effect-existence` | Sufficiency-arrow edges where the predicted effect of A → B suggests something else should also be observable | Look for the predicted second effect; if it exists, confirm the structure; if not, the original claim is suspect. |

## Diagram-type scoping

Most rules fire only on specific diagram types. The table below maps:

| Rule | CRT | FRT | PRT | TT | EC | Goal | S&T | Freeform |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `empty-title` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `clarity-word-limit` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `disconnected-graph-floor` | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | — |
| `clarity-similarity` | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | — |
| `cause-sufficiency-missing-co-cause` | ✓ | ✓ | — | — | — | — | — | — |
| `complete-step` | — | — | — | ✓ | — | — | — | — |
| `st-tactic-assumptions` | — | — | — | — | — | — | ✓ | — |
| `ec-missing-conflict` | — | — | — | — | ✓ | — | — | — |
| `cause-effect-reversal` | ✓ | ✓ | — | — | — | — | — | — |
| `external-root-cause` | ✓ | — | — | — | — | — | — | — |
| `predicted-effect-existence` | ✓ | ✓ | — | — | — | — | — | — |
| `goalTree-multiple-goals` | — | — | — | — | — | ✓ | — | — |

Freeform receives almost no validators by design — see [Chapter 11](11-freeform-diagrams.md).
