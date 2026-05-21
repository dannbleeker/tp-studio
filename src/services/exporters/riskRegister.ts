import { incomingEdges } from '@/domain/graph';
import type { Entity, EvidenceItem, TPDocument } from '@/domain/types';
import { slug, triggerDownload } from './shared';

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

/** RFC 4180-safe cell escaper — same shape as `csvExport.ts`'s. */
const csvCell = (raw: string | number | undefined): string => {
  if (raw === undefined || raw === null) return '';
  const s = String(raw);
  if (s.length === 0) return '';
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

const row = (cells: (string | number | undefined)[]): string => cells.map(csvCell).join(',');

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
    .map((e) => doc.entities[e.sourceId]?.title?.trim() ?? '')
    .filter((t) => t.length > 0);
  if (titles.length === 0) return '(no trigger drawn)';
  return titles.join(' + ');
};

/**
 * Walk the doc for injection / desiredEffect entities reachable
 * BACKWARD from the UDE (i.e. would-be ancestors in the causal
 * graph). These are the mitigations: an injection or DE that, if
 * adopted, breaks the chain leading to the UDE.
 *
 * Returns "(no mitigation)" when the UDE has no injection ancestors
 * — that's the open-risk state.
 */
const mitigationsFor = (doc: TPDocument, ude: Entity): string => {
  const visited = new Set<string>();
  const queue: string[] = [ude.id];
  const found: string[] = [];
  while (queue.length > 0) {
    const next = queue.shift();
    if (!next || visited.has(next)) continue;
    visited.add(next);
    for (const edge of incomingEdges(doc, next)) {
      const src = doc.entities[edge.sourceId];
      if (!src) continue;
      if (src.type === 'injection' || src.type === 'desiredEffect') {
        const title = src.title.trim();
        if (title.length > 0 && !found.includes(title)) found.push(title);
      }
      queue.push(src.id);
    }
  }
  return found.length === 0 ? '(no mitigation)' : found.join('; ');
};

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
  const tail = e.url && e.url.length > 0 ? ` (${e.url})` : '';
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
  const lines: string[] = [row([...HEADER])];

  const udes = Object.values(doc.entities)
    .filter((e) => e.type === 'ude')
    .sort((a, b) => a.annotationNumber - b.annotationNumber);

  for (const ude of udes) {
    const mitigation = mitigationsFor(doc, ude);
    const status = mitigation === '(no mitigation)' ? 'open' : 'mitigated';
    lines.push(
      row([
        ude.id,
        ude.title.trim() || '(untitled)',
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
  // Subtract 1 for the header.
  return csv.split('\n').filter((line) => line.length > 0).length - 1;
};
