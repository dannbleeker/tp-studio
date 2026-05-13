# TP Studio — Feature research

A menu of feature ideas pulled from real TOC / TP tools and adjacent disciplines (causal-loop diagrams, argument mapping, concept mapping, generic diagramming). Compiled from web research — every item has a source URL.

**How to use this**

- Items are addressed by **bucket letter + number**: `B3`, `C1`, `J4`. Say "let's pick A1, A6, and B9" and we know exactly which features you mean.
- **Confidence**:
  - **H** — directly observed in a shipping product or official docs
  - **M** — referenced in reviews, blog posts, or practitioner discussions
  - **L** — academic or speculative but attested somewhere
- **Effort hint** is a rough wall-clock T-shirt size from someone who already knows this codebase: `trivial` (< 1 hour), `small` (a few hours), `medium` (a day or two), `large` (multi-day or architecture-shifting).
- All sources are URLs; no item is a "wouldn't it be cool if" invention with no attestation.
- **AI / LLM features are intentionally excluded** from this menu, per user request. If they become in scope later, a separate document.

**What's NOT in this list**

- Anything already shipped in TP Studio's current state (sanity-checked against the iteration-2 feature set: CRT/FRT, AND grouping, groups, hoist, CLR validation, markdown descriptions, edge labels, search, multi-select, clipboard, swap, Quick Capture, JSON/CSV/PNG/JPEG/SVG/Markdown/Flying Logic round-trip, print/PDF, themes, narrow-viewport, etc.).
- Pricing / marketing material.

**Picking from this menu**

You can say:
- "Pick X, Y, Z" — I'll build them in order.
- "Pick everything in bucket E" — done.
- "What would you sequence next if it were up to you?" — I'll propose 5 items, with rationale.

---

## A. Table-stakes we're missing

Common-denominator features that show up across the serious TOC tools (Flying Logic, Vithanco, Harmony) but aren't yet in TP Studio.

### A1. Evaporating Cloud / Conflict Resolution Diagram
**Source**: https://docs.flyinglogic.com/thinking-with-flying-logic/transition-tree  ·  **Confidence**: H  ·  **Effort**: medium
Why TP Studio could care: EC is the most-used TOC TP tool; without it the toolkit feels incomplete.

### A2. Prerequisite Tree with Obstacles → Intermediate Objectives
**Source**: https://vithanco.com/notations/TOC/prerequisite-tree/  ·  **Confidence**: H  ·  **Effort**: medium
Why TP Studio could care: Standard fifth tree type in the TP suite; pairs naturally with FRT injections.

### A3. Transition Tree with Action / Need entity classes
**Source**: https://docs.flyinglogic.com/thinking-with-flying-logic/transition-tree  ·  **Confidence**: H  ·  **Effort**: medium
Why TP Studio could care: Bridges FRT injections to execution; recognised step in Dettmer's full TP pipeline.

### A4. Goal Tree (IO Map) entity classes
**Source**: https://flyinglogic.com/history/  ·  **Confidence**: H  ·  **Effort**: small
Why TP Studio could care: FL added "Critical Success Factor" + "Necessary Condition" exactly so users can build a Goal Tree; cheap to graft onto our domain model.

### A5. Document auto-recovery on unexpected quit
**Source**: https://flyinglogic.com/history/  ·  **Confidence**: H  ·  **Effort**: small
Why TP Studio could care: Local-web app browser tab crashes are common; auto-save + restore is now expected.

### A6. Reverse-edge command
**Source**: https://flyinglogic.com/history/  ·  **Confidence**: H  ·  **Effort**: trivial
Why TP Studio could care: Practitioners frequently mis-build cause/effect direction; one-click reverse is faster than delete+redraw.

### A7. Redact command (strip sensitive text for export)
**Source**: https://flyinglogic.com/history/  ·  **Confidence**: H  ·  **Effort**: small
Why TP Studio could care: Many TP users are inside enterprises / SCIF contexts and need to share scrubbed trees.

