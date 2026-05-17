/**
 * Session 115 — extracted from `CreationWizardPanel.tsx` (Tier-2 #4
 * structural refactor). The step definitions are pure data — prompt
 * + placeholder per step — with no dependencies on panel state. Pulling
 * them into a sibling file:
 *
 *   - Drops ~56 LOC from the component file (was 596 LOC, now ~540).
 *   - Lets future copywriters edit the prompts without scrolling
 *     past panel state-management code.
 *   - Makes the prompts importable from a test if we ever want to
 *     pin "first prompt of the Goal Tree wizard reads {x}".
 *
 * No behavior change — the component imports these exactly as before.
 */
import { EC_SLOTS_BY_ORDER, type ECSlot } from '@/domain/ecGuiding';

export type StepDef = {
  prompt: string;
  placeholder: string;
};

export const GOAL_TREE_STEPS: StepDef[] = [
  {
    prompt: "What is the Goal? One sentence — the system's purpose.",
    placeholder: 'e.g. "Be the customer\'s first choice in our category"',
  },
  {
    prompt: 'First Critical Success Factor — what must hold for the Goal?',
    placeholder: 'e.g. "Customers consistently find what they need"',
  },
  {
    prompt: 'Second Critical Success Factor.',
    placeholder: 'e.g. "Customers trust the experience end-to-end"',
  },
  {
    prompt: 'Third Critical Success Factor.',
    placeholder: 'e.g. "Customers recommend us unprompted"',
  },
  {
    prompt: 'First Necessary Condition — pick any CSF and name a prerequisite.',
    placeholder: 'e.g. "Range covers ≥80% of relevant intent"',
  },
];

/**
 * EC wizard prompts keyed by slot. The order is decided at render time
 * by `EC_SLOTS_BY_ORDER` so the same definitions back both the A-first
 * and D-first walks (Session 87 EC PPT comparison item #3).
 */
export const EC_STEP_BY_SLOT: Record<ECSlot, StepDef> = {
  a: {
    prompt: 'What is the shared objective (A) both sides agree on?',
    placeholder: 'e.g. "Run a sustainable business"',
  },
  b: {
    prompt: 'Need B — what does the first side need to support A?',
    placeholder: 'e.g. "Hit quarterly revenue targets"',
  },
  c: {
    prompt: 'Need C — what does the other side need to support A?',
    placeholder: 'e.g. "Sustain product quality"',
  },
  d: {
    prompt: "Want D — the first side's prerequisite (will conflict with D′).",
    placeholder: 'e.g. "Ship every feature on the roadmap"',
  },
  dPrime: {
    prompt: "Want D′ — the other side's prerequisite (conflicts with D).",
    placeholder: 'e.g. "Cut the roadmap to half and harden the core"',
  },
};

export const EC_STEPS: StepDef[] = EC_SLOTS_BY_ORDER.aFirst.map((slot) => EC_STEP_BY_SLOT[slot]);
export const EC_STEPS_D_FIRST: StepDef[] = EC_SLOTS_BY_ORDER.dFirst.map(
  (slot) => EC_STEP_BY_SLOT[slot]
);
