import { displayTitle, isOfBuiltin } from '@/domain/entityPalettes';
import { entitiesOfBuiltin, incomingEdges, outgoingEdges } from '@/domain/graph';
import type { Entity, EvidenceItem, TPDocument } from '@/domain/types';
import { csvRow, slug, triggerDownload } from './shared';

/**
 * Session 134 / spec major gap #5 — Risk-register export.
 *
 * Converts a TP document's UDE entities into a structured risk-register
 * CSV: one row per UDE, with columns the spec calls out — Risk
 * (the UDE), Trigger (the entity / edge that spawns it), Consequence
 * (the UDE's description), Mitigation (linked injection / action
 * entities), Evidence (the UDE's `evidence[]` items rendered as
 * semicolon-joined `[strength/source] description (url)` entries),
 * Owner (dedicated `entity.owner` field; legacy `attributes.owner`
 * fallback), Status (open / mitigated based on the presence of a
 * mitigation).
 *
 * Diagram-type agnostic — works on any doc containing UDEs (NBR is
 * the canonical case, but a CRT's UDEs map naturally onto a register
 * too, and the spec doesn't gate the export on a particular type).
 *
 * The exporter is intentionally lossy: it collapses graph structure
 * into tabular shape because that's what consumes a risk register
 * (project trackers, leadership memos, audit checklists). Use the
 * JSON export when round-trip fidelity matters.
 */

// Session 135 — CSV cell escaper + row builder moved to `./shared.ts`
// (`csvCell` + `csvRow`) and shared with the TT-tasks exporter.

const HEADER = [
  'risk_id',
  'risk',
  'trigger',
  'consequence',
  'mitigation',
  'evidence',
  'owner',
  'status',
] as const;

/**
 * For a given UDE entity, walk its incoming edges and assemble a
 * one-line description of the trigger chain: the immediate
 * predecessors joined by " + " (matching how an analyst would say
 * "X plus Y, leading to <UDE>" in a workshop).
 *
 * Returns an empty string when the UDE has no incoming structural
 * edges — surfaces as "(no trigger drawn)" in the rendered cell so
 * a register reader sees the gap.
 */
const triggerFor = (doc: TPDocument, ude: Entity): string => {
  const incoming = incomingEdges(doc, ude.id);
  if (incoming.length === 0) return '(no trigger drawn)';
  const titles = incoming
    .map((e) => doc.entities[e.sourceId])
    .filter((s): s is Entity => !!s)
    .map((s) => displayTitle(s));
  if (titles.length === 0) return '(no trigger drawn)';
  return titles.join(' + ');
};

/**
 * Session 135 / Perf #4 — pre-compute the UDE → mitigation-titles map
 * in one pass.
 *
 * Original implementation ran a backward BFS *per UDE*, allocating a
 * fresh `visited` Set + `queue` each call. On a doc with 100 UDEs
 * sharing mitigation ancestors that's ~15k+ edge visits, dominated
 * by re-scanning the same subgraph multiple times.
 *
 * The forward-only inversion: each injection / desiredEffect is a
 * mitigation. BFS forward from each mitigation finds every UDE that
 * mitigation reaches. Map<UDEId, mitigationTitles[]> built once;
 * per-UDE lookup is O(1).
 *
 * Complexity drops from O(U·E) where U = UDE count to O(M·E + U)
 * where M = mitigation count. On the worst-case 100-UDE doc this is
 * ~30x fewer edge visits.
 */
const buildMitigationsByUde = (doc: TPDocument): Map<string, string[]> => {
  const result = new Map<string, string[]>();
  // First, collect all candidate mitigations (injection + desiredEffect
  // entities, custom classes included — the same `entitiesOfBuiltin`
  // definition the NBR validator uses, so the exporter and the validator
  // can't disagree about what counts as an injection). Untitled mitigations
  // are kept (placeholdered below) rather than dropped.
  const mitigations: Entity[] = [
    ...entitiesOfBuiltin(doc, 'injection'),
    ...entitiesOfBuiltin(doc, 'desiredEffect'),
  ];
  // Forward-BFS from each mitigation; record the mitigation's title
  // against every UDE reached. The `seenForThisMitigation` Set
  // prevents duplicate entries when one mitigation reaches the same
  // UDE via multiple paths.
  for (const m of mitigations) {
    const title = displayTitle(m);
    const visited = new Set<string>([m.id]);
    const queue: string[] = [m.id];
    // Head-index dequeue: O(1) per step vs `queue.shift()`'s O(N) array slide.
    let head = 0;
    while (head < queue.length) {
      const next = queue[head++];
      if (!next) continue;
      for (const edge of outgoingEdges(doc, next)) {
        const targetId = edge.targetId;
        if (visited.has(targetId)) continue;
        visited.add(targetId);
        const tgt = doc.entities[targetId];
        if (!tgt) continue;
        if (isOfBuiltin(tgt.type, 'ude', doc.customEntityClasses)) {
          let list = result.get(targetId);
          if (!list) {
            list = [];
            result.set(targetId, list);
          }
          if (!list.includes(title)) list.push(title);
        }
        queue.push(targetId);
      }
    }
  }
  return result;
};

