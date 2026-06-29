import { BookOpen, GraduationCap, Keyboard } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useDocumentStore } from '@/store';

/**
 * Session 183 — "Learn the method" routes to TP Studio's existing learning
 * surfaces rather than duplicating them: the User Guide (static HTML), the
 * keyboard/help dialog, and the About dialog (the method, the book, licences).
 * The dialogs stay mounted in App, so opening them from Start works.
 */
export function LearnSection() {
  const { openHelp, openAbout } = useDocumentStore(
    useShallow((s) => ({ openHelp: s.openHelp, openAbout: s.openAbout }))
  );

  const items = [
    {
      icon: BookOpen,
      title: 'User Guide',
      desc: 'A practitioner’s walkthrough of every feature, start to finish.',
      onClick: () => window.open('/user-guide.html', '_blank', 'noopener'),
    },
    {
      icon: Keyboard,
      title: 'Keyboard & shortcuts',
      desc: 'The fastest way to drive the canvas and the command palette.',
      onClick: openHelp,
    },
    {
      icon: GraduationCap,
      title: 'About & the book',
      desc: 'The method behind the tool, the practitioner’s book, licences, and version.',
      onClick: openAbout,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map(({ icon: Icon, title, desc, onClick }) => (
        <button
          key={title}
          type="button"
          onClick={onClick}
          className="flex flex-col gap-1.5 rounded-lg border border-neutral-200 bg-white p-4 text-left transition hover:border-accent-400 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-accent-500"
        >
          <Icon className="h-5 w-5 text-accent-600 dark:text-accent-400" aria-hidden />
          <h3 className="font-medium text-neutral-900 text-sm dark:text-neutral-100">{title}</h3>
          <p className="text-neutral-600 text-xs leading-snug dark:text-neutral-400">{desc}</p>
        </button>
      ))}
    </div>
  );
}
