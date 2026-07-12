import { buildEdge, buildEntity } from '../examples/shared';
import { ST_FACET_KEYS } from '../graph';
import { newDocumentId } from '../ids';
import type { Edge, Entity, TPDocument } from '../types';

/**
 * Session 198 (backlog G) — shared builder for the facet-based Strategy & Tactics
 * template pack, built on the corrected DIRECTIONAL model (backlog B).
 *
 * Unlike the older facet-free S&T patterns (which model the strategy as a `goal`
 * node and the assumptions as `necessaryCondition` titles), here every step is a
 * single first-class `injection` card carrying its strategy + three directional
 * assumptions as the reserved `ST_FACET_KEYS` attributes. That is what renders as
 * the tall facet card and what the position-aware validators read.
 *
 * Each step supplies only the assumptions its position calls for, so the pack
 * opens clean against `st-tactic-assumptions`:
 *   - the apex omits `necessary` (nothing above it);
 *   - a leaf omits `sufficiency` (nothing below it);
 *   - every step carries `strategy` + `parallel`.
 * Non-leaf steps always fan out to ≥2 children, so `st-tactic-fold-in` stays
 * quiet. Leaf steps legitimately trip `st-tactic-rollup` (a leaf HAS a parent and
 * no children) — that nudge is pre-resolved here since a template's leaves are
 * intentional, so the doc opens without noise.
 */
export type STStepSpec = {
  /** The tactic — becomes the injection's title. */
  tactic: string;
  /** The outcome this step delivers (`stStrategy`). */
  strategy: string;
  /** Why this step is needed (`stNecessaryAssumption`). Omit on the apex. */
  necessary?: string;
  /** Why this tactic fits the strategy (`stParallelAssumption`). */
  parallel: string;
  /** Why the step needs sub-steps (`stSufficiencyAssumption`). Omit on a leaf. */
  sufficiency?: string;
  children?: STStepSpec[];
};

export const buildSTFacetDoc = (title: string, apex: STStepSpec): TPDocument => {
  const t = Date.now();
  let ann = 0;
  const entities: Entity[] = [];
  const edges: Edge[] = [];
  const resolvedWarnings: Record<string, true> = {};

  const walk = (spec: STStepSpec, parentId?: Entity['id']): void => {
    ann += 1;
    const attributes: Record<string, { kind: 'string'; value: string }> = {
      [ST_FACET_KEYS.strategy]: { kind: 'string', value: spec.strategy },
      [ST_FACET_KEYS.parallelAssumption]: { kind: 'string', value: spec.parallel },
    };
    if (spec.necessary) {
      attributes[ST_FACET_KEYS.necessaryAssumption] = { kind: 'string', value: spec.necessary };
    }
    if (spec.sufficiency) {
      attributes[ST_FACET_KEYS.sufficiencyAssumption] = { kind: 'string', value: spec.sufficiency };
    }
    const node: Entity = { ...buildEntity('injection', spec.tactic, t, ann), attributes };
    entities.push(node);
    if (parentId) edges.push(buildEdge(node.id, parentId)); // edge runs child → parent
    const children = spec.children ?? [];
    if (children.length === 0 && parentId) {
      // Intentional leaf — pre-resolve the rollup nudge so the template is clean.
      resolvedWarnings[`st-tactic-rollup:entity:${node.id}`] = true;
    }
    for (const child of children) walk(child, node.id);
  };
  walk(apex);

  return {
    id: newDocumentId(),
    diagramType: 'st',
    title,
    entities: Object.fromEntries(entities.map((e) => [e.id, e])),
    edges: Object.fromEntries(edges.map((e) => [e.id, e])),
    groups: {},
    resolvedWarnings,
    nextAnnotationNumber: ann + 1,
    createdAt: t,
    updatedAt: t,
    schemaVersion: 10,
  };
};
