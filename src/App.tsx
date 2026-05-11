import { Canvas } from './components/canvas/Canvas';
import { useDocumentStore } from './store';

function TitleBadge() {
  const title = useDocumentStore((s) => s.doc.title);
  const setTitle = useDocumentStore((s) => s.setTitle);
  const diagramType = useDocumentStore((s) => s.doc.diagramType);

  return (
    <div className="pointer-events-none absolute left-4 top-4 z-10 flex items-center gap-2">
      <input
        className="pointer-events-auto rounded-md bg-transparent px-2 py-1 text-sm font-medium text-neutral-900 outline-none transition focus:bg-white focus:shadow-sm dark:text-neutral-100 dark:focus:bg-neutral-900"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        size={Math.max(title.length, 6)}
      />
      <span className="rounded-full bg-neutral-200/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
        {diagramType}
      </span>
    </div>
  );
}

export function App() {
  return (
    <main className="relative h-full w-full">
      <TitleBadge />
      <Canvas />
    </main>
  );
}
