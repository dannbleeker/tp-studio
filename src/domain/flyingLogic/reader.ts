import { createDocument, createEdge, createEntity, createGroup } from '../factory';
import type {
  Edge,
  EdgeId,
  Entity,
  EntityId,
  Group,
  GroupColor,
  GroupId,
  TPDocument,
} from '../types';
import { VALID_GROUP_COLORS, mapEntityType } from './typeMaps';

/**
 * Flying Logic XML reader. Two schema variants exist in the wild:
 *
 *   1. **Flat / scripting export** — what FL's automation API and our writer
 *      emit. Vertices and edges sit directly under `decisionGraph`;
 *      `<attribute key="...">value</attribute>` elements are direct children
 *      of each `<vertex>` / `<edge>`; entity class and vertex type are plain
 *      XML attributes on the `<vertex>` element (`entityClass="Goal"`,
 *      `type="entity"`).
 *
 *   2. **Nested / user-saved** — what FL produces when a user runs File →
 *      Save in the desktop app. Adds a `logicGraph > graph` wrapper, wraps
 *      attributes in an `<attributes>` container per vertex/edge, and
 *      stores `entityClass` + `type` as nested `<attribute>` elements
 *      (entityClass's value is in turn the `name` attribute of a child
 *      `<entityClass name="..."/>` element). Document metadata lives in a
 *      `<documentInfo title="" author="" comments=""/>` element instead of
 *      root-level attributes.
 *
 * This reader handles both. The helpers below test the flat form first
 * (cheaper, the format we generate) and fall back to the nested form. The
 * test suite pins both shapes; `tests/domain/flyingLogic.test.ts` carries
 * fixture cases for each.
 */

/** Element that holds the `<attribute>` children — either `el` itself
 *  (flat) or its `<attributes>` child (nested). */
const attributeHost = (el: Element): Element => {
  for (const child of Array.from(el.children)) {
    if (child.tagName === 'attributes') return child;
  }
  return el;
};

/** Find the first direct child whose tagName matches. Used in place of
 *  `el.querySelector(':scope > tag')` because jsdom's XML-mode handling of
 *  the `:scope` selector is unreliable — it returns null on real-world
 *  Flying Logic files where iterating `el.children` does find the node. */
const firstChildByTag = (el: Element, tag: string): Element | null => {
  for (const child of Array.from(el.children)) {
    if (child.tagName === tag) return child;
  }
  return null;
};

/** Read every `<attribute key="...">value</attribute>` child into a key→
 *  textContent map. */
const getAttributeMap = (el: Element): Map<string, string> => {
  const map = new Map<string, string>();
  const host = attributeHost(el);
  for (const attr of Array.from(host.children)) {
    if (attr.tagName !== 'attribute') continue;
    const key = attr.getAttribute('key');
    if (!key) continue;
    // Nested entityClass uses a child element, not text content — skip here
    // and let `getEntityClass` pull it out separately.
    if (key === 'entityClass' && firstChildByTag(attr, 'entityClass')) continue;
    map.set(key, attr.textContent ?? '');
  }
  return map;
};

/** Resolve the entity class for a vertex from either the flat XML attribute
 *  (`<vertex entityClass="Goal">`) or the nested attribute form
 *  (`<attribute key="entityClass"><entityClass name="Goal"/></attribute>`).
 *  Returns null if neither shape is present. */
const getEntityClass = (el: Element): string | null => {
  const flat = el.getAttribute('entityClass');
  if (flat) return flat;
  const host = attributeHost(el);
  for (const attr of Array.from(host.children)) {
    if (attr.tagName !== 'attribute') continue;
    if (attr.getAttribute('key') !== 'entityClass') continue;
    const ec = firstChildByTag(attr, 'entityClass');
    const name = ec?.getAttribute('name');
    if (name) return name;
  }
  return null;
};

/** Vertex type — `"entity"` / `"junctor"` / `"group"`. Same dual storage as
 *  entityClass (flat XML attribute first, then nested `<attribute key="type">`
 *  text content). */
const getVertexTypeAttr = (el: Element, attrs: Map<string, string>): string | null =>
  el.getAttribute('type') ?? attrs.get('type') ?? null;

const getGroupedAttr = (el: Element, attrs: Map<string, string>): string | null =>
  el.getAttribute('grouped') ?? attrs.get('grouped') ?? null;

