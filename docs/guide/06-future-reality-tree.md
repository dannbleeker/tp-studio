# Chapter 6 — Future Reality Tree
### *What would it look like solved?*

> **🎯 What this process is for**
> A Future Reality Tree (FRT) tests whether your proposed injections actually solve the problem. It answers: "If I make these changes, what will the system produce instead?" The same causal model as a CRT, but starting from injections instead of root causes and reaching upward to *desired effects* instead of undesirable ones. The point is *prediction*: if the FRT is logically sound, the injections will work; if it's not, they won't.

## The premise

A CRT diagnoses. An EC names the conflict. An FRT designs the solution. Each is a deliberate step; skipping straight from EC to "let's do the injection" loses the discipline of *checking your work*.

The check matters because injections have second-order effects. The thing you do to fix UDE-1 might cause UDE-7. The FRT is the place to catch that before the rollout, not after. Goldratt called the unanticipated downstream UDE the **Negative Branch** — and the FRT is structured to make Negative Branches *visible*.

## The method

1. **Start with the injections you drafted in the EC**, marked as `Injection` type. They are the bottom of the FRT — the things you will *do*.
2. **Above each injection, list the desired effects you expect.** "The team has protected drafting time." "The triage rubric exists." "Senior agents stop context-switching." Mark each as `Desired Effect`.
3. **Connect upward — sufficient causality, same as CRT.** "Because of injection X, desired effect Y." Verbalize.
4. **Trace forward to the elimination of each original UDE.** The FRT is correct when every CRT UDE has a path *down* to one or more of your injections.
5. **Hunt for Negative Branches.** For each major desired effect, ask: "What new UDE might this *also* cause?" If you find one, draw it as an `Undesirable Effect`. Then look for an injection that prevents it. Add a new injection if needed. Keep iterating.
6. **Flag Positive Reinforcing Loops.** When a desired effect causes something that causes the original desired effect more strongly, you've found a virtuous cycle. Tag the back-edge.
7. **Verbalize the FRT** the same way you verbalized the CRT. If it sounds like a real future, you're done.

## Worked example (continued)

From [Chapter 5](05-evaporating-cloud.md): one injection drafted — **Train 2 L2 agents on the hardest 20% of ticket types**.

`Cmd+K → New diagram → Future Reality Tree`. Empty FRT canvas opens.

Add the injection: double-click, type **Train 2 L2 agents on the hardest 20% of ticket types**, Inspector → Type → Injection. The stripe turns emerald.

Now ask: *if this injection lands, what will be true?*

- Lead's queue load drops ~30%.
- Lead has 2 days/week of protected drafting time.
- L2 agents have a clearer career-development path. *(Bonus desired effect — worth noting.)*

Add each as `Desired Effect` entities (indigo stripe).

Connect upward. Then continue:

- Because Lead has protected drafting time → triage rubric exists → resolution time drops → SLA met → churn drops.
- Because Lead has protected drafting time → consolidated answer base exists → agents stop redoing prior work → cost-per-ticket drops.
- Because L2 agents have career development → retention improves → reduced hiring-and-training overhead. *(Another bonus.)*

Three of the original CRT's UDEs trace cleanly down to the single injection. So far so good.

Now hunt for Negative Branches. Ask: "What might *also* happen?"

- L2 training takes time. During training, queue load on existing seniors goes UP. *(UDE: "Queue load on existing seniors spikes during training.")*
- If the training is poorly designed, L2 agents handle hard tickets badly, customer experience drops. *(UDE: "L2-resolved tickets are lower quality than L3.")*

Add both as UDEs. Each is a real risk of the injection.

For each negative branch, draft a *second-order injection*:

- Hire one temp contractor for 8 weeks to cover queue during training. *(Inject.)*
- Build a 2-week shadowing program where L2s pair with L3s on hard tickets before going solo. *(Inject.)*

The FRT now has 3 injections (one primary, two for negative branches), 5 desired effects, 2 negative-branch UDEs (each suppressed by an injection), and clean paths from the injections to the elimination of the original 3 CRT UDEs.

🛠 **How TP Studio helps:** `Start Negative Branch from this entity` palette command (also right-click context menu) creates a "Negative Branch" group preset (slate-coloured) rooted at the entity you select. Useful for keeping NB sub-trees visually separated.

## Sidebars

> **🛠 How TP Studio helps**
> - `Cmd+K → New Future Reality Tree` to start fresh; `Load example Future Reality Tree` for a reference.
> - **Group presets**: Negative Branch (slate), Positive Reinforcing Loop (emerald), Archive (slate, collapsed) — `Cmd+K → Group inspector → Preset`. Catalog in `src/domain/groupPresets.ts`.
> - **Back-edge tagging** for reinforcing loops — Edge Inspector → Back-edge toggle.
> - **Edge polarity** matters in FRTs more than CRTs. If a chain has a negative edge halfway up, the eventual desired effect is *suppressed*, not produced. The polarity badge catches it.
> - **InjectionWorkbench carry-forward** — if you started in an EC and drafted injections there, the injections (entities of type `Injection`) carry to the FRT through the JSON model. Copy-paste between docs preserves them.

> **💡 Practitioner tips**
> - **Look for Negative Branches actively, not passively.** The FRT's value is mostly in catching them. Walk through each desired effect and ask "what else?" Don't accept the first answer.
> - **Number your injections.** The Inspector's `annotationNumber` field lets you label them I1, I2, I3. Useful when writing the rollout plan; readers can reference "injection I2" rather than "the second one from the top."
> - **The FRT is a draft.** It will be wrong about some second-order effects. The rollout will reveal which ones; capture revisions before the rollout so you can compare predicted vs. actual after.

> **⚠ Common mistakes**
> - **Trivial FRT.** If your FRT is a single injection → single desired effect → "and the UDE goes away", you haven't done the work. Real systems have second-order effects; if you didn't find any, you didn't look.
> - **Confusing prediction with hope.** "We hope this will lead to…" isn't a cause-effect claim. The FRT's edges are *predictions*: if this, then probably that. Mark assumptions where the prediction is uncertain.
> - **Skipping the Negative Branch hunt.** This is the single highest-value step in FRT drawing. Skipping it produces FRTs that read like project plans and predict like horoscopes.

> **🛑 When to stop**
> - Every CRT UDE has a path *down* to at least one injection.
> - Each injection has at least one desired effect spelled out.
> - You've looked for Negative Branches against every major desired effect (looking, not just gesturing).
> - Each NB has either an injection that suppresses it, or an explicit "we accept this risk" annotation.
> - Verbalisation reads as a plausible future, not a wish-list.

🔁 **Chain to next:** the FRT tells you *what* should happen. The PRT tells you *what's in the way of making it happen*.

---

→ Continue to [Chapter 7 — Prerequisite Tree](07-prerequisite-tree.md)
