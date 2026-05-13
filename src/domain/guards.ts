import type { DiagramType, EdgeKind, EntityType } from './types';

export const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const DIAGRAM_TYPES: ReadonlySet<DiagramType> = new Set<DiagramType>([
  'crt',
  'frt',
  'prt',
  'tt',
  'ec',
  // Bundle 10:
  'st', // Strategy & Tactics Tree (FL-DT4)
  'freeform', // Free-form diagram (FL-DT5)
]);
export const isDiagramType = (v: unknown): v is DiagramType =>
  typeof v === 'string' && DIAGRAM_TYPES.has(v as DiagramType);

const ENTITY_TYPES: ReadonlySet<EntityType> = new Set<EntityType>([
  'ude',
  'effect',
  'rootCause',
  'injection',
  'desiredEffect',
  'assumption',
  'goal',
  'criticalSuccessFactor',
  'necessaryCondition',
  'obstacle',
  'intermediateObjective',
  'action',
  'need',
  'want',
  // FL-ET7 (Session 72) — missing from the original set; would have
  // rejected any JSON import that carried a note entity. Fixed here as
  // part of the Bundle 10 audit pass.
  'note',
]);
export const isEntityType = (v: unknown): v is EntityType =>
  typeof v === 'string' && ENTITY_TYPES.has(v as EntityType);

const EDGE_KINDS: ReadonlySet<EdgeKind> = new Set<EdgeKind>(['sufficiency']);
export const isEdgeKind = (v: unknown): v is EdgeKind =>
  typeof v === 'string' && EDGE_KINDS.has(v as EdgeKind);

export const isStringArray = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === 'string');

/** A bag whose every value is literally `true` — matches the resolvedWarnings shape. */
export const isTrueMap = (v: unknown): v is Record<string, true> =>
  isObject(v) && Object.values(v).every((x) => x === true);
