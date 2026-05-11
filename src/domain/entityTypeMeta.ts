import { ENTITY_STRIPE_COLOR } from './tokens';
import type { DiagramType, EntityType } from './types';

export type EntityTypeMeta = {
  type: EntityType;
  label: string;
  stripeColor: string;
  shortcut?: string;
};

const LABELS: Record<EntityType, string> = {
  ude: 'Undesirable Effect',
  effect: 'Effect',
  rootCause: 'Root Cause',
  injection: 'Injection',
  desiredEffect: 'Desired Effect',
  assumption: 'Assumption',
};

export const ENTITY_TYPE_META: Record<EntityType, EntityTypeMeta> = (
  Object.keys(LABELS) as EntityType[]
).reduce(
  (acc, type) => {
    acc[type] = { type, label: LABELS[type], stripeColor: ENTITY_STRIPE_COLOR[type] };
    return acc;
  },
  {} as Record<EntityType, EntityTypeMeta>
);

export const PALETTE_BY_DIAGRAM: Record<DiagramType, EntityType[]> = {
  crt: ['ude', 'effect', 'rootCause', 'assumption'],
  frt: ['injection', 'effect', 'desiredEffect', 'assumption'],
};

export const defaultEntityType = (diagramType: DiagramType): EntityType =>
  diagramType === 'crt' ? 'effect' : 'effect';
