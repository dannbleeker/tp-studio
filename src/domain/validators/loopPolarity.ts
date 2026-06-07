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
const MESSAGE: Partial<Record<DiagramType, string>> = {
  crt: 'This loop is balancing (self-correcting) — but a persistent UDE usually rides a reinforcing (vicious) cycle. Check the edge polarities.',
  nbr: 'This loop is balancing (self-correcting) — a negative branch that sustains itself usually rides a reinforcing cycle. Check the edge polarities.',
  frt: 'This loop is balancing (self-limiting) — an injection that counteracts itself is usually unintended. Check the edge polarities.',
};

export const loopPolarityRule = (doc: TPDocument): UntieredWarning[] => {
  const message = MESSAGE[doc.diagramType];
  if (!message) return [];
  const out: UntieredWarning[] = [];
  for (const loop of loopsWithPolarity(doc)) {
    if (loop.polarity !== 'balancing') continue;
    const target = loop.closingEdgeId ?? loop.edgeIds[0];
    if (!target) continue;
    out.push(makeWarning(doc, 'loop-polarity', { kind: 'edge', id: target }, message));
  }
  return out;
};
