import { useEffect } from 'react';
import { defaultEntityType } from '../domain/entityTypeMeta';
import { getCanvasNodes } from '../services/canvasRef';
import { confirmAndDeleteEntity } from '../services/confirmations';
import { useDocumentStore } from '../store';

const isEditableTarget = (target: EventTarget | null): boolean => {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable;
};

export function useGlobalKeyboard() {
  const togglePalette = useDocumentStore((s) => s.togglePalette);
  const closePalette = useDocumentStore((s) => s.closePalette);
  const closeHelp = useDocumentStore((s) => s.closeHelp);
  const undo = useDocumentStore((s) => s.undo);
  const redo = useDocumentStore((s) => s.redo);
  const select = useDocumentStore((s) => s.select);
  const addEntity = useDocumentStore((s) => s.addEntity);
  const connect = useDocumentStore((s) => s.connect);
  const beginEditing = useDocumentStore((s) => s.beginEditing);
  const deleteEdge = useDocumentStore((s) => s.deleteEdge);
  const showToast = useDocumentStore((s) => s.showToast);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const cmdOrCtrl = e.metaKey || e.ctrlKey;
      const inField = isEditableTarget(e.target);

      // Cmd/Ctrl+K — palette (works anywhere)
      if (cmdOrCtrl && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        togglePalette();
        return;
      }

      // Cmd/Ctrl+S — surface save toast (data persists automatically on every mutation)
      if (cmdOrCtrl && e.key.toLowerCase() === 's') {
        e.preventDefault();
        showToast('success', 'Saved to this browser.');
        return;
      }

      // Cmd/Ctrl+E — open the palette pre-filtered to Export commands.
      if (cmdOrCtrl && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        useDocumentStore.getState().openPaletteWithQuery('Export');
        return;
      }

      // Escape — close help / palette / deselect
      if (e.key === 'Escape') {
        const state = useDocumentStore.getState();
        if (state.helpOpen) {
          closeHelp();
          return;
        }
        if (state.paletteOpen) {
          closePalette();
          return;
        }
        if (state.editingEntityId !== null) {
          // node textarea will handle its own escape; let it bubble
          return;
        }
        select({ kind: 'none' });
        return;
      }

      // Cmd/Ctrl+Z — undo / Cmd/Ctrl+Shift+Z — redo (skip when typing)
      if (cmdOrCtrl && e.key.toLowerCase() === 'z') {
        if (inField) return;
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }

      // Per-selection shortcuts
      const { selection, doc } = useDocumentStore.getState();

      if (e.key === 'Enter' && !inField && selection.kind === 'entity') {
        e.preventDefault();
        beginEditing(selection.id);
        return;
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && !inField) {
        if (selection.kind === 'entity') {
          e.preventDefault();
          confirmAndDeleteEntity(selection.id);
          return;
        }
        if (selection.kind === 'edge') {
          e.preventDefault();
          deleteEdge(selection.id);
          return;
        }
      }

      if (e.key === 'Tab' && !inField && selection.kind === 'entity') {
        e.preventDefault();
        const newEntity = addEntity({
          type: defaultEntityType(doc.diagramType),
          startEditing: true,
        });
        if (e.shiftKey) {
          // create parent: new -> selected
          connect(newEntity.id, selection.id);
        } else {
          // create child: selected -> new
          connect(selection.id, newEntity.id);
        }
        return;
      }

      // Arrow-key navigation among connected entities.
      // Layout is bottom-up: effects are visually above causes.
      // ArrowUp → effect (target of an outgoing edge).
      // ArrowDown → cause (source of an incoming edge).
      // ArrowLeft / ArrowRight → sibling at the same rank (using live RF positions).
      if (!inField && selection.kind === 'entity') {
        const edges = Object.values(doc.edges);
        let nextId: string | undefined;

        if (e.key === 'ArrowUp') {
          const out = edges.find((edge) => edge.sourceId === selection.id);
          if (out) nextId = out.targetId;
        } else if (e.key === 'ArrowDown') {
          const inc = edges.find((edge) => edge.targetId === selection.id);
          if (inc) nextId = inc.sourceId;
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          const rfNodes = getCanvasNodes();
          const current = rfNodes.find((n) => n.id === selection.id);
          if (current) {
            const rowThreshold = 60; // px tolerance for "same rank"
            const direction = e.key === 'ArrowRight' ? 1 : -1;
            const candidates = rfNodes.filter(
              (n) =>
                n.id !== current.id &&
                Math.abs(n.position.y - current.position.y) <= rowThreshold &&
                Math.sign(n.position.x - current.position.x) === direction
            );
            candidates.sort(
              (a, b) =>
                Math.abs(a.position.x - current.position.x) -
                Math.abs(b.position.x - current.position.x)
            );
            nextId = candidates[0]?.id;
          }
        }

        if (nextId) {
          e.preventDefault();
          select({ kind: 'entity', id: nextId });
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [
    togglePalette,
    closePalette,
    closeHelp,
    undo,
    redo,
    select,
    addEntity,
    connect,
    beginEditing,
    deleteEdge,
    showToast,
  ]);
}
