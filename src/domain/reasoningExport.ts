import type { CausalityLabel } from '@/store/uiSlice/types';
import { findCoreDrivers } from './coreDriver';
import { renderEdgeSentence, resolveEdgeConnector, topologicalEdgeOrder } from './edgeReading';
import { DIAGRAM_TYPE_LABEL, ENTITY_TYPE_META } from './entityTypeMeta';
import { incomingEdges, isAssumption, outgoingEdges, structuralEntities } from './graph';
import type { Edge, Entity, TPDocument } from './types';

/**
 * Reasoning text exporter — compiles the diagram's causal logic into a
 * Markdown document a user can paste into a brief, deck, or postmortem.
 *
 * Two output modes share the same primitives (`renderEdgeSentence`,
 * `resolveEdgeConnector`, `topologicalEdgeOrder` from `edgeReading.ts`):
 *
 *   - **Narrative form** — one sentence per edge in topological order,
 *     plus diagram-type-specific preamble (System Scope, EC conflict
 *     statement) and appendix (Core Driver candidates on CRT, the proper
 *     Action+Precondition triples on TT).
 *   - **Outline form** — Markdown headings + nested bullets. Each terminal
 *     entity (no structural outgoing edges) becomes a heading; its causes
 *     are nested underneath, recursing toward root causes. For EC the
 *     5-box conflict isn't a tree, so we render a structured description
 *     instead.
 *
 * The exporter accepts a `CausalityLabel` so the consumer can override the
 * connector word (`'auto'` is the default and the right pick for most
 * cases — it picks the diagram-type-natural reading).
 */

const DEFAULT_LABEL: CausalityLabel = 'auto';

/**
 * Render the preamble shared by both output modes. Carries:
 *   - Document title + diagram-type subtitle + optional author.
 *   - Document description (markdown verbatim).
 *   - System Scope answers (Session 56) — one bullet per filled field.
 *   - EC-specific conflict statement when the doc has ≥2 Wants.
 */
const renderPreamble = (doc: TPDocument): string[] => {
  const lines: string[] = [];
  lines.push(`# ${doc.title || 'Untitled'}`);
  lines.push(`*${DIAGRAM_TYPE_LABEL[doc.diagramType]}*`);
  if (doc.author?.trim()) lines.push(`by ${doc.author.trim()}`);
  if (doc.description?.trim()) lines.push('', doc.description.trim());

  if (doc.systemScope) {
    const scope = doc.systemScope;
    const fields: Array<[string, string | undefined]> = [
      ['System goal', scope.goal],
      ['Necessary conditions', scope.necessaryConditions],
      ['Success measures', scope.successMeasures],
      ['Boundaries', scope.boundaries],
      ['Containing system', scope.containingSystem],
      ['Interacting systems', scope.interactingSystems],
      ['Inputs / outputs', scope.inputsOutputs],
    ];
    const filled = fields.filter(([, v]) => v?.trim());
    if (filled.length > 0) {
      lines.push('', '## System scope');
      for (const [label, val] of filled) lines.push(`- **${label}:** ${val?.trim()}`);
    }
  }

  if (doc.diagramType === 'ec') {
    const wants = Object.values(doc.entities)
      .filter((e) => e.type === 'want')
      .sort((a, b) => a.annotationNumber - b.annotationNumber);
    if (wants.length >= 2 && wants[0] && wants[1]) {
      lines.push('', '## The conflict');
      lines.push(
        `On the one hand, we want "${wants[0].title.trim() || 'Want 1'}". ` +
          `On the other hand, we also want "${wants[1].title.trim() || 'Want 2'}".`
      );
      const wantIds = new Set(wants.map((w) => w.id));
      const mutex = Object.values(doc.edges).find(
        (e) => e.isMutualExclusion === true && wantIds.has(e.sourceId) && wantIds.has(e.targetId)
      );
      if (!mutex) {
        lines.push(
          '',
          '*Note: no mutual-exclusion edge between the two Wants is drawn yet — see the CLR walkthrough.*'
        );
      }
    }
  }

  return lines;
};

/**
 * TT-specific helper: render each `(Action + Precondition) → Outcome`
 * triple as a single sentence rather than two separate per-edge ones.
 * Walks topological order; for each target with both an `action`-typed
 * cause and a non-action cause, emits the triple form. Targets that
 * don't have the triple shape fall back to per-edge sentences.
 */
