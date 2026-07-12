import type { TPDocument } from '../types';
import { buildECPattern } from './ec-shared';

/**
 * Pattern: Call the customer vs follow the procedure (Evaporating Cloud).
 *
 * The fire-fighting conflict Cohen works in the *TOC Handbook* (Ch. 24, "Daily
 * Management with TOC"), abstracted: an order is ready to ship but a shipping
 * detail is missing, and the one person allowed to call the customer is away.
 * The clerk needs the detail now to get the order out; the standing procedure
 * exists to keep customer contact consistent. It is the classic fire-fighting
 * shape — a one-off blaze whose real fix is amending the rule so it can't
 * recur. Pairs with the "nbr-contact-customer" negative branch, which
 * interrogates the obvious injection. Node text is original; no names.
 */
export const buildPatternECContactVsProcedure = (): TPDocument =>
  buildECPattern({
    title: 'Call the customer vs follow the procedure (fire-fighting cloud)',
    objective: 'Ship every order correctly and on time',
    need1: 'Get the missing shipping detail now',
    need2: 'Keep customer contact consistent and professional',
    want1: 'Let the shipping clerk call the customer directly',
    want2: 'Only the account manager ever calls the customer',
    assumptions: [
      {
        arrow: 'd-b',
        text: "If the clerk waits for the account manager to return, the detail won't arrive before the order is due.",
      },
      {
        arrow: 'dPrime-c',
        text: 'Anyone other than the account manager calling will confuse the customer and look unprofessional.',
      },
    ],
    notes: [
      {
        text: 'Injection: let the clerk call only when the account manager is unavailable — but test it first (see the paired NBR).',
        anchor: 'a',
        position: { x: 60, y: 440 },
      },
    ],
  });
