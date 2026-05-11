import type { DiagramType, Edge, Entity, TPDocument } from './types';

export const STORAGE_KEY = 'tp-studio:active-document:v1';

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const isDiagramType = (v: unknown): v is DiagramType => v === 'crt' || v === 'frt';

const isEntity = (v: unknown): v is Entity =>
  isObject(v) &&
  typeof v.id === 'string' &&
  typeof v.type === 'string' &&
  typeof v.title === 'string';

const isEdge = (v: unknown): v is Edge =>
  isObject(v) &&
  typeof v.id === 'string' &&
  typeof v.sourceId === 'string' &&
  typeof v.targetId === 'string';

const validateRecord = <T>(
  raw: unknown,
  guard: (v: unknown) => v is T,
  label: string
): Record<string, T> => {
  if (!isObject(raw)) throw new Error(`Invalid document: ${label} must be an object.`);
  for (const [k, v] of Object.entries(raw)) {
    if (!guard(v)) throw new Error(`Invalid document: ${label}["${k}"] is malformed.`);
  }
  return raw as Record<string, T>;
};

export const exportToJSON = (doc: TPDocument): string => JSON.stringify(doc, null, 2);

export const importFromJSON = (raw: string): TPDocument => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Invalid document: not valid JSON (${(err as Error).message}).`);
  }
  if (!isObject(parsed)) throw new Error('Invalid document: not an object.');
  if (parsed.schemaVersion !== 1) {
    throw new Error(`Unsupported schemaVersion: ${String(parsed.schemaVersion)}`);
  }
  if (typeof parsed.id !== 'string') throw new Error('Invalid document: missing id.');
  if (!isDiagramType(parsed.diagramType)) {
    throw new Error('Invalid document: bad diagramType.');
  }
  const entities = validateRecord(parsed.entities, isEntity, 'entities');
  const edges = validateRecord(parsed.edges, isEdge, 'edges');
  const resolvedWarnings = isObject(parsed.resolvedWarnings)
    ? (parsed.resolvedWarnings as Record<string, true>)
    : {};
  return {
    id: parsed.id,
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

const hasLocalStorage = (): boolean => typeof globalThis.localStorage !== 'undefined';

export const saveToLocalStorage = (doc: TPDocument): void => {
  if (!hasLocalStorage()) return;
  globalThis.localStorage.setItem(STORAGE_KEY, exportToJSON(doc));
};

export const loadFromLocalStorage = (): TPDocument | null => {
  if (!hasLocalStorage()) return null;
  const raw = globalThis.localStorage.getItem(STORAGE_KEY);
  if (raw === null) return null;
  try {
    return importFromJSON(raw);
  } catch {
    return null;
  }
};

export const clearLocalStorage = (): void => {
  if (!hasLocalStorage()) return;
  globalThis.localStorage.removeItem(STORAGE_KEY);
};
