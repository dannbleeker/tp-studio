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
export type ECSlot = 'a' | 'b' | 'c' | 'd' | 'dPrime';

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