---

## B. Flying Logic-specific distinguishers we don't have

FL is the closest direct competitor; these are features TP Studio's audience may already expect.

### B1. Multiple layout orientations (hierarchical / radial / inner-outer)
**Source**: https://flyinglogic.com/history/  ·  **Confidence**: H  ·  **Effort**: medium
Why TP Studio could care: Different audiences read trees differently; radial is useful for Evaporating Cloud and Goal Trees.

### B2. Graph compactness slider
**Source**: https://flyinglogic.com/history/  ·  **Confidence**: H  ·  **Effort**: small
Why TP Studio could care: Single control trades whitespace for readability without re-laying out manually.

### B3. Custom entity symbols (SVG / PNG)
**Source**: https://flyinglogic.com/history/  ·  **Confidence**: H  ·  **Effort**: small
Why TP Studio could care: Practitioners brand trees for clients; allow per-entity-class icon overrides.

### B4. Group background colors / symbols
**Source**: https://flyinglogic.com/history/  ·  **Confidence**: H  ·  **Effort**: trivial
Why TP Studio could care: We have groups already; coloured backgrounds help separate sub-systems visually.

### B5. Zoom-up annotations ("Z" key) — bigger callouts on hover/select
**Source**: https://flyinglogic.com/history/  ·  **Confidence**: H  ·  **Effort**: small
Why TP Studio could care: Lets users keep descriptions short on the node and reveal them as a tooltip-card.

### B6. Document-level scripting hooks
**Source**: http://flyinglogic.com/wp-content/uploads/2020/01/Flying-Logic-Scripting-Guide.pdf  ·  **Confidence**: H  ·  **Effort**: large
Why TP Studio could care: FL exposes Python scripting for custom importers / exporters; TP Studio could ship a JS sandbox.

### B7. User-defined attributes per entity / edge
**Source**: https://flyinglogic.com/history/  ·  **Confidence**: H  ·  **Effort**: medium
Why TP Studio could care: Lets advanced users tag entities with arbitrary metadata (owner, evidence, source URL).

### B8. Edit-multiple-elements inspector
**Source**: https://flyinglogic.com/history/  ·  **Confidence**: H  ·  **Effort**: small
Why TP Studio could care: We have multi-select; batch property editor closes the loop (e.g. recolor 12 UDEs at once).

### B9. Resource / calendar / sub-day-effort project-management overlay
**Source**: https://flyinglogic.com/history/  ·  **Confidence**: H  ·  **Effort**: large
Why TP Studio could care: FL doubles as a critical-chain planner; a lightweight "execution view" extends a TP to a plan.

### B10. Custom domains (define your own entity classes)
**Source**: https://flyinglogic.com/history/  ·  **Confidence**: H  ·  **Effort**: medium
Why TP Studio could care: We currently ship a fixed 6-class palette; letting users add classes opens TP Studio to adjacent methodologies.

---

## C. Causal / probabilistic analysis

Quantifying belief along a tree. None of this is in TP Studio today; FL ships rich versions.

### C1. Per-entity confidence value (0–100%)
**Source**: https://docs.flyinglogic.com/user-guide/graph-logic  ·  **Confidence**: H  ·  **Effort**: medium
Why TP Studio could care: Lets a CRT show which UDEs / root causes are well-evidenced vs. speculative.

### C2. Per-edge weight (-100% to +100%)
**Source**: https://docs.flyinglogic.com/user-guide/graph-logic  ·  **Confidence**: H  ·  **Effort**: medium
Why TP Studio could care: Captures strength + sign of causation; powers downstream propagation.

### C3. Confidence propagation through fuzzy AND/OR
**Source**: https://docs.flyinglogic.com/user-guide/graph-logic  ·  **Confidence**: H  ·  **Effort**: medium
Why TP Studio could care: When users tweak a root's confidence, downstream effects update — gives the tree a live "what-if" feel.