/**
 * Render the mitigation cell for one UDE, given the pre-computed map.
 * Returns "(no mitigation)" — the open-risk state — when no mitigation
 * was found reaching this UDE.
 */
const formatMitigations = (titles: string[] | undefined): string =>
  titles && titles.length > 0 ? titles.join('; ') : '(no mitigation)';

/**
 * Pull the entity's owner. Prefers the dedicated `entity.owner` field
 * (Session 134); falls back to the legacy `attributes.owner.value`
 * path that older docs may carry. Empty cell when neither is set so
 * the register imports cleanly into project trackers.
 */
const ownerFor = (entity: Entity): string => {
  if (entity.owner && entity.owner.trim().length > 0) return entity.owner.trim();
  const legacy = entity.attributes?.owner;
  return legacy?.kind === 'string' ? legacy.value : '';
};

/**
 * Render one evidence item for the CSV cell. Format:
 *   `[strong/metric] p95 = 740 ms (https://…)`
 *
 * The bracketed prefix carries the [strength/source] taxonomy so a
 * register reader gets the qualitative + provenance signals at a
 * glance. Description is the body; URL trails in parens when set.
 *
 * Trims whitespace + collapses internal newlines to spaces so the
 * cell stays one logical line — the RFC 4180 escaper would otherwise
 * keep embedded `\n`s, which trips up project-tracker imports that
 * treat newline-in-cell as row-break.
 */
const formatEvidenceItem = (e: EvidenceItem): string => {
  const desc = e.description.trim().replace(/\s+/g, ' ');
  const head = `[${e.strength}/${e.source}]`;
  const body = desc.length > 0 ? ` ${desc}` : '';
  // Collapse whitespace in the URL too (matching the description above) so a
  // newline smuggled into the url field can't survive into the CSV cell — the
  // RFC 4180 escaper keeps embedded newlines, which some tracker imports treat
  // as a row break.
  const tail = e.url && e.url.length > 0 ? ` (${e.url.trim().replace(/\s+/g, ' ')})` : '';
  return `${head}${body}${tail}`;
};

/**
 * Pull the entity's evidence as a single-line semicolon-joined cell.
 * Empty string when the entity has no evidence so the register cell
 * imports as blank.
 */
const evidenceFor = (entity: Entity): string => {
  if (!entity.evidence || entity.evidence.length === 0) return '';
  return entity.evidence.map(formatEvidenceItem).join('; ');
};

/**
 * Build the CSV text for a given document. Exported for tests; the
 * production path uses `exportRiskRegister(doc)` below.
 */
export const buildRiskRegisterCsv = (doc: TPDocument): string => {
  const lines: string[] = [csvRow([...HEADER])];

  // Custom classes with supersetOf:'ude' get a register row too — they're
  // UDEs to every other surface (validator, canvas), so the export agrees.
  const udes = entitiesOfBuiltin(doc, 'ude')
    .slice()
    .sort((a, b) => a.annotationNumber - b.annotationNumber);

  // Session 135 / Perf #4 — one BFS pass instead of one per UDE.
  // See `buildMitigationsByUde` for the inversion rationale.
  const mitigationsByUde = buildMitigationsByUde(doc);

  for (const ude of udes) {
    const mitigation = formatMitigations(mitigationsByUde.get(ude.id));
    const status = mitigation === '(no mitigation)' ? 'open' : 'mitigated';
    lines.push(
      csvRow([
        ude.id,
        displayTitle(ude),
        triggerFor(doc, ude),
        ude.description ?? '',
        mitigation,
        evidenceFor(ude),
        ownerFor(ude),
        status,
      ])
    );
  }

  return `${lines.join('\n')}\n`;
};

/**
 * Trigger a browser download of the risk-register CSV for the given doc.
 * Returns the row count (excluding the header) so callers can toast
 * how many risks were exported.
 */
export const exportRiskRegister = (doc: TPDocument): number => {
  const csv = buildRiskRegisterCsv(doc);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  triggerDownload(blob, `${slug(doc.title)}-risk-register.csv`);
  // One CSV record per UDE — count the source rows directly so a multi-line
  // `description` cell (quoted per RFC 4180) can't inflate the toast count.
  return entitiesOfBuiltin(doc, 'ude').length;
};
