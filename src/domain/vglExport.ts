import { ENTITY_TYPE_META } from './entityTypeMeta';
import { structuralEntities } from './graph';
import type { TPDocument } from './types';

/**
 * VGL-like declarative export (N5 — Session 64).
 *
 * The Flying Logic VGL (Visual Graph Language) doesn't have a published,
 * stable grammar we can target precisely. This exporter ships a *VGL-flavored*
 * declarative text format the user can paste into a doc, diff against
 * other versions, or hand-edit and re-import as a starting point. The
 * intent is interoperability with users who think in text-config rather
 * than the FL XML / our JSON.
 *
 * Format:
 *
 * ```
 * graph "Document title" type:crt direction:BT {
 *   entity e_<id> class:"Undesirable Effect" {
 *     title: "Customers churn"
 *     annotation: 3
 *     description: "Quarterly NPS dropped 8 points."
 *   }
 *   entity e_<id> class:"Root Cause" {
 *     title: "Manual order entry"
 *     annotation: 1
 *   }
 *   edge e_<rc> -> e_<ude> {
 *     label: "within 30 days"
 *   }
 *   edge_and target:e_<ude> {
 *     e_<rc1>
 *     e_<rc2>
 *   }
 * }
 * ```
 *
 * Each `entity` block carries the class label (using the human-readable
 * `ENTITY_TYPE_META.label` rather than the internal enum), title,
 * annotation number, and an optional description. Each `edge` is a simple
 * arrow with optional inline label. AND-grouped edges sharing a target
 * collapse into an `edge_and` block listing the sources — this matches FL's
 * "junctor" semantics more cleanly than repeating `edge ... and:groupId`
 * on every member.
 *
 * Assumption-typed entities are dropped from this export (they're not
 * structural causal entities; the JSON / FL exports keep them).
 *
 * Note: this format isn't round-trippable yet — there's no `importFromVgl`
 * companion. If a user starts authoring TP documents in VGL text, that
 * importer becomes worth building. For now, treat the export as
 * human-readable interchange only.
 */

/** Escape for inclusion inside a `"..."` value. */
const q = (s: string): string =>
  `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, '\\n')}"`;

/** Sanitize an id for use as a VGL token. */
const tid = (id: string): string => `e_${id.replace(/[^a-zA-Z0-9_]/g, '_')}`;

export const exportToVgl = (doc: TPDocument): string => {
  const out: string[] = [];
  const direction = doc.layoutConfig?.direction ?? 'BT';
  const header = `graph ${q(doc.title || 'Untitled')} type:${doc.diagramType} direction:${direction}`;
  out.push(`${header} {`);

  // Entities: sort by annotation number so the output is deterministic and
  // reads in author-order (rather than insertion-order from the Map).
  const entities = structuralEntities(doc).sort((a, b) => a.annotationNumber - b.annotationNumber);

  for (const e of entities) {
    const className = ENTITY_TYPE_META[e.type].label;
    out.push(`  entity ${tid(e.id)} class:${q(className)} {`);
    out.push(`    title: ${q(e.title || 'Untitled')}`);
    out.push(`    annotation: ${e.annotationNumber}`);
    if (e.description?.trim()) {
      out.push(`    description: ${q(e.description.trim())}`);
    }
    out.push('  }');
  }

  // Group edges by junctor kind: AND/OR/XOR-grouped ones bucket under
  // `edge_<kind> target:T { … }`; plain ones render one-per-line. An edge belongs
  // to AT MOST ONE junctor kind (store-enforced), so the kinds never overlap.
  type Edge = (typeof doc.edges)[string];
  const JUNCTOR_KINDS = ['and', 'or', 'xor'] as const;
  type JunctorKind = (typeof JUNCTOR_KINDS)[number];
  const groupFieldOf = (e: Edge, kind: JunctorKind): string | undefined =>
    kind === 'and' ? e.andGroupId : kind === 'or' ? e.orGroupId : e.xorGroupId;
  const plain: Edge[] = [];
  const buckets: Record<JunctorKind, Map<string, { targetId: string; members: Edge[] }>> = {
    and: new Map(),
    or: new Map(),
    xor: new Map(),
  };
  for (const edge of Object.values(doc.edges)) {
    const src = doc.entities[edge.sourceId];
    const tgt = doc.entities[edge.targetId];
    if (!src || !tgt) continue;
    const kind = JUNCTOR_KINDS.find((k) => groupFieldOf(edge, k));
    const key = kind && groupFieldOf(edge, kind);
    if (kind && key) {
      const bucket = buckets[kind].get(key);
      if (bucket) bucket.members.push(edge);
      else buckets[kind].set(key, { targetId: edge.targetId, members: [edge] });
    } else {
      plain.push(edge);
    }
  }

  for (const edge of plain) {
    const hasLabel = edge.label?.trim();
    if (hasLabel) {
      out.push(`  edge ${tid(edge.sourceId)} -> ${tid(edge.targetId)} {`);
      out.push(`    label: ${q(edge.label!.trim())}`);
      out.push('  }');
    } else {
      out.push(`  edge ${tid(edge.sourceId)} -> ${tid(edge.targetId)}`);
    }
  }

  for (const kind of JUNCTOR_KINDS) {
    for (const { targetId, members } of buckets[kind].values()) {
      if (members.length < 2) {
        // Single-member group → render as a plain edge instead of an empty-ish
        // `edge_<kind>` block. The user can re-group on import.
        for (const edge of members) {
          out.push(`  edge ${tid(edge.sourceId)} -> ${tid(edge.targetId)}`);
        }
        continue;
      }
      out.push(`  edge_${kind} target:${tid(targetId)} {`);
      for (const edge of members) out.push(`    ${tid(edge.sourceId)}`);
      out.push('  }');
    }
  }

  out.push('}');
  return `${out.join('\n')}\n`;
};
