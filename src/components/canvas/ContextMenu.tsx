import { useEffect, useRef } from 'react';
import {
  ENTITY_TYPE_META,
  PALETTE_BY_DIAGRAM,
  defaultEntityType,
} from '../../domain/entityTypeMeta';
import { confirmAndDeleteEntity } from '../../services/confirmations';
import { useDocumentStore } from '../../store';

type MenuItem =
  | { kind: 'action'; label: string; destructive?: boolean; run: () => void }
  | { kind: 'separator' }
  | { kind: 'header'; label: string };

export function ContextMenu() {
  const menu = useDocumentStore((s) => s.contextMenu);
  const close = useDocumentStore((s) => s.closeContextMenu);
  const addEntity = useDocumentStore((s) => s.addEntity);
  const connect = useDocumentStore((s) => s.connect);
  const deleteEdge = useDocumentStore((s) => s.deleteEdge);
  const beginEditing = useDocumentStore((s) => s.beginEditing);
  const updateEntity = useDocumentStore((s) => s.updateEntity);
  const diagramType = useDocumentStore((s) => s.doc.diagramType);
  const entity = useDocumentStore((s) =>
    menu.open && menu.target.kind === 'entity' ? s.doc.entities[menu.target.id] : undefined
  );

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
    if (menu.target.kind === 'entity' && entity) {
      const id = menu.target.id;
      const convertOptions = PALETTE_BY_DIAGRAM[diagramType].filter((t) => t !== entity.type);
      return [
        {
          kind: 'action',
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
          kind: 'action',
          label: 'Add parent',
          run: () => {
            const e = addEntity({
              type: defaultEntityType(diagramType),
              startEditing: true,
            });
            connect(e.id, id);
          },
        },
        { kind: 'action', label: 'Rename', run: () => beginEditing(id) },
        { kind: 'separator' },
        { kind: 'header', label: 'Convert to' },
        ...convertOptions.map<MenuItem>((type) => ({
          kind: 'action',
          label: ENTITY_TYPE_META[type].label,
          run: () => updateEntity(id, { type }),
        })),
        { kind: 'separator' },
        {
          kind: 'action',
          label: 'Delete entity',
          destructive: true,
          run: () => confirmAndDeleteEntity(id),
        },
      ];
    }
    if (menu.target.kind === 'edge') {
      const id = menu.target.id;
      return [
        {
          kind: 'action',
          label: 'Delete edge',
          destructive: true,
          run: () => deleteEdge(id),
        },
      ];
    }
    return [
      {
        kind: 'action',
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
      {items.map((item, idx) => {
        const stableKey =
          item.kind === 'separator'
            ? `sep:${idx}`
            : item.kind === 'header'
              ? `hdr:${item.label}`
              : `act:${item.label}`;
        if (item.kind === 'separator') {
          return <div key={stableKey} className="my-1 h-px bg-neutral-200 dark:bg-neutral-800" />;
        }
        if (item.kind === 'header') {
          return (
            <div
              key={stableKey}
              className="px-3 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400"
            >
              {item.label}
            </div>
          );
        }
        return (
          <button
            key={stableKey}
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
        );
      })}
    </div>
  );
}
