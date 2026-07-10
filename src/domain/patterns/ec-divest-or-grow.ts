import type { TPDocument } from '../types';
import { buildECPattern } from './ec-shared';

/**
 * Pattern: Divest or grow — the conglomerate cloud (Evaporating Cloud).
 *
 * The board-level conflict that animates Goldratt's *It's Not Luck* (1994),
 * abstracted: a group under credit pressure is pushed to sell the very
 * subsidiaries its long-term prosperity depends on. Immediate financial
 * relief (sell) and future profit engines (hold) both serve one objective,
 * so the same board genuinely wants both. The novel's resolution direction
 * rides as a note on D': improve the subsidiaries' market position until
 * the conflict dissolves — the sale either fetches full value or stops
 * being necessary. Node text is original; the pattern references the
 * novel's premise, not its scenes.
 */
export const buildPatternECDivestOrGrow = (): TPDocument =>
  buildECPattern({
    title: 'Divest-or-grow conglomerate cloud',
    objective: "Secure the group's long-term prosperity",
    need1: "Restore the group's cash position and credit standing now",
    need2: "Keep the profit engines the group's future depends on",
    want1: 'Sell the peripheral subsidiaries',
    want2: 'Hold and grow the subsidiaries',
    notes: [
      // The novel's resolution direction hangs off D′ (hold and grow).
      {
        text: 'Break the cloud by attacking the assumption that the subsidiaries cannot become more valuable before the deadline — make them worth keeping, or worth full price.',
        anchor: 'dPrime',
        position: { x: 1150, y: 560 },
      },
    ],
  });
