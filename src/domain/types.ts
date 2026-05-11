// --- Branded ID types ---
// Pure phantom branding: at runtime these are plain strings. The brand exists
// to let TypeScript catch "I accidentally passed an edge id where an entity
// id was expected" at compile time. Records remain keyed by plain `string`
// so that Object.keys() and external string IDs from React Flow / file
// pickers don't need casts on the way in — values produced by our factory
// functions narrow on the way out.

declare const ENTITY_ID_BRAND: unique symbol;
declare const EDGE_ID_BRAND: unique symbol;
declare const DOCUMENT_ID_BRAND: unique symbol;

export type EntityId = string & { readonly [ENTITY_ID_BRAND]: true };
export type EdgeId = string & { readonly [EDGE_ID_BRAND]: true };
export type DocumentId = string & { readonly [DOCUMENT_ID_BRAND]: true };

// --- Domain types ---

export type EntityType =
  | 'ude'
  | 'effect'
  | 'rootCause'
  | 'injection'
  | 'desiredEffect'
  | 'assumption';

export type Entity = {
  id: EntityId;
  type: EntityType;
  title: string;
  description?: string;
  confidence?: number;
  createdAt: number;
  updatedAt: number;
};

export type EdgeKind = 'sufficiency';

export type Edge = {
  id: EdgeId;
  sourceId: EntityId;
  targetId: EntityId;
  kind: EdgeKind;
  andGroupId?: string;
  assumptionIds?: EntityId[];
};

export type DiagramType = 'crt' | 'frt';

export type ClrRuleId =
  | 'clarity'
  | 'entity-existence'
  | 'causality-existence'
  | 'cause-sufficiency'
  | 'additional-cause'
  | 'cause-effect-reversal'
  | 'predicted-effect-existence'
  | 'tautology';

export type WarningTarget = { kind: 'entity'; id: string } | { kind: 'edge'; id: string };

export type Warning = {
  id: string;
  ruleId: ClrRuleId;
  message: string;
  target: WarningTarget;
  resolved: boolean;
};

export type TPDocument = {
  id: DocumentId;
  diagramType: DiagramType;
  title: string;
  entities: Record<string, Entity>;
  edges: Record<string, Edge>;
  resolvedWarnings: Record<string, true>;
  createdAt: number;
  updatedAt: number;
  schemaVersion: 1;
};
