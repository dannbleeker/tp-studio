// Visual design tokens. Imported by both tailwind.config.ts (for theme.extend)
// and individual components that need raw hex (SVG strokes, inline styles, etc).
// Changing a brand color here updates every consumer.

import type { EntityType } from './types';

export const ENTITY_STRIPE_COLOR: Record<EntityType, string> = {
  ude: '#ef4444', // red-500
  effect: '#737373', // neutral-500
  rootCause: '#d97706', // amber-600
  injection: '#059669', // emerald-600
  desiredEffect: '#6366f1', // indigo-500
  assumption: '#8b5cf6', // violet-500
  // Goal Tree classes (A4): visually distinct from CRT/FRT classes so a Goal
  // entity inside a CRT reads as "this is the goal of the system" rather
  // than an effect.
  goal: '#0ea5e9', // sky-500 — anchors the top of an IO map
  criticalSuccessFactor: '#0d9488', // teal-600 — must-be conditions
  necessaryCondition: '#84cc16', // lime-500 — sub-conditions feeding a CSF
  // Prerequisite Tree (A2): obstacles are warm-warning rose, intermediate
  // objectives are a forward-action blue distinct from both effect-grey and
  // goal-sky.
  obstacle: '#f43f5e', // rose-500
  intermediateObjective: '#2563eb', // blue-600
  // Transition Tree (A3): cyan reads as "go do this" without overlapping
  // injection-emerald or IO-blue.
  action: '#06b6d4', // cyan-500
  // Evaporating Cloud (A1): the two needs and two wants in the classic
  // 5-box conflict. Amber for the needs (must-have prerequisites of the
  // common goal) and fuchsia for the wants (the two conflicting strategies
  // — visually warm and distinct from rose-obstacle / red-ude).
  need: '#f59e0b', // amber-500
  want: '#d946ef', // fuchsia-500
  // FL-ET7: a sticky-note yellow. Distinct from the warmer amber needs +
  // amber rootCause; reads as "post-it" rather than a TOC-typed entity.
  note: '#eab308', // yellow-500
};

export const ACCENT = '#6366f1'; // indigo-500
export const ACCENT_DARK = '#818cf8'; // indigo-400 — for dark theme

// --- Edge color palettes ---
// Each palette maps the four edge states (default / selected / AND / arrow marker)
// to concrete hex colors. The current palette is selected via uiSlice.edgePalette
// and consumed in TPEdge and useGraphView.

export type EdgePaletteId = 'default' | 'colorblindSafe' | 'mono';

export type EdgePaletteTokens = {
  stroke: string;
  strokeSelected: string;
  strokeAnd: string;
  marker: string;
  markerAnd: string;
};

export const EDGE_PALETTES: Record<EdgePaletteId, EdgePaletteTokens> = {
  default: {
    stroke: '#a3a3a3', // neutral-400
    strokeSelected: ACCENT,
    strokeAnd: ENTITY_STRIPE_COLOR.assumption,
    marker: '#737373', // neutral-500
    markerAnd: ENTITY_STRIPE_COLOR.assumption,
  },
  colorblindSafe: {
    // Wong palette: sky-blue + vermillion + bluish-green. Distinct in
    // deuteranopia and protanopia.
    stroke: '#56b4e9',
    strokeSelected: '#d55e00',
    strokeAnd: '#009e73',
    marker: '#56b4e9',
    markerAnd: '#009e73',
  },
  mono: {
    stroke: '#737373',
    strokeSelected: '#171717',
    strokeAnd: '#404040',
    marker: '#737373',
    markerAnd: '#404040',
  },
};

// Backwards-compat exports used by existing components. They point at the
// default palette; runtime components should prefer the slice-driven values.
export const EDGE_STROKE_DEFAULT = EDGE_PALETTES.default.stroke;
export const EDGE_STROKE_SELECTED = EDGE_PALETTES.default.strokeSelected;
export const EDGE_STROKE_AND = EDGE_PALETTES.default.strokeAnd;
export const EDGE_MARKER_DEFAULT = EDGE_PALETTES.default.marker;
export const EDGE_MARKER_AND = EDGE_PALETTES.default.markerAnd;

// Canvas background grid color
export const GRID_DOT = '#d4d4d4'; // neutral-300

// Theme surface backgrounds for PNG export and the print stylesheet.
export const SURFACE_LIGHT = '#ffffff';
export const SURFACE_DARK = '#0a0a0a';
export const SURFACE_HIGH_CONTRAST = '#000000';
