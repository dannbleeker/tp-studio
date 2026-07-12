/**
 * Session 87 / EC PPT comparison item #2 — Per-slot guiding questions.
 *
 * The canonical BESTSELLER EC workshop PowerPoint keeps a reference
 * table of guiding questions per slot (A / B / C / D / D′) permanently
 * visible on the page. TP Studio's wizard surfaces equivalent prompts
 * but they vanish when the wizard closes. These questions are the
 * "what does this slot mean" reference a practitioner re-reads while
 * editing — the wizard's once-only-on-creation prompt model loses
 * them.
 *
 * Exposed as a stable canonical map so:
 *   - the EntityInspector can show the right question when an EC slot
 *     entity is selected (re-surfaces the wizard prompt without
 *     re-opening the wizard);
 *   - future doc-level surfaces (a collapsible "EC reading guide" in
 *     the Document Inspector, an export footer, etc.) can read the
 *     same table.
 *
 * Wording mirrors the PPT verbatim, not the wizard's `EC_STEPS`
 * placeholders — the wizard prompts a NEW user through creation; the
 * inspector reminds a returning user what each slot is FOR.
 */
import type { CloudType } from './types';

export type ECSlot = 'a' | 'b' | 'c' | 'd' | 'dPrime';

/** Canonical ordered list of every EC slot, in the structural (A-first)
 *  walk. Session 94 (Top-30 #17) — pulled out of CreationWizardPanel's
 *  inline union literal so the slot identity has one source. The mini
 *  ECSlotIndicator and any future per-slot iterator can read this. */
export const ALL_EC_SLOTS: ReadonlyArray<ECSlot> = ['a', 'b', 'c', 'd', 'dPrime'] as const;

/** Single-character / two-character display token per slot. Mirrors the
 *  prime mark used in the canonical BESTSELLER PowerPoint (Unicode
 *  PRIME, U+2032 — D′ — rather than the ASCII apostrophe). Used by the
 *  ECSlotIndicator + the PDF workshop sheet. */
export const EC_SLOT_GLYPH: Record<ECSlot, string> = {
  a: 'A',
  b: 'B',
  c: 'C',
  d: 'D',
  dPrime: 'D′',
};

/** Wizard walk order. The structural A-first walk teaches the EC shape
 *  top-down; the practitioner-experiential D-first walk starts at the
 *  felt conflict and works up to the common objective. */
export type WizardOrder = 'aFirst' | 'dFirst';
export const EC_SLOTS_BY_ORDER: Record<WizardOrder, ReadonlyArray<ECSlot>> = {
  aFirst: ALL_EC_SLOTS,
  dFirst: ['d', 'dPrime', 'c', 'b', 'a'],
};

export const EC_SLOT_GUIDING_QUESTIONS: Record<ECSlot, string> = {
  a: 'What common objective will be achieved by meeting both need B and need C?',
  b: 'What need is satisfied by their/my action in D?',
  c: 'What need is satisfied by my action in D′?',
  d: 'What action does the other side want to do / do I feel under pressure to do?',
  dPrime: 'What is the action I want to do?',
};

/** Slot label for the inspector heading — keeps the PPT's letter
 *  convention so the question reads in context. */
export const EC_SLOT_LABEL: Record<ECSlot, string> = {
  a: 'A · Common objective',
  b: 'B · First need',
  c: 'C · Second need',
  d: 'D · First want',
  dPrime: 'D′ · Conflicting want',
};

/**
 * Session 197 (backlog D1) — cloud-type-aware wizard modes.
 *
 * Cohen's Ch. 24 of the *TOC Handbook* (Cox & Schleier 2010) builds each
 * kind of Evaporating Cloud in a different order and recommends a different
 * arrow to break (Table 24-9 + the per-type question tables 24-2/24-4/24-5/
 * 24-6). The EC creation wizard reads these when the user OPTS IN to a cloud
 * type; the `'generic'` default leaves the existing A-first/D-first walk and
 * prompts exactly as before, and never touches `doc.cloudType`.
 *
 * Data split: the build ORDER + break HINT (below, domain-level) live here;
 * the per-type prompt COPY lives beside the other wizard copy in
 * `components/canvas/wizards/creationWizardSteps.ts` (`EC_STEPS_BY_CLOUD_TYPE`).
 * (A reading/present order per type is deferred to backlog D5, which is the
 * feature that will consume it.)
 */
export type ECWizardMode = 'generic' | CloudType;

/** Per-cloud-type build/fill order. Two are new (firefighting / ude); the
 *  rest reuse the generic walks so there is one source for each order. */
export const EC_CLOUD_TYPE_ORDER: Record<CloudType, readonly ECSlot[]> = {
  dilemma: EC_SLOTS_BY_ORDER.dFirst, // D → D′ → C → B → A
  conflict: EC_SLOTS_BY_ORDER.dFirst, // D → D′ → C → B → A
  firefighting: ['b', 'd', 'dPrime', 'c', 'a'], // the endangered need is the entry point
  ude: ['b', 'd', 'c', 'dPrime', 'a'], // the "Z" walk
  consolidated: EC_SLOTS_BY_ORDER.aFirst, // A → B → C → D → D′
  core: EC_SLOTS_BY_ORDER.aFirst,
};

/** Cohen's "best arrow to break" recommendation per cloud type. Surfaced in
 *  the wizard's completion panel + a caption while a type is active. */
export const EC_CLOUD_TYPE_BREAK_HINT: Record<CloudType, string> = {
  dilemma: 'Cohen suggests trying to break the C–D′ or D–D′ arrow.',
  conflict: 'Cohen suggests breaking on your own side — the C–D′ arrow (or D–D′).',
  firefighting: 'Cohen suggests breaking D–D′ — fold the emergency action into the procedure.',
  ude: 'Cohen suggests breaking D–D′ (for a customer-facing UDE, aim at C–D′).',
  consolidated:
    'Cohen suggests breaking D–D′ for the consolidated cloud, then each source cloud for specifics.',
  core: 'Cohen suggests breaking the D–D′ arrow.',
};
