import {
  AlertTriangle,
  Cloud,
  Crosshair,
  Footprints,
  ListChecks,
  type LucideIcon,
  Map as MapIcon,
  Network,
  Shapes,
  Target,
  TrendingUp,
} from 'lucide-react';
import { diagramLabel, diagramShortLabel } from '@/domain/entityPalettes';
import { DIAGRAM_TYPE_COLOR } from '@/domain/entityTypeMeta';
import { ENTITY_STRIPE_COLOR } from '@/domain/tokens';
import type { DiagramType } from '@/domain/types';
import type { Messages } from '@/i18n/types';

/**
 * Session 183 — per-diagram-type chrome for the Start surface (group headers,
 * tree-card tags). `label` / `tag` / `color` reuse the domain's
 * `DIAGRAM_TYPE_LABEL` / `DIAGRAM_SHORT_LABEL` / `DIAGRAM_TYPE_COLOR` (the colour
 * is the diagram's canonical entity-stripe token — no new colour values); `icon`
 * is a lucide glyph. Cover every `DiagramType` so grouping never hits the
 * fallback for a known type.
 */
export type DiagramMeta = { label: string; tag: string; color: string; icon: LucideIcon };

/**
 * Per-type icon. The label / tag / colour used to be baked into a module-level
 * record here; label and tag now come from the message catalogue (via
 * `diagramLabel` / `diagramShortLabel`) so the Start surface follows the active
 * locale, and the colour comes straight from `DIAGRAM_TYPE_COLOR`. Only the
 * glyph choice is genuinely local to this surface.
 */
const DIAGRAM_ICON: Record<DiagramType, LucideIcon> = {
  goalTree: Target,
  ec: Cloud,
  crt: Network,
  frt: TrendingUp,
  prt: ListChecks,
  tt: Footprints,
  st: MapIcon,
  nbr: AlertTriangle,
  freeform: Shapes,
  id: Crosshair,
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
  'id',
  'freeform',
];

/** Neutral fallback so an unrecognised diagram type never breaks the page. */
export const fallbackDiagramMeta = (type: string): DiagramMeta => ({
  label: type,
  tag: type.slice(0, 4).toUpperCase(),
  color: ENTITY_STRIPE_COLOR.effect,
  icon: Shapes,
});

export const diagramMetaFor = (messages: Messages, type: DiagramType): DiagramMeta => {
  const icon = DIAGRAM_ICON[type];
  const color = DIAGRAM_TYPE_COLOR[type];
  // A type outside the registry (an older doc, a hand-edited file) still has to
  // render something — fall back rather than crash the Start page.
  if (!icon || !color) return fallbackDiagramMeta(type);
  return {
    label: diagramLabel(messages, type),
    tag: diagramShortLabel(messages, type),
    color,
    icon,
  };
};

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