### C4. Probabilistic mode (Sum-Probabilities ⊕ + Product × junctors)
**Source**: https://docs.flyinglogic.com/thinking-with-flying-logic/evidence-based-analysis.html  ·  **Confidence**: H  ·  **Effort**: medium
Why TP Studio could care: For audiences that want belief-network semantics rather than fuzzy logic.

### C5. Belief-network "proportional" voting mode
**Source**: https://docs.flyinglogic.com/thinking-with-flying-logic/evidence-based-analysis.html  ·  **Confidence**: H  ·  **Effort**: medium
Why TP Studio could care: Lets each input vote with a weight rather than gate the conclusion.

### C6. Evidence-Based Analysis entity classes (Proposition / Indicator / Event / Knowledge)
**Source**: https://docs.flyinglogic.com/thinking-with-flying-logic/evidence-based-analysis.html  ·  **Confidence**: H  ·  **Effort**: medium
Why TP Studio could care: Whole second domain alongside Effects-Based Planning; useful for intelligence / audit use cases.

### C7. Monte-Carlo sensitivity over confidences
**Source**: https://www.vensim.com/documentation/index.html?sensitivity.htm  ·  **Confidence**: H  ·  **Effort**: large
Why TP Studio could care: Vensim ships this for SD models; same approach answers "if my root assumptions are noisy, which UDEs are robust?".

### C8. Bayesian-network influence-diagram mode
**Source**: https://support.bayesfusion.com/docs/GeNIe/id_tutorial.html  ·  **Confidence**: H  ·  **Effort**: large
Why TP Studio could care: For TOC practitioners crossing into formal risk analysis; GeNIe / Hugin demonstrate the demand.

---

## D. Cross-tree linking & strategy

Linking multiple trees and modelling at the strategy layer — gap that FL only partially fills.

### D1. Strategy & Tactics (S&T) Tree
**Source**: https://www.toc-goldratt.com/en/toc-application/strategy-and-tactic-tree  ·  **Confidence**: H  ·  **Effort**: large
Why TP Studio could care: Goldratt's last canonical TP tool; without it TP Studio can't carry a transformation past planning.

### D2. S&T node fields: Necessary Assumption / Strategy / Parallel Assumption / Tactic / Sufficiency Assumption
**Source**: https://webapp.harmonyapps.com/What-Is-TOC-Strategy-and-Tactic-Trees  ·  **Confidence**: H  ·  **Effort**: medium
Why TP Studio could care: Harmony's 5-field-per-node schema is the de-facto S&T data model.

### D3. Link CRT → FRT (carry UDEs into desirable effects)
**Source**: https://docs.flyinglogic.com/thinking-with-flying-logic/transition-tree  ·  **Confidence**: H  ·  **Effort**: medium
Why TP Studio could care: FL docs explicitly describe injections "becoming" goals downstream; we should let users pull entities through.

### D4. Link FRT → Prerequisite Tree (injections become PRT objectives)
**Source**: https://www.toc-goldratt.com/en/toc-application/strategy-and-tactic-tree  ·  **Confidence**: H  ·  **Effort**: medium
Why TP Studio could care: Standard practitioner flow; without it users juggle copies by hand.

### D5. Negative Branch Reservation (NBR) sub-tree linked to an injection
**Source**: https://intelligentmanagement.ws/learningcentre/negative-branch-reservation-thinking-process-tool/  ·  **Confidence**: H  ·  **Effort**: medium
Why TP Studio could care: Each FRT injection should let users spawn an NBR; supporting injections then trim it.

### D6. Positive Branch Reservation
**Source**: https://www.tocinstitute.org/toc-thinking-processes.html  ·  **Confidence**: M  ·  **Effort**: medium
Why TP Studio could care: PBR is the often-overlooked counterpart to NBR — explore why a good thing happens.

