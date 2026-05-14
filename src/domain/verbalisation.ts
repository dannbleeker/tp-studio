import type { Entity, TPDocument } from './types';

/**
 * Session 77 / brief §6 — Evaporating Cloud Verbalisation generator.
 *
 * Produces the read-aloud verbal form of an EC document. The output is
 * a structured token list rather than a single string so the UI can
 * make every "click for assumptions" link interactive — the
 * VerbalisationStrip component renders one piece per token, attaching
 * an `onClick` handler to `{ kind: 'assumptionAnchor' }` tokens.
 *
 * Canonical reading (brief §6):
 *
 *   "In order to achieve {A}, we must {B}, because [click for assumptions].
 *    In order to {B}, we must {D}, because [click for assumptions].
 *    In order to achieve {A}, we must also {C}, because [click for assumptions].
 *    In order to {C}, we must {D′}, because [click for assumptions].
 *    But {D} and {D′} cannot coexist, because [click for assumptions]."
 *
 * If any of the five slots is empty or unfilled, the helper renders a
 * neutral placeholder ("an objective", "a need", etc.) so the verbal
 * form is still legible during the wizard's progressive fill.
 */

/**
 * One renderable piece of the verbalised EC. The UI walks the list and
 * renders each piece per its `kind`:
 *
 *   - `'text'`   — static prose; render as plain text.
 *   - `'slot'`   — an entity title pulled from one of the five EC slots.
 *                  The optional `entityId` lets the UI cross-link the
 *                  text to its source entity (e.g. select-on-click).
 *   - `'assumptionAnchor'` — a clickable link that jumps the inspector
 *                  to the assumption well for the corresponding edge.
 *                  Carries the `edgeId` so the consumer can address it.
 */
export type VerbalisationToken =
  | { kind: 'text'; text: string }
  | { kind: 'slot'; slot: 'a' | 'b' | 'c' | 'd' | 'dPrime'; entityId?: string; text: string }
  | { kind: 'assumptionAnchor'; edgeId: string; assumptionCount: number };

/** Placeholder shown when an EC slot hasn't been filled in yet. Keeps
 *  the verbal form readable during the wizard's progressive flow. */
const PLACEHOLDER: Record<'a' | 'b' | 'c' | 'd' | 'dPrime', string> = {
  a: 'the common objective',
  b: 'the first need',
  c: 'the second need',
  d: 'the first want',
  dPrime: 'the conflicting want',
};

const slotEntities = (
  doc: TPDocument
): Record<'a' | 'b' | 'c' | 'd' | 'dPrime', Entity | undefined> => {
  const map: Record<'a' | 'b' | 'c' | 'd' | 'dPrime', Entity | undefined> = {
    a: undefined,
    b: undefined,
    c: undefined,
    d: undefined,
    dPrime: undefined,
  };
  for (const entity of Object.values(doc.entities)) {
    const slot = entity.ecSlot;
    if (slot && !map[slot]) map[slot] = entity;
  }
  return map;
};

const slotText = (entity: Entity | undefined, slot: keyof typeof PLACEHOLDER): string => {
  const t = entity?.title.trim();
  return t && t.length > 0 ? t : PLACEHOLDER[slot];
};

/**
 * For each of the 5 canonical EC arrows (B→A, C→A, D→B, D′→C, D↔D′),
 * return the edge id and the count of assumptions attached. Returns
 * `null` for an arrow if no edge connects the relevant entities yet —
 * the verbalisation strip still renders the sentence with a
 * placeholder-only anchor (no jump target, no count) so the user sees
 * the slot.
 */
type ArrowKey = 'bToA' | 'cToA' | 'dToB' | 'dPrimeToC' | 'dToDPrime';

const findArrow = (
  doc: TPDocument,
  sourceId: string | undefined,
  targetId: string | undefined,
  requireMutex = false
): { edgeId: string; assumptionCount: number } | null => {
  if (!sourceId || !targetId) return null;
  for (const edge of Object.values(doc.edges)) {
    const matches = edge.sourceId === sourceId && edge.targetId === targetId;
    const reverseMatches = requireMutex && edge.sourceId === targetId && edge.targetId === sourceId;
    if ((matches || reverseMatches) && (!requireMutex || edge.isMutualExclusion)) {
      // Assumption count from BOTH the legacy Edge.assumptionIds list
      // (back-compat) and the v7 Document.assumptions map keyed by
      // edgeId. The two should normally agree; we union to be safe.
      const legacy = edge.assumptionIds?.length ?? 0;
      const fromMap = doc.assumptions
        ? Object.values(doc.assumptions).filter((a) => a.edgeId === edge.id).length
        : 0;
      return { edgeId: edge.id, assumptionCount: Math.max(legacy, fromMap) };
    }
  }
  return null;
};

