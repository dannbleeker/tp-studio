import { resolveEntityTypeMeta } from './entityTypeMeta';
import { structuralEntities } from './graph';
import type { TPDocument } from './types';

/**
 * Mermaid `graph` export (N3).
 *
 * Renders the structural causal graph in Mermaid's flowchart syntax, ready
 * to paste into a GitHub README, Notion code block, Obsidian note, or
 * `https://mermaid.live`. Direction is `BT` (bottom-to-top) so the effects
 * end up at the top — matches the in-app rendering and the TOC convention.
 *
 * Assumption entities (and edges touching them) are omitted. AND-grouped
 * edges render with a thicker stroke (`==>`) since Mermaid doesn't have a
 * native group / junctor primitive.
 *
 * Per-type styling lives in `classDef` blocks below the graph, applied to
 * each node with `class N typeFoo;`. We tint only the stroke + a faint
 * fill — Mermaid's default text colour stays readable.
 */

/**
 * Sanitise a string for inclusion inside a Mermaid label's `"..."`. Mermaid
 * doesn't accept literal newlines inside labels, so we replace them with
 * `<br/>` (rendered as a line break in the SVG output). Embedded double
 * quotes are HTML-escaped because Mermaid's parser doesn't accept escaped
 * quotes inside `"..."`.
 */
const mermaidLabel = (s: string): string =>
  s
    .replace(/"/g, '&quot;')
    // Square brackets close the node declaration. Mermaid's own parser tolerates
    // a `]` inside a quoted label, but OUR importer's `NODE_DECL_RE` matches
    // `\[[^\]]*\]`, so `Cost [USD] is high` round-tripped as "no nodes found"
    // (or, with edges present, degraded the title to the raw internal id).
    // Escaped as HTML entities, which `decodeLabel` reverses.
    .replace(/\[/g, '&#91;')
    .replace(/\]/g, '&#93;')
    .replace(/\r?\n/g, '<br/>');

/** Coerce an entity id to a safe Mermaid identifier (alphanumeric + underscore). */
const mermaidId = (id: string): string => `n_${id.replace(/[^a-zA-Z0-9_]/g, '_')}`;

export const exportToMermaid = (doc: TPDocument): string => {
  const structural = structuralEntities(doc).sort(
    (a, b) => a.annotationNumber - b.annotationNumber
  );

  const lines: string[] = [];
  // Document title becomes a Mermaid title directive — supported by the
  // current Mermaid release; older renderers will quietly ignore it.
  // QUOTED. The frontmatter is YAML, so an unquoted `Rev 2: the sequel` is a
  // mapping-inside-a-mapping and the whole diagram fails to render on
  // mermaid.live and GitHub; a leading `#` becomes a comment and the title
  // silently becomes null.
  const title = (doc.title || 'Untitled').replace(/\r?\n/g, ' ').trim();
  const yamlTitle = `"${title.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  lines.push('---');
  lines.push(`title: ${yamlTitle}`);
  lines.push('---');
  lines.push('graph BT');

  // Nodes
  for (const e of structural) {
    // B10: doc-aware lookup so custom-class entities pick up their label.
    const meta = resolveEntityTypeMeta(e.type, doc.customEntityClasses);
    const label = `#${e.annotationNumber} ${meta.label}<br/>${e.title || 'Untitled'}`;
    lines.push(`  ${mermaidId(e.id)}["${mermaidLabel(label)}"]`);
  }

  // Edges
  // See `dotExport` — nodes come from `structuralEntities`, so checking only
  // that the endpoints are entities emitted edges to undeclared note nodes,
  // which Mermaid auto-creates under their raw internal id.
  const declared = new Set(structural.map((e) => e.id));
  for (const edge of Object.values(doc.edges)) {
    if (!declared.has(edge.sourceId) || !declared.has(edge.targetId)) continue;
    const arrow = edge.andGroupId ? '==>' : '-->';
    if (edge.label?.trim()) {
      lines.push(
        `  ${mermaidId(edge.sourceId)} ${arrow}|"${mermaidLabel(edge.label.trim())}"| ${mermaidId(edge.targetId)}`
      );
    } else {
      lines.push(`  ${mermaidId(edge.sourceId)} ${arrow} ${mermaidId(edge.targetId)}`);
    }
  }

  // classDefs — one per type id present in the document. Custom-class
  // types resolve through the same `resolveEntityTypeMeta` helper, so a
  // custom "evidence" class renders as `type_evidence` with the user's
  // color. The N3 importer accepts and ignores unknown `type_<id>`
  // class lines, so a round-trip via Mermaid drops the custom class
  // info but preserves the structure (no error).
  const usedTypes = new Set<string>(structural.map((e) => e.type));
  if (usedTypes.size > 0) lines.push('');
  for (const type of usedTypes) {
    const meta = resolveEntityTypeMeta(type, doc.customEntityClasses);
    // Sanitise the class suffix so a custom id with dashes still
    // parses as a valid Mermaid classDef name (Mermaid identifiers
    // allow `[A-Za-z0-9_]+`).
    const classSuffix = type.replace(/[^a-zA-Z0-9_]/g, '_');
    lines.push(
      `  classDef type_${classSuffix} stroke:${meta.stripeColor},stroke-width:2px,fill:${meta.stripeColor}1a;`
    );
  }
  for (const e of structural) {
    const classSuffix = e.type.replace(/[^a-zA-Z0-9_]/g, '_');
    lines.push(`  class ${mermaidId(e.id)} type_${classSuffix};`);
  }

  return `${lines.join('\n')}\n`;
};