### D7. Multi-document workspace ("project of trees")
**Source**: https://webapp.harmonyapps.com/What-Is-TOC-Strategy-and-Tactic-Trees  ·  **Confidence**: H  ·  **Effort**: medium
Why TP Studio could care: Harmony groups S&T + plan modules; we currently treat each tree as a standalone JSON.

### D8. Linked sub-trees inside a single document (CmapTools "knowledge model" style)
**Source**: https://cmap.ihmc.us/docs/theory-of-concept-maps  ·  **Confidence**: H  ·  **Effort**: medium
Why TP Studio could care: A node can link to a deeper map; collapses huge CRTs into navigable layers.

### D9. Reuse-by-reference: an entity that appears in two trees stays in sync
**Source**: https://cmap.ihmc.us/docs/theory-of-concept-maps  ·  **Confidence**: M  ·  **Effort**: medium
Why TP Studio could care: Same UDE often appears across CRT and FRT — single source of truth avoids drift.

---

## E. CLR rule extensions

We ship 8; the canonical TOC catalogue is 10, with extra heuristics in practitioner literature.

### E1. Cause-Effect Reversal check
**Source**: https://docs.flyinglogic.com/thinking-with-flying-logic/the-categories-of-legitimate-reservation  ·  **Confidence**: H  ·  **Effort**: small
Why TP Studio could care: 9th CLR; detects edges where the arrow direction is suspicious (e.g. correlation flagged as cause).

### E2. Indirect Effects (missing intermediate)
**Source**: https://docs.flyinglogic.com/thinking-with-flying-logic/the-categories-of-legitimate-reservation  ·  **Confidence**: H  ·  **Effort**: small
Why TP Studio could care: 10th CLR — flag suspiciously long causal "jumps" that skip steps.

### E3. Back-edge / cycle warning
**Source**: https://docs.flyinglogic.com/thinking-with-flying-logic/the-categories-of-legitimate-reservation  ·  **Confidence**: H  ·  **Effort**: small
Why TP Studio could care: FL treats back-edges as a deliberate reservation; we should at least surface them.

### E4. "House on Fire" CLR (cause not strong enough at this magnitude)
**Source**: https://cdn.ymaws.com/www.tocico.org/resource/resmgr/ch.25_appendix_b.pdf  ·  **Confidence**: M  ·  **Effort**: small
Why TP Studio could care: Listed in TOCICO body-of-knowledge; sometimes-cited extension to the canonical 8.

### E5. Three-level CLR grouping (Clarity → Existence → Sufficiency)
**Source**: https://hohmannchris.wordpress.com/2016/02/16/what-are-categories-of-legitimate-reservation/  ·  **Confidence**: H  ·  **Effort**: trivial
Why TP Studio could care: Grouping our CLR panel by these three levels matches how practitioners apply them.

### E6. Per-entity attestation field ("source / evidence")
**Source**: https://docs.flyinglogic.com/thinking-with-flying-logic/evidence-based-analysis.html  ·  **Confidence**: H  ·  **Effort**: small
Why TP Studio could care: Direct hook for the Entity-Existence CLR — show the attesting source on hover.

---

## F. Layout & visual ergonomics

### F1. Incremental relayout (don't reshuffle untouched nodes)
**Source**: https://flyinglogic.com/history/  ·  **Confidence**: H  ·  **Effort**: medium
Why TP Studio could care: Big disruptive relayouts disorient users mid-edit; minimise motion on insert.

### F2. Fade-in / out animation for added / deleted nodes
**Source**: https://flyinglogic.com/history/  ·  **Confidence**: H  ·  **Effort**: trivial
Why TP Studio could care: Helps users follow what changed during undo / redo.

### F3. Adjustable per-entity title width and font size
**Source**: https://flyinglogic.com/history/  ·  **Confidence**: H  ·  **Effort**: trivial
Why TP Studio could care: Long UDE phrases wrap badly at one fixed width.

