import { exportToFlyingLogic, importFromFlyingLogic } from '@/domain/flyingLogic';
import type { TPDocument } from '@/domain/types';
import { pickFile } from './picker';
import { slug, triggerDownload } from './shared';

/**
 * Flying Logic XML round-trip — both the export and the import file picker
 * live here because they share the same wire format. The domain-layer
 * functions (`exportToFlyingLogic` / `importFromFlyingLogic`) do all the
 * actual XML work; this layer just wraps them in browser file primitives.
 */

export const exportFlyingLogic = (doc: TPDocument): void => {
  const xml = exportToFlyingLogic(doc);
  const blob = new Blob([xml], { type: 'application/xml' });
  triggerDownload(blob, `${slug(doc.title)}.logicx`);
};

/**
 * Browser file-picker wrapper for Flying Logic files. Accepts `.logicx`,
 * `.logic`, and `.xlogic` (Flying Logic 4's user-saved extension) and
 * returns the parsed `TPDocument`, or null when the user cancels / the
 * file fails to parse. Parse failures surface as a toast via `pickFile`.
 */
export const pickFlyingLogic = (): Promise<TPDocument | null> =>
  pickFile({
    accept: '.logicx,.logic,.xlogic,application/xml,text/xml',
    label: 'Flying Logic',
    parse: importFromFlyingLogic,
  });
