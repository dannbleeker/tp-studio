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
};

export const ACCENT = '#6366f1'; // indigo-500
export const ACCENT_DARK = '#818cf8'; // indigo-400 — for dark theme

export const EDGE_STROKE_DEFAULT = '#a3a3a3'; // neutral-400
export const EDGE_STROKE_SELECTED = ACCENT;
export const EDGE_STROKE_AND = ENTITY_STRIPE_COLOR.assumption;
export const EDGE_MARKER_DEFAULT = '#737373'; // neutral-500
export const EDGE_MARKER_AND = ENTITY_STRIPE_COLOR.assumption;

// Canvas background grid color
export const GRID_DOT = '#d4d4d4'; // neutral-300

// Theme surface backgrounds for PNG export.
export const SURFACE_LIGHT = '#ffffff';
export const SURFACE_DARK = '#0a0a0a';
