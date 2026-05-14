import type { TPDocument } from '@/domain/types';
import { buildVsBuyEC } from './buildVsBuyEC';
import { centraliseVsDecentraliseEC } from './centraliseVsDecentraliseEC';
import { genericSaasGoalTree } from './genericSaasGoalTree';
import { makerVsManagerEC } from './makerVsManagerEC';
import { personalProductivityCRT } from './personalProductivityCRT';
import { retailOpsCRT } from './retailOpsCRT';
import { retailOpsGoalTree } from './retailOpsGoalTree';
import { saasEngineeringCRT } from './saasEngineeringCRT';
import { salesVsMarketingEC } from './salesVsMarketingEC';
import { type TemplateSpec, buildTemplate } from './shared';
import { speedVsQualityEC } from './speedVsQualityEC';

/**
 * Session 79 / brief §12 — Templates library index.
 *
 * Each template ships as a TS module exporting a `TemplateSpec`
 * (entities + edges as plain literals). The picker iterates this
 * registry; clicking a card calls `buildTemplate(spec)` to inflate
 * the spec into a fully-typed `TPDocument` with fresh ids + valid
 * annotation numbers, then passes it to `setDocument`.
 *
 * Order matters — the picker renders templates in this order. We
 * lead with Goal Trees (the brief's recommended entry diagram),
 * then ECs (the heart), then CRTs (the connective tissue).
 */

export const TEMPLATE_SPECS: readonly TemplateSpec[] = [
  // Goal Trees (3).
  genericSaasGoalTree,
  retailOpsGoalTree,
  // ECs (5).
  salesVsMarketingEC,
  speedVsQualityEC,
  buildVsBuyEC,
  centraliseVsDecentraliseEC,
  makerVsManagerEC,
  // CRTs (3).
  retailOpsCRT,
  saasEngineeringCRT,
  personalProductivityCRT,
];

/** Resolve a template id to its spec; useful in tests + the picker. */
export const findTemplateSpec = (id: string): TemplateSpec | undefined =>
  TEMPLATE_SPECS.find((t) => t.id === id);

/** Inflate a template by id into a fresh Document. Returns `null`
 *  on an unknown id (lets the caller decide whether to toast or
 *  silently fall back). */
export const loadTemplate = (id: string): TPDocument | null => {
  const spec = findTemplateSpec(id);
  return spec ? buildTemplate(spec) : null;
};

export { buildTemplate } from './shared';
export type { TemplateSpec } from './shared';
