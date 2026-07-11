import type { TPDocument } from '../types';
import { buildECPattern } from './ec-shared';

/**
 * Pattern: Resistance to change — Efrat's cloud (Evaporating Cloud).
 *
 * The universal "why we both want change and fear it" conflict, after Efrat
 * Goldratt-Ashlag's 1995 model (*Embracing Change vs. Resistance to Change*).
 * Being happy at work rests on two different needs: satisfaction — a sense of
 * achievement, which only comes from taking on something new — and security,
 * which she redefines as confidence in the reliability of one's own predictions.
 * Satisfaction pulls you to embrace the change; security pulls you to resist it,
 * and the same person feels both at once. The most-reached-for cloud in buy-in
 * and facilitation work: it locates the two injections (protect prediction
 * reliability; give an owning role in the change) by naming the need each side
 * is defending. D (embrace) serves B (satisfaction); D′ (resist) serves C
 * (security) — the same wiring `buildECPattern` applies to every cloud.
 *
 * Session 195 — the cloud now ships **fully assumptioned**: the 14 numbered
 * assumptions published as Figure 8.3 of Dettmer's *The Logical Thinking
 * Process* (2007, "Efrat's Cloud", used there with Efrat Goldratt's
 * permission), paraphrased per the library's no-verbatim rule and attached as
 * first-class `Assumption` records behind the four support arrows (3 on B→A,
 * 4 on D→B, 4 on C→A, 3 on D′→C). The D′→C three carry status
 * `'challengeable'` — they are exactly what breaking channel 1 attacks. The
 * first library pattern to exercise the assumption layer end-to-end.
 *
 * The two breaking channels ship as non-causal **notes** pinned to the need
 * each one protects — dotted on the canvas and excluded from the CLR rules, so
 * they read as facilitation hints, not cloud structure. (Injections proper
 * aren't EC-canvas citizens — they emerge from scrutiny and develop across
 * linked docs via the Injection Flower; a note is the right primitive here.)
 * Channel 1 breaks the D′→C assumptions (#19–#21); channel 2 doesn't break an
 * assumption — it *builds on* the D→B four (#11–#14), turning the change
 * itself into the fresh challenge satisfaction needs. The note texts carry
 * those numbers so the canvas badges cross-reference.
 */
export const buildPatternECEfratsChangeCloud = (): TPDocument =>
  buildECPattern({
    title: "Resistance to change (Efrat's cloud)",
    objective: 'Be happy and engaged at work',
    need1: 'Get satisfaction — a sense of achievement',
    need2: 'Feel secure — trust that my predictions hold',
    want1: 'Embrace the change',
    want2: 'Resist the change',
    notes: [
      // Channel 1 hangs off C (security); Channel 2 hangs off B (satisfaction).
      {
        text: 'Channel 1 — protect security: supply the information + training people need to forecast through the change. Breaks assumptions #19–#21.',
        anchor: 'c',
        position: { x: 380, y: 560 },
      },
      {
        text: 'Channel 2 — offer satisfaction: give an owning role in the change so it becomes an achievement. Builds on assumptions #11–#14.',
        anchor: 'b',
        position: { x: 380, y: -90 },
      },
    ],
    // Figure 8.3's 14 assumptions, paraphrased, in the figure's numbering
    // order (B→A first, then D→B, C→A, D′→C) so the canvas badges #8–#21
    // walk the published sequence.
    assumptions: [
      // B→A — satisfaction is necessary for happiness (figure #1–#3).
      { arrow: 'b-a', text: 'Without satisfaction there is no lasting happiness.' },
      { arrow: 'b-a', text: 'Satisfaction is a sense of fulfillment.' },
      {
        arrow: 'b-a',
        text: 'Fulfillment comes from reaching challenging objectives where failure is a real possibility.',
      },
      // D→B — satisfaction demands initiating change (figure #4–#7).
      {
        arrow: 'd-b',
        text: 'Hardly anyone lives for long in a high-risk, constantly challenging environment.',
      },
      {
        arrow: 'd-b',
        text: 'Doing the same things over and over satisfies less and less — the novelty wears off.',
      },
      { arrow: 'd-b', text: 'Sustaining satisfaction takes new challenges.' },
      { arrow: 'd-b', text: 'Meeting a new challenge means doing things differently — change.' },
      // C→A — security is necessary for happiness (figure #8–#11).
      { arrow: 'c-a', text: 'No one stays happy for long in a climate of high anxiety.' },
      { arrow: 'c-a', text: 'Anxiety climbs when people do not feel secure.' },
      {
        arrow: 'c-a',
        text: 'Security comes from confidence that future events are predictable.',
      },
      {
        arrow: 'c-a',
        text: 'The more consistently predictable events are, the more secure people feel.',
      },
      // D′→C — security demands resisting change (figure #12–#14). These are
      // the three that breaking channel 1 attacks, hence 'challengeable'.
      {
        arrow: 'dPrime-c',
        text: 'Change makes my environment inconsistent.',
        status: 'challengeable',
      },
      {
        arrow: 'dPrime-c',
        text: 'Inconsistency undermines my ability to predict.',
        status: 'challengeable',
      },
      {
        arrow: 'dPrime-c',
        text: 'The bigger the change, the less predictable the future becomes.',
        status: 'challengeable',
      },
    ],
  });
