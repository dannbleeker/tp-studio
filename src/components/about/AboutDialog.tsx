import { Shield, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useT } from '@/i18n/useT';
import { useDocumentStore } from '@/store';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import {
  BOOK_EPUB_LINK,
  BOOK_PDF_LINK,
  GITHUB_LINK,
  type LinkRow,
  LinkRowItem,
  NOTICES_LINK,
  NOTICES_PATH,
  USER_GUIDE_LINK,
} from './docLinks';

/**
 * Session 111 — About TP Studio dialog.
 *
 * The permanent in-app home for everything that isn't a feature surface:
 *   - what TP Studio *is* (tagline)
 *   - which build is running (version + date)
 *   - where to read more (the practitioner book, User Guide, security,
 *     third-party notices)
 *   - where the source code lives (one explicit GitHub link, intentional)
 *   - copyright + nominative-use trademark notice
 *
 * Session 153 — the doc links + their `LinkRowItem` renderer moved to
 * `./docLinks` so the Help dialog ("Learn TP Studio" section) and this dialog
 * share one source of truth. Build-path rationale lives there.
 *
 * Build metadata (version, date, copyright string) is injected via Vite
 * `define` — see `vite.config.ts`. The copyright string auto-rolls forward.
 */

// The security link carries the build-time audit label, so it stays here rather
// than in the shared `docLinks` module (which deliberately avoids build-define
// globals so any consumer can import it cleanly).
const SECURITY_PATH = '/security.html';
const SECURITY_LINK: LinkRow = {
  href: SECURITY_PATH,
  Icon: Shield,
  linkKey: 'security',
  // Session 136 — surface the latest audit pointer here so it's visible without
  // clicking through (refreshes automatically when SECURITY.md's `Last
  // reviewed:` line moves forward). The date is a build-time define, so it is a
  // PARAMETER to the catalogue entry rather than part of the copy.
  hintParams: { audit: __SECURITY_AUDIT_LABEL__ },
};

const READ_MORE: LinkRow[] = [
  BOOK_PDF_LINK,
  BOOK_EPUB_LINK,
  USER_GUIDE_LINK,
  SECURITY_LINK,
  NOTICES_LINK,
];

const PROJECT: LinkRow[] = [GITHUB_LINK];

export function AboutDialog() {
  const a = useT().about;
  const open = useDocumentStore((s) => s.aboutOpen);
  const close = useDocumentStore((s) => s.closeAbout);
  const openDiceGame = useDocumentStore((s) => s.openDiceGame);
  // Session 195 easter egg — five clicks on the version line open the dice
  // game (the second trigger besides the hidden palette command). The counter
  // resets whenever the dialog closes so a stray click doesn't linger.
  const [versionClicks, setVersionClicks] = useState(0);
  useEffect(() => {
    if (!open) setVersionClicks(0);
  }, [open]);
  const handleVersionClick = () => {
    const next = versionClicks + 1;
    if (next >= 5) {
      setVersionClicks(0);
      close();
      openDiceGame();
      return;
    }
    setVersionClicks(next);
  };

  return (
    <Modal open={open} onDismiss={close} widthClass="max-w-md" labelledBy="about-title">
      <header className="flex items-center justify-between border-neutral-200 border-b px-4 py-3 dark:border-neutral-800">
        <h2
          id="about-title"
          className="font-semibold text-neutral-900 text-sm dark:text-neutral-100"
        >
          {a.title}
        </h2>
        <Button variant="ghost" size="icon" onClick={close} aria-label={a.close}>
          <X className="h-4 w-4" />
        </Button>
      </header>

      <div className="max-h-[70vh] space-y-5 overflow-y-auto px-4 py-4">
        {/* Tagline + build metadata */}
        <section>
          <p className="text-neutral-700 text-sm leading-relaxed dark:text-neutral-300">
            {a.tagline}
          </p>
          {/* Deliberately unstyled-as-a-button: the egg shouldn't advertise
              itself. `select-text` keeps the version copyable. */}
          <button
            type="button"
            onClick={handleVersionClick}
            className="mt-3 cursor-text select-text text-left text-neutral-500 text-xs dark:text-neutral-400"
          >
            {a.versionLine({ version: __APP_VERSION__, build: __BUILD_DATE__ })}
          </button>
        </section>

        {/* Read more */}
        <section>
          <h3 className="mb-1.5 font-semibold text-[10px] text-neutral-500 uppercase tracking-wider dark:text-neutral-400">
            {a.readMore}
          </h3>
          <div className="-mx-2">
            {READ_MORE.map((row) => (
              <LinkRowItem key={row.href} {...row} />
            ))}
          </div>
        </section>

        {/* Project */}
        <section>
          <h3 className="mb-1.5 font-semibold text-[10px] text-neutral-500 uppercase tracking-wider dark:text-neutral-400">
            {a.project}
          </h3>
          <div className="-mx-2">
            {PROJECT.map((row) => (
              <LinkRowItem key={row.href} {...row} />
            ))}
          </div>
        </section>

        {/* Copyright + trademark notice */}
        <footer className="border-neutral-200 border-t pt-4 text-[11px] text-neutral-500 leading-relaxed dark:border-neutral-800 dark:text-neutral-400">
          {a.copyright({ years: __COPYRIGHT_YEARS__ })}{' '}
          <a
            href={NOTICES_PATH}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent-700 underline dark:text-accent-300"
          >
            {a.noticesLinkText}
          </a>{' '}
          {a.copyrightTail}
        </footer>
      </div>
    </Modal>
  );
}
