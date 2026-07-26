import type { ClrMessageKey } from '@/i18n/types';
import { loopsWithPolarity } from '../loopAnalysis';
import type { DiagramType, TPDocument } from '../types';
import { makeWarning, type UntieredWarning } from './shared';

/**
 * Session 179 (Theme A2 — the System-Dynamics lens) — flags a feedback loop
 * whose polarity is surprising for the diagram type:
 *   - **CRT / NBR** (a problem tree): a *balancing* (self-correcting) loop is
 *     unusual — a persistent UDE normally rides a *reinforcing* (vicious)
 *     cycle, so a balancing loop hints the edge polarities are off.
 *   - **FRT** (a solution tree): a *balancing* loop means an injection may be
 *     self-limiting — usually unintended.
 *
 * Reinforcing loops (vicious in a CRT, virtuous in an FRT) are the expected
 * case and produce no warning; loops we can't classify (a `zero`-weight edge)
 * are skipped. Anchored on the loop-closing (back-)edge. This turns "is this
 * loop a feature or a bug?" into a glanceable answer.
 */
/**
 * Keyed per diagram type rather than parameterized: the three variants are
 * genuinely different sentences (a balancing loop means something different in
 * a CRT than in an FRT), not one sentence with a substituted noun. A
 * translator needs to rewrite each, so each gets its own catalogue key.
 */
const MESSAGE_KEY: Partial<Record<DiagramType, ClrMessageKey>> = {
  crt: 'loop-polarity.crt',
  nbr: 'loop-polarity.nbr',
  frt: 'loop-polarity.frt',
};

export const loopPolarityRule = (doc: TPDocument): UntieredWarning[] => {
  const messageKey = MESSAGE_KEY[doc.diagramType];
  if (!messageKey) return [];
  const out: UntieredWarning[] = [];
  for (const loop of loopsWithPolarity(doc)) {
    if (loop.polarity !== 'balancing') continue;
    const target = loop.closingEdgeId ?? loop.edgeIds[0];
    if (!target) continue;
    out.push(makeWarning(doc, 'loop-polarity', { kind: 'edge', id: target }, messageKey));
  }
  return out;
};
