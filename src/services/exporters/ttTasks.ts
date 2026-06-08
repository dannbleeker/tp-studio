import { incomingEdges, outgoingEdges } from '@/domain/graph';
import type { Entity, TPDocument } from '@/domain/types';
import { csvRow, slug, triggerDownload } from './shared';

/**
 * Session 135 — Transition Tree (TT) → task-tracker CSV export.
 *
 * Closes the first half of spec major gap #7 ("Task / execution
 * bridge"). The spec wants TT actions to flow into a project tracker
 * — Jira, Trello, Planner, Asana, etc. — with owner / due date /
 * dependencies / status / success criteria attached. Most trackers
 * accept CSV import natively, so CSV is the universally portable
 * pivot format. Per-tracker formats (Jira XML, etc.) can layer on
 * top of this in follow-ups; the spec's "buy-in narrative"
 * generator is a separate item parked under the AI-out-of-scope
 * boundary.
 *
 * The exporter walks every `action` entity in the doc, in
 * step-number order (the explicit `ordering` field on the entity,
 * with a fallback to `annotationNumber` for actions without one).
 * For each action:
 *
 *   - `step`            the action's `ordering` (or annotation number)
 *   - `action`          the action's title
 *   - `precondition`    incoming edges' source entity titles
 *                       (semicolon-joined; "(no precondition drawn)"
 *                       when empty)
 *   - `outcome`         outgoing edges' target entity titles
 *                       (semicolon-joined; "(no outcome drawn)"
 *                       when empty)
 *   - `owner`           the dedicated `entity.owner` field, with a
 *                       fallback to legacy `attributes.owner.value`
 *                       (matching the risk-register pattern)
 *   - `due_date`        from `attributes.dueDate.value` if set (the
 *                       attribute key is reserved by the user-defined
 *                       attribute editor and read here when present)
 *   - `status`          derived from `attributes.implemented?.value`
 *                       (bool) — same field the InjectionWorkbench
 *                       uses for injection-implemented state:
 *                       'implemented' when true, 'open' otherwise
 *   - `success_criteria` the action's `description` field, trimmed
 *                       to a single line for cell-friendliness
 *
 * Diagram-type agnostic — runs on any doc containing `action`
 * entities. TT is the canonical case (the diagram's entity palette
 * surfaces actions front-and-centre), but a CRT or FRT with a
 * sprinkling of action entities exports cleanly too.
 *
 * Like the risk-register exporter, this is intentionally lossy: it
 * collapses graph structure into tabular shape because that's what
 * task trackers consume. The JSON export remains the round-trip
 * format for fidelity.
 */

// Session 135 — reserved attribute key the exporter reads from
// user-defined attributes. Pulled into a constant so a future
// schema move to a first-class field on Entity (similar to how
// `owner` graduated from `attributes.owner` to `entity.owner` in
// Session 134) only needs to update one place.
const ATTR_DUE_DATE = 'dueDate';
const ATTR_IMPLEMENTED = 'implemented';

const HEADER = [
  'step',
  'action',
  'precondition',
  'outcome',
  'owner',
  'due_date',
  'status',
  'success_criteria',
] as const;

/**
 * Pull the action's owner. Prefers the dedicated `entity.owner`
 * field (Session 134); falls back to the legacy
 * `attributes.owner.value` path for older docs. Same precedence
 * rule as the risk-register exporter so a doc that exports both
 * sheets reads consistent owner values.
 */
const ownerFor = (entity: Entity): string => {
  if (entity.owner && entity.owner.trim().length > 0) return entity.owner.trim();
  const legacy = entity.attributes?.owner;
  return legacy?.kind === 'string' ? legacy.value : '';
};

/**
 * Pull the action's due date from `attributes.dueDate.value` if
 * set. We accept any string format (ISO 8601, "Q3 2026", etc.) —
 * the user defines what the convention is in their workflow, and
 * trackers all parse different shapes. Empty string when not set.
 */
const dueDateFor = (entity: Entity): string => {
  const raw = entity.attributes?.[ATTR_DUE_DATE];
  if (raw?.kind === 'string') return raw.value.trim();
  return '';
};

