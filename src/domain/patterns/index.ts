/**
 * Pattern library — curated starter diagrams for common TOC scenarios.
 *
 * Session 134 closed minor gap #4 (sub-item A) from the spec gap
 * analysis with the first two patterns + the dialog plumbing.
 * Session 137 expanded the library to **5 patterns per diagram type**
 * (CRT / FRT / PRT / TT / EC / Goal Tree / S&T / NBR), drawn from
 * canonical TOC literature (Goldratt, Dettmer, Scheinkopf, Cox /
 * Boyd) with original descriptions — no copy-paste at the entity-
 * title level.
 *
 * Each `Pattern` is a fully-formed `TPDocument` factory the "Pattern
 * library…" picker can drop onto the canvas as a starting point.
 * Distinct from `EXAMPLE_BY_DIAGRAM` (one example per diagram type,
 * kept for the quick "Load example" command); patterns are
 * many-per-type and surface in a dedicated library dialog.
 *
 * The library is intentionally curated, not generated: each pattern
 * should be a teaching-quality starting point that a TOC practitioner
 * would recognise as a canonical shape. Toy data dilutes the value.
 *
 * Growing the library: add a builder file alongside this one (one
 * per pattern), then register it in `PATTERNS` below. The registry
 * is a flat array because patterns aren't keyed on diagram type
 * alone — multiple patterns share a `diagramType` and the dialog
 * needs the per-pattern label / hint to differentiate them.
 */
import { buildExampleCRT } from '../examples/crt';
import { buildExampleEC } from '../examples/ec';
import { buildExampleFRT } from '../examples/frt';
import { buildExampleGoalTree } from '../examples/goalTree';
import { buildExampleNBR } from '../examples/nbr';
import { buildExamplePRT } from '../examples/prt';
import { buildExampleST } from '../examples/st';
import { buildExampleTT } from '../examples/tt';
import type { DiagramType, TPDocument } from '../types';
import { buildPatternCloudCore } from './cloud-core';
import { buildPatternCloudFirefighting } from './cloud-firefighting';
import { buildPatternCloudUDE } from './cloud-ude';
import { buildPatternCRTEngineeringVelocity } from './crt-engineering-velocity';
import { buildPatternCRTInventoryTurnsFalling } from './crt-inventory-turns-falling';
import { buildPatternCRTMultiProjectBottleneck } from './crt-multi-project-bottleneck';
import { buildPatternCRTSalesPipelineStall } from './crt-sales-pipeline-stall';
import { buildPatternCRTTonsPerHour } from './crt-tons-per-hour';
import { buildPatternECBatchSize } from './ec-batch-size';
import { buildPatternECBuildVsBuy } from './ec-build-vs-buy';
import { buildPatternECCentralizeVsFederate } from './ec-centralize-vs-federate';
import { buildPatternECCostVsThroughput } from './ec-cost-vs-throughput';
import { buildPatternECDelegation } from './ec-delegation';
import { buildPatternECEfratsChangeCloud } from './ec-efrats-change-cloud';
import { buildPatternECInventoryVsAvailability } from './ec-inventory-vs-availability';
import { buildPatternECPricing } from './ec-pricing';
import { buildPatternECProfitSpendVsSave } from './ec-profit-spend-vs-save';
import { buildPatternECProjectTaskSafety } from './ec-project-task-safety';
import { buildPatternECQualityVsSpeed } from './ec-quality-vs-speed';
import { buildPatternECSpeakUpVsStaySafe } from './ec-speak-up-vs-stay-safe';
import { buildPatternECSpecialistVsGeneralist } from './ec-specialist-vs-generalist';
import { buildPatternECTransformationVsQuarter } from './ec-transformation-vs-quarter';
import { buildPatternFRTDbrScheduling } from './frt-dbr-scheduling';
import { buildPatternFRTPricingExperiment } from './frt-pricing-experiment';
import { buildPatternFRTScheduleAdherence } from './frt-schedule-adherence';
import { buildPatternFRTTeamOkrs } from './frt-team-okrs';
import { buildPatternFRTWipCap } from './frt-wip-cap';
import { buildPatternGoalTreeEffectiveSalesTeam } from './goalTree-effective-sales-team';
import { buildPatternGoalTreeITFunction } from './goalTree-it-function';
import { buildPatternGoalTreeSubscriptionBusiness } from './goalTree-subscription-business';
import { buildPatternGoalTreeSustainableProductOrg } from './goalTree-sustainable-product-org';
import { buildPatternGoalTreeTrustworthyMl } from './goalTree-trustworthy-ml';
import { buildPatternNBRAggressiveDeadlines } from './nbr-aggressive-deadlines';
import { buildPatternNBRHiringFreeze } from './nbr-hiring-freeze';
import { buildPatternNBROpenSourceRelease } from './nbr-open-source-release';
import { buildPatternNBROutsourcedSupport } from './nbr-outsourced-support';
import { buildPatternPRTDatabaseMigration } from './prt-database-migration';
import { buildPatternPRTNewMarketEntry } from './prt-new-market-entry';
import { buildPatternPRTPerformanceReviews } from './prt-performance-reviews';
import { buildPatternPRTZeroDefects } from './prt-zero-defects';
import { buildPatternSTConstraintExploitation } from './st-constraint-exploitation';
import { buildPatternSTMarketExpansion } from './st-market-expansion';
import { buildPatternSTQualityFirst } from './st-quality-first';
import { buildPatternSTTimeToMarket } from './st-time-to-market';
import { buildPatternTTDealClose } from './tt-deal-close';
import { buildPatternTTEngineerOnboarding } from './tt-engineer-onboarding';
import { buildPatternTTFeatureRollout } from './tt-feature-rollout';
import { buildPatternTTIncidentResponse } from './tt-incident-response';