const ttTriples = (doc: TPDocument, label: CausalityLabel): string[] => {
  const lines: string[] = [];
  const byTarget = new Map<string, Edge[]>();
  for (const e of Object.values(doc.edges)) {
    const src = doc.entities[e.sourceId];
    const tgt = doc.entities[e.targetId];
    if (!src || !tgt || isAssumption(src) || isAssumption(tgt)) continue;
    const list = byTarget.get(tgt.id) ?? [];
    list.push(e);
    byTarget.set(tgt.id, list);
  }
  const order = topologicalEdgeOrder(doc);
  const seen = new Set<string>();
  for (const eid of order) {
    const e = doc.edges[eid];
    if (!e) continue;
    if (seen.has(e.targetId)) continue;
    seen.add(e.targetId);
    const feeds = byTarget.get(e.targetId) ?? [];
    const action = feeds.find((f) => doc.entities[f.sourceId]?.type === 'action');
    const precondition = feeds.find((f) => {
      const src = doc.entities[f.sourceId];
      return src && src.type !== 'action';
    });
    const target = doc.entities[e.targetId];
    if (action && precondition && target) {
      const a = doc.entities[action.sourceId];
      const p = doc.entities[precondition.sourceId];
      if (a && p) {
        lines.push(
          `In order to obtain "${target.title.trim() || 'Untitled'}", do "${a.title.trim() || 'Untitled'}" given "${p.title.trim() || 'Untitled'}".`
        );
        continue;
      }
    }
    // Fall back to per-edge sentences for this target.
    for (const ed of feeds) {
      const src = doc.entities[ed.sourceId];
      const tgt = doc.entities[ed.targetId];
      if (!src || !tgt) continue;
      const connector = resolveEdgeConnector(ed, label, doc.diagramType);
      lines.push(renderEdgeSentence(src, tgt, connector));
    }
  }
  return lines;
};

/** Append CRT-specific Core Driver section when one or more candidates exist. */
const appendCoreDriverSection = (lines: string[], doc: TPDocument): void => {
  if (doc.diagramType !== 'crt') return;
  const drivers = findCoreDrivers(doc);
  if (drivers.length === 0) return;
  lines.push('', '## Likely Core Driver(s)');
  for (const d of drivers) {
    lines.push(
      `- "${d.entity.title.trim() || 'Untitled'}" reaches ${d.reachedUdeCount} UDE${d.reachedUdeCount === 1 ? '' : 's'}.`
    );
  }
};

/**
 * Narrative form — one sentence per edge in topological order, with
 * per-diagram-type preamble + appendix. TT uses the AND-junctor triple
 * form ("In order to obtain X, do Y given Z.") when the structure
 * supports it; everything else uses `renderEdgeSentence` directly.
 */
export const exportReasoningNarrative = (
  doc: TPDocument,
  label: CausalityLabel = DEFAULT_LABEL
): string => {
  const lines = renderPreamble(doc);
  lines.push('', '## Reasoning');

  if (doc.diagramType === 'tt') {
    const triples = ttTriples(doc, label);
    if (triples.length === 0) lines.push('*No edges drawn yet.*');
    else for (const s of triples) lines.push(s);
  } else {
    const order = topologicalEdgeOrder(doc);
    if (order.length === 0) {
      lines.push('*No edges drawn yet.*');
    } else {
      for (const eid of order) {
        const e = doc.edges[eid];
        if (!e) continue;
        const src = doc.entities[e.sourceId];
        const tgt = doc.entities[e.targetId];
        if (!src || !tgt || isAssumption(src) || isAssumption(tgt)) continue;
        const connector = resolveEdgeConnector(e, label, doc.diagramType);
        lines.push(renderEdgeSentence(src, tgt, connector));
      }
    }
  }

  appendCoreDriverSection(lines, doc);
  return `${lines.join('\n').trimEnd()}\n`;
};

/**
 * Outline form — Markdown headings + nested bullets. Each terminal
 * entity (no structural outgoing edges) becomes an H3; the bullets
 * underneath are its causes, recursing toward root. EC isn't a tree
 * so it's rendered as a structured description instead.
 */
