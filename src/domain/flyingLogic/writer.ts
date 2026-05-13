import type { EntityType, TPDocument } from '../types';
import { ENTITY_TYPE_TO_FL, escapeXml } from './typeMaps';

/**
 * Serialize a TPDocument as Flying Logic XML. Returns a string ready to be
 * written to a `.logicx` file (flat XML; not zipped).
 *
 * Lossy:
 *   - Position data is dropped (FL doesn't store positions either).
 *   - Custom canvas / domain / display settings aren't written.
 *
 * Preserved via `tp-studio-*` attributes (FL ignores them on its side):
 *   - Internal IDs (`tp-studio-id`, `tp-studio-edge-id`,
 *     `tp-studio-and-group-id`, `tp-studio-or-group-id`,
 *     `tp-studio-xor-group-id`)
 *   - Bundle 8 edge polarity (`tp-studio-weight`) — positive / negative / zero.
 *   - Annotation numbers (`tp-studio-annotation`)
 *   - Group colors (`tp-studio-color`)
 *   - Diagram type + nextAnnotation counter on the root
 *
 * Junctor handling (Session 76 extension): AND keeps its
 * `tp-studio-and-group-id` attribute (backwards-compatible with files
 * written before Bundle 8). OR / XOR junctors use parallel attribute
 * keys; the reader inspects which key is present to reconstruct the
 * junctor kind on import. FL renders all three as undifferentiated
 * junctor vertices (it has no native OR / XOR operator type in the
 * dimensions we use), but the round-trip back into TP Studio is
 * lossless.
 */
