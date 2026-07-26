import { useCallback } from 'react';
import type { Warning, WarningAction } from '@/domain/types';
import { resolveClrActionLabel, resolveClrMessage } from './clr';
import { useT } from './useT';

/**
 * React-side resolvers for CLR copy.
 *
 * Kept OUT of `clr.ts` on purpose: `clr.ts` is imported by
 * `domain/validators/shared.ts`, and pulling `useT` (and therefore `@/store`)
 * in through that path would create a domain → store import cycle. `clr.ts`
 * stays React-free; anything that needs the active locale lives here.
 *
 * Both resolvers fall back to the English string the validator already
 * rendered, so a warning produced before this seam existed — or one whose key
 * is missing from a partially-translated locale — still shows real copy
 * rather than a blank or a raw key.
 */
export const useClrText = (): {
  message: (warning: Warning) => string;
  actionLabel: (action: WarningAction) => string;
} => {
  const messages = useT();

  const message = useCallback(
    (warning: Warning): string =>
      warning.messageKey
        ? resolveClrMessage(messages, warning.messageKey, warning.params, warning.message)
        : warning.message,
    [messages]
  );

  const actionLabel = useCallback(
    (action: WarningAction): string =>
      resolveClrActionLabel(messages, action.actionId, action.label),
    [messages]
  );

  return { message, actionLabel };
};
