import { STORAGE_KEYS, readString, removeKey, writeString } from '@/services/storage';
import {
  isDiagramType,
  isEdgeKind,
  isEntityType,
  isObject,
  isStringArray,
  isTrueMap,
} from './guards';
import { CURRENT_SCHEMA_VERSION, migrateToCurrent } from './migrations';
import type { DocumentId, Edge, EdgeId, Entity, EntityId, TPDocument } from './types';

/** Re-exported for tests and any consumer that needs the literal key. */
export const STORAGE_KEY = STORAGE_KEYS.doc;

const invalid = (label: string, why: string): Error =>
  new Error(`Invalid document: ${label} ${why}.`);

const validateEntity = (v: unknown, label: string): Entity => {
  if (!isObject(v)) throw invalid(label, 'must be an object');
  if (typeof v.id !== 'string') throw invalid(label, 'has no id');
  if (!isEntityType(v.type)) throw invalid(label, `has invalid type "${String(v.type)}"`);
  if (typeof v.title !== 'string') throw invalid(label, 'has non-string title');
  if (typeof v.createdAt !== 'number') throw invalid(label, 'has non-number createdAt');
  if (typeof v.updatedAt !== 'number') throw invalid(label, 'has non-number updatedAt');
  if (v.description !== undefined && typeof v.description !== 'string') {
    throw invalid(label, 'has non-string description');
  }
  if (v.confidence !== undefined && typeof v.confidence !== 'number') {
    throw invalid(label, 'has non-number confidence');
  }
  return {
    id: v.id as EntityId,
    type: v.type,
    title: v.title,
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
    ...(typeof v.description === 'string' ? { description: v.description } : {}),
    ...(typeof v.confidence === 'number' ? { confidence: v.confidence } : {}),
  };
};

const validateEdge = (v: unknown, label: string): Edge => {
  if (!isObject(v)) throw invalid(label, 'must be an object');
  if (typeof v.id !== 'string') throw invalid(label, 'has no id');
  if (typeof v.sourceId !== 'string') throw invalid(label, 'has non-string sourceId');
  if (typeof v.targetId !== 'string') throw invalid(label, 'has non-string targetId');
  if (!isEdgeKind(v.kind)) throw invalid(label, `has invalid kind "${String(v.kind)}"`);
  if (v.andGroupId !== undefined && typeof v.andGroupId !== 'string') {
    throw invalid(label, 'has non-string andGroupId');
  }
  if (v.assumptionIds !== undefined && !isStringArray(v.assumptionIds)) {
    throw invalid(label, 'has non-string-array assumptionIds');
  }
  return {
    id: v.id as EdgeId,
    sourceId: v.sourceId as EntityId,
    targetId: v.targetId as EntityId,
    kind: v.kind,
    ...(typeof v.andGroupId === 'string' ? { andGroupId: v.andGroupId } : {}),
    ...(isStringArray(v.assumptionIds) ? { assumptionIds: v.assumptionIds as EntityId[] } : {}),
  };
};

const validateRecord = <T>(
  raw: unknown,
  validator: (v: unknown, label: string) => T,
  label: string
): Record<string, T> => {
  if (!isObject(raw)) throw invalid(label, 'must be an object');
  const out: Record<string, T> = {};
  for (const [k, v] of Object.entries(raw)) {
    out[k] = validator(v, `${label}["${k}"]`);
  }
  return out;
};

export const exportToJSON = (doc: TPDocument): string => JSON.stringify(doc, null, 2);

export const importFromJSON = (raw: string): TPDocument => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Invalid document: not valid JSON (${(err as Error).message}).`);
  }
  // Run forward migrations before validation so downstream guards can assume
  // the document is at CURRENT_SCHEMA_VERSION. Today the registry is empty;
  // this is the plumbing for future versions.
  parsed = migrateToCurrent(parsed);
  if (!isObject(parsed)) throw new Error('Invalid document: not an object.');
  if (parsed.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    throw new Error(`Unsupported schemaVersion: ${String(parsed.schemaVersion)}`);
  }
  if (typeof parsed.id !== 'string') throw new Error('Invalid document: missing id.');
  if (!isDiagramType(parsed.diagramType)) {
    throw new Error('Invalid document: bad diagramType.');
  }
  const entities = validateRecord(parsed.entities, validateEntity, 'entities');
  const edges = validateRecord(parsed.edges, validateEdge, 'edges');

  let resolvedWarnings: Record<string, true> = {};
  if (parsed.resolvedWarnings !== undefined) {
    if (!isTrueMap(parsed.resolvedWarnings)) {
      throw new Error('Invalid document: resolvedWarnings must map strings to literal true.');
    }
    resolvedWarnings = parsed.resolvedWarnings;
  }

  return {
    id: parsed.id as DocumentId,
    title: typeof parsed.title === 'string' ? parsed.title : 'Untitled',
    diagramType: parsed.diagramType,
    entities,
    edges,
    resolvedWarnings,
    createdAt: typeof parsed.createdAt === 'number' ? parsed.createdAt : Date.now(),
    updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : Date.now(),
    schemaVersion: 1,
  };
};

export const saveToLocalStorage = (doc: TPDocument): void => {
  writeString(STORAGE_KEYS.doc, exportToJSON(doc));
};

export const loadFromLocalStorage = (): TPDocument | null => {
  const raw = readString(STORAGE_KEYS.doc);
  if (raw === null) return null;
  try {
    return importFromJSON(raw);
  } catch {
    return null;
  }
};

export const clearLocalStorage = (): void => {
  removeKey(STORAGE_KEYS.doc);
};