### F4. Showcase / dim mode (translucent rather than hidden) for filtered nodes
**Source**: https://docs.kumu.io/getting-started/first-steps  ·  **Confidence**: H  ·  **Effort**: small
Why TP Studio could care: Kumu's "showcase" keeps context visible while highlighting a slice — better than hide.

### F5. Sunburst / radial alternate view
**Source**: https://en.wikipedia.org/wiki/Kialo  ·  **Confidence**: H  ·  **Effort**: medium
Why TP Studio could care: Kialo offers tree + sunburst for the same debate; useful for showing CRT proportions.

### F6. Ink-saving / high-contrast print mode
**Source**: https://flyinglogic.com/history/  ·  **Confidence**: H  ·  **Effort**: trivial
Why TP Studio could care: FL ships this explicitly; reduces colour-fill on printouts.

### F7. Disclosure-triangle "chart mode" for collapsible sub-trees
**Source**: https://flyinglogic.com/history/  ·  **Confidence**: H  ·  **Effort**: small
Why TP Studio could care: We have groups + hoist; per-node disclosure triangles add a lighter-weight collapse.

---

## G. Collaboration / multi-user / comments

### G1. Synchronous co-editing on the same canvas
**Source**: https://cmap.ihmc.us/docs/theory-of-concept-maps  ·  **Confidence**: H  ·  **Effort**: large
Why TP Studio could care: CmapTools has had this since the 2000s; modern users expect it.

### G2. Threaded comments anchored to entities / edges
**Source**: https://cmap.ihmc.us/docs/theory-of-concept-maps  ·  **Confidence**: H  ·  **Effort**: medium
Why TP Studio could care: Reviewers add CLR objections directly on the node they're disputing.

### G3. Post-it / annotation overlay layer
**Source**: https://cmap.ihmc.us/docs/theory-of-concept-maps  ·  **Confidence**: H  ·  **Effort**: small
Why TP Studio could care: Free-floating notes that don't pollute the formal tree.

### G4. Pro / Con sub-claims on each entity
**Source**: https://en.wikipedia.org/wiki/Kialo  ·  **Confidence**: H  ·  **Effort**: medium
Why TP Studio could care: Kialo-style pro / con vote captures workshop reservations in structured form.

### G5. Group voting / claim weighting
**Source**: https://en.wikipedia.org/wiki/Kialo  ·  **Confidence**: H  ·  **Effort**: medium
Why TP Studio could care: Kialo's guided-voting tour is a great pattern for getting a team to triage UDEs.

### G6. Multiple Strategy / Tactic owners per node
**Source**: https://www.toc-goldratt.com/en/product/Harmony-SandT-Software  ·  **Confidence**: H  ·  **Effort**: small
Why TP Studio could care: Harmony explicitly supports multi-owner; useful when a UDE crosses departments.

---

## H. Versioning / branching / what-if

### H1. Inline revision history with restore
**Source**: https://drawio-app.com/blog/why-you-need-revision-handling-for-your-diagrams/  ·  **Confidence**: H  ·  **Effort**: medium
Why TP Studio could care: Draw.io's diagram revision pattern is well-trodden; we currently only have JSON snapshots on disk.

### H2. Visual diff between two versions
**Source**: https://www.inkandswitch.com/patchwork/notebook/2024-version-control/10/  ·  **Confidence**: M  ·  **Effort**: large
Why TP Studio could care: Practitioners need to show "what changed in this CRT since last week" to sponsors.

### H3. Named branches for "what-if" scenarios
**Source**: https://www.inkandswitch.com/patchwork/notebook/2024-version-control/10/  ·  **Confidence**: M  ·  **Effort**: large
Why TP Studio could care: Try out alternative injections without forking the file by hand.

