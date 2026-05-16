# Appendix A — End-to-end case study
### Customer-support firefighting

> *The worked example used in Chapters 4–6 is sketched here as one continuous narrative. Read it once in full to see how the CRT, EC, and FRT compose into a single analysis.*

## The scenario

A B2B SaaS company. The product is mature; the install base is ~400 customers paying an average of $40K ARR. Customer Success and Support are organizationally separate; Support has 8 agents (2 L1, 4 L2, 2 L3) and one team lead (formerly L3, promoted 14 months ago).

The VP of CS calls a meeting. Three concerns:

- Renewal pull-through is down. Net retention has dropped from 112% to 94% over the last 4 quarters.
- The Support team is burnt out. Three resignations in the last 6 months, all citing "constant firefighting."
- Cost per ticket — measured in agent-hours per resolution — is up 40% YoY despite no change in product complexity.

The conventional moves have already been tried. Hiring more agents didn't help. A new ticketing tool didn't help. A re-org didn't help. The VP wants a diagnosis.

## CRT

Three UDEs:

- **Customers churn at renewal**
- **NPS keeps dropping**
- **Support cost per ticket up 40%**

Cause chains (built bottom-up):

```
                        ┌─ Customers churn at renewal ──┐
                        │           ▲                    │
                        │           │                    │
        ┌── NPS keeps dropping       │       Support cost per ticket up 40%
        │           ▲                │                    ▲
        │           │                │                    │
   Customers get          Customer SLA          Agents redo prior work
   inconsistent           expectations          for common questions
   answers                missed                       ▲
        ▲                  ▲                            │
        │                  │                            │
        │           Resolution time > 8h               │
        │                  ▲                            │
        │             ┌────┴────┐                       │
        │             │ AND     │                       │
        │             └────┬────┘                       │
        │      ┌──────────┴───────────┐                  │
        │  Senior agents          No shared            No consolidated
        │  context-switch         triage rubric        answer base
        │  constantly                 ▲                    ▲
        │      ▲                      │                    │
        └──────┴──────────────────────┴────────────────────┘
                                      │
                          Support lead has no protected
                          drafting time
                          (CORE DRIVER — reach: 3 UDEs)
```

The structure converges: three UDEs trace through five intermediate effects to two terminal causes ("Senior agents context-switch constantly" and "Support lead has no protected drafting time"), with the lead's protected-time problem feeding three of the four intermediate effects. The core driver is structural — not a hiring problem, not a tooling problem, not a re-org problem. The lead has not been protected from incoming work long enough to build the team's scaling apparatus.

## EC

Why has this persisted? The EC.

- **A — Goal:** A sustainable support function.
- **B — Need:** Keep ticket queue responsive to retain at-risk customers.
- **C — Need:** Build durable structure (rubric + answer base) so the team scales.
- **D — Want (satisfies B):** Support lead stays on the queue.
- **D′ — Want (satisfies C):** Support lead takes 2 days/week off the queue to build structure.
- **Mutex:** D and D′ conflict — one person.

The cloud reads aloud:

> *In order to achieve a sustainable support function, we must keep ticket queue responsive to retain at-risk customers; therefore the support lead stays on the queue. In order to achieve a sustainable support function we must also build durable structure (rubric + answer base) so the team scales; therefore the support lead takes 2 days/week off the queue. And these two wants conflict.*

Assumptions on B → D:

- *Only the support lead can resolve the hard tickets.*
- *Tickets sufficient to keep the queue responsive must all be resolved by humans.*
- *We can't temporarily reduce inbound ticket volume.*
- *No structural improvement could pay off within the timeframe leadership cares about.*

Assumptions on C → D′:

- *Building the structure requires the lead specifically — no other agent can do it.*
- *The structure must be built in dedicated blocks, not incrementally.*

The breakable assumption is **"Only the support lead can resolve the hard tickets."** Trained L2 agents could handle the hardest 20% of ticket types, freeing the lead's time without sacrificing queue responsiveness.

The cloud evaporates. Injection: **Train 2 L2 agents on the hardest 20% of ticket types**.

## FRT

Does the injection actually work?

Primary chain:

- Inject: Train 2 L2 agents → L2 agents handle hardest 20% → Lead's queue load drops 30% → Lead has 2 days/wk drafting time → Rubric + answer base exist → Resolution time drops, no answer-redoing → SLA met + cost per ticket drops → **CRT UDEs eliminated.**

Negative branches:

- **NB1:** L2 training takes time. Queue load on existing seniors spikes during training. → Inject: Temp contractor for 8 weeks during training.
- **NB2:** L2-resolved tickets might be lower quality than L3. → Inject: 2-week shadowing program before L2s go solo.

Three injections total, ready for the PRT.

## PRT (sketch)

Below each injection, the obstacles + IOs. For the primary injection:

- *Obstacle:* No list of "hardest 20%". → *IO:* Audit complete; hardest 20% defined.
- *Obstacle:* L2 candidates have full queues. → *IO:* L2 capacity freed by re-routing.
- *Obstacle:* No curriculum. → *IO:* Curriculum drafted, lead-reviewed.
- *Obstacle:* No budget for contractor. → *IO:* Budget approved.

For the temp-contractor injection: → *IO:* Contractor identified, contracted, onboarded. (Standard recruiting / contracting workflow; mostly off-canvas.)

For the shadowing injection: → *IO:* Shadowing rubric drafted. *IO:* L3 calendars cleared 2 hours/day during shadowing weeks.

## TT (sketch)

The most operationally explicit. One example chain from the PRT's "Audit complete" IO:

1. **Pull 6mo of escalated tickets via helpdesk API.** Precondition: API token. Outcome: CSV of ~2400 tickets.
2. **Bucket the CSV by type and compute escalation rate.** Precondition: CSV + categorization rubric. Outcome: Ranked list.
3. **Mark top 20%, circulate to L2 candidates.** Precondition: Ranked list + L2s identified. Outcome: Signed-off list.
4. **Publish list as workspace doc.** Precondition: Signed-off. Outcome: IO achieved.

Each leaf is sized for one person, one day at most.

## The result

Six weeks after the workshop:

- L2 training in week 4, all 2 L2s certified on hardest-20% types.
- Lead has had 5 weeks of 2-days-protected time. Rubric drafted, sections 1-3 of answer base done.
- Resolution time has dropped from a median of 11 hours to 6.5.
- One renewal saved that the VP's gut said would have churned. Another is at risk but the underlying complaint shifted from "you're slow" to product-specific gaps — addressable in the next product cycle.

Twelve weeks later, both NB injections also paid out: the temp contractor extended for 4 weeks beyond plan because the lead wanted more drafting time; the L2 shadowing turned into a permanent pairing convention, with one L2 explicitly on a promotion track.

The CRT was a structural diagnosis. The EC named the false assumption. The FRT predicted the result. The PRT/TT planned the rollout. None of these was the answer alone; the chain was.
