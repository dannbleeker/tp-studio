import {
  AlertTriangle,
  Cloud,
  Footprints,
  ListChecks,
  type LucideIcon,
  Map as MapIcon,
  Network,
  Shapes,
  Target,
  TrendingUp,
} from 'lucide-react';
import { DIAGRAM_SHORT_LABEL, DIAGRAM_TYPE_LABEL } from '@/domain/entityTypeMeta';
import { ENTITY_STRIPE_COLOR, VIOLET_500 } from '@/domain/tokens';
import type { DiagramType } from '@/domain/types';
import type { TemplateSpec } from '@/templates';

/**
 * Session 183 — per-diagram-type chrome for the Start surface (group headers,
 * tree-card tags). `label` / `tag` reuse the domain's `DIAGRAM_TYPE_LABEL` /
 * `DIAGRAM_SHORT_LABEL`; `color` is a representative entity-stripe colour from
 * tokens (no new colour values); `icon` is a lucide glyph. Cover every
 * `DiagramType` so grouping never hits the fallback for a known type.
 */
export type DiagramMeta = { label: string; tag: string; color: string; icon: LucideIcon };

export const DIAGRAM_META: Record<DiagramType, DiagramMeta> = {
  goalTree: {
    label: DIAGRAM_TYPE_LABEL.goalTree,
    tag: DIAGRAM_SHORT_LABEL.goalTree,
    color: ENTITY_STRIPE_COLOR.goal,
    icon: Target,
  },
  ec: {
    label: DIAGRAM_TYPE_LABEL.ec,
    tag: DIAGRAM_SHORT_LABEL.ec,
    color: ENTITY_STRIPE_COLOR.want,
    icon: Cloud,
  },
  crt: {
    label: DIAGRAM_TYPE_LABEL.crt,
    tag: DIAGRAM_SHORT_LABEL.crt,
    color: ENTITY_STRIPE_COLOR.ude,
    icon: Network,
  },
  frt: {
    label: DIAGRAM_TYPE_LABEL.frt,
    tag: DIAGRAM_SHORT_LABEL.frt,
    color: ENTITY_STRIPE_COLOR.desiredEffect,
    icon: TrendingUp,
  },
  prt: {
    label: DIAGRAM_TYPE_LABEL.prt,
    tag: DIAGRAM_SHORT_LABEL.prt,
    color: ENTITY_STRIPE_COLOR.intermediateObjective,
    icon: ListChecks,
  },
  tt: {
    label: DIAGRAM_TYPE_LABEL.tt,
    tag: DIAGRAM_SHORT_LABEL.tt,
    color: ENTITY_STRIPE_COLOR.action,
    icon: Footprints,
  },
  st: {
    label: DIAGRAM_TYPE_LABEL.st,
    tag: DIAGRAM_SHORT_LABEL.st,
    color: VIOLET_500,
    icon: MapIcon,
  },
  nbr: {
    label: DIAGRAM_TYPE_LABEL.nbr,
    tag: DIAGRAM_SHORT_LABEL.nbr,
    color: ENTITY_STRIPE_COLOR.obstacle,
    icon: AlertTriangle,
  },
  freeform: {
    label: DIAGRAM_TYPE_LABEL.freeform,
    tag: DIAGRAM_SHORT_LABEL.freeform,
    color: ENTITY_STRIPE_COLOR.effect,
    icon: Shapes,
  },
};

/**
 * Canonical method order for the template groups: Goal Tree leads (the
 * recommended entry diagram), then the conflict (EC), the current → future →
 * plan → execute spine (CRT → FRT → PRT → TT), S&T closing the strategy arc,
 * with NBR + Freeform last. Types absent here are appended in registry order.
 */
export const DIAGRAM_ORDER: DiagramType[] = [
  'goalTree',
  'ec',
  'crt',
  'frt',
  'prt',
  'tt',
  'st',
  'nbr',
  'freeform',
];

/** Neutral fallback so an unrecognised diagram type never breaks the page. */
export const fallbackDiagramMeta = (type: string): DiagramMeta => ({
  label: type,
  tag: type.slice(0, 4).toUpperCase(),
  color: ENTITY_STRIPE_COLOR.effect,
  icon: Shapes,
});

export const diagramMetaFor = (type: DiagramType): DiagramMeta =>
  DIAGRAM_META[type] ?? fallbackDiagramMeta(type);

/**
 * Group templates by `diagramType`, computed from the specs present (never a
 * hand-maintained list) — so adding a TemplateSpec module to the registry makes
 * a group/card appear with zero edits here. Empty groups are dropped; groups
 * render in {@link DIAGRAM_ORDER}, with any present-but-unordered type appended
 * after in first-seen order so a brand-new diagram type degrades gracefully
 * instead of vanishing.
 */
export const groupTemplatesByType = (
  specs: readonly TemplateSpec[]
): Array<{ type: DiagramType; specs: TemplateSpec[] }> => {
  const byType = new Map<DiagramType, TemplateSpec[]>();
  for (const spec of specs) {
    const arr = byType.get(spec.diagramType);
    if (arr) arr.push(spec);
    else byType.set(spec.diagramType, [spec]);
  }
  const ordered: DiagramType[] = [
    ...DIAGRAM_ORDER.filter((t) => byType.has(t)),
    ...[...byType.keys()].filter((t) => !DIAGRAM_ORDER.includes(t)),
  ];
  return ordered.map((type) => ({ type, specs: byType.get(type) ?? [] }));
};
