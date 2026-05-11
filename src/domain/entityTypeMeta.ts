import type { DiagramType, EntityType } from './types';

export type EntityTypeMeta = {
  type: EntityType;
  label: string;
  stripeColor: string;
  shortcut?: string;
};

export const ENTITY_TYPE_META: Record<EntityType, EntityTypeMeta> = {
  ude: { type: 'ude', label: 'Undesirable Effect', stripeColor: '#ef4444' },
  effect: { type: 'effect', label: 'Effect', stripeColor: '#737373' },
  rootCause: { type: 'rootCause', label: 'Root Cause', stripeColor: '#d97706' },
  injection: { type: 'injection', label: 'Injection', stripeColor: '#059669' },
  desiredEffect: {
    type: 'desiredEffect',
    label: 'Desired Effect',
    stripeColor: '#6366f1',
  },
  assumption: { type: 'assumption', label: 'Assumption', stripeColor: '#8b5cf6' },
};

export const PALETTE_BY_DIAGRAM: Record<DiagramType, EntityType[]> = {
  crt: ['ude', 'effect', 'rootCause', 'assumption'],
  frt: ['injection', 'effect', 'desiredEffect', 'assumption'],
};

export const defaultEntityType = (diagramType: DiagramType): EntityType =>
  diagramType === 'crt' ? 'effect' : 'effect';
