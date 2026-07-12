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
import type { CloudType } from '@/domain/types';

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

/**
 * Session 197 (backlog D1) — per-cloud-type wizard prompts. Original app-voice
 * paraphrases of Cohen's guiding-question tables (Handbook Ch. 24, Tables
 * 24-2 / 24-4 / 24-5 / 24-6). Consumed by the wizard ONLY when the user opts
 * into a cloud type; the walk order for each type lives in
 * `EC_CLOUD_TYPE_ORDER` (`@/domain/ecGuiding`). The generic default keeps
 * `EC_STEP_BY_SLOT` above.
 */
export const EC_STEPS_BY_CLOUD_TYPE: Record<CloudType, Record<ECSlot, StepDef>> = {
  // Inner Dilemma — a one-person conflict; D is the forced option, D′ preferred.
  dilemma: {
    d: {
      prompt: 'Which action do you feel under the most pressure to take? (the distasteful one — D)',
      placeholder: 'e.g. "Take the safe, expected assignment"',
    },
    dPrime: {
      prompt: 'Which action would you most prefer? (D′)',
      placeholder: 'e.g. "Take the risky, stretching assignment"',
    },
    c: {
      prompt: 'What need of yours does your preferred action D′ satisfy? (C)',
      placeholder: 'e.g. "Grow and be challenged"',
    },
    b: {
      prompt: 'What need of yours does the forced action D satisfy? (B)',
      placeholder: 'e.g. "Feel secure and not fail"',
    },
    a: {
      prompt: 'What common objective is met when both need B and need C are satisfied? (A)',
      placeholder: 'e.g. "Have a fulfilling career"',
    },
  },
  // Day-to-Day Conflict — two parties; the other side is B-D, you are C-D′.
  conflict: {
    d: {
      prompt: 'What tactic does the other side want to take? (D)',
      placeholder: 'e.g. "Ship on the original date"',
    },
    dPrime: {
      prompt: 'What tactic do you want to take? (D′)',
      placeholder: 'e.g. "Slip the date to harden quality"',
    },
    c: {
      prompt: 'What need are you trying to satisfy with your tactic D′? (C)',
      placeholder: 'e.g. "Protect the product\'s reliability"',
    },
    b: {
      prompt: 'What need is the other side trying to satisfy, as you see it? (B)',
      placeholder: 'e.g. "Keep the launch commitment"',
    },
    a: {
      prompt: 'What objective do you both share, met when needs B and C both hold? (A)',
      placeholder: 'e.g. "Win and keep the customer"',
    },
  },
  // Fire-Fighting — the fire triggers the cloud but is not a box; entry point
  // is the endangered need B.
  firefighting: {
    b: {
      prompt: 'What important need does this fire put at risk? (B)',
      placeholder: 'e.g. "Get the order shipped on time"',
    },
    d: {
      prompt: 'What action would meet that endangered need B? (D)',
      placeholder: 'e.g. "Let the clerk call the customer directly"',
    },
    dPrime: {
      prompt: 'What procedure or rule currently prevents that action? (D′)',
      placeholder: 'e.g. "Only the account manager contacts customers"',
    },
    c: {
      prompt: 'What need does that procedure D′ protect? (C)',
      placeholder: 'e.g. "Keep customer contact consistent"',
    },
    a: {
      prompt: 'What common objective is met when both B and C hold? (A)',
      placeholder: 'e.g. "Serve customers reliably"',
    },
  },
  // UDE cloud — the "Z" walk B → D → C → D′ → A.
  ude: {
    b: {
      prompt: 'What important need does this undesirable effect put at risk? (B)',
      placeholder: 'e.g. "Deliver on our promised dates"',
    },
    d: {
      prompt: 'What action would meet that endangered need B? (D)',
      placeholder: 'e.g. "Hold generous safety stock everywhere"',
    },
    c: {
      prompt: 'What other important need stops you from always taking that action? (C)',
      placeholder: 'e.g. "Keep cash and carrying cost down"',
    },
    dPrime: {
      prompt: 'What do you do instead, to meet that other need C? (D′)',
      placeholder: 'e.g. "Keep stock lean"',
    },
    a: {
      prompt: 'What common objective is met when both B and C hold? (A)',
      placeholder: 'e.g. "Run a profitable, dependable operation"',
    },
  },
  // Consolidated / Generic — the core conflict merged from several UDE clouds.
  consolidated: {
    a: {
      prompt: 'What shared objective sits above all the conflicts you are consolidating? (A)',
      placeholder: 'e.g. "Ongoing success"',
    },
    b: {
      prompt: 'What need shows up across them on one side? (B)',
      placeholder: 'e.g. "Deliver results now"',
    },
    c: {
      prompt: 'What need shows up across them on the other side? (C)',
      placeholder: 'e.g. "Protect the long term"',
    },
    d: {
      prompt: 'What generic action do the one-side wants boil down to? (D)',
      placeholder: 'e.g. "Push hard for this quarter"',
    },
    dPrime: {
      prompt: 'What generic action do the other-side wants boil down to? (D′)',
      placeholder: 'e.g. "Invest in the future"',
    },
  },
  // Core cloud — the recurring conflict under many UDEs.
  core: {
    a: {
      prompt: 'What objective does this recurring conflict serve? (A)',
      placeholder: 'e.g. "Run a healthy organization"',
    },
    b: {
      prompt: 'What need drives one side? (B)',
      placeholder: 'e.g. "Maximize local efficiency"',
    },
    c: {
      prompt: 'What need drives the other side? (C)',
      placeholder: 'e.g. "Protect overall flow"',
    },
    d: {
      prompt: 'What does one side keep wanting to do? (D)',
      placeholder: 'e.g. "Keep every resource busy"',
    },
    dPrime: {
      prompt: 'What does the other side keep wanting to do? (D′)',
      placeholder: 'e.g. "Let non-constraints idle"',
    },
  },
};

/**
 * Session 136 — CRT creation wizard prompts. The Current Reality Tree
 * starts from undesirable effects (UDEs) and works backwards to a
 * shared root cause. The classic Goldratt advice: list 5–10 UDEs first,
 * then look for connections.
 *
 * The wizard keeps it tight at three UDEs — enough to make the
 * "now find what they share" step land naturally, without making the
 * onboarding longer than the EC + Goal Tree wizards. Subsequent UDEs
 * + the causal chain are the user's work; the wizard only opens the
 * door.
 */
export const CRT_STEPS: StepDef[] = [
  {
    prompt: 'First UDE — what is one problem that bothers you about this system?',
    placeholder: 'e.g. "Customers churn before their second renewal"',
  },
  {
    prompt: 'Second UDE — what else bothers you? UDEs often share a root cause.',
    placeholder: 'e.g. "Support tickets spike in the first 60 days"',
  },
  {
    prompt: 'Third UDE — one more. Look for problems that feel connected to the first two.',
    placeholder: 'e.g. "Sales pipelines stall in the proof-of-concept phase"',
  },
];
