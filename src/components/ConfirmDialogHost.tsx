import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useDocumentStore } from '@/store';

/**
 * App-layer connector for the store-free `<ConfirmDialog>` shell.
 *
 * The store exposes a `confirm(message): Promise<boolean>` action that
 * stashes a pending resolver in `confirmDialog`; this host is the bridge
 * between that store state and the prop-driven dialog. It reads the open
 * state + labels from the store and settles the promise via
 * `resolveConfirm` on the dialog's `onConfirm` / `onCancel` callbacks.
 *
 * Why the split (see `ui/README.md`): `ui/` primitives never call
 * `useDocumentStore()` so they're vendorable into other apps. All the
 * store coupling that used to live inside `ConfirmDialog` lives here
 * instead, in the app layer. Mounted once at the App root next to the
 * other dialogs.
 */
export function ConfirmDialogHost() {
  const confirmDialog = useDocumentStore((s) => s.confirmDialog);
  const resolveConfirm = useDocumentStore((s) => s.resolveConfirm);

  return (
    <ConfirmDialog
      open={confirmDialog !== null}
      confirmLabel={confirmDialog?.confirmLabel ?? 'Confirm'}
      cancelLabel={confirmDialog?.cancelLabel ?? 'Cancel'}
      onConfirm={() => resolveConfirm(true)}
      onCancel={() => resolveConfirm(false)}
    >
      {confirmDialog?.message ?? ''}
    </ConfirmDialog>
  );
}