### H4. Compare two trees side-by-side
**Source**: https://drawio-app.com/blog/why-you-need-revision-handling-for-your-diagrams/  ·  **Confidence**: M  ·  **Effort**: medium
Why TP Studio could care: For pre / post FRT comparison; faster than diffing JSON.

### H5. Sensitivity simulation: vary one root, watch downstream
**Source**: https://www.vensim.com/documentation/index.html?sensitivity.htm  ·  **Confidence**: H  ·  **Effort**: large
Why TP Studio could care: Pairs with C1 / C2: sliding a root assumption shows which UDEs depend on it.

---

## I. Templates & onboarding

### I1. Built-in starter templates per tree type
**Source**: https://miro.com/templates/fishbone-diagram/  ·  **Confidence**: H  ·  **Effort**: small
Why TP Studio could care: Miro's templates onboard cold users in minutes; we ship none.

### I2. Guided NBR walkthrough wizard
**Source**: https://intelligentmanagement.ws/learningcentre/negative-branch-reservation-thinking-process-tool/  ·  **Confidence**: M  ·  **Effort**: medium
Why TP Studio could care: NBR is procedural — perfect for a step-by-step wizard.

### I3. "Review my CRT" cognitive-walkthrough mode
**Source**: https://hohmannchris.wordpress.com/2016/02/16/what-are-categories-of-legitimate-reservation/  ·  **Confidence**: M  ·  **Effort**: small
Why TP Studio could care: A guided pass through the 10 CLRs, one entity at a time.

### I4. Example library: Goldratt classics (production, sales, projects)
**Source**: https://flyinglogic.com/1152/how-to-create-a-current-reality-tree-with-flying-logic/  ·  **Confidence**: M  ·  **Effort**: small
Why TP Studio could care: Reusable canonical trees teach the method while showing the tool.

### I5. Built-in domains for adjacent notations (Goal Tree, IBIS, Argument map)
**Source**: https://vithanco.com/tools/vgl/  ·  **Confidence**: H  ·  **Effort**: medium
Why TP Studio could care: Vithanco supports CRT + IBIS + Goal Tree in one app — broader market.

---

## J. Integrations

### J1. MS Project XML / MPX import & export (for Transition Trees that become plans)
**Source**: https://flyinglogic.com/history/  ·  **Confidence**: H  ·  **Effort**: large
Why TP Studio could care: FL exports schedule data; lets TP Studio hand off to PM teams.

### J2. Realization Concerto (critical-chain) export
**Source**: https://flyinglogic.com/history/  ·  **Confidence**: H  ·  **Effort**: large
Why TP Studio could care: FL added this for the CCPM crowd; same data model fits a PRT.

### J3. Jira-issue link per entity
**Source**: https://memfault.com/blog/product-updates-all-new-jira-integration-to-streamline-your-workflow-2/  ·  **Confidence**: M  ·  **Effort**: small
Why TP Studio could care: Lets a UDE or injection point at the ticket that resolves it; sync status back.

### J4. Confluence / Notion embed
**Source**: https://help.miro.com/hc/en-us/articles/360016335640-Embed-a-Miro-board  ·  **Confidence**: H  ·  **Effort**: small
Why TP Studio could care: Most TPs end up illustrating an internal wiki page; embed code beats screenshot.

### J5. CSV bulk import with column-mapping wizard
**Source**: https://flyinglogic.com/history/  ·  **Confidence**: H  ·  **Effort**: small
Why TP Studio could care: We have CSV export; FL ships customisable CSV import for round-trip.

---

## K. Embeds / sharing

### K1. Public read-only share link
**Source**: https://help.miro.com/hc/en-us/articles/360016335640-Embed-a-Miro-board  ·  **Confidence**: H  ·  **Effort**: medium
Why TP Studio could care: Practitioners share trees with sponsors without licensing them.

### K2. Password-protected publish link
**Source**: https://www.lucidchart.com/blog/getting-started-sharing-and-collaboration  ·  **Confidence**: H  ·  **Effort**: small
Why TP Studio could care: Lucid does this; protects sensitive CRTs.

