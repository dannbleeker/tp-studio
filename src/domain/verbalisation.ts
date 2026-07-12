import { assumptionsForEdge } from './graphCore';
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
  // Session 117 — `entityId` explicitly allows `undefined` so call sites
  // can pass `slots.a?.id` (which may be undefined when the slot is
  // unfilled) without a conditional spread at every push() site.
  | {
      kind: 'slot';
      slot: 'a' | 'b' | 'c' | 'd' | 'dPrime';
      entityId?: string | undefined;
      text: string;
    }
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
      // Record-canonical: the edge's assumption count is the first-class
      // `doc.assumptions` records keyed to it.
      return { edgeId: edge.id, assumptionCount: assumptionsForEdge(doc, edge.id).length };
    }
  }
  return null;
};

/**
 * Session 87 / EC PPT comparison item #4 — verbal-style modulator.
 *
 * `'neutral'` (the v7 default) reads each prerequisite arrow as "we
 * must X" — a single-perspective workshop voice. `'twoSided'` mirrors
 * the BESTSELLER workshop PPT's explicit two-party framing:
 *
 *   - D-side prerequisites read "they want to" / "they need" (the
 *     "other side" facing the conflict);
 *   - D′-side prerequisites read "I want to" / "I need" (the user's
 *     own side);
 *   - both sides converge on the shared A objective with "we" again
 *     since that's the shared goal both parties agree on.
 *
 * Pure helper: the function takes the active doc style, never reaches
 * into store state, so verbalisation stays trivially testable.
 */
const wordingForStyle = (
  style: 'neutral' | 'twoSided'
): {
  inOrderToAchieve: string;
  needB: string;
  needC: string;
  inOrderTo: string;
  wantD: string;
  wantDPrime: string;
} => {
  if (style === 'twoSided') {
    // The two needs (B + C) belong to each party respectively. The PPT frames
    // B as the OTHER side's need (satisfied by D) and C as MY side's need
    // (satisfied by D′). Voice is tied to the SIDE, not the reading position.
    return {
      inOrderToAchieve: 'In order to achieve ',
      needB: ', they must ',
      needC: ', I must ',
      inOrderTo: 'In order to ',
      wantD: ', they want to ',
      wantDPrime: ', I want to ',
    };
  }
  return {
    inOrderToAchieve: 'In order to achieve ',
    needB: ', we must ',
    needC: ', we must ',
    inOrderTo: 'In order to ',
    wantD: ', we must ',
    wantDPrime: ', we must ',
  };
};

/**
 * Generate the structured verbalisation for an EC document. Returns an empty
 * array for non-EC docs.
 *
 * Session 198 (backlog D5) — `opts.leadWithC` presents the cloud from the D′
 * side's perspective, reading the C→D′ (my-side) arc BEFORE the B→D
 * (other-side) arc. Cohen recommends leading with the listener's own need +
 * tactic so they feel heard first (Handbook Ch. 24). Default (`false`) is the
 * canonical B-first reading, byte-for-byte as before.
 */
export const verbaliseEC = (
  doc: TPDocument,
  opts?: { leadWithC?: boolean }
): VerbalisationToken[] => {
  if (doc.diagramType !== 'ec') return [];
  const slots = slotEntities(doc);
  const a = slotText(slots.a, 'a');
  const b = slotText(slots.b, 'b');
  const c = slotText(slots.c, 'c');
  const d = slotText(slots.d, 'd');
  const dPrime = slotText(slots.dPrime, 'dPrime');
  const w = wordingForStyle(doc.ecVerbalStyle ?? 'neutral');
  const leadWithC = opts?.leadWithC ?? false;

  // Arrow lookups — directed except the D↔D′ mutex, which we treat as
  // bidirectional and require the `isMutualExclusion` flag.
  const arrows: Record<ArrowKey, { edgeId: string; assumptionCount: number } | null> = {
    bToA: findArrow(doc, slots.b?.id, slots.a?.id),
    cToA: findArrow(doc, slots.c?.id, slots.a?.id),
    dToB: findArrow(doc, slots.d?.id, slots.b?.id),
    dPrimeToC: findArrow(doc, slots.dPrime?.id, slots.c?.id),
    dToDPrime: findArrow(doc, slots.d?.id, slots.dPrime?.id, true),
  };
  const arrow = (k: ArrowKey): VerbalisationToken => {
    const found = arrows[k];
    return found
      ? { kind: 'assumptionAnchor', edgeId: found.edgeId, assumptionCount: found.assumptionCount }
      : { kind: 'assumptionAnchor', edgeId: '', assumptionCount: 0 };
  };

  // "also" attaches to whichever need-arc reads SECOND (it reads as "the other
  // need too"). Keeps the default output identical: B first (no "also"), C
  // second ("… we must also …").
  const alsoize = (conn: string): string => `${conn.trimEnd()} also `;

  // One need→want arc: "In order to achieve A, [voice] NEED, because [x]. In
  // order to NEED, [voice] WANT, because [y]." Both arcs open on the shared A.
  const arc = (
    needSlot: 'b' | 'c',
    needTxt: string,
    needConn: string,
    wantSlot: 'd' | 'dPrime',
    wantTxt: string,
    wantConn: string,
    needArrowKey: ArrowKey,
    wantArrowKey: ArrowKey,
    isSecond: boolean
  ): VerbalisationToken[] => {
    const needId = (needSlot === 'b' ? slots.b : slots.c)?.id;
    const wantId = (wantSlot === 'd' ? slots.d : slots.dPrime)?.id;
    return [
      { kind: 'text', text: w.inOrderToAchieve },
      { kind: 'slot', slot: 'a', entityId: slots.a?.id, text: a },
      { kind: 'text', text: isSecond ? alsoize(needConn) : needConn },
      { kind: 'slot', slot: needSlot, entityId: needId, text: needTxt },
      { kind: 'text', text: ', because ' },
      arrow(needArrowKey),
      { kind: 'text', text: `. ${w.inOrderTo}` },
      { kind: 'slot', slot: needSlot, entityId: needId, text: needTxt },
      { kind: 'text', text: wantConn },
      { kind: 'slot', slot: wantSlot, entityId: wantId, text: wantTxt },
      { kind: 'text', text: ', because ' },
      arrow(wantArrowKey),
    ];
  };

  const bArc = (isSecond: boolean) =>
    arc('b', b, w.needB, 'd', d, w.wantD, 'bToA', 'dToB', isSecond);
  const cArc = (isSecond: boolean) =>
    arc('c', c, w.needC, 'dPrime', dPrime, w.wantDPrime, 'cToA', 'dPrimeToC', isSecond);

  const first = leadWithC ? cArc(false) : bArc(false);
  const second = leadWithC ? bArc(true) : cArc(true);

  return [
    ...first,
    { kind: 'text', text: '. ' },
    ...second,
    { kind: 'text', text: '. But ' },
    { kind: 'slot', slot: 'd', entityId: slots.d?.id, text: d },
    { kind: 'text', text: ' and ' },
    { kind: 'slot', slot: 'dPrime', entityId: slots.dPrime?.id, text: dPrime },
    { kind: 'text', text: ' cannot coexist, because ' },
    arrow('dToDPrime'),
    { kind: 'text', text: '.' },
  ];
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