const getCollapsedAttr = (el: Element, attrs: Map<string, string>): boolean => {
  const flat = el.getAttribute('collapsed');
  if (flat !== null) return flat === 'true';
  return attrs.get('collapsed') === 'true';
};

/**
 * Parse a Flying Logic XML document and produce a TPDocument. Handles both
 * the flat-script and nested-user-saved schema variants.
 *
 * Throws on parser-level errors. Unknown vertex / edge data is tolerated:
 * a `<vertex>` we can't classify is dropped, a malformed `<edge>` is
 * skipped, etc. Caller-facing errors are descriptive.
 */
export const importFromFlyingLogic = (xml: string): TPDocument => {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xml, 'application/xml');
  const parseError = xmlDoc.querySelector('parsererror');
  if (parseError) {
    throw new Error(
      `Invalid Flying Logic file: ${parseError.textContent?.trim() ?? 'XML parse failed'}`
    );
  }
  const root = xmlDoc.documentElement;
  if (!root || root.tagName !== 'flyingLogic') {
    throw new Error('Invalid Flying Logic file: root element is not <flyingLogic>.');
  }

  // Top-level metadata — try both shapes.
  // Shape 1 (flat / our writer): <attribute key="title">...</attribute> children.
  const rootAttrs = new Map<string, string>();
  for (const child of Array.from(root.children)) {
    if (child.tagName === 'attribute') {
      const key = child.getAttribute('key');
      if (key) rootAttrs.set(key, child.textContent ?? '');
    }
  }
  // Shape 2 (FL native): <documentInfo title="..." author="..." comments="..."/>.
  // Only fill the map if the flat form didn't already supply the field — a
  // file that mixes both shouldn't lose its preferred values.
  for (const child of Array.from(root.children)) {
    if (child.tagName !== 'documentInfo') continue;
    const title = child.getAttribute('title');
    const author = child.getAttribute('author');
    const comments = child.getAttribute('comments');
    if (title && !rootAttrs.has('title')) rootAttrs.set('title', title);
    if (author && !rootAttrs.has('author')) rootAttrs.set('author', author);
    if (comments && !rootAttrs.has('description')) rootAttrs.set('description', comments);
  }

  const diagramTypeAttr = rootAttrs.get('tp-studio-diagram-type');
  // Accept any diagram type our app currently knows about. Unknown
  // values fall back to CRT so a file from a future version still
  // imports with sane defaults.
  const KNOWN_DIAGRAMS: Record<string, true> = {
    crt: true,
    frt: true,
    prt: true,
    tt: true,
    ec: true,
    st: true,
    freeform: true,
  };
  const diagramType =
    diagramTypeAttr && KNOWN_DIAGRAMS[diagramTypeAttr]
      ? (diagramTypeAttr as 'crt' | 'frt' | 'prt' | 'tt' | 'ec' | 'st' | 'freeform')
      : 'crt';
  const baseDoc = createDocument(diagramType);
  const seedTitle = rootAttrs.get('title');
  const seedAuthor = rootAttrs.get('author');
  const seedDescription = rootAttrs.get('description');
  const seedNextAnnotation = Number.parseInt(rootAttrs.get('tp-studio-next-annotation') ?? '', 10);

  // Locate vertices / edges containers. Descendant selectors match both the
  // flat (`decisionGraph > vertices`) and nested (`decisionGraph > logicGraph
  // > graph > vertices`) forms — querySelector returns the first match, and
  // there's only one `<vertices>` element in either layout.
  const verticesEl = root.querySelector('decisionGraph vertices');
  const edgesEl = root.querySelector('decisionGraph edges');

  type RawVertex = {
    eid: string;
    el: Element;
    isJunctor: boolean;
    isGroup: boolean;
    grouped?: string[];
    collapsed: boolean;
    attrs: Map<string, string>;
    entityClass: string | null;
  };
  const vertices = new Map<string, RawVertex>();
  if (verticesEl) {
    for (const el of Array.from(verticesEl.children)) {
      if (el.tagName !== 'vertex') continue;
      const eid = el.getAttribute('eid');
      if (!eid) continue;
      const attrs = getAttributeMap(el);
      const vertexType = getVertexTypeAttr(el, attrs);
      const grouped = getGroupedAttr(el, attrs);
      vertices.set(eid, {
        eid,
        el,
        isJunctor: vertexType === 'junctor',
        isGroup: grouped !== null,
        grouped: grouped ? grouped.split(/\s+/).filter(Boolean) : undefined,
        collapsed: getCollapsedAttr(el, attrs),
        attrs,
        entityClass: getEntityClass(el),
      });
    }
  }

  // First pass: build entities (everything that's an actual entity vertex).
  const entityByEid = new Map<string, Entity>();
  let annotationCounter = Number.isFinite(seedNextAnnotation) ? seedNextAnnotation : 1;
  for (const v of vertices.values()) {
    if (v.isJunctor || v.isGroup) continue;
    const type = mapEntityType(v.entityClass);
    const title = v.attrs.get('title') ?? '';
    const description = v.attrs.get('description');
    const preservedId = v.attrs.get('tp-studio-id');
    const annotation = Number.parseInt(v.attrs.get('tp-studio-annotation') ?? '', 10);
    const entity = createEntity({
      type,
      title,
      annotationNumber: Number.isFinite(annotation) ? annotation : annotationCounter++,
    });
    const finalEntity: Entity = {
      ...entity,
      id: (preservedId || entity.id) as EntityId,
      ...(description ? { description } : {}),
    };
    entityByEid.set(v.eid, finalEntity);
  }

  // Second pass: walk edges. Track junctor in/out so we can synthesize
  // `andGroupId` / `orGroupId` / `xorGroupId` for our edges.
  type EdgeWeight = 'positive' | 'negative' | 'zero';
  type RawEdge = {
    source: string;
    target: string;
    label?: string;
    tpStudioId?: string;
    // Bundle 8 — polarity tag. Round-tripped via `tp-studio-weight`
    // attribute on the edge. Unknown values fall to undefined (no tag).
    weight?: EdgeWeight;
  };
  const isEdgeWeight = (v: string | undefined): v is EdgeWeight =>
    v === 'positive' || v === 'negative' || v === 'zero';
  const rawEdges: RawEdge[] = [];
  if (edgesEl) {
    for (const el of Array.from(edgesEl.children)) {
      if (el.tagName !== 'edge') continue;
      const source = el.getAttribute('source');
      const target = el.getAttribute('target');
      if (!source || !target) continue;
      const attrs = getAttributeMap(el);
      const weightAttr = attrs.get('tp-studio-weight');
      rawEdges.push({
        source,
        target,
        label: attrs.get('label'),
        tpStudioId: attrs.get('tp-studio-edge-id'),
        ...(isEdgeWeight(weightAttr) ? { weight: weightAttr } : {}),
      });
    }
  }

  // Group edges by whether they touch a junctor.
  // junctor → outgoing edges (one expected per junctor, pointing at the final target)
  const junctorOut = new Map<string, RawEdge[]>();
  // junctor → incoming edges (one per AND-grouped source)
  const junctorIn = new Map<string, RawEdge[]>();
  const directEdges: RawEdge[] = [];
  for (const e of rawEdges) {
    const sourceIsJunctor = vertices.get(e.source)?.isJunctor;
    const targetIsJunctor = vertices.get(e.target)?.isJunctor;
    if (sourceIsJunctor) {
      const list = junctorOut.get(e.source) ?? [];
      list.push(e);
      junctorOut.set(e.source, list);
    } else if (targetIsJunctor) {
      const list = junctorIn.get(e.target) ?? [];
      list.push(e);
      junctorIn.set(e.target, list);
    } else {
      directEdges.push(e);
    }
  }

  const finalEdges: Edge[] = [];
  for (const e of directEdges) {
    const source = entityByEid.get(e.source);
    const target = entityByEid.get(e.target);
    if (!source || !target) continue;
    const created = createEdge({ sourceId: source.id, targetId: target.id });
    finalEdges.push({
      ...created,
      id: (e.tpStudioId || created.id) as EdgeId,
      ...(e.label ? { label: e.label } : {}),
      ...(e.weight ? { weight: e.weight } : {}),
    });
  }

  // Expand junctors into junctor-grouped edges. Pick the kind based on
  // which `tp-studio-*-group-id` attribute is present on the junctor
  // vertex; default to AND for backwards compatibility with files
  // written before Bundle 8.
  for (const [junctorEid, outEdges] of junctorOut) {
    const inEdges = junctorIn.get(junctorEid) ?? [];
    if (inEdges.length === 0) continue;
    const target = outEdges[0]?.target;
    if (!target) continue;
    const targetEntity = entityByEid.get(target);
    if (!targetEntity) continue;
    const junctorVertex = vertices.get(junctorEid);
    const preservedAnd = junctorVertex?.attrs.get('tp-studio-and-group-id');
    const preservedOr = junctorVertex?.attrs.get('tp-studio-or-group-id');
    const preservedXor = junctorVertex?.attrs.get('tp-studio-xor-group-id');
    // Determine which kind to apply. AND > OR > XOR for the legacy case
    // where multiple attributes accidentally landed; otherwise the
    // attribute that's set wins. Default mints an AND group when no
    // preserved id is found (covers files written by older TP Studio
    // builds + native FL files where junctors are implicitly AND).
    let groupKind: 'and' | 'or' | 'xor' = 'and';
    let preservedId: string | undefined;
    if (preservedAnd) {
      groupKind = 'and';
      preservedId = preservedAnd;
    } else if (preservedOr) {
      groupKind = 'or';
      preservedId = preservedOr;
    } else if (preservedXor) {
      groupKind = 'xor';
      preservedId = preservedXor;
    }
    const mintedId = preservedId || `${groupKind}-${Math.random().toString(36).slice(2, 10)}`;
    const groupFields = (() => {
      if (groupKind === 'and') return { andGroupId: mintedId };
      if (groupKind === 'or') return { orGroupId: mintedId };
      return { xorGroupId: mintedId };
    })();
    for (const inE of inEdges) {
      const source = entityByEid.get(inE.source);
      if (!source) continue;
      // `createEdge` takes andGroupId via its params; for OR / XOR we
      // attach the field directly after creation.
      const created = createEdge({
        sourceId: source.id,
        targetId: targetEntity.id,
        ...(groupKind === 'and' ? { andGroupId: mintedId } : {}),
      });
      finalEdges.push({
        ...created,
        ...groupFields,
        id: (inE.tpStudioId || created.id) as EdgeId,
        ...(inE.label ? { label: inE.label } : {}),
        ...(inE.weight ? { weight: inE.weight } : {}),
      });
    }
  }

  // Third pass: groups.
  const groupByEid = new Map<string, Group>();
  for (const v of vertices.values()) {
    if (!v.isGroup) continue;
    const title = v.attrs.get('title') ?? 'Group';
    const preservedColor = v.attrs.get('tp-studio-color');
    const color: GroupColor = VALID_GROUP_COLORS.has(preservedColor as GroupColor)
      ? (preservedColor as GroupColor)
      : 'indigo';
    const preservedId = v.attrs.get('tp-studio-id');
    const memberEids = v.grouped ?? [];
    const memberIds: string[] = [];
    for (const memberEid of memberEids) {
      const childEntity = entityByEid.get(memberEid);
      if (childEntity) {
        memberIds.push(childEntity.id);
        continue;
      }
      const childGroup = groupByEid.get(memberEid);
      if (childGroup) memberIds.push(childGroup.id);
    }
    const created = createGroup({ title, color, memberIds });
    const finalGroup: Group = {
      ...created,
      id: (preservedId || created.id) as GroupId,
      collapsed: v.collapsed,
    };
    groupByEid.set(v.eid, finalGroup);
  }

  // Build the final document.
  const entities: Record<string, Entity> = {};
  for (const e of entityByEid.values()) entities[e.id] = e;
  const edges: Record<string, Edge> = {};
  for (const e of finalEdges) edges[e.id] = e;
  const groups: Record<string, Group> = {};
  for (const g of groupByEid.values()) groups[g.id] = g;

  return {
    ...baseDoc,
    title: seedTitle || baseDoc.title,
    ...(seedAuthor ? { author: seedAuthor } : {}),
    ...(seedDescription ? { description: seedDescription } : {}),
    entities,
    edges,
    groups,
    nextAnnotationNumber: Number.isFinite(seedNextAnnotation)
      ? seedNextAnnotation
      : Math.max(annotationCounter, 1),
  };
};
