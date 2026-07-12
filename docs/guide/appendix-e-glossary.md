# Appendix E — Glossary

> *Terms used throughout. The TOC tradition is acronym-heavy; this list disambiguates.*

| Term | Definition |
| --- | --- |
| **AND junctor** | A combinatorial node in TP Studio rendering "all inbound causes jointly sufficient." Visual: violet circle labeled `AND`. |
| **Assumption** | A claim that a causal arrow depends on, and that someone could plausibly challenge. An *edge annotation* (not an entity type) — added from the Edge Inspector's Assumption Well or by pressing `A` on a selected edge; renders as a violet card tied to its arrow. |
| **Back-edge** | The edge that closes a causal loop. Auto-detected (the loop-closer renders dashed with a `↻` glyph and an R/B polarity badge); can also be tagged manually to pick the closing edge or to name the loop. There is no cycle warning — the rendering *is* the acknowledgement. |
| **Browse Lock** | TP Studio's read-only mode. Toggle via the ⋮ overflow menu (*Lock for browsing*) or Settings → Behavior. Auto-engages on share-link load. |
| **CLR** | Categories of Legitimate Reservation. The discipline-checks for evaluating a causal claim — eight in Dettmer's teaching layout (Chapter 13). |
| **Core driver** | The root cause with the highest UDE-reach in a CRT — the candidate constraint. |
| **CRT** | Current Reality Tree. "Why is this happening?" |
| **CSF** | Critical Success Factor. Middle layer of a Goal Tree. |
| **D / D′** | The two "wants" in an Evaporating Cloud — the actions one side and the other side advocate. |
| **DAG** | Directed Acyclic Graph. Most TP Studio diagrams are DAGs (back-edges are explicit annotations of cycles, not structural cycles). |
| **DE** | Desired Effect. The FRT's top-of-tree entity (what the system would produce after the injection). |
| **EC** | Evaporating Cloud. The 5-box conflict diagram. |
| **Effect** | An entity in a CRT/FRT that's caused by something and causes something else — intermediate. |
| **Evidence** | A first-class list on every entity: structured rows backing the entity with a `description`, a 5-way `source` (`Observed / Stakeholder / Metric / Policy / Assumption`), a 3-way `strength` (`Weak / Moderate / Strong`), an optional URL, and a per-row validation stamp. Surfaces in the Inspector beneath the Owner block and feeds the `evidence` column of the Risk Register (CSV) export. |
| **FRT** | Future Reality Tree. "What would it look like solved?" |
| **Goal** | The top of a Goal Tree. Single (typically). Time-bounded (preferably). |
| **Goal Tree** | Top-down decomposition: Goal → CSFs → NCs. Strategic-planning shape. |
| **Injection** | A proposed change to the system. The hypothesis to test. |
| **IO** | Intermediate Objective. A state that, achieved, dissolves an obstacle. PRT-specific. |
| **NA** | Necessary Assumption. The first facet of an S&T card — "why this matters now." |
| **NBR** | Negative Branch Reservation. A forward-causal sub-tree from a candidate injection that maps its unintended consequences and the mitigation that breaks the chain. Available in TP Studio as both (a) a "Negative Branch" group preset inside an FRT for sub-branch capture, and (b) its own first-class **NBR** diagram type — `Cmd+K → New diagram… → NBR`. |
| **NC** | Necessary Condition. Lower layer of a Goal Tree. |
| **NPS** | Net Promoter Score. Used in the case study as a UDE signal; not a TOC term. |
| **OR junctor** | "Any one of the inbound causes is sufficient." Visual: indigo circle. |
| **PA** | Parallel Assumption. The third facet of an S&T card — "why this specific approach." |
| **Owner** | Per-entity free-form text field naming whoever's accountable for the entity (decision owner, action assignee, validation owner). Feeds the `owner` column of the Risk Register (CSV) export. |
| **Templates library** | Curated starter diagrams for common TOC scenarios (~110, all diagram types). `Cmd+K → Browse templates…` (or Start page → Templates) lists them with a filter chip row; "+ Insert here" merges a same-type template into the current diagram. Distinct from "Load example…" which loads one canonical example per diagram type. |
| **PRT** | Prerequisite Tree. "What's in our way?" |
| **Risk register** | A tabular accounting of identified risks, one per row, with `risk / trigger / consequence / mitigation / evidence / owner / status` columns. TP Studio's **Risk register (CSV)** export (Chapter 16) generates one from any doc containing UDEs by walking each UDE backward through the causal graph to find reachable injections (the mitigations). The `evidence` cell renders the UDE's `evidence[]` entries as semicolon-joined `[strength/source] description (url)` rows. Status is `mitigated` if any mitigation reaches the UDE, `open` otherwise. |
| **Root cause** | A terminal cause at the bottom of a CRT — the leverage point. |
| **S&T** | Strategy & Tactics Tree. Operational-deployment decomposition with 5-facet cards. |
| **SA** | Sufficiency Assumption. The fifth facet of an S&T card — "why this tactic is enough." |
| **Locus** | Per-entity flag: `control` / `influence` / `external`. Previously labelled "Span of control" in TP Studio; the schema field name `spanOfControl` is retained for backward compatibility. |
| **Start page** | The workspace TP Studio opens on: a problem-led hero, the All-trees library (every saved tree, open or closed), Templates, a Needs-review triage view, and Learn-the-method links. The top-left logo returns to it from the editor. |
| **Strategy** | The second facet of an S&T card — the outcome-shaped "what." |
| **Sufficiency edge** | An edge claiming "this cause, by itself, produces the effect." Default for CRT/FRT/TT edges. |
| **Necessity edge** | An edge claiming "the effect requires this cause." Default for PRT/EC edges. |
| **Tactic** | The fourth facet of an S&T card — the concrete actions. |
| **TT** | Transition Tree. Action / precondition / outcome triples. "How do we get there?" |
| **TOC** | Theory of Constraints. Goldratt's framework. |
| **UDE** | Undesirable Effect. The symptom layer at the top of a CRT — what stakeholders / customers / the market actually feel. |
| **VerbalisationStrip** | The above-canvas paragraph rendering of an EC, updates live. |
| **XOR junctor** | "Exactly one of the inbound causes occurs." Visual: rose circle. |
