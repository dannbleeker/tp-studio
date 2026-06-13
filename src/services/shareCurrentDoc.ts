import { useDocumentStore } from '@/store';
import { currentDoc } from '@/store/selectors';
import { generateShareLink, SHARE_LINK_SOFT_WARN_BYTES } from './shareLink';

/**
 * Generate a read-only share link for the active document and copy it to the
 * clipboard (the quick TopBar "Share" action). Same flow as the Export picker's
 * "Copy read-only share link" item, surfaced as a one-click button.
 */
export const shareCurrentDoc = async (): Promise<void> => {
  const s = useDocumentStore.getState();
  try {
    const link = await generateShareLink(currentDoc(s));
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(link);
      const tooLarge = link.length > SHARE_LINK_SOFT_WARN_BYTES;
      s.showToast(
        tooLarge ? 'info' : 'success',
        tooLarge
          ? `Share link copied (${(link.length / 1024).toFixed(1)} KB). Large links may be truncated by some chat clients — consider exporting JSON instead.`
          : 'Read-only share link copied to clipboard.'
      );
    } else {
      s.showToast(
        'error',
        "This browser doesn't expose the clipboard API. Use the JSON export to share."
      );
    }
  } catch (err) {
    s.showToast('error', err instanceof Error ? err.message : 'Could not generate share link.');
  }
};