/** Generate the structured verbalisation for an EC document. Returns
 *  an empty array for non-EC docs. */
export const verbaliseEC = (doc: TPDocument): VerbalisationToken[] => {
  if (doc.diagramType !== 'ec') return [];
  const slots = slotEntities(doc);
  const a = slotText(slots.a, 'a');
  const b = slotText(slots.b, 'b');
  const c = slotText(slots.c, 'c');
  const d = slotText(slots.d, 'd');
  const dPrime = slotText(slots.dPrime, 'dPrime');

  // Arrow lookups — directed except the D↔D′ mutex, which we treat as
  // bidirectional and require the `isMutualExclusion` flag.
  const arrows: Record<ArrowKey, { edgeId: string; assumptionCount: number } | null> = {
    bToA: findArrow(doc, slots.b?.id, slots.a?.id),
    cToA: findArrow(doc, slots.c?.id, slots.a?.id),
    dToB: findArrow(doc, slots.d?.id, slots.b?.id),
    dPrimeToC: findArrow(doc, slots.dPrime?.id, slots.c?.id),
    dToDPrime: findArrow(doc, slots.d?.id, slots.dPrime?.id, true),
  };

  const tokens: VerbalisationToken[] = [];
  const push = (...t: VerbalisationToken[]): void => {
    tokens.push(...t);
  };
  const arrow = (k: ArrowKey): VerbalisationToken => {
    const a = arrows[k];
    return a
      ? { kind: 'assumptionAnchor', edgeId: a.edgeId, assumptionCount: a.assumptionCount }
      : { kind: 'assumptionAnchor', edgeId: '', assumptionCount: 0 };
  };

  push({ kind: 'text', text: 'In order to achieve ' });
  push({ kind: 'slot', slot: 'a', entityId: slots.a?.id, text: a });
  push({ kind: 'text', text: ', we must ' });
  push({ kind: 'slot', slot: 'b', entityId: slots.b?.id, text: b });
  push({ kind: 'text', text: ', because ' });
  push(arrow('bToA'));
  push({ kind: 'text', text: '. In order to ' });
  push({ kind: 'slot', slot: 'b', entityId: slots.b?.id, text: b });
  push({ kind: 'text', text: ', we must ' });
  push({ kind: 'slot', slot: 'd', entityId: slots.d?.id, text: d });
  push({ kind: 'text', text: ', because ' });
  push(arrow('dToB'));
  push({ kind: 'text', text: '. In order to achieve ' });
  push({ kind: 'slot', slot: 'a', entityId: slots.a?.id, text: a });
  push({ kind: 'text', text: ', we must also ' });
  push({ kind: 'slot', slot: 'c', entityId: slots.c?.id, text: c });
  push({ kind: 'text', text: ', because ' });
  push(arrow('cToA'));
  push({ kind: 'text', text: '. In order to ' });
  push({ kind: 'slot', slot: 'c', entityId: slots.c?.id, text: c });
  push({ kind: 'text', text: ', we must ' });
  push({ kind: 'slot', slot: 'dPrime', entityId: slots.dPrime?.id, text: dPrime });
  push({ kind: 'text', text: ', because ' });
  push(arrow('dPrimeToC'));
  push({ kind: 'text', text: '. But ' });
  push({ kind: 'slot', slot: 'd', entityId: slots.d?.id, text: d });
  push({ kind: 'text', text: ' and ' });
  push({ kind: 'slot', slot: 'dPrime', entityId: slots.dPrime?.id, text: dPrime });
  push({ kind: 'text', text: ' cannot coexist, because ' });
  push(arrow('dToDPrime'));
  push({ kind: 'text', text: '.' });

  return tokens;
};

/**
 * Flatten the token list into a plain-text string for testing,
 * accessibility, or non-interactive callers (e.g. the HTML export
 * viewer can render this and skip the click affordances). The
 * `[assumptions: N]` suffix replaces the click target so the reader
 * still sees the count.
 */
export const verbalisedECText = (doc: TPDocument): string => {
  const tokens = verbaliseEC(doc);
  return tokens
    .map((t) => {
      if (t.kind === 'text') return t.text;
      if (t.kind === 'slot') return t.text;
      return t.assumptionCount > 0
        ? `[${t.assumptionCount} assumption${t.assumptionCount === 1 ? '' : 's'}]`
        : '[no assumptions yet]';
    })
    .join('');
};
