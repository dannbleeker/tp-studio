import type { Entity } from '@/domain/types';
import { useDocumentStore } from '@/store';
import { LargeDialog } from '../ui/LargeDialog';
import { causalEntities, EntityPickerGrid } from './EntityPickerGrid';

/**
 * Session 135 / spec major gap #3 Phase 1B — entity-picker dialog for
 * cross-diagram imports.
 *
 * Opened by the "Import entity from another doc…" palette command after the user
 * has picked a TP Studio JSON file. The file is parsed up-front (a malformed doc
 * surfaces as an import error via the shared `pickFile` toast) and stashed on the
 * slice. On pick: `addImportedEntity` mints a new entity in the current doc with
 * `importedFrom` set; the dialog closes; the new entity becomes the active
 * selection so the inspector immediately shows the import-from badge. The
 * filterable entity grid is the shared `EntityPickerGrid`.
 */
export function ImportEntityPickerDialog() {
  const state = useDocumentStore((s) => s.importEntityPicker);
  const close = useDocumentStore((s) => s.closeImportEntityPicker);
  const addImportedEntity = useDocumentStore((s) => s.addImportedEntity);
  const showToast = useDocumentStore((s) => s.showToast);

  if (!state) return null;
  const { sourceDoc } = state;

  const handlePick = (sourceEntity: Entity): void => {
    const minted = addImportedEntity({ sourceDocId: sourceDoc.id, sourceEntity });
    if (!minted) {
      showToast('error', 'Could not import the selected entity.');
      return;
    }
    showToast(
      'success',
      `Imported "${sourceEntity.title || '(untitled)'}" from ${sourceDoc.title}.`
    );
    close();
  };

  return (
    <LargeDialog
      open={true}
      onClose={close}
      title={`Import entity from "${sourceDoc.title}"`}
      subtitle={`Pick one of the ${causalEntities(sourceDoc.entities).length} entities. The new entity in this doc will keep a back-reference to the source.`}
      closeAriaLabel="Close import-entity picker"
    >
      <EntityPickerGrid
        entities={sourceDoc.entities}
        customClasses={sourceDoc.customEntityClasses}
        onPick={handlePick}
        emptyLabel="The source document has no causally-meaningful entities to import."
        gridAriaLabel="Source-document entities"
        cardActionVerb="Import"
        cardDataComponent="import-entity-card"
      />
    </LargeDialog>
  );
}
