import { validationFingerprint } from '@/domain/fingerprint';
import type { Warning } from '@/domain/types';
import { validate } from '@/domain/validators';
import { useFingerprintMemo } from '@/hooks/useFingerprintMemo';
import { useDocumentStore } from '@/store';
import { currentDoc } from '@/store/selectors';

/**
 * The active document's full CLR warning set, memoized on the validation
 * fingerprint. `validate` is globally cached (per-doc WeakMap + a fingerprint
 * LRU), so every caller — the TopBar Logic chip, the CLR panel, and the
 * Inspector's WarningsList — shares ONE computed `Warning[]`; the open count
 * can't drift between them.
 */
export const useDocWarnings = (): Warning[] => {
  const doc = useDocumentStore((s) => currentDoc(s));
  return useFingerprintMemo(() => validate(doc), validationFingerprint(doc));
};