export const exportToFlyingLogic = (doc: TPDocument): string => {
  // Allocate FL eids — Flying Logic uses small integers.
  let next = 1;
  const eidByEntity = new Map<string, number>();
  const eidByGroup = new Map<string, number>();
  const eidByJunctor = new Map<string, number>();

  for (const entity of Object.values(doc.entities)) eidByEntity.set(entity.id, next++);
  for (const group of Object.values(doc.groups)) eidByGroup.set(group.id, next++);

  // Collect junctor groups by kind. Edges carry at most one of the
  // three groupId fields (cross-kind exclusivity is enforced at the
  // store and persistence layers). The triple is symmetric.
  type JunctorKind = 'and' | 'or' | 'xor';
  const groupIdsByKind: Record<JunctorKind, Set<string>> = {
    and: new Set(),
    or: new Set(),
    xor: new Set(),
  };
  for (const edge of Object.values(doc.edges)) {
    if (edge.andGroupId) groupIdsByKind.and.add(edge.andGroupId);
    if (edge.orGroupId) groupIdsByKind.or.add(edge.orGroupId);
    if (edge.xorGroupId) groupIdsByKind.xor.add(edge.xorGroupId);
  }
  for (const set of Object.values(groupIdsByKind)) {
    for (const gid of set) eidByJunctor.set(gid, next++);
  }

  /** Look up the junctor groupId an edge belongs to (any kind), with the
   *  kind. Cross-kind exclusivity means at most one is set per edge. */
  const edgeJunctor = (edge: { andGroupId?: string; orGroupId?: string; xorGroupId?: string }): {
    kind: JunctorKind;
    gid: string;
  } | null => {
    if (edge.andGroupId) return { kind: 'and', gid: edge.andGroupId };
    if (edge.orGroupId) return { kind: 'or', gid: edge.orGroupId };
    if (edge.xorGroupId) return { kind: 'xor', gid: edge.xorGroupId };
    return null;
  };
  // Per-kind attribute key for the junctor's preserved groupId.
  const JUNCTOR_ATTR_KEY: Record<JunctorKind, string> = {
    and: 'tp-studio-and-group-id',
    or: 'tp-studio-or-group-id',
    xor: 'tp-studio-xor-group-id',
  };

  const usedTypes = new Set<EntityType>();
  for (const entity of Object.values(doc.entities)) usedTypes.add(entity.type);

  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push(`<flyingLogic majorversion="5" uuid="${escapeXml(doc.id)}" instance="tp-studio">`);
  lines.push(
    `  <attribute key="title" class="java.lang.String">${escapeXml(doc.title)}</attribute>`
  );
  if (doc.author) {
    lines.push(
      `  <attribute key="author" class="java.lang.String">${escapeXml(doc.author)}</attribute>`
    );
  }
  if (doc.description) {
    lines.push(
      `  <attribute key="description" class="java.lang.String">${escapeXml(doc.description)}</attribute>`
    );
  }
  lines.push(
    `  <attribute key="tp-studio-diagram-type" class="java.lang.String">${doc.diagramType}</attribute>`
  );
  lines.push(
    `  <attribute key="tp-studio-next-annotation" class="java.lang.Integer">${doc.nextAnnotationNumber}</attribute>`
  );

  // Symbols (entity classes the doc actually uses)
  lines.push('  <symbols>');
  for (const type of usedTypes) {
    lines.push(`    <entityClass name="${escapeXml(ENTITY_TYPE_TO_FL[type])}"/>`);
  }
  lines.push('  </symbols>');

  // Decision graph
  lines.push('  <decisionGraph>');
  lines.push('    <vertices>');

  for (const entity of Object.values(doc.entities)) {
    const eid = eidByEntity.get(entity.id);
    if (eid === undefined) continue;
    lines.push(
      `      <vertex eid="${eid}" type="entity" entityClass="${escapeXml(ENTITY_TYPE_TO_FL[entity.type])}">`
    );
    lines.push(
      `        <attribute key="title" class="java.lang.String">${escapeXml(entity.title)}</attribute>`
    );
    if (entity.description) {
      lines.push(
        `        <attribute key="description" class="java.lang.String">${escapeXml(entity.description)}</attribute>`
      );
    }
    lines.push(
      `        <attribute key="tp-studio-id" class="java.lang.String">${escapeXml(entity.id)}</attribute>`
    );
    lines.push(
      `        <attribute key="tp-studio-annotation" class="java.lang.Integer">${entity.annotationNumber}</attribute>`
    );
    lines.push('      </vertex>');
  }

  // AND / OR / XOR junctors. Each kind uses its own attribute key for
  // the preserved group id so the reader can tell them apart. FL itself
  // renders all three identically (as a generic junctor vertex).
  for (const [kind, ids] of Object.entries(groupIdsByKind) as [JunctorKind, Set<string>][]) {
    for (const gid of ids) {
      const eid = eidByJunctor.get(gid);
      if (eid === undefined) continue;
      lines.push(
        `      <vertex eid="${eid}" type="junctor"><attribute key="${JUNCTOR_ATTR_KEY[kind]}" class="java.lang.String">${escapeXml(gid)}</attribute></vertex>`
      );
    }
  }

  // Groups
  for (const group of Object.values(doc.groups)) {
    const eid = eidByGroup.get(group.id);
    if (eid === undefined) continue;
    const memberEids = group.memberIds
      .map((id) => eidByEntity.get(id) ?? eidByGroup.get(id))
      .filter((e): e is number => e !== undefined)
      .join(' ');
    const collapsedAttr = group.collapsed ? ' collapsed="true"' : '';
    lines.push(`      <vertex eid="${eid}" grouped="${memberEids}"${collapsedAttr}>`);
    lines.push(
      `        <attribute key="title" class="java.lang.String">${escapeXml(group.title)}</attribute>`
    );
    lines.push(
      `        <attribute key="tp-studio-id" class="java.lang.String">${escapeXml(group.id)}</attribute>`
    );
    lines.push(
      `        <attribute key="tp-studio-color" class="java.lang.String">${escapeXml(group.color)}</attribute>`
    );
    lines.push('      </vertex>');
  }

  lines.push('    </vertices>');

  // Edges
  lines.push('    <edges>');
  const junctorOutEmitted = new Set<string>(); // gid|targetEid
  for (const edge of Object.values(doc.edges)) {
    const sourceEid = eidByEntity.get(edge.sourceId);
    const targetEid = eidByEntity.get(edge.targetId);
    if (sourceEid === undefined || targetEid === undefined) continue;

    const junctor = edgeJunctor(edge);
    if (junctor) {
      const junctorEid = eidByJunctor.get(junctor.gid);
      if (junctorEid !== undefined) {
        const sourceAttrs: string[] = [
          `<attribute key="tp-studio-edge-id" class="java.lang.String">${escapeXml(edge.id)}</attribute>`,
        ];
        if (edge.weight) {
          sourceAttrs.push(
            `<attribute key="tp-studio-weight" class="java.lang.String">${edge.weight}</attribute>`
          );
        }
        // source → junctor
        lines.push(
          `      <edge source="${sourceEid}" target="${junctorEid}">${sourceAttrs.join('')}</edge>`
        );
        // junctor → target (once per (gid, target) pair)
        const key = `${junctor.gid}|${targetEid}`;
        if (!junctorOutEmitted.has(key)) {
          lines.push(`      <edge source="${junctorEid}" target="${targetEid}"/>`);
          junctorOutEmitted.add(key);
        }
        continue;
      }
    }

    const attrs: string[] = [
      `<attribute key="tp-studio-edge-id" class="java.lang.String">${escapeXml(edge.id)}</attribute>`,
    ];
    if (edge.label) {
      attrs.push(
        `<attribute key="label" class="java.lang.String">${escapeXml(edge.label)}</attribute>`
      );
    }
    if (edge.weight) {
      attrs.push(
        `<attribute key="tp-studio-weight" class="java.lang.String">${edge.weight}</attribute>`
      );
    }
    lines.push(`      <edge source="${sourceEid}" target="${targetEid}">${attrs.join('')}</edge>`);
  }
  lines.push('    </edges>');
  lines.push('  </decisionGraph>');
  lines.push('</flyingLogic>');
  return `${lines.join('\n')}\n`;
};