export const exportReasoningOutline = (
  doc: TPDocument,
  label: CausalityLabel = DEFAULT_LABEL
): string => {
  const lines = renderPreamble(doc);
  lines.push('', '## Reasoning (outline)');

  if (doc.diagramType === 'ec') {
    lines.push(...renderEcOutline(doc));
  } else {
    const terminals = findTerminals(doc);
    if (terminals.length === 0) {
      lines.push('*No structural entities yet.*');
    } else {
      for (const term of terminals) {
        lines.push(
          '',
          `### ${term.title.trim() || 'Untitled'} (${ENTITY_TYPE_META[term.type].label})`
        );
        const visited = new Set<string>();
        renderCausesInto(lines, doc, term.id, visited, 0, label);
        // If the terminal has no incoming causes, surface that explicitly.
        if (incomingEdges(doc, term.id).length === 0) {
          lines.push('- *No causes drawn yet.*');
        }
      }
    }
  }

  appendCoreDriverSection(lines, doc);
  return `${lines.join('\n').trimEnd()}\n`;
};

/** Terminal entities = no outgoing edges to non-assumption targets. */
const findTerminals = (doc: TPDocument): Entity[] =>
  structuralEntities(doc)
    .filter((e) => {
      const outs = outgoingEdges(doc, e.id);
      return outs.every((edge) => {
        const t = doc.entities[edge.targetId];
        return !t || isAssumption(t);
      });
    })
    .sort((a, b) => a.annotationNumber - b.annotationNumber);

const renderCausesInto = (
  lines: string[],
  doc: TPDocument,
  targetId: string,
  visited: Set<string>,
  depth: number,
  label: CausalityLabel
): void => {
  if (visited.has(targetId)) return;
  visited.add(targetId);
  const incoming = incomingEdges(doc, targetId);
  const target = doc.entities[targetId];
  if (!target) return;
  for (const edge of incoming) {
    const source = doc.entities[edge.sourceId];
    if (!source || isAssumption(source)) continue;
    const connector = resolveEdgeConnector(edge, label, doc.diagramType);
    const indent = '  '.repeat(depth);
    lines.push(`${indent}- ${renderEdgeSentence(source, target, connector)}`);
    renderCausesInto(lines, doc, source.id, visited, depth + 1, label);
  }
};

/**
 * EC isn't a tree — render the canonical 5-box structure as a structured
 * description instead. Goal at the top, each Want under the Need it
 * satisfies, mutex link noted if drawn, plus all edge assumptions
 * listed at the bottom.
 */
const renderEcOutline = (doc: TPDocument): string[] => {
  const lines: string[] = [];
  const byType = (t: Entity['type']) =>
    Object.values(doc.entities)
      .filter((e) => e.type === t)
      .sort((a, b) => a.annotationNumber - b.annotationNumber);
  const goal = byType('goal')[0];
  const needs = byType('need');
  const wants = byType('want');
  if (goal) {
    lines.push(`- **Common goal:** "${goal.title.trim() || 'Untitled'}"`);
  }
  for (const need of needs) {
    lines.push(`  - **Need:** "${need.title.trim() || 'Untitled'}"`);
    // Wants that feed this need (Want → Need edge).
    const feedingWants = Object.values(doc.edges)
      .filter((e) => e.targetId === need.id)
      .map((e) => doc.entities[e.sourceId])
      .filter((s): s is Entity => Boolean(s && s.type === 'want'));
    for (const w of feedingWants) {
      lines.push(`    - **Want:** "${w.title.trim() || 'Untitled'}"`);
    }
  }
  // Mutual exclusion note
  const wantIds = new Set(wants.map((w) => w.id));
  const mutex = Object.values(doc.edges).find(
    (e) => e.isMutualExclusion === true && wantIds.has(e.sourceId) && wantIds.has(e.targetId)
  );
  if (mutex && wants.length >= 2 && wants[0] && wants[1]) {
    lines.push(
      '',
      `- **Mutually exclusive:** "${wants[0].title.trim() || 'Want 1'}" and "${wants[1].title.trim() || 'Want 2'}" cannot both hold.`
    );
  }
  // Edge assumptions
  const edgesWithAssumptions = Object.values(doc.edges).filter(
    (e) => (e.assumptionIds?.length ?? 0) > 0
  );
  if (edgesWithAssumptions.length > 0) {
    lines.push('', '### Assumptions on edges');
    for (const e of edgesWithAssumptions) {
      const src = doc.entities[e.sourceId];
      const tgt = doc.entities[e.targetId];
      if (!src || !tgt) continue;
      lines.push(`- **${src.title.trim() || 'Untitled'} → ${tgt.title.trim() || 'Untitled'}**`);
      for (const aid of e.assumptionIds ?? []) {
        const a = doc.entities[aid];
        if (a) lines.push(`  - ${a.title.trim() || 'Untitled assumption'}`);
      }
    }
  }
  return lines;
};
