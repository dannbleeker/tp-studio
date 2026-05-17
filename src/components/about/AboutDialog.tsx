import { useDocumentStore } from '@/store';
import { BookOpen, Code2, ExternalLink, FileText, Scale, Shield, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';

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
 * Why a dedicated dialog instead of a HelpDialog subsection: the
 * HelpDialog is keyboard-shortcut-and-gesture-shaped — book links
 * buried in there read as footnotes. This dialog gives those
 * surfaces a discoverable home and gives the NOTICE.md /
 * SECURITY.md docs an in-app surface (they had no entry point
 * before).
 *
 * Why links go to `/...` not `github.com/...`: the markdown source
 * for NOTICE / SECURITY / USER_GUIDE is rendered to HTML at build
 * time by `scripts/build-docs-bundle.mjs`, and the book PDF is
 * copied into `public/` at the same time. Vite bundles all of them
 * into `dist/`, so they serve from the branded subdomain
 * (tp-studio.struktureretsundfornuft.dk/notices.html etc.) instead
 * of leaking the underlying GitHub hosting. Service worker picks
 * them up for offline reading.
 *
 * Build metadata (version, date, copyright string) is injected via
 * Vite `define` — see `vite.config.ts`. The copyright string
 * auto-rolls forward: "2026" today, "2026–2027" once we're in 2027,
 * etc. No code edit needed at year-rollover.
 */

const BOOK_PATH = '/Causal-Thinking-with-TP-Studio.pdf';
const USER_GUIDE_PATH = '/user-guide.html';
const SECURITY_PATH = '/security.html';
const NOTICES_PATH = '/notices.html';
const GITHUB_URL = 'https://github.com/dannbleeker/tp-studio';

type LinkRow = {
  href: string;
  Icon: typeof BookOpen;
  label: string;
  hint?: string;
  external?: boolean;
};

const READ_MORE: LinkRow[] = [
  {
    href: BOOK_PATH,
    Icon: BookOpen,
    label: 'Causal Thinking with TP Studio',
    hint: 'The practitioner book — ~50,000 words, 17 chapters.',
  },
  {
    href: USER_GUIDE_PATH,
    Icon: FileText,
    label: 'User Guide',
    hint: 'Reference for every feature and shortcut.',
  },
  {
    href: SECURITY_PATH,
    Icon: Shield,
    label: 'Security & threat model',
  },
  {
    href: NOTICES_PATH,
    Icon: Scale,
    label: 'Third-party notices & trademarks',
  },
];

const PROJECT: LinkRow[] = [
  {
    href: GITHUB_URL,
    Icon: Code2,
    label: 'Source code on GitHub',
    external: true,
  },
];

function LinkRowItem({ href, Icon, label, hint, external }: LinkRow) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="-mx-2 group flex items-start gap-3 rounded-md px-2 py-2 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-neutral-500 group-hover:text-indigo-500 dark:text-neutral-400" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 font-medium text-neutral-900 text-sm dark:text-neutral-100">
          {label}
          {external ? (
            <ExternalLink className="h-3 w-3 text-neutral-400 dark:text-neutral-500" />
          ) : null}
        </div>
        {hint ? <div className="text-neutral-500 text-xs dark:text-neutral-400">{hint}</div> : null}
      </div>
    </a>
  );
}

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
          © {__COPYRIGHT_YEARS__} Dann Pedersen. &quot;Flying Logic&quot; is a trademark of its
          owner. See{' '}
          <a
            href={NOTICES_PATH}
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-600 hover:underline dark:text-indigo-400"
          >
            third-party notices
          </a>{' '}
          for full attribution.
        </footer>
      </div>
    </Modal>
  );
}