/**
 * Derive a status string from the `attributes.implemented` boolean.
 * The InjectionWorkbench's "Implemented" toggle writes this exact
 * key (`{ kind: 'bool', value: true|false }`), and tracker imports
 * read either 'open' or 'implemented' depending on column-mapping
 * conventions. Custom intermediate states (in-progress, blocked,
 * etc.) aren't modeled — practitioners can layer those via
 * additional user-defined attributes if needed.
 */
const statusFor = (entity: Entity): string => {
  const raw = entity.attributes?.[ATTR_IMPLEMENTED];
  if (raw?.kind === 'bool' && raw.value === true) return 'implemented';
  return 'open';
};

/**
 * Format the action's description as a single-line success-criteria
 * cell. Trims, collapses internal whitespace + line breaks to single
 * spaces (so a markdown paragraph break doesn't survive into a
 * cell-newline that breaks tracker CSV importers).
 */
const successCriteriaFor = (entity: Entity): string => {
  const desc = entity.description?.trim();
  if (!desc) return '';
  return desc.replace(/\s+/g, ' ');
};

/**
 * Join an entity's incoming source titles into a precondition cell.
 * Returns "(no precondition drawn)" when the action has no incoming
 * edges so the gap is visible in the exported sheet instead of
 * silently absent.
 */
const preconditionFor = (doc: TPDocument, action: Entity): string => {
  const incoming = incomingEdges(doc, action.id);
  if (incoming.length === 0) return '(no precondition drawn)';
  // Keep untitled sources visible (placeholder); only an unresolved (deleted)
  // source is skipped.
  const titles = incoming
    .map((e) => doc.entities[e.sourceId])
    .filter((s): s is Entity => !!s)
    .map((s) => s.title.trim() || '(untitled)');
  if (titles.length === 0) return '(no precondition drawn)';
  return titles.join('; ');
};

/**
 * Join an entity's outgoing target titles into an outcome cell.
 * Mirrors `preconditionFor` for outgoing edges.
 */
const outcomeFor = (doc: TPDocument, action: Entity): string => {
  const outgoing = outgoingEdges(doc, action.id);
  if (outgoing.length === 0) return '(no outcome drawn)';
  const titles = outgoing
    .map((e) => doc.entities[e.targetId])
    .filter((t): t is Entity => !!t)
    .map((t) => t.title.trim() || '(untitled)');
  if (titles.length === 0) return '(no outcome drawn)';
  return titles.join('; ');
};

/**
 * Build the CSV text for a given document. Exported for tests; the
 * production path uses `exportTtTasks(doc)` below.
 *
 * Actions are sorted by their explicit `ordering` field when set
 * (the step-number badge the TT canvas renders), with a stable
 * fallback to `annotationNumber` so two actions without ordering
 * still produce a deterministic order. The step column in the CSV
 * shows whichever value drove the sort.
 */
export const buildTtTasksCsv = (doc: TPDocument): string => {
  const lines: string[] = [csvRow([...HEADER])];

  const actions = Object.values(doc.entities)
    .filter((e) => e.type === 'action')
    .sort((a, b) => {
      const ao = a.ordering ?? a.annotationNumber;
      const bo = b.ordering ?? b.annotationNumber;
      if (ao !== bo) return ao - bo;
      // Stable tie-break on annotation number so two actions without
      // ordering preserve creation order.
      return a.annotationNumber - b.annotationNumber;
    });

  for (const action of actions) {
    lines.push(
      csvRow([
        action.ordering ?? action.annotationNumber,
        action.title.trim() || '(untitled action)',
        preconditionFor(doc, action),
        outcomeFor(doc, action),
        ownerFor(action),
        dueDateFor(action),
        statusFor(action),
        successCriteriaFor(action),
      ])
    );
  }

  return `${lines.join('\n')}\n`;
};

/**
 * Trigger a browser download of the TT-task CSV. Returns the row
 * count (excluding the header) so callers can toast how many
 * actions were exported, matching the risk-register exporter's
 * return contract.
 */
export const exportTtTasks = (doc: TPDocument): number => {
  const csv = buildTtTasksCsv(doc);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  triggerDownload(blob, `${slug(doc.title)}-tt-tasks.csv`);
  // One CSV record per action — count the source rows directly so a cell with
  // an embedded newline (quoted per RFC 4180) can't inflate the toast count.
  return Object.values(doc.entities).filter((e) => e.type === 'action').length;
};
