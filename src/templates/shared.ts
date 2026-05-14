import { newDocumentId, newEdgeId, newEntityId } from '@/domain/ids';
import type {
  DiagramType,
  Edge,
  EdgeId,
  Entity,
  EntityId,
  EntityType,
  TPDocument,
} from '@/domain/types';

/**
 * Session 79 / brief §12 — Templates library helpers.
 *
 * Each template module declares its entities + edges as plain
 * literals; this shared layer turns those into a fully-typed
 * `TPDocument` with stable ids, valid `annotationNumber`s, a
 * `schemaVersion: 8` stamp, and matching `assumptions` map (empty
 * for now — templates ship without first-class assumption records,
 * the user can add them after loading).
 *
 * Pure functions: no React, no DOM, framework-free so the template
 * modules tree-shake cleanly and the picker can render their
 * metadata server-side if needed (it isn't today, but the constraint
 * keeps the templates lightweight).
 */

export type TemplateEntity = {
  /** Local-only key for cross-referencing in the edges list. Replaced
   *  with a real EntityId at build time. */
  key: string;
  type: EntityType;
  title: string;
  description?: string;
  /** EC docs use ecSlot to bind one entity to each of the 5
   *  canonical boxes. The factory.ts seed positions are mirrored
   *  here when an EC template wants the slot pre-positioned. */
  ecSlot?: 'a' | 'b' | 'c' | 'd' | 'dPrime';
  position?: { x: number; y: number };
};

export type TemplateEdge = {
  source: string; // entity key
  target: string; // entity key
  kind?: 'sufficiency' | 'necessity';
  /** Optional AND-group key. Edges sharing the same `andGroup` value
   *  end up in the same `andGroupId` after expansion. */
  andGroup?: string;
  label?: string;
  isMutualExclusion?: boolean;
};

export type TemplateSpec = {
  /** Stable id used by the picker for selection. Slug form. */
  id: string;
  title: string;
  diagramType: DiagramType;
  description: string;
  entities: TemplateEntity[];
  edges: TemplateEdge[];
};

const EC_POSITIONS: Record<'a' | 'b' | 'c' | 'd' | 'dPrime', { x: number; y: number }> = {
  a: { x: 100, y: 250 },
  b: { x: 450, y: 100 },
  c: { x: 450, y: 400 },
  d: { x: 800, y: 100 },
  dPrime: { x: 800, y: 400 },
};

/** Inflate a template spec into a fully-typed Document. */
export const buildTemplate = (spec: TemplateSpec): TPDocument => {
  const now = Date.now();
  const idByKey = new Map<string, EntityId>();
  const entities: Record<string, Entity> = {};
  spec.entities.forEach((e, i) => {
    const id = newEntityId();
    idByKey.set(e.key, id);
    const position = e.position ?? (e.ecSlot ? EC_POSITIONS[e.ecSlot] : undefined);
    entities[id] = {
      id,
      type: e.type,
      title: e.title,
      annotationNumber: i + 1,
      createdAt: now + i,
      updatedAt: now + i,
      ...(e.description ? { description: e.description } : {}),
      ...(e.ecSlot ? { ecSlot: e.ecSlot } : {}),
      ...(position ? { position } : {}),
    };
  });

  const andGroupIds = new Map<string, string>();
  const getAndGroupId = (key: string): string => {
    let existing = andGroupIds.get(key);
    if (!existing) {
      existing = `and-${spec.id}-${andGroupIds.size + 1}`;
      andGroupIds.set(key, existing);
    }
    return existing;
  };

  const edges: Record<string, Edge> = {};
  for (const e of spec.edges) {
    const sourceId = idByKey.get(e.source);
    const targetId = idByKey.get(e.target);
    if (!sourceId || !targetId) {
      throw new Error(
        `Template ${spec.id}: edge references unknown entity key (${e.source} → ${e.target}).`
      );
    }
    const edgeId = newEdgeId() as EdgeId;
    edges[edgeId] = {
      id: edgeId,
      sourceId,
      targetId,
      kind:
        e.kind ??
        (spec.diagramType === 'ec' || spec.diagramType === 'goalTree'
          ? 'necessity'
          : 'sufficiency'),
      ...(e.andGroup ? { andGroupId: getAndGroupId(e.andGroup) } : {}),
      ...(e.label ? { label: e.label } : {}),
      ...(e.isMutualExclusion ? { isMutualExclusion: true as const } : {}),
    };
  }

  return {
    id: newDocumentId(),
    diagramType: spec.diagramType,
    title: spec.title,
    description: spec.description,
    entities,
    edges,
    groups: {},
    resolvedWarnings: {},
    nextAnnotationNumber: spec.entities.length + 1,
    createdAt: now,
    updatedAt: now,
    schemaVersion: 8,
  };
};
