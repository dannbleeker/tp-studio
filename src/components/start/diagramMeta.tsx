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
import {
  DIAGRAM_SHORT_LABEL,
  DIAGRAM_TYPE_COLOR,
  DIAGRAM_TYPE_LABEL,
} from '@/domain/entityTypeMeta';
import { ENTITY_STRIPE_COLOR } from '@/domain/tokens';
import type { DiagramType } from '@/domain/types';

/**
 * Session 183 — per-diagram-type chrome for the Start surface (group headers,
 * tree-card tags). `label` / `tag` / `color` reuse the domain's
 * `DIAGRAM_TYPE_LABEL` / `DIAGRAM_SHORT_LABEL` / `DIAGRAM_TYPE_COLOR` (the colour
 * is the diagram's canonical entity-stripe token — no new colour values); `icon`
 * is a lucide glyph. Cover every `DiagramType` so grouping never hits the
 * fallback for a known type.
 */
export type DiagramMeta = { label: string; tag: string; color: string; icon: LucideIcon };

export const DIAGRAM_META: Record<DiagramType, DiagramMeta> = {
  goalTree: {
    label: DIAGRAM_TYPE_LABEL.goalTree,
    tag: DIAGRAM_SHORT_LABEL.goalTree,
    color: DIAGRAM_TYPE_COLOR.goalTree,
    icon: Target,
  },
  ec: {
    label: DIAGRAM_TYPE_LABEL.ec,
    tag: DIAGRAM_SHORT_LABEL.ec,
    color: DIAGRAM_TYPE_COLOR.ec,
    icon: Cloud,
  },
  crt: {
    label: DIAGRAM_TYPE_LABEL.crt,
    tag: DIAGRAM_SHORT_LABEL.crt,
    color: DIAGRAM_TYPE_COLOR.crt,
    icon: Network,
  },
  frt: {
    label: DIAGRAM_TYPE_LABEL.frt,
    tag: DIAGRAM_SHORT_LABEL.frt,
    color: DIAGRAM_TYPE_COLOR.frt,
    icon: TrendingUp,
  },
  prt: {
    label: DIAGRAM_TYPE_LABEL.prt,
    tag: DIAGRAM_SHORT_LABEL.prt,
    color: DIAGRAM_TYPE_COLOR.prt,
    icon: ListChecks,
  },
  tt: {
    label: DIAGRAM_TYPE_LABEL.tt,
    tag: DIAGRAM_SHORT_LABEL.tt,
    color: DIAGRAM_TYPE_COLOR.tt,
    icon: Footprints,
  },
  st: {
    label: DIAGRAM_TYPE_LABEL.st,
    tag: DIAGRAM_SHORT_LABEL.st,
    color: DIAGRAM_TYPE_COLOR.st,
    icon: MapIcon,
  },
  nbr: {
    label: DIAGRAM_TYPE_LABEL.nbr,
    tag: DIAGRAM_SHORT_LABEL.nbr,
    color: DIAGRAM_TYPE_COLOR.nbr,
    icon: AlertTriangle,
  },
  freeform: {
    label: DIAGRAM_TYPE_LABEL.freeform,
    tag: DIAGRAM_SHORT_LABEL.freeform,
    color: DIAGRAM_TYPE_COLOR.freeform,
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
 * Group any diagram-typed items (templates / patterns / the unified library) by
 * `diagramType`, computed from what's present (never a hand-maintained list) — so
 * adding a registry entry makes a group/card appear with zero edits here. Empty
 * groups are dropped; groups render in {@link DIAGRAM_ORDER}, with any
 * present-but-unordered type appended after in first-seen order so a brand-new
 * diagram type degrades gracefully instead of vanishing.
 */
export const groupByDiagramType = <T extends { diagramType: DiagramType }>(
  items: readonly T[]
): Array<{ type: DiagramType; items: T[] }> => {
  const byType = new Map<DiagramType, T[]>();
  for (const item of items) {
    const arr = byType.get(item.diagramType);
    if (arr) arr.push(item);
    else byType.set(item.diagramType, [item]);
  }
  const ordered: DiagramType[] = [
    ...DIAGRAM_ORDER.filter((t) => byType.has(t)),
    ...[...byType.keys()].filter((t) => !DIAGRAM_ORDER.includes(t)),
  ];
  return ordered.map((type) => ({ type, items: byType.get(type) ?? [] }));
};
