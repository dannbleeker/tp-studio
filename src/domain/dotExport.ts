import { resolveEntityTypeMeta } from './entityTypeMeta';
import { isAssumption, structuralEntities } from './graph';
import type { TPDocument } from './types';

/**
 * Graphviz DOT export (N2).
 *
 * Renders the structural causal graph as a `digraph` ready to paste into
 * `dot`, `https://dreampuf.github.io/GraphvizOnline/`, VS Code's Graphviz
 * Preview, or any other DOT-aware tool. Causality direction matches the
 * in-app rendering: edges go cause → effect, and `rankdir=BT` puts effects
 * at the top of the rendered layout (like CRT / FRT / PRT / TT).
 *
 * Assumptions and edges touching them are omitted — they don't carry
 * structural causality. AND groups render as bold edges (the dotted /
 * grouped Flying-Logic style isn't expressible in plain DOT without
 * coordinate hacks; bold is the closest universal cue).
 *
 * Per-entity styling uses the type's stripe colour as the node border with
 * a 2-pixel pen weight. We don't tint the fill — alpha hex (`#rrggbbaa`)
 * isn't supported by every Graphviz build, and a coloured border + label
 * preamble (`Undesirable Effect — #3`) reads clearly on the default white
 * fill across both screen rendering and printed output.
 */

/** Escape a string for DOT double-quoted use: backslashes, quotes, newlines. */
const escapeDot = (s: string): string =>
  s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, '\\n');

/** Coerce an entity id (or any string) to a safe DOT identifier. */
const dotId = (id: string): string => `n_${id.replace(/[^a-zA-Z0-9_]/g, '_')}`;

export const exportToDot = (doc: TPDocument): string => {
  const title = escapeDot(doc.title || 'Untitled');
  const lines: string[] = [];
  lines.push(`digraph "${title}" {`);
  // Effects sit on top → bottom-to-top edge layout in the rendered diagram.
  lines.push('  rankdir=BT;');
  lines.push('  node [shape=box, style=rounded, fontname="Helvetica", fontsize=11];');
  lines.push('  edge [fontname="Helvetica", fontsize=10];');
  lines.push('');

  const structural = structuralEntities(doc).sort(
    (a, b) => a.annotationNumber - b.annotationNumber
  );
  for (const e of structural) {
    // B10: doc-aware lookup picks up custom-class color + label.
    const meta = resolveEntityTypeMeta(e.type, doc.customEntityClasses);
    const label = `${meta.label} — #${e.annotationNumber}\n${e.title || 'Untitled'}`;
    lines.push(
      `  ${dotId(e.id)} [label="${escapeDot(label)}", color="${meta.stripeColor}", penwidth=2];`
    );
  }
  lines.push('');

  for (const edge of Object.values(doc.edges)) {
    const src = doc.entities[edge.sourceId];
    const tgt = doc.entities[edge.targetId];
    if (!src || !tgt || isAssumption(src) || isAssumption(tgt)) continue;
    const attrs: string[] = [];
    if (edge.label?.trim()) attrs.push(`label="${escapeDot(edge.label.trim())}"`);
    if (edge.andGroupId) attrs.push('style=bold');
    const attrStr = attrs.length ? ` [${attrs.join(', ')}]` : '';
    lines.push(`  ${dotId(edge.sourceId)} -> ${dotId(edge.targetId)}${attrStr};`);
  }

  lines.push('}');
  return `${lines.join('\n')}\n`;
};
