import { BookOpen, Code2, ExternalLink, FileText, Scale } from 'lucide-react';

/**
 * Shared documentation / project links, consumed by BOTH the About dialog and
 * the Help dialog so the two can never drift on URLs or copy.
 *
 * Why links go to `/…` not `github.com/…`: `scripts/build-docs-bundle.mjs`
 * renders the markdown sources (USER_GUIDE / NOTICES / SECURITY) to HTML and
 * copies the book PDF/EPUB into `public/` at build time; Vite bundles all of
 * them into `dist/`, so they serve from the branded subdomain and the service
 * worker caches them for offline reading.
 *
 * NOTE: the security link carries a build-time `__SECURITY_AUDIT_LABEL__` and so
 * stays local to AboutDialog — keeping THIS module free of build-define globals
 * means any consumer (e.g. the Help dialog) can import it without seeding them.
 */
export const BOOK_PDF_PATH = '/Causal-Thinking-with-TP-Studio.pdf';
export const BOOK_EPUB_PATH = '/Causal-Thinking-with-TP-Studio.epub';
export const USER_GUIDE_PATH = '/user-guide.html';
export const NOTICES_PATH = '/notices.html';
export const GITHUB_URL = 'https://github.com/dannbleeker/tp-studio';

export type LinkRow = {
  href: string;
  Icon: typeof BookOpen;
  label: string;
  hint?: string;
  external?: boolean;
};

export const USER_GUIDE_LINK: LinkRow = {
  href: USER_GUIDE_PATH,
  Icon: FileText,
  label: 'User Guide',
  hint: 'Reference for every feature and shortcut.',
};

export const BOOK_PDF_LINK: LinkRow = {
  href: BOOK_PDF_PATH,
  Icon: BookOpen,
  label: 'Causal Thinking with TP Studio (PDF)',
  hint: 'The practitioner book — ~50,000 words, 17 chapters. Best for desktop reading.',
};

export const BOOK_EPUB_LINK: LinkRow = {
  href: BOOK_EPUB_PATH,
  Icon: BookOpen,
  label: 'Causal Thinking with TP Studio (EPUB)',
  hint: 'Same book, reflowable. Email to your Kindle or open in any e-reader app.',
};

export const NOTICES_LINK: LinkRow = {
  href: NOTICES_PATH,
  Icon: Scale,
  label: 'Third-party notices & trademarks',
};

export const GITHUB_LINK: LinkRow = {
  href: GITHUB_URL,
  Icon: Code2,
  label: 'Source code on GitHub',
  external: true,
};

/**
 * The "Learn TP Studio" subset the Help dialog surfaces — the User Guide first
 * (every feature + shortcut), then the practitioner book. Kept short so the Help
 * dialog's reference job (shortcuts + gestures) still leads below it.
 */
export const LEARN_LINKS: LinkRow[] = [USER_GUIDE_LINK, BOOK_PDF_LINK];

export function LinkRowItem({ href, Icon, label, hint, external }: LinkRow) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group -mx-2 flex items-start gap-3 rounded-md px-2 py-2 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
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
