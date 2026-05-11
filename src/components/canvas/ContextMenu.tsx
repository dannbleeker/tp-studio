import { useEffect, useRef } from 'react';
import { defaultEntityType } from '../../domain/entityTypeMeta';
import { useDocumentStore } from '../../store';

type MenuItem = {
  label: string;
  destructive?: boolean;
  run: () => void;
};

export function ContextMenu() {
  const menu = useDocumentStore((s) => s.contextMenu);
  const close = useDocumentStore((s) => s.closeContextMenu);
  const addEntity = useDocumentStore((s) => s.addEntity);
  const connect = useDocumentStore((s) => s.connect);
  const deleteEntity = useDocumentStore((s) => s.deleteEntity);
  const deleteEdge = useDocumentStore((s) => s.deleteEdge);
  const beginEditing = useDocumentStore((s) => s.beginEditing);
  const diagramType = useDocumentStore((s) => s.doc.diagramType);

  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menu.open) return undefined;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('mousedown', handler);
    window.addEventListener('keydown', keyHandler);
    return () => {
      window.removeEventListener('mousedown', handler);
      window.removeEventListener('keydown', keyHandler);
    };
  }, [menu.open, close]);

  if (!menu.open) return null;

  const items: MenuItem[] = (() => {
    if (menu.target.kind === 'entity') {
      const id = menu.target.id;
      return [
        {
          label: 'Add child',
          run: () => {
            const e = addEntity({
              type: defaultEntityType(diagramType),
              startEditing: true,
            });
            connect(id, e.id);
          },
        },
        {
          label: 'Add parent',
          run: () => {
            const e = addEntity({
              type: defaultEntityType(diagramType),
              startEditing: true,
            });
            connect(e.id, id);
          },
        },
        {
          label: 'Rename',
          run: () => beginEditing(id),
        },
        {
          label: 'Delete entity',
          destructive: true,
          run: () => deleteEntity(id),
        },
      ];
    }
    if (menu.target.kind === 'edge') {
      const id = menu.target.id;
      return [
        {
          label: 'Delete edge',
          destructive: true,
          run: () => deleteEdge(id),
        },
      ];
    }
    return [
      {
        label: 'New entity here',
        run: () =>
          addEntity({
            type: defaultEntityType(diagramType),
            startEditing: true,
          }),
      },
    ];
  })();

  return (
    <div
      ref={ref}
      className="fixed z-40 min-w-[180px] overflow-hidden rounded-md border border-neutral-200 bg-white py-1 shadow-lg dark:border-neutral-800 dark:bg-neutral-950"
      style={{ top: menu.y, left: menu.x }}
      role="menu"
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          role="menuitem"
          onClick={() => {
            close();
            item.run();
          }}
          className={
            item.destructive
              ? 'flex w-full items-center justify-between px-3 py-1.5 text-left text-sm text-red-700 transition hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/30'
              : 'flex w-full items-center justify-between px-3 py-1.5 text-left text-sm text-neutral-700 transition hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-900'
          }
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
