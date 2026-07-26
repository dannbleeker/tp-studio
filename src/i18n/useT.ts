import { useEffect, useSyncExternalStore } from 'react';
import { useDocumentStore } from '@/store';
import { en } from './locales/en';
import { peekMessages, preloadLocale, subscribeMessages } from './registry';
import type { Messages } from './types';

/**
 * Access the active locale's catalogue.
 *
 * Returns the catalogue OBJECT rather than a `t('some.key')` lookup function.
 * Call sites read `t.settings.appearance.theme`, which means every access is
 * checked by `tsc` against `Messages` — a typo is a compile error, not a
 * missing-key placeholder at runtime — and there is no runtime key parsing.
 *
 * The `useSyncExternalStore` subscription exists only so a locale switch
 * re-renders once its chunk resolves; until then `peekMessages` returns
 * English, so there is never an empty or key-shaped flash.
 */
export const useT = (): Messages => {
  const locale = useDocumentStore((s) => s.locale);

  // The load is a side effect and belongs in an effect, not in the
  // `useSyncExternalStore` snapshot — React may call a snapshot repeatedly and
  // expects it to be pure.
  useEffect(() => {
    void preloadLocale(locale);
  }, [locale]);

  return useSyncExternalStore(
    subscribeMessages,
    () => peekMessages(locale),
    // Server/initial snapshot: English is statically imported, so it is always
    // available without waiting on a chunk.
    () => en
  );
};
