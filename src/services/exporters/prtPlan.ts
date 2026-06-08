import { incomingEdges, isAssumption, outgoingEdges, structuralEntities } from '@/domain/graph';
import type { Edge, Entity, TPDocument } from '@/domain/types';
import { csvRow, slug, triggerDownload } from './shared';

/**
 * Phase 3 #6 — Prerequisite Tree → ordered implementation-plan CSV.
 *
 * Closes the second half of spec major gap #7's "task / execution bridge" for
 * PRTs. A Transition Tree carries explicit step numbers (`Entity.ordering`);
 * a Prerequisite Tree does not — its order is *implied* by the dependency
 * edges. So where `ttTasks.ts` sorts actions by their step field, this
 * exporter topologically sorts the tree and emits the Intermediate Objectives
 * in dependency order: an IO that another IO depends on comes first.
 *
 * PRT edge convention (see `domain/examples/prt.ts`): an IO points at the
 * obstacle it overcomes, and an obstacle points at the goal it unblocks
 * (IO → obstacle → goal). IOs may also depend on one another (IO_A → IO_B
 * means "achieve A before B"). The Kahn sort puts prerequisite-free IOs first.
 *
 * One row per Intermediate Objective:
 *   - `step`        1-based position in dependency order
 *   - `objective`   the IO's title
 *   - `overcomes`   the obstacle(s) this IO targets (outgoing edges to
 *                   `obstacle` entities; "(no obstacle linked)" when none)
 *   - `depends_on`  prerequisite IOs (incoming edges from `intermediateObjective`
 *                   entities; "(none)" when this is a starting objective)
 *   - `owner`       `entity.owner`, falling back to legacy `attributes.owner`
 *   - `due_date`    `attributes.dueDate` if set
 *   - `status`      'done' when `attributes.implemented` is true, else 'open'
 *   - `notes`       the IO's `description`, collapsed to a single line
 *
 * Like the other CSV exporters this is intentionally lossy — it flattens the
 * graph into a tracker-friendly sheet. JSON remains the round-trip format.
 */

const ATTR_DUE_DATE = 'dueDate';
const ATTR_IMPLEMENTED = 'implemented';

const HEADER = [
  'step',
  'objective',
  'overcomes',
  'depends_on',
  'owner',
  'due_date',
  'status',
  'notes',
] as const;

const ownerFor = (entity: Entity): string => {
  if (entity.owner && entity.owner.trim().length > 0) return entity.owner.trim();
  const legacy = entity.attributes?.owner;
  return legacy?.kind === 'string' ? legacy.value : '';
};

const dueDateFor = (entity: Entity): string => {
  const raw = entity.attributes?.[ATTR_DUE_DATE];
  return raw?.kind === 'string' ? raw.value.trim() : '';
};

const statusFor = (entity: Entity): string => {
  const raw = entity.attributes?.[ATTR_IMPLEMENTED];
  return raw?.kind === 'bool' && raw.value === true ? 'done' : 'open';
};

const notesFor = (entity: Entity): string => {
  const desc = entity.description?.trim();
  return desc ? desc.replace(/\s+/g, ' ') : '';
};

/**
 * Topologically order a PRT's structural entities (Kahn's algorithm; ties
 * broken by annotation number for stability), then keep only the Intermediate
 * Objectives. The result is the IOs in dependency order. Cycles / unreached
 * nodes fall back to annotation order so nothing is silently dropped — the
 * same defensive contract as `topologicalEdgeOrder`.
 */
