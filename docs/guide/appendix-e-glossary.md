# Appendix E — Glossary

> *Terms used throughout. The TOC tradition is acronym-heavy; this list disambiguates.*

| Term | Definition |
| --- | --- |
| **AND junctor** | A combinatorial node in TP Studio rendering "all inbound causes jointly sufficient." Visual: violet circle labeled `AND`. |
| **Assumption** | A claim that a causal arrow depends on, and that someone could plausibly challenge. First-class entity since schema v7. |
| **Back-edge** | An edge flagged as a deliberate cycle-closer; the cycle CLR rule suppresses warnings on cycles whose closing edge is back-tagged. |
| **Browse Lock** | TP Studio's read-only mode. Toggle in TopBar. Auto-engages on share-link load. |
| **CLR** | Categories of Legitimate Reservation. The six discipline-checks for evaluating a causal claim. |
| **Core driver** | The root cause with the highest UDE-reach in a CRT — the candidate constraint. |
| **CRT** | Current Reality Tree. "Why is this happening?" |
| **CSF** | Critical Success Factor. Middle layer of a Goal Tree. |
| **D / D′** | The two "wants" in an Evaporating Cloud — the actions one side and the other side advocate. |
| **DAG** | Directed Acyclic Graph. Most TP Studio diagrams are DAGs (back-edges are explicit annotations of cycles, not structural cycles). |
| **DE** | Desired Effect. The FRT's top-of-tree entity (what the system would produce after the injection). |
| **EC** | Evaporating Cloud. The 5-box conflict diagram. |
| **Effect** | An entity in a CRT/FRT that's caused by something and causes something else — intermediate. |
| **FRT** | Future Reality Tree. "What would it look like solved?" |
| **Goal** | The top of a Goal Tree. Single (typically). Time-bounded (preferably). |
| **Goal Tree** | Top-down decomposition: Goal → CSFs → NCs. Strategic-planning shape. |
| **Injection** | A proposed change to the system. The hypothesis to test. |
| **IO** | Intermediate Objective. A state that, achieved, dissolves an obstacle. PRT-specific. |
| **NA** | Necessary Assumption. The first facet of an S&T card — "why this matters now." |
| **NBR** | Negative Branch Reservation. A forward-causal sub-tree from a candidate injection that maps its unintended consequences and the mitigation that breaks the chain. Available in TP Studio as both (a) a "Negative Branch" group preset inside an FRT for sub-branch capture, and (b) its own first-class **NBR** diagram type since Session 134 — `Cmd+K → New diagram… → NBR`. |
| **NC** | Necessary Condition. Lower layer of a Goal Tree. |
| **NPS** | Net Promoter Score. Used in the case study as a UDE signal; not a TOC term. |
| **OR junctor** | "Any one of the inbound causes is sufficient." Visual: indigo circle. |
| **PA** | Parallel Assumption. The third facet of an S&T card — "why this specific approach." |
| **Owner** | Per-entity free-form text field naming whoever's accountable for the entity (decision owner, action assignee, validation owner). Feeds the `owner` column of the Risk Register (CSV) export. |
| **Pattern library** | Curated starter diagrams for common TOC scenarios. `Cmd+K → Pattern library…` lists every pattern with a filter chip row for diagram type. Distinct from "Load example…" which loads one canonical example per diagram type. |
| **PRT** | Prerequisite Tree. "What's in our way?" |
| **Risk register** | A tabular accounting of identified risks, one per row, with `risk / trigger / consequence / mitigation / owner / status` columns. TP Studio's **Risk register (CSV)** export (Chapter 16) generates one from any doc containing UDEs by walking each UDE backward through the causal graph to find reachable injections (the mitigations). Status is `mitigated` if any mitigation reaches the UDE, `open` otherwise. |
| **Root cause** | A terminal cause at the bottom of a CRT — the leverage point. |
| **S&T** | Strategy & Tactics Tree. Operational-deployment decomposition with 5-facet cards. |
| **SA** | Sufficiency Assumption. The fifth facet of an S&T card — "why this tactic is enough." |
| **Locus** | Per-entity flag: `control` / `influence` / `external`. Previously labelled "Span of control" in TP Studio; the schema field name `spanOfControl` is retained for backward compatibility. |
| **Strategy** | The second facet of an S&T card — the outcome-shaped "what." |
| **Sufficiency edge** | An edge claiming "this cause, by itself, produces the effect." Default for CRT/FRT/TT edges. |
| **Necessity edge** | An edge claiming "the effect requires this cause." Default for PRT/EC edges. |
| **Tactic** | The fourth facet of an S&T card — the concrete actions. |
| **TT** | Transition Tree. Action / precondition / outcome triples. "How do we get there?" |
| **TOC** | Theory of Constraints. Goldratt's framework. |
| **UDE** | Undesirable Effect. The symptom layer at the top of a CRT — what stakeholders / customers / the market actually feel. |
| **VerbalisationStrip** | The above-canvas paragraph rendering of an EC, updates live. |
| **XOR junctor** | "Exactly one of the inbound causes occurs." Visual: rose circle. |
