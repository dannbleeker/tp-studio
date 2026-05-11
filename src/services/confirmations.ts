import { connectionCount } from '@/domain/graph';
import { useDocumentStore } from '@/store';

export const confirmAndDeleteEntity = (id: string): void => {
  const { doc, deleteEntity } = useDocumentStore.getState();
  const entity = doc.entities[id];
  if (!entity) return;

  const connections = connectionCount(doc, id);
  if (connections > 0) {
    const title = entity.title.trim() || 'this entity';
    const plural = connections === 1 ? '' : 's';
    const ok = window.confirm(`Delete "${title}" and ${connections} connection${plural}?`);
    if (!ok) return;
  }
  deleteEntity(id);
};