export const orderedIntermediateObjectives = (doc: TPDocument): Entity[] => {
  const entities = structuralEntities(doc);
  const edges = Object.values(doc.edges).filter((e) => {
    const src = doc.entities[e.sourceId];
    const tgt = doc.entities[e.targetId];
    return src && tgt && !isAssumption(src) && !isAssumption(tgt);
  });

  const inDegree = new Map<string, number>();
  for (const e of entities) inDegree.set(e.id, 0);
  for (const edge of edges) {
    inDegree.set(edge.targetId, (inDegree.get(edge.targetId) ?? 0) + 1);
  }

  // Outgoing adjacency built once so the Kahn dequeue below is O(V+E) rather
  // than O(V·E) — it previously re-scanned every edge (`edges.filter(...)`) on
  // each node popped from the queue.
  const outgoing = new Map<string, Edge[]>();
  for (const edge of edges) {
    const list = outgoing.get(edge.sourceId);
    if (list) list.push(edge);
    else outgoing.set(edge.sourceId, [edge]);
  }

  const ready: Entity[] = [];
  for (const [id, d] of inDegree) {
    if (d === 0) {
      const e = doc.entities[id];
      if (e) ready.push(e);
    }
  }
  ready.sort((a, b) => a.annotationNumber - b.annotationNumber);

  const visited = new Set<string>();
  const order: Entity[] = [];
  while (ready.length > 0) {
    const next = ready.shift();
    if (!next || visited.has(next.id)) continue;
    visited.add(next.id);
    order.push(next);
    for (const edge of outgoing.get(next.id) ?? []) {
      const remaining = (inDegree.get(edge.targetId) ?? 0) - 1;
      inDegree.set(edge.targetId, remaining);
      if (remaining <= 0) {
        const target = doc.entities[edge.targetId];
        if (target && !visited.has(target.id)) ready.push(target);
      }
    }
    ready.sort((a, b) => a.annotationNumber - b.annotationNumber);
  }

  if (order.length < entities.length) {
    const seen = new Set(order.map((e) => e.id));
    for (const e of [...entities].sort((a, b) => a.annotationNumber - b.annotationNumber)) {
      if (!seen.has(e.id)) order.push(e);
    }
  }

  return order.filter((e) => e.type === 'intermediateObjective');
};

const overcomesFor = (doc: TPDocument, io: Entity): string => {
  // Keep untitled obstacles visible (placeholder) rather than dropping them,
  // matching the "(untitled objective)" treatment of the primary cell.
  const titles = outgoingEdges(doc, io.id)
    .map((e) => doc.entities[e.targetId])
    .filter((t): t is Entity => t?.type === 'obstacle')
    .map((t) => t.title.trim() || '(untitled obstacle)');
  return titles.length > 0 ? titles.join('; ') : '(no obstacle linked)';
};

const dependsOnFor = (doc: TPDocument, io: Entity): string => {
  const titles = incomingEdges(doc, io.id)
    .map((e) => doc.entities[e.sourceId])
    .filter(
      (sourceEntity): sourceEntity is Entity => sourceEntity?.type === 'intermediateObjective'
    )
    .map((sourceEntity) => sourceEntity.title.trim() || '(untitled objective)');
  return titles.length > 0 ? titles.join('; ') : '(none)';
};

/**
 * Build the PRT-plan CSV text for a document. Exported for tests; the
 * production path uses `exportPrtPlan(doc)`.
 */
export const buildPrtPlanCsv = (doc: TPDocument): string => {
  const lines: string[] = [csvRow([...HEADER])];
  orderedIntermediateObjectives(doc).forEach((io, i) => {
    lines.push(
      csvRow([
        i + 1,
        io.title.trim() || '(untitled objective)',
        overcomesFor(doc, io),
        dependsOnFor(doc, io),
        ownerFor(io),
        dueDateFor(io),
        statusFor(io),
        notesFor(io),
      ])
    );
  });
  return `${lines.join('\n')}\n`;
};

/**
 * Trigger a browser download of the PRT-plan CSV. Returns the row count
 * (excluding the header) so callers can toast how many objectives were
 * exported — matching `exportTtTasks` / `exportRiskRegister`.
 */
export const exportPrtPlan = (doc: TPDocument): number => {
  const csv = buildPrtPlanCsv(doc);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  triggerDownload(blob, `${slug(doc.title)}-prt-plan.csv`);
  // One CSV record per ordered IO — count the source rows directly so a cell
  // with an embedded newline (quoted per RFC 4180) can't inflate the toast.
  return orderedIntermediateObjectives(doc).length;
};
