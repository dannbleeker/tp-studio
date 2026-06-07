// Session 130 — split from `domain/types.ts`. Edge model: the kind/weight
// enums and the `Edge` record itself. Imports the branded ID types and
// the `AttrValue` shape that edge `attributes` reuses from the entity model.

import type { AttrValue } from './entity';
import type { EdgeId, EntityId } from './ids';

/**
 * Edge logical semantics. Session 77 split — until now every edge was
 * implicitly `'sufficiency'` and the diagram type chose the reading word
 * ("because" vs. "in order to"). The brief's v1 model promotes the
 * distinction to a stored field so EC + Goal Tree edges are explicitly
 * necessity-typed regardless of how a reader interprets them.
 *
 *   - `'sufficiency'` — "X exists, therefore Y exists." CRT/FRT/TT edges.
 *   - `'necessity'` — "In order to X, Y must hold." EC + Goal Tree edges.
 *
 * Old saved documents have `Edge.kind === 'sufficiency'` everywhere; the
 * v6→v7 migration looks at the document's diagram type and upgrades EC +
 * Goal Tree edges to `'necessity'`.
 */
export type EdgeKind = 'sufficiency' | 'necessity';

/**
 * Bundle 8 / FL-ED1 — edge polarity. Tags an edge as a positive
 * (default sufficiency), negative (counter-causal — "this CAUSE
 * REDUCES this EFFECT"), or zero (neutral / no-effect) correlation.
 * Metadata only: CLR rules don't change behavior on weight, and the
 * cycle/causality validators continue to treat every edge as a
 * structural link. Exporters round-trip the weight where the target
 * format supports it (Flying Logic carries weight natively).
 *
 * Unset (`undefined`) is the common case and reads as "positive
 * sufficiency" — the existing TOC semantics. Only set this when the
 * user explicitly wants to mark counter-causality.
 */
export type EdgeWeight = 'positive' | 'negative' | 'zero';

export type Edge = {
  id: EdgeId;
  sourceId: EntityId;
  targetId: EntityId;
  kind: EdgeKind;
  andGroupId?: string;
  /** Bundle 8 / FL-ED3 — mutual-exclusion junctor across a set of
   *  edges sharing a target. Same model as `andGroupId`: edges with
   *  the same `xorGroupId` value converge into one labelled "XOR"
   *  junctor circle just below the target. An edge can belong to AT
   *  MOST ONE of `andGroupId` / `orGroupId` / `xorGroupId` — the
   *  store actions enforce this and the JunctorOverlay reads them
   *  one-of-three. */
  xorGroupId?: string;
  /** Bundle 8 / FL-ED4 — explicit OR junctor. Today's implicit model
   *  is "two non-AND-grouped incoming edges = either suffices"; an
   *  explicit OR group makes the alternation visible on the canvas
   *  with its own labelled junctor circle. Same exclusivity rule as
   *  `xorGroupId`. */
  orGroupId?: string;
  /** Bundle 8 / FL-ED1 — see {@link EdgeWeight}. Metadata only. */
  weight?: EdgeWeight;
  assumptionIds?: EntityId[];
  /** Optional short text label rendered mid-edge. ≤30 chars renders inline,
   *  longer wraps as a tooltip. Distinct from assumption entities. */
  label?: string;
  /** Long-form markdown annotation explaining the edge — distinct from the
   *  short `label` (which sits inline on the canvas) and from
   *  `assumptionIds` (which links to standalone Assumption entities).
   *  Surfaces in EdgeInspector as a full MarkdownField; the canvas shows a
   *  small "note" indicator when set. Use for "why this edge holds" prose
   *  that doesn't deserve a separate Assumption entity but is too long for
   *  the label. Round-trips through JSON. */
  description?: string;
  /** Book-derived (TOC-reading set): explicit acknowledgement that this edge
   *  closes a causal loop intentionally. CRTs often contain vicious circles
   *  ("manual intake → opaque categories → worse support → more manual
   *  intake"); FRTs often *design* positive reinforcing loops. The cycle
   *  CLR rule (Session 48's E3) treats every cycle as a defect by default;
   *  flagging an edge as a back-edge tells the rule "yes, the loop is the
   *  point — don't warn me about it again." Visually rendered with a
   *  thicker stroke and a small loop glyph so the loop reads as a feature
   *  rather than a problem. */
  isBackEdge?: boolean;
  /** Book-derived (TOC-reading set): mark an edge as a mutual-exclusion link.
   *  Only meaningful on Evaporating Cloud diagrams, where the diagnostic
   *  *depends* on two Wants being mutually exclusive — the user models the
   *  conflict by drawing an edge between the two `want` entities and
   *  flagging it. Visually rendered with a red stroke + ⊥ glyph; an
   *  EC-specific CLR rule fires when a 2-want EC has no such edge ("is
   *  this really a conflict?"). */
  isMutualExclusion?: boolean;
  /** Theme A / A4 (Session 180) — System-Dynamics delay marker. When true the
   *  edge renders a `//` glyph mid-arc to signal that the cause's effect is
   *  LAGGED (it arrives later in time). Delay is what governs how a feedback
   *  loop behaves: a reinforcing loop with no delay escalates instantly, a
   *  delayed one builds slowly (and hides its cause), and a delayed balancing
   *  loop oscillates. Annotation only — never simulated. Omitted from JSON when
   *  unset. */
  delay?: boolean;
  /** Theme A / A3 (Session 180) — a name for the feedback loop this edge closes.
   *  Only meaningful on a back-edge (the loop's canonical anchor). Systems
   *  thinking names loops ("Burnout spiral") so a group can refer to the pattern
   *  instead of re-tracing the arrows. Rendered as a small label by the
   *  back-edge, alongside the R/B polarity badge. Omitted from JSON when unset. */
  loopName?: string;
  /** Theme A / A3 (Session 180) — free-text behavior-over-time note for the loop
   *  this back-edge closes ("escalates over 3–6 months, then morale collapses").
   *  Captures the qualitative temporal dynamic the acyclic sufficiency structure
   *  can't express — without any simulation. Surfaces in the EdgeInspector.
   *  Omitted from JSON when unset. */
  loopNarrative?: string;
  /** B1 — user-defined attributes on edges, mirroring `Entity.attributes`.
   *  Same `AttrValue` shape and the same Inspector key/value editor.
   *  Use for ad-hoc edge metadata (a source URL on a citation edge, a
   *  weight on a flow edge) that the built-in `label` / `description` /
   *  `isBackEdge` / `isMutualExclusion` fields don't cover. Omitted from
   *  JSON when unset; see {@link AttrValue}. */
  attributes?: Record<string, AttrValue>;
};
