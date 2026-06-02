import { Shield, X } from 'lucide-react';
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
  label: 'Security & threat model',
  // Session 136 — surface the latest audit pointer here so it's visible without
  // clicking through (refreshes automatically when SECURITY.md's `Last
  // reviewed:` line moves forward).
  hint: `Last audit: ${__SECURITY_AUDIT_LABEL__}.`,
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
  const open = useDocumentStore((s) => s.aboutOpen);
  const close = useDocumentStore((s) => s.closeAbout);

  return (
    <Modal open={open} onDismiss={close} widthClass="max-w-md" labelledBy="about-title">
      <header className="flex items-center justify-between border-neutral-200 border-b px-4 py-3 dark:border-neutral-800">
        <h2
          id="about-title"
          className="font-semibold text-neutral-900 text-sm dark:text-neutral-100"
        >
          About TP Studio
        </h2>
        <Button variant="ghost" size="icon" onClick={close} aria-label="Close about">
          <X className="h-4 w-4" />
        </Button>
      </header>

      <div className="max-h-[70vh] space-y-5 overflow-y-auto px-4 py-4">
        {/* Tagline + build metadata */}
        <section>
          <p className="text-neutral-700 text-sm leading-relaxed dark:text-neutral-300">
            A practitioner-focused canvas for Theory of Constraints Thinking Process diagrams. Open
            source, local-first, runs in your browser.
          </p>
          <p className="mt-3 text-neutral-500 text-xs dark:text-neutral-400">
            Version {__APP_VERSION__} · Build {__BUILD_DATE__}
          </p>
        </section>

        {/* Read more */}
        <section>
          <h3 className="mb-1.5 font-semibold text-[10px] text-neutral-500 uppercase tracking-wider dark:text-neutral-400">
            Read more
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
            Project
          </h3>
          <div className="-mx-2">
            {PROJECT.map((row) => (
              <LinkRowItem key={row.href} {...row} />
            ))}
          </div>
        </section>

        {/* Copyright + trademark notice */}
        <footer className="border-neutral-200 border-t pt-4 text-[11px] text-neutral-500 leading-relaxed dark:border-neutral-800 dark:text-neutral-400">
          © {__COPYRIGHT_YEARS__} Dann Bleeker Pedersen. &quot;Flying Logic&quot; is a trademark of
          its owner. See{' '}
          <a
            href={NOTICES_PATH}
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-700 underline dark:text-indigo-300"
          >
            third-party notices
          </a>{' '}
          for full attribution.
        </footer>
      </div>
    </Modal>
  );
}
