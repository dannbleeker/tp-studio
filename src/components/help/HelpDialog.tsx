import { X } from 'lucide-react';
import { type ShortcutGroup, shortcutGroupTitle, shortcutsByGroupFor } from '@/domain/shortcuts';
import type { Messages } from '@/i18n/types';
import { useT } from '@/i18n/useT';
import { useDocumentStore } from '@/store';
import { LEARN_LINKS, LinkRowItem } from '../about/docLinks';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';

/**
 * The four section headings, in the order the dialog renders them. Stored
 * as a const tuple so renaming or reordering is a single edit. The
 * underlying rows come from `SHORTCUTS_BY_GROUP` so this file no longer
 * carries its own per-row list — registry drift is impossible.
 */
const GROUP_ORDER: ShortcutGroup[] = ['global', 'entity', 'group', 'canvas'];

/**
 * Session 92 (UI bigger asks #27 + #28) — pointer-gesture affordances.
 *
 * The shortcut registry only carries keyboard bindings, but TP Studio
 * has several pointer-based affordances that are useful but hidden
 * (no menu entry, no toolbar button). The FirstEntityTip surfaces
 * these on first use, but auto-hides past 2 entities; the Help
 * dialog is the durable surface — always reachable via `?` /
 * palette / kebab, never auto-hidden.
 *
 * Keeping the list inline (not in the registry) because the registry's
 * `keys` field assumes a keyboard binding; gestures don't have one.
 */
const GESTURE_ORDER = [
  'marquee',
  'splice',
  'connect',
  'altConnect',
  'pin',
  'rename',
] as const satisfies readonly (keyof Messages['help']['gesture'])[];

export function HelpDialog() {
  const t = useT();
  const byGroup = shortcutsByGroupFor(t);
  const open = useDocumentStore((s) => s.helpOpen);
  const close = useDocumentStore((s) => s.closeHelp);
  // Session 111 — footer link to the About dialog. Cheap discovery
  // path: users who hit Help looking for "what is this thing" land
  // on the About dialog instead of bouncing back out empty-handed.
  const openAbout = useDocumentStore((s) => s.openAbout);

  return (
    <Modal open={open} onDismiss={close} widthClass="max-w-md" labelledBy="help-title">
      <header className="flex items-center justify-between border-neutral-200 border-b px-4 py-3 dark:border-neutral-800">
        <h2
          id="help-title"
          className="font-semibold text-neutral-900 text-sm dark:text-neutral-100"
        >
          {t.help.title}
        </h2>
        <Button variant="ghost" size="icon" onClick={close} aria-label={t.help.close}>
          <X className="h-4 w-4" />
        </Button>
      </header>
      <div className="max-h-[70vh] space-y-4 overflow-y-auto px-4 py-3">
        {/* Session 153 — "?" is now a real Help entry, not just a shortcuts
            list: lead with the User Guide + practitioner book, then the keyboard
            and gesture reference below. Links shared with the About dialog via
            `docLinks` so the two can't drift. */}
        <section>
          <h3 className="mb-1.5 font-semibold text-[10px] text-neutral-500 uppercase tracking-wider dark:text-neutral-400">
            {t.help.learn}
          </h3>
          <div className="-mx-2">
            {LEARN_LINKS.map((row) => (
              <LinkRowItem key={row.href} {...row} />
            ))}
          </div>
        </section>
        {GROUP_ORDER.map((group) => {
          const rows = byGroup[group];
          if (rows.length === 0) return null;
          return (
            <section key={group}>
              <h3 className="mb-1.5 font-semibold text-[10px] text-neutral-500 uppercase tracking-wider dark:text-neutral-400">
                {shortcutGroupTitle(t, group)}
              </h3>
              <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 text-sm">
                {rows.map((r) => (
                  <div key={r.id} className="contents">
                    <dt className="text-neutral-700 dark:text-neutral-200">{r.label}</dt>
                    <dd>
                      <kbd className="rounded-sm border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 font-mono text-[11px] text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
                        {r.keys}
                      </kbd>
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          );
        })}
        {/* Session 92 — pointer-gesture affordances. See the GESTURES
            const above for rationale. Rendered after the keyboard
            sections so users who came for keys see those first. */}
        <section>
          <h3 className="mb-1.5 font-semibold text-[10px] text-neutral-500 uppercase tracking-wider dark:text-neutral-400">
            {t.help.gestures}
          </h3>
          <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 text-sm">
            {GESTURE_ORDER.map((key) => {
              const g = t.help.gesture[key];
              return (
                <div key={key} className="contents">
                  <dt className="text-neutral-700 dark:text-neutral-200">{g.label}</dt>
                  <dd>
                    <span className="rounded-sm border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 text-[11px] text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
                      {g.gesture}
                    </span>
                  </dd>
                </div>
              );
            })}
          </dl>
        </section>
        {/* Session 111 — link to About dialog. The Help dialog is
            where users look for "what is this thing"; the link
            forwards them to the About surface that actually carries
            tagline / version / docs / source / trademarks. */}
        <section className="border-neutral-200 border-t pt-3 dark:border-neutral-800">
          <button
            type="button"
            onClick={() => {
              close();
              openAbout();
            }}
            className="text-accent-600 text-xs hover:underline dark:text-accent-400"
          >
            {t.help.aboutLink}
          </button>
        </section>
      </div>
    </Modal>
  );
}
