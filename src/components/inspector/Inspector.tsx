import { validate } from '@/domain/validators';
import { useDocumentStore } from '@/store';
import clsx from 'clsx';
import { X } from 'lucide-react';
import { useMemo } from 'react';
import { Button } from '../ui/Button';
import { EdgeInspector } from './EdgeInspector';
import { EntityInspector } from './EntityInspector';

export function Inspector() {
  const selection = useDocumentStore((s) => s.selection);
  const doc = useDocumentStore((s) => s.doc);
  const select = useDocumentStore((s) => s.select);

  const open = selection.kind !== 'none';

  const warnings = useMemo(() => validate(doc), [doc]);

  return (
    <aside
      className={clsx(
        'absolute right-0 top-0 z-10 h-full w-[320px] transform transition-transform duration-200 ease-out',
        'border-l border-neutral-200 bg-white/95 backdrop-blur',
        'dark:border-neutral-800 dark:bg-neutral-950/95',
        open ? 'translate-x-0' : 'translate-x-full'
      )}
      aria-hidden={!open}
    >
      <div className="flex h-full flex-col">
        <header className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            {selection.kind === 'entity' ? 'Entity' : selection.kind === 'edge' ? 'Edge' : ''}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => select({ kind: 'none' })}
            aria-label="Close inspector"
          >
            <X className="h-4 w-4" />
          </Button>
        </header>
        <div className="flex-1 overflow-y-auto p-4">
          {selection.kind === 'entity' && (
            <EntityInspector
              entityId={selection.id}
              warnings={warnings.filter(
                (w) => w.target.kind === 'entity' && w.target.id === selection.id
              )}
            />
          )}
          {selection.kind === 'edge' && (
            <EdgeInspector
              edgeId={selection.id}
              warnings={warnings.filter(
                (w) => w.target.kind === 'edge' && w.target.id === selection.id
              )}
            />
          )}
        </div>
      </div>
    </aside>
  );
}
