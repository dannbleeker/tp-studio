import { ENTITY_TYPE_META } from './entityTypeMeta';
import { isAssumption, outgoingEdges, structuralEntities } from './graph';
import type { Entity, TPDocument } from './types';

/**
 * OPML 2.0 outline export (N1).
 *
 * Causal graphs are DAGs, not trees — an effect can have many causes — but
 * outline editors (OmniOutliner, Bike, Logseq, etc.) want a single-parent
 * hierarchy. We project the DAG to a tree by picking each entity's **first**
 * outgoing edge (sorted by target annotation number for determinism) as its
 * outline parent. Multi-parented entities still appear once; the rest of
 * their causal links are dropped from the outline (not lost — the JSON or
 * Flying Logic export round-trips the full graph).
 *
 * Roots of the outline are entities with no outgoing edges (terminal
 * effects, goals — the apex of a CRT / FRT / PRT). Children render below
 * their effect, which gives the outline reading "the effect, then its
 * causes underneath" — matching how TOC practitioners verbalize a CRT.
 *
 * Assumptions live on edges, not in the causal flow, so they're omitted
 * from the outline. They're still captured in the JSON / FL exports.
 *
 * Conventional non-OPML attributes are prefixed with `_` per OPML 2.0's
 * guidance for namespace-free custom attributes:
 *   - `_type`        — entity type label (e.g. "Undesirable Effect")
 *   - `_annotation`  — the stable per-document annotation number
 *   - `_note`        — the markdown description (OmniOutliner convention)
 */

const escapeXml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const exportToOpml = (doc: TPDocument): string => {
  // Structural entities only — assumptions are edge-attached and don't fit
  // the parent / child outline metaphor.
  const structural = structuralEntities(doc).sort(
    (a, b) => a.annotationNumber - b.annotationNumber
  );

  // outlineParentOf: each entity's chosen single parent for the outline
  // tree (or null for roots). Picked deterministically by lowest-numbered
  // outgoing target — a stable rule so two runs over the same doc produce
  // byte-identical output.
  const outlineParentOf = new Map<string, string | null>();
  for (const e of structural) {
    const outs = outgoingEdges(doc, e.id);
    const targets = outs
      .map((edge) => doc.entities[edge.targetId])
      .filter((t): t is Entity => t !== undefined && !isAssumption(t))
      .sort((a, b) => a.annotationNumber - b.annotationNumber);
    outlineParentOf.set(e.id, targets[0]?.id ?? null);
  }

  const childrenOf = new Map<string, string[]>();
  for (const e of structural) childrenOf.set(e.id, []);
  for (const [child, parent] of outlineParentOf) {
    if (parent !== null) childrenOf.get(parent)?.push(child);
  }
  for (const arr of childrenOf.values()) {
    // arr is built from structural ids → entity always exists; non-null
    // assertions are safe here. `noUncheckedIndexedAccess` is on, so the
    // `!` is required to keep the subtraction expression numeric.
    arr.sort(
      (a, b) => (doc.entities[a]?.annotationNumber ?? 0) - (doc.entities[b]?.annotationNumber ?? 0)
    );
  }

  const renderOne = (id: string, depth: number): string[] => {
    const e = doc.entities[id];
    if (!e) return [];
    const meta = ENTITY_TYPE_META[e.type];
    const indent = '  '.repeat(depth + 2); // +2 for <opml> + <body>
    const text = escapeXml(e.title || 'Untitled');
    const attrs = [
      `text="${text}"`,
      `_type="${escapeXml(meta.label)}"`,
      `_annotation="${e.annotationNumber}"`,
    ];
    if (e.description?.trim()) attrs.push(`_note="${escapeXml(e.description)}"`);
    const kids = childrenOf.get(id) ?? [];
    if (kids.length === 0) return [`${indent}<outline ${attrs.join(' ')} />`];
    const lines = [`${indent}<outline ${attrs.join(' ')}>`];
    for (const kid of kids) lines.push(...renderOne(kid, depth + 1));
    lines.push(`${indent}</outline>`);
    return lines;
  };

  const roots = structural
    .filter((e) => outlineParentOf.get(e.id) === null)
    .sort((a, b) => a.annotationNumber - b.annotationNumber);

  const out: string[] = [];
  out.push('<?xml version="1.0" encoding="UTF-8"?>');
  out.push('<opml version="2.0">');
  out.push('  <head>');
  out.push(`    <title>${escapeXml(doc.title || 'Untitled')}</title>`);
  if (doc.author?.trim()) out.push(`    <ownerName>${escapeXml(doc.author.trim())}</ownerName>`);
  out.push('  </head>');
  out.push('  <body>');
  for (const r of roots) out.push(...renderOne(r.id, 0));
  out.push('  </body>');
  out.push('</opml>');
  return `${out.join('\n')}\n`;
};
