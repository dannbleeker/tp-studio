import { DIAGRAM_TYPE_LABEL } from './entityTypeMeta';
import { newDocumentId, newEdgeId, newEntityId, newGroupId } from './ids';
import type {
  DiagramType,
  Edge,
  Entity,
  EntityId,
  EntityType,
  Group,
  GroupColor,
  TPDocument,
} from './types';

const titleForDiagram = (diagramType: DiagramType): string =>
  `Untitled ${DIAGRAM_TYPE_LABEL[diagramType]}`;

/**
 * The mutable part of a freshly created document — entities, edges, and the
 * annotation counter. Every other field on `TPDocument` (id, title, type,
 * timestamps, resolvedWarnings, groups, schemaVersion) is mechanical and
 * lives inside `createDocument` itself.
 */
type DocSeed = Pick<TPDocument, 'entities' | 'edges' | 'nextAnnotationNumber'>;

const emptySeed = (): DocSeed => ({ entities: {}, edges: {}, nextAnnotationNumber: 1 });

/**
 * Canonical 5-box Evaporating Cloud layout (mirrored in examples.ts for the
 * example builder). Goal on the left, two needs stacked centrally, two wants
 * stacked on the right. These coordinates are the EC diagnostic — dagre is
 * disabled for this diagram (LAYOUT_STRATEGY.ec === 'manual').
 */
const EC_POSITIONS = {
  a: { x: 100, y: 250 },
  b: { x: 450, y: 100 },
  c: { x: 450, y: 400 },
  d: { x: 800, y: 100 },
  dPrime: { x: 800, y: 400 },
} as const;

/**
 * Seed a blank Evaporating Cloud with the 5 boxes pre-positioned and the
 * 4 sufficiency edges (D→B, D′→C, B→A, C→A) already wired. Box titles are
 * empty placeholders — the user fills them in. Without the seed, the
 * diagnostic structure would be invisible on a fresh canvas.
 */
const seedEC = (now: number): DocSeed => {
  const ids = {
    a: newEntityId(),
    b: newEntityId(),
    c: newEntityId(),
    d: newEntityId(),
    dPrime: newEntityId(),
  };
  const mkEntity = (
    id: EntityId,
    type: Entity['type'],
    n: number,
    pos: { x: number; y: number },
    slot: 'a' | 'b' | 'c' | 'd' | 'dPrime'
  ): Entity => ({
    id,
    type,
    title: '',
    annotationNumber: n,
    createdAt: now,
    updatedAt: now,
    position: pos,
    ecSlot: slot,
  });
  // Session 77: EC edges are necessity-typed ("in order to A, we must B").
  const mkEdge = (sourceId: EntityId, targetId: EntityId): Edge => ({
    id: newEdgeId(),
    sourceId,
    targetId,
    kind: 'necessity',
  });
  const entities: Entity[] = [
    mkEntity(ids.a, 'goal', 1, EC_POSITIONS.a, 'a'),
    mkEntity(ids.b, 'need', 2, EC_POSITIONS.b, 'b'),
    mkEntity(ids.c, 'need', 3, EC_POSITIONS.c, 'c'),
    mkEntity(ids.d, 'want', 4, EC_POSITIONS.d, 'd'),
    mkEntity(ids.dPrime, 'want', 5, EC_POSITIONS.dPrime, 'dPrime'),
  ];
  const edges: Edge[] = [
    mkEdge(ids.d, ids.b),
    mkEdge(ids.dPrime, ids.c),
    mkEdge(ids.b, ids.a),
    mkEdge(ids.c, ids.a),
  ];
  return {
    entities: Object.fromEntries(entities.map((e) => [e.id, e])),
    edges: Object.fromEntries(edges.map((e) => [e.id, e])),
    nextAnnotationNumber: 6,
  };
};

/**
 * Per-diagram-type initial-content factory. CRT/FRT/PRT/TT all start blank;
 * Evaporating Cloud pre-seeds five boxes at canonical coordinates via
 * `seedEC` above. The `now` argument is the document-level timestamp so
 * all seeded entities share `createdAt` / `updatedAt`.
 *
 * The `Record<DiagramType, _>` shape forces a new diagram type to declare
 * its seed — a missing entry surfaces as a compile error rather than a
 * silently-blank canvas for a diagram that's supposed to ship populated.
 */
export const INITIAL_DOC_BY_DIAGRAM: Record<DiagramType, (now: number) => DocSeed> = {
  crt: () => emptySeed(),
  frt: () => emptySeed(),
  prt: () => emptySeed(),
  tt: () => emptySeed(),
  ec: seedEC,
  // FL-DT4 + FL-DT5: both start empty. S&T users build the tree
  // top-down from a single apex goal; freeform users have no canonical
  // starting shape. Pre-seeding either would be a guess.
  st: () => emptySeed(),
  freeform: () => emptySeed(),
  // Session 77 / brief §5 — Goal Tree starts empty; the guided wizard
  // (Goal → CSFs → NCs) populates it. A seed-with-empty-Goal might
  // feel friendlier, but the wizard is the canonical entry path.
  goalTree: () => emptySeed(),
};

export const createDocument = (diagramType: DiagramType): TPDocument => {
  const now = Date.now();
  const seed = INITIAL_DOC_BY_DIAGRAM[diagramType](now);
  return {
    id: newDocumentId(),
    diagramType,
    title: titleForDiagram(diagramType),
    entities: seed.entities,
    edges: seed.edges,
    groups: {},
    resolvedWarnings: {},
    nextAnnotationNumber: seed.nextAnnotationNumber,
    createdAt: now,
    updatedAt: now,
    schemaVersion: 8,
  };
};

export const createEntity = (params: {
  type: EntityType;
  title?: string;
  annotationNumber: number;
}): Entity => {
  const now = Date.now();
  return {
    id: newEntityId(),
    type: params.type,
    title: params.title ?? '',
    annotationNumber: params.annotationNumber,
    createdAt: now,
    updatedAt: now,
  };
};

export const createEdge = (params: {
  sourceId: string;
  targetId: string;
  andGroupId?: string;
}): Edge => ({
  id: newEdgeId(),
  sourceId: params.sourceId as EntityId,
  targetId: params.targetId as EntityId,
  kind: 'sufficiency',
  ...(params.andGroupId ? { andGroupId: params.andGroupId } : {}),
});

export const createGroup = (params: {
  title?: string;
  color?: GroupColor;
  memberIds?: string[];
}): Group => {
  const now = Date.now();
  return {
    id: newGroupId(),
    title: params.title ?? 'New group',
    color: params.color ?? 'indigo',
    memberIds: params.memberIds ?? [],
    collapsed: false,
    createdAt: now,
    updatedAt: now,
  };
};