export type Pattern = {
  /** Stable id used by tests + as the dialog list key. */
  id: string;
  /** Card title in the library dialog. */
  label: string;
  /** One-line description of what the pattern models — surfaces in the
   *  card hint below the label. */
  hint: string;
  /** Drives the diagram-type filter pill and the chip on each card. */
  diagramType: DiagramType;
  /** Mints a fresh `TPDocument`. Called when the user picks the card.
   *  Same shape as `EXAMPLE_BY_DIAGRAM[type]()`. */
  build: () => TPDocument;
};

export const PATTERNS: Pattern[] = [
  // ── CRT ────────────────────────────────────────────────────────────
  {
    id: 'crt-customer-satisfaction',
    label: 'Customer satisfaction declining',
    hint: 'Classic operational CRT — fulfilment-flow root causes feeding a single customer UDE, with one AND junctor.',
    diagramType: 'crt',
    build: buildExampleCRT,
  },
  {
    id: 'crt-engineering-velocity',
    label: 'Engineering velocity decline',
    hint: 'Software-team CRT — sprint slip rolls up from on-call / review / flake causes, with an AND on the ops-drag effect.',
    diagramType: 'crt',
    build: buildPatternCRTEngineeringVelocity,
  },
  {
    id: 'crt-multi-project-bottleneck',
    label: 'Multi-project bottleneck',
    hint: 'Critical-chain CRT — shared-specialist contention combines with safety-burn and WIP indiscipline to slip every milestone at once.',
    diagramType: 'crt',
    build: buildPatternCRTMultiProjectBottleneck,
  },
  {
    id: 'crt-sales-pipeline-stall',
    label: 'Sales pipeline stall',
    hint: 'Revenue-team CRT — qualification gaps + SE bottleneck + discount-lever behaviour combine to miss quarterly target.',
    diagramType: 'crt',
    build: buildPatternCRTSalesPipelineStall,
  },
  {
    id: 'crt-inventory-turns-falling',
    label: 'Inventory turns falling',
    hint: 'Manufacturing CRT — batch sizing + safety stock + maintenance over-buy combine to drag inventory turns below plan.',
    diagramType: 'crt',
    build: buildPatternCRTInventoryTurnsFalling,
  },
  {
    id: 'crt-tons-per-hour',
    label: 'Local-optimum measure (tons per hour)',
    hint: "Goldratt's archetype — one local measure (reward the furnace on tons/hour) sprays into a UDE field: WIP piles up, the wrong mix is poured, inventory balloons, orders ship late. AND on the late-orders UDE; pairs with the schedule-adherence FRT.",
    diagramType: 'crt',
    build: buildPatternCRTTonsPerHour,
  },

  // ── EC ─────────────────────────────────────────────────────────────
  {
    id: 'ec-work-life-balance',
    label: 'Work / life balance',
    hint: 'Teaching-classic personal EC — "leave at 5" vs "stay late", with the explicit D↔D′ mutex arrow.',
    diagramType: 'ec',
    build: buildExampleEC,
  },
  {
    id: 'ec-cloud-ude',
    label: 'UDE cloud',
    hint: 'TP Basics cloud progression — the conflict behind one undesirable effect (missed delivery dates). Pre-tagged cloud-type "UDE".',
    diagramType: 'ec',
    build: buildPatternCloudUDE,
  },
  {
    id: 'ec-cloud-core',
    label: 'Core cloud',
    hint: 'TP Basics cloud progression — the recurring conflict under many UDEs (produce now vs. protect the future). Pre-tagged cloud-type "Core".',
    diagramType: 'ec',
    build: buildPatternCloudCore,
  },
  {
    id: 'ec-cloud-firefighting',
    label: 'Firefighting cloud',
    hint: 'TP Basics cloud progression — the symptom-vs-cause trap (fix now vs. fix the cause). Pre-tagged cloud-type "Firefighting".',
    diagramType: 'ec',
    build: buildPatternCloudFirefighting,
  },
  {
    id: 'ec-quality-vs-speed',
    label: 'Quality vs speed',
    hint: 'Engineering tradeoff EC — QA gate vs continuous delivery, both routes to "ship features customers love".',
    diagramType: 'ec',
    build: buildPatternECQualityVsSpeed,
  },
  {
    id: 'ec-centralize-vs-federate',
    label: 'Centralize vs federate',
    hint: 'Org-design EC — central design-system team vs embedded maintainers, around shared brand coherence.',
    diagramType: 'ec',
    build: buildPatternECCentralizeVsFederate,
  },
  {
    id: 'ec-build-vs-buy',
    label: 'Build vs buy',
    hint: 'Procurement EC — in-house customer data platform vs vendor adoption, around control and speed needs.',
    diagramType: 'ec',
    build: buildPatternECBuildVsBuy,
  },
  {
    id: 'ec-specialist-vs-generalist',
    label: 'Specialist vs generalist hiring',
    hint: 'Team-composition EC — deep-tenure hire vs T-shaped hire, around "solve hard problems" vs "pivot to new ones."',
    diagramType: 'ec',
    build: buildPatternECSpecialistVsGeneralist,
  },
  {
    id: 'ec-efrats-change-cloud',
    label: "Resistance to change (Efrat's cloud)",
    hint: 'The buy-in workhorse after Efrat Goldratt-Ashlag (1995) — happiness at work needs both satisfaction (which pulls you to embrace change) and security (which pulls you to resist it), so the same person wants and fears the change at once.',
    diagramType: 'ec',
    build: buildPatternECEfratsChangeCloud,
  },
  {
    id: 'ec-speak-up-vs-stay-safe',
    label: 'Speak up vs stay safe',
    hint: 'Identity-protection EC — keep quiet vs name the hard issues, around standing on the team vs surfacing the real problems.',
    diagramType: 'ec',
    build: buildPatternECSpeakUpVsStaySafe,
  },
  {
    id: 'ec-transformation-vs-quarter',
    label: 'Transformation vs this quarter',
    hint: 'Short-term-vs-long-term EC — fund this quarter vs fund the transformation, the reason a sound change keeps getting deferred.',
    diagramType: 'ec',
    build: buildPatternECTransformationVsQuarter,
  },
  {
    id: 'ec-cost-vs-throughput',
    label: 'Cost world vs throughput world',
    hint: "The idle-worker conflict from *The Goal* — keep every resource busy (local efficiency) vs let non-constraints idle (subordinate to the drum). TOC's foundational cloud.",
    diagramType: 'ec',
    build: buildPatternECCostVsThroughput,
  },
  {
    id: 'ec-batch-size',
    label: 'Batch size (EBQ)',
    hint: 'Economic-batch-quantity conflict — amortise setup over large batches vs cut carrying cost with small batches. Broken by quick-changeover (setup-time collapse).',
    diagramType: 'ec',
    build: buildPatternECBatchSize,
  },
  {
    id: 'ec-inventory-vs-availability',
    label: 'Inventory vs availability',
    hint: 'Distribution/retail cloud — high store stock to protect sales vs low stock to protect cash and margin. Broken by central holding + frequent pull replenishment.',
    diagramType: 'ec',
    build: buildPatternECInventoryVsAvailability,
  },
  {
    id: 'ec-project-task-safety',
    label: 'Project task safety',
    hint: 'The Critical Chain conflict — pad every task vs strip task safety. Broken by aggregating safety into a shared project/feeding buffer managed by buffer consumption.',
    diagramType: 'ec',
    build: buildPatternECProjectTaskSafety,
  },
  {
    id: 'ec-profit-spend-vs-save',
    label: 'Profit: spend vs save',
    hint: 'The simplest teaching cloud — grow value by improving the product (spend) vs reduce cost by cutting expenses (save), both to increase profit.',
    diagramType: 'ec',
    build: buildPatternECProfitSpendVsSave,
  },
  {
    id: 'ec-delegation',
    label: 'Delegation',
    hint: 'Everyday-management cloud — let people do the work (develop them) vs do it myself (guarantee the result), both to lead a team that delivers and grows.',
    diagramType: 'ec',
    build: buildPatternECDelegation,
  },
  {
    id: 'ec-pricing',
    label: 'Pricing (discount vs hold)',
    hint: 'Commercial cloud — win the deal by dropping price vs protect margin by holding it. Broken by competing on quantified value instead of the discount lever.',
    diagramType: 'ec',
    build: buildPatternECPricing,
  },

  // ── FRT ────────────────────────────────────────────────────────────
  {
    id: 'frt-default',
    label: 'Future Reality Tree starter',
    hint: 'Bottom-up FRT seeded with an injection — propagates through intermediate effects to a desired effect.',
    diagramType: 'frt',
    build: buildExampleFRT,
  },
  {
    id: 'frt-wip-cap',
    label: 'WIP cap rollout',
    hint: 'Flow-improvement FRT — cap WIP at every stage; queues drain, hand-offs surface, variance narrows, p95 lead-time drops.',
    diagramType: 'frt',
    build: buildPatternFRTWipCap,
  },
  {
    id: 'frt-team-okrs',
    label: 'Single-team OKR adoption',
    hint: 'Focus-first FRT — cutting to two team objectives drives clarity, deeper work, and the right outcomes shipped.',
    diagramType: 'frt',
    build: buildPatternFRTTeamOkrs,
  },
  {
    id: 'frt-dbr-scheduling',
    label: 'Drum-buffer-rope scheduling',
    hint: 'Manufacturing FRT — DBR drains WIP, kills expedites, and lifts plant throughput on existing capacity.',
    diagramType: 'frt',
    build: buildPatternFRTDbrScheduling,
  },
  {
    id: 'frt-pricing-experiment',
    label: 'Segment-specific pricing experiment',
    hint: 'Commercial FRT — price change + CPQ lock jointly drive enterprise margin lift without churn.',
    diagramType: 'frt',
    build: buildPatternFRTPricingExperiment,
  },
  {
    id: 'frt-schedule-adherence',
    label: 'Local-measure swap (schedule adherence)',
    hint: 'The FRT counterpart to the tons-per-hour CRT — swap the local measure for finishing-schedule adherence; the right mix is poured, WIP drains, inventory falls, orders ship on time. AND on the on-time effect.',
    diagramType: 'frt',
    build: buildPatternFRTScheduleAdherence,
  },

  // ── PRT ────────────────────────────────────────────────────────────
  {
    id: 'prt-default',
    label: 'Prerequisite Tree starter',
    hint: 'Necessity-style PRT — objective at top, obstacles beneath, intermediate objectives clearing each.',
    diagramType: 'prt',
    build: buildExamplePRT,
  },
  {
    id: 'prt-database-migration',
    label: 'Database migration',
    hint: 'Technical PRT — four obstacles a real migration team will recognise, each paired with a measurable IO.',
    diagramType: 'prt',
    build: buildPatternPRTDatabaseMigration,
  },
  {
    id: 'prt-new-market-entry',
    label: 'New-market entry',
    hint: 'Go-to-market PRT — regulatory, brand, payments, and support obstacles for entering a new geographic market.',
    diagramType: 'prt',
    build: buildPatternPRTNewMarketEntry,
  },
  {
    id: 'prt-performance-reviews',
    label: 'Performance-review rollout',
    hint: 'Change-management PRT — the four social obstacles every performance-review rollout actually trips over.',
    diagramType: 'prt',
    build: buildPatternPRTPerformanceReviews,
  },
  {
    id: 'prt-zero-defects',
    label: 'Zero-defect manufacturing',
    hint: 'Quality-program PRT — culture, measurement, supplier-drift, and ECO obstacles to consistent zero-defect shipping.',
    diagramType: 'prt',
    build: buildPatternPRTZeroDefects,
  },

  // ── TT ─────────────────────────────────────────────────────────────
  {
    id: 'tt-support-triage',
    label: 'Support triage Transition Tree',
    hint: 'Canonical Outcome ← (Precondition + Action) triples joined by AND junctors, including one unspecified precondition.',
    diagramType: 'tt',
    build: buildExampleTT,
  },
  {
    id: 'tt-engineer-onboarding',
    label: 'Engineer onboarding',
    hint: 'People-process TT — laptop → environment → starter ticket → reviewed PR → first production merge.',
    diagramType: 'tt',
    build: buildPatternTTEngineerOnboarding,
  },
  {
    id: 'tt-incident-response',
    label: 'Incident response',
    hint: "Ops TT — acknowledge, identify, communicate, mitigate, post-mortem — each step's outcome a measurable state.",
    diagramType: 'tt',
    build: buildPatternTTIncidentResponse,
  },
  {
    id: 'tt-feature-rollout',
    label: 'Feature-flag rollout',
    hint: 'Delivery TT — staged cohorts (employees → 1% → 25% → 100%) with measurement gates between every expansion.',
    diagramType: 'tt',
    build: buildPatternTTFeatureRollout,
  },
  {
    id: 'tt-deal-close',
    label: 'Enterprise deal close',
    hint: 'Sales TT — buyer-side stakeholder states (champion → CFO sponsor → security → procurement → signed).',
    diagramType: 'tt',
    build: buildPatternTTDealClose,
  },

  // ── NBR ────────────────────────────────────────────────────────────
  {
    id: 'nbr-qa-gate',
    label: 'QA gate NBR',
    hint: 'Software-team NBR — QA-gate injection spawns slower releases + lost competitive edge; proactive mitigation swaps to test-suite hardening.',
    diagramType: 'nbr',
    build: buildExampleNBR,
  },
  {
    id: 'nbr-hiring-freeze',
    label: 'Hiring freeze NBR',
    hint: 'Cost-control NBR — freeze drops headcount cost but produces burnout + leadership-pipeline thinning; mitigation keeps critical backfills.',
    diagramType: 'nbr',
    build: buildPatternNBRHiringFreeze,
  },
  {
    id: 'nbr-aggressive-deadlines',
    label: 'Aggressive deadlines NBR',
    hint: 'Schedule-pressure NBR — public deadline hits the date but spawns post-launch incidents + senior attrition; mitigation cuts scope instead.',
    diagramType: 'nbr',
    build: buildPatternNBRAggressiveDeadlines,
  },
  {
    id: 'nbr-outsourced-support',
    label: 'Outsourced support NBR',
    hint: 'Cost-savings NBR — vendor support drops cost but loses customer signal + slows escalation; mitigation requires weekly issue patterns + 1h SLA.',
    diagramType: 'nbr',
    build: buildPatternNBROutsourcedSupport,
  },
  {
    id: 'nbr-open-source-release',
    label: 'Open-source release NBR',
    hint: 'Visibility-injection NBR — OSS release lifts adoption but adds maintainer burnout + enterprise dilution; mitigation carves out paid surfaces.',
    diagramType: 'nbr',
    build: buildPatternNBROpenSourceRelease,
  },

  // ── Goal Tree ─────────────────────────────────────────────────────
  {
    id: 'goalTree-default',
    label: 'Goal Tree starter',
    hint: '3-layer necessity tree — Goal at top, Critical Success Factors beneath, Necessary Conditions feeding each CSF.',
    diagramType: 'goalTree',
    build: buildExampleGoalTree,
  },
  {
    id: 'goalTree-sustainable-product-org',
    label: 'Sustainable product organization',
    hint: 'Org Goal Tree — local decision-making, outcome learning, sustainable pace, with observable NC numbers.',
    diagramType: 'goalTree',
    build: buildPatternGoalTreeSustainableProductOrg,
  },
  {
    id: 'goalTree-subscription-business',
    label: 'Profitable subscription business',
    hint: 'Financial Goal Tree — CAC payback, retention, and per-customer margin, each tied to a board-pack number.',
    diagramType: 'goalTree',
    build: buildPatternGoalTreeSubscriptionBusiness,
  },
  {
    id: 'goalTree-trustworthy-ml',
    label: 'Trustworthy ML system',
    hint: 'ML-system Goal Tree — honest claims, online/offline parity, detectable failures, with observable practices as NCs.',
    diagramType: 'goalTree',
    build: buildPatternGoalTreeTrustworthyMl,
  },
  {
    id: 'goalTree-effective-sales-team',
    label: 'Effective sales team',
    hint: 'Go-to-market Goal Tree — real pipeline, equipped reps, coaching that pays off — each NC visible on a Monday.',
    diagramType: 'goalTree',
    build: buildPatternGoalTreeEffectiveSalesTeam,
  },
  {
    id: 'goalTree-it-function',
    label: 'Generic IT-function goals',
    hint: "IT-function Goal Tree (from Dann's 2020 article) — a build-and-implement value arm and an efficient-operation arm, under a financial-restriction boundary.",
    diagramType: 'goalTree',
    build: buildPatternGoalTreeITFunction,
  },

  // ── S&T ───────────────────────────────────────────────────────────
  {
    id: 'st-default',
    label: 'Strategy & Tactics starter',
    hint: 'Hierarchical S&T — strategy / tactic pairs with rationale fields (necessary / parallel / sufficient assumptions).',
    diagramType: 'st',
    build: buildExampleST,
  },
  {
    id: 'st-constraint-exploitation',
    label: 'Operating-constraint exploitation',
    hint: 'Five-focusing-steps S&T — subordinate every other station to the bottleneck; setup / cleaning moved off the constraint.',
    diagramType: 'st',
    build: buildPatternSTConstraintExploitation,
  },
  {
    id: 'st-quality-first',
    label: 'Quality-first strategy',
    hint: 'Quality-as-moat S&T — "no surprise releases" gate plus test plans + customer-shape samples on every PR.',
    diagramType: 'st',
    build: buildPatternSTQualityFirst,
  },
  {
    id: 'st-market-expansion',
    label: 'Geographic market expansion',
    hint: 'Go-to-market S&T — locally-staffed presence in the new market via a country-lead-first hiring sequence.',
    diagramType: 'st',
    build: buildPatternSTMarketExpansion,
  },
  {
    id: 'st-time-to-market',
    label: 'Reduce time-to-market',
    hint: 'Concurrent-engineering S&T — design / engineering / GTM converging on a single live brief with weekly cross-team reviews.',
    diagramType: 'st',
    build: buildPatternSTTimeToMarket,
  },
];

/** Subset of `PATTERNS` matching the given diagram type, in registry order. */
export const patternsForDiagram = (diagramType: DiagramType): Pattern[] =>
  PATTERNS.filter((p) => p.diagramType === diagramType);

/** Lookup by stable id; `undefined` if the id isn't in the registry. */
export const patternById = (id: string): Pattern | undefined => PATTERNS.find((p) => p.id === id);
