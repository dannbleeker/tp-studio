import type { ECSlot } from './ecGuiding';
import { createDocument } from './factory';
import type { TPDocument } from './types';

/**
 * E3 — the 3-Cloud rapid-diagnosis method (a-dato source; NEXT_STEPS Theme E).
 *
 * A fast on-ramp alternative to a full Current Reality Tree: name three
 * undesirable effects, surface the conflict behind each, then **consolidate**
 * the three into one Core Cloud — the single A/B/C/D/D′ conflict that, broken,
 * dissolves all three symptoms at once. The wizard captures the three conflicts
 * in its own state (so it can show them side by side at the consolidation step)
 * and commits a single Evaporating Cloud document tagged `cloudType: 'core'`.
 *
 * This module is the pure domain layer: the captured-input shape + the builder
 * that turns it into a Core Cloud `TPDocument`. No store, no React — so the
 * consolidation logic is trivially unit-testable. The wizard panel owns the
 * elicitation UI; the store action owns opening the resulting doc in a tab.
 *
 * Single-document constraint: one EC document is exactly one 5-box cloud (the
 * layout is hand-positioned, `LAYOUT_STRATEGY.ec === 'manual'`). So the three
 * source clouds live as captured text — preserved in the Core Cloud's
 * `description` as a provenance block — rather than three extra canvas docs.
 */

/**
 * One undesirable effect and the conflict the practitioner feels behind it:
 * the action they actually take (D) versus the opposing action that feels
 * equally justified (D′). The lightweight unit of the *rapid* method — the
 * full A/B/C structure is articulated once, during consolidation, instead of
 * three times over.
 */
export type CloudConflict = {
  /** The undesirable effect — the felt symptom that started the diagnosis. */
  ude: string;
  /** D — what is actually done under the pressure of this conflict. */
  doNow: string;
  /** D′ — the opposing action that feels equally legitimate. */
  doInstead: string;
};

/**
 * The consolidated Core Cloud the three conflicts resolve into — the single
 * five-slot conflict sitting under all three symptoms. Field order mirrors the
 * canonical EC slots (A objective · B/C needs · D/D′ wants).
 */
export type CoreCloud = {
  /** A — the shared objective both sides of the core conflict serve. */
  objective: string;
  /** B — the need the D side protects. */
  need1: string;
  /** C — the need the D′ side protects. */
  need2: string;
  /** D — the first want (in conflict with D′). */
  want1: string;
  /** D′ — the opposing want (in conflict with D). */
  want2: string;
};

/** Everything the wizard captures across the rapid flow. */
export type ThreeCloudInput = {
  /** The three source conflicts, in capture order. */
  conflicts: ReadonlyArray<CloudConflict>;
  /** The consolidated Core Cloud the user writes at the final step. */
  core: CoreCloud;
  /** Optional document title; falls back to a generated one when blank. */
  title?: string;
};

/** Number of source clouds the rapid method consolidates. Three is the
 *  documented sweet spot — enough for a shared conflict to emerge, few enough
 *  to stay rapid. The UI seeds this many blank conflict rows. */
export const THREE_CLOUD_COUNT = 3;

/** Per-conflict elicitation copy — the felt symptom, then the two-sided pull.
 *  Kept here (pure data) so the prompts are importable from a test and edited
 *  without touching panel state. The consolidation step reuses the canonical
 *  EC slot labels + guiding questions from `./ecGuiding`. */
export const CONFLICT_FIELD_COPY: Record<
  keyof CloudConflict,
  { label: string; placeholder: string }
> = {
  ude: {
    label: 'Undesirable effect',
    placeholder: 'e.g. "Releases slip almost every sprint"',
  },
  doNow: {
    label: 'D · what you do',
    placeholder: 'e.g. "Pull people onto firefighting"',
  },
  doInstead: {
    label: 'D′ · what you feel you should do instead',
    placeholder: 'e.g. "Protect planned work and let the fire burn"',
  },
};

const DEFAULT_TITLE = 'Core cloud — 3-cloud diagnosis';

/** Map a Core Cloud's fields onto the five EC slots used by the seeded doc. */
const titleForSlot = (core: CoreCloud): Record<ECSlot, string> => ({
  a: core.objective,
  b: core.need1,
  c: core.need2,
  d: core.want1,
  dPrime: core.want2,
});

/**
 * Render the three captured conflicts as a provenance block for the Core
 * Cloud's `description` — so the reasoning that produced the consolidation
 * travels with the document (export, share-link, the Document Inspector).
 * Exported for tests. Blank conflicts are skipped so a partly-filled run still
 * yields a clean note.
 */
export const summariseConflicts = (conflicts: ReadonlyArray<CloudConflict>): string => {
  const lines = conflicts
    .map((c, i) => {
      const ude = c.ude.trim();
      if (!ude) return '';
      const doNow = c.doNow.trim();
      const doInstead = c.doInstead.trim();
      const tension = doNow && doInstead ? ` — pulled between "${doNow}" and "${doInstead}"` : '';
      return `${i + 1}. ${ude}${tension}.`;
    })
    .filter(Boolean);
  if (lines.length === 0) return '';
  return ['Consolidated from a 3-cloud rapid diagnosis:', ...lines].join('\n');
};

/**
 * Build the Core Cloud document from a completed (or partly completed) rapid
 * diagnosis. Reuses the blank 5-box EC scaffold (`createDocument('ec')`) — same
 * positions, slots, and four necessity edges a normal "New EC" gives — then
 * fills the box titles from the consolidated conflict, tags the doc
 * `cloudType: 'core'`, and records the three source conflicts as a description
 * provenance block. Pure: no store, no side effects beyond the factory's own
 * id/timestamp stamping.
 */
export const buildThreeCloudCoreDoc = (input: ThreeCloudInput): TPDocument => {
  const base = createDocument('ec');
  const bySlot = titleForSlot(input.core);
  const entities = Object.fromEntries(
    Object.entries(base.entities).map(([id, entity]) => {
      const slot = entity.ecSlot;
      if (!slot) return [id, entity];
      const title = bySlot[slot].trim();
      return [id, { ...entity, title }];
    })
  );
  const description = summariseConflicts(input.conflicts);
  return {
    ...base,
    title: input.title?.trim() || DEFAULT_TITLE,
    cloudType: 'core',
    entities,
    ...(description ? { description } : {}),
  };
};