### K3. Embed with start-area / focus-object preset
**Source**: https://help.miro.com/hc/en-us/articles/360126335640-Embed-a-Miro-board  ·  **Confidence**: H  ·  **Effort**: small
Why TP Studio could care: Same tree, different embeds zoomed to a sub-branch — supports blog-post storytelling.

### K4. Anonymous viewer comments
**Source**: https://help.miro.com/hc/en-us/articles/360016335640-Embed-a-Miro-board  ·  **Confidence**: M  ·  **Effort**: medium
Why TP Studio could care: Lightweight feedback collection without account creation.

---

## L. Mobile / touch

### L1. Touch-first manipulation (drag to create, two-finger pan, pinch-zoom)
**Source**: https://www.synergycodes.com/blog/building-usable-and-accessible-diagrams-with-react-flow  ·  **Confidence**: M  ·  **Effort**: medium
Why TP Studio could care: TP Studio is browser-based; tablet support is mostly a CSS / touch-handler problem.

### L2. Stylus / pressure-aware sketch mode for annotations
**Source**: https://www.xp-pen.com/blog/touch-function-drawing-tablet.html  ·  **Confidence**: L  ·  **Effort**: medium
Why TP Studio could care: Workshop facilitators want to ink quick notes on a tree from an iPad / Wacom.

---

## M. Accessibility beyond what we have

### M1. Full keyboard navigation through the graph (Tab between nodes, arrow between edges)
**Source**: https://www.synergycodes.com/portfolio/accessibility-in-workflow-builder  ·  **Confidence**: H  ·  **Effort**: medium
Why TP Studio could care: WCAG 2.1 keyboard navigation is rarely complete in diagram tools; differentiator.

### M2. ARIA descriptions for nodes / edges
**Source**: https://www.synergycodes.com/blog/building-usable-and-accessible-diagrams-with-react-flow  ·  **Confidence**: H  ·  **Effort**: medium
Why TP Studio could care: Screen-reader announces "UDE 'late deliveries' caused by Root Cause 'capacity bottleneck'."

### M3. High-contrast theme variant (separate from colour palettes)
**Source**: https://www.a11y-collective.com/blog/accessible-charts/  ·  **Confidence**: H  ·  **Effort**: small
Why TP Studio could care: Even our colourblind-safe palette can fail at low contrast; ship a WCAG-AAA pair.

### M4. Tab + Enter focus chart from a search box
**Source**: https://cambridge-intelligence.com/build-accessible-data-visualization-apps-with-keylines/  ·  **Confidence**: H  ·  **Effort**: small
Why TP Studio could care: We have search; this hooks it into keyboard focus for AT users.

---

## N. Data import / export formats

### N1. OPML export
**Source**: https://flyinglogic.com/history/  ·  **Confidence**: H  ·  **Effort**: small
Why TP Studio could care: FL exports OPML so users can take a tree into outliners; we already have Quick Capture from indented text — round-trip closes nicely.

### N2. Graphviz DOT export
**Source**: https://flyinglogic.com/history/  ·  **Confidence**: H  ·  **Effort**: small
Why TP Studio could care: FL ships DOT export; opens scripting / CI use cases.

### N3. Mermaid syntax export / import
**Source**: https://www.drawio.com/blog/mermaid-diagrams  ·  **Confidence**: H  ·  **Effort**: small
Why TP Studio could care: Most engineering wikis render Mermaid natively; one-click conversion lets devs paste a CRT into a README.

### N4. XSLT-based custom export
**Source**: https://flyinglogic.com/history/  ·  **Confidence**: H  ·  **Effort**: medium
Why TP Studio could care: User-supplied templates produce arbitrary text outputs (HTML reports, policy docs).

