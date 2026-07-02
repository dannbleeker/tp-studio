import { PromptDialog } from '@/components/ui/PromptDialog';
import { useDocumentStore } from '@/store';

/**
 * App-layer connector for the store-free `<PromptDialog>` shell — sibling of
 * `ConfirmDialogHost`. The store's `prompt(message): Promise<string | null>`
 * action stashes a pending resolver in `promptDialog`; this host bridges that
 * state to the prop-driven dialog and settles the promise via `resolvePrompt`.
 * Submit resolves with the raw string (matching `window.prompt` — an empty
 * submit is `''`, not a cancel); Cancel / Esc resolve `null`. Mounted once at
 * the App root next to the other dialog hosts.
 */
export function PromptDialogHost() {
  const promptDialog = useDocumentStore((s) => s.promptDialog);
  const resolvePrompt = useDocumentStore((s) => s.resolvePrompt);

  return (
    <PromptDialog
      open={promptDialog !== null}
      message={promptDialog?.message ?? ''}
      defaultValue={promptDialog?.defaultValue ?? ''}
      placeholder={promptDialog?.placeholder ?? ''}
      confirmLabel={promptDialog?.confirmLabel ?? 'OK'}
      onSubmit={(value) => resolvePrompt(value)}
      onCancel={() => resolvePrompt(null)}
    />
  );
}
