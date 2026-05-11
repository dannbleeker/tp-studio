export type EntityType =
  | 'ude'
  | 'effect'
  | 'rootCause'
  | 'injection'
  | 'desiredEffect'
  | 'assumption';

export type Entity = {
  id: string;
  type: EntityType;
  title: string;
  description?: string;
  confidence?: number;
  createdAt: number;
  updatedAt: number;
};

export type EdgeKind = 'sufficiency';

export type Edge = {
  id: string;
  sourceId: string;
  targetId: string;
  kind: EdgeKind;
  andGroupId?: string;
  assumptionIds?: string[];
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
  id: string;
  diagramType: DiagramType;
  title: string;
  entities: Record<string, Entity>;
  edges: Record<string, Edge>;
  resolvedWarnings: Record<string, true>;
  createdAt: number;
  updatedAt: number;
  schemaVersion: 1;
};