### N5. Declarative text format (VGL-style)
**Source**: https://vithanco.com/tools/vgl/  ·  **Confidence**: H  ·  **Effort**: large
Why TP Studio could care: Vithanco's VGL is human-prose + machine-graph; a TP-Studio DSL would let trees live in git.

### N6. Print-to-PDF with searchable text (not just rasterised entities)
**Source**: https://www.scoop.it/topic/theory-of-constraints-by-philip-marris/p/4007055735/2013/09/04/flying-logic-toc-thinking-processes-software  ·  **Confidence**: M  ·  **Effort**: small
Why TP Studio could care: A long-standing FL complaint is that PDF export lacks text-layer; we can ship that on day one.

---

## O. Quantitative analysis

### O1. Loop detection / dominance analysis for back-edges
**Source**: https://onlinelibrary.wiley.com/doi/10.1002/sdr.1757  ·  **Confidence**: M  ·  **Effort**: large
Why TP Studio could care: TP trees occasionally have reinforcing loops; SD literature offers algorithms to rank loop strength.

### O2. System-archetype detection (e.g. "limits to growth", "fixes that fail")
**Source**: https://i2insights.org/2025/09/16/four-core-system-dynamics-concepts/  ·  **Confidence**: M  ·  **Effort**: large
Why TP Studio could care: Pattern-match a CRT against canonical archetypes — surface the diagnosis automatically.

### O3. Throughput / cycle-time math attached to edges
**Source**: https://elischragenheim.com/2016/04/03/toc-and-software-the-search-for-value/  ·  **Confidence**: M  ·  **Effort**: large
Why TP Studio could care: Schragenheim's Throughput Economics thread is exactly TOC-the-numbers; a quantitative overlay broadens the audience.

### O4. Sensitivity heat-map (which entity moves which outcome most)
**Source**: https://www.numberanalytics.com/blog/vensim-system-dynamics-modeling-tips  ·  **Confidence**: M  ·  **Effort**: medium
Why TP Studio could care: Once edges carry weights, ranking root causes by their influence on UDEs is a small additional step.

---

## P. Speculative / unattested-but-supported-by-discussion

### P1. Inference-scheme tagging on edges (deductive / inductive / analogical)
**Source**: http://www.argunet.org/working-with-argunet/ch03.html  ·  **Confidence**: M  ·  **Effort**: small
Why TP Studio could care: Argunet lets users mark the warrant on each link; would sharpen CLR conversations.

### P2. Per-edge "attack" vs "support" relation (Argunet)
**Source**: http://www.argunet.org/working-with-argunet/ch03s02.html  ·  **Confidence**: H  ·  **Effort**: medium
Why TP Studio could care: Captures objections in-graph rather than via descriptions; useful for FRT reservations.

### P3. Evidence-source typology (assertion / data / expert / case / quote)
**Source**: https://rationaleonline.com/  ·  **Confidence**: H  ·  **Effort**: small
Why TP Studio could care: Rationale's typed evidence boxes are a clean pattern for attesting entity existence.

### P4. Simulate-by-perturbation animation (Loopy style)
**Source**: https://ncase.me/loopy/  ·  **Confidence**: H  ·  **Effort**: large
Why TP Studio could care: Click a root cause "+/-" and watch the perturbation flow downstream — visceral teaching tool.

### P5. ProConCloud variant of Evaporating Cloud (Alan Barnard)
**Source**: https://www.dralanbarnard.com/pdf/What_is_Theory_of_Constraints_(TOC).PDF  ·  **Confidence**: M  ·  **Effort**: medium
Why TP Studio could care: Barnard's extension of EC adds pros / cons to each side — natural fit if we already build EC.

### P6. Plug-in / vnotation system: user-defined entity / edge schema
**Source**: https://vithanco.com/tools/vgl/user-defined-notations-vnotation/  ·  **Confidence**: H  ·  **Effort**: large
Why TP Studio could care: Vithanco lets users define new notations declaratively; the same approach lets TP Studio host non-TOC trees without code changes.
