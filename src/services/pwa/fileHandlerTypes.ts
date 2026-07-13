// Flying Logic file types for the PWA file-handler association. Shared by the web
// manifest (`vite.config.ts` → `file_handlers`) and the runtime launchQueue
// consumer (`fileHandlers.ts`). Kept deliberately import-free so `vite.config.ts`
// can pull it in without dragging the app graph into config evaluation.
//
// `.xlogic` is Flying Logic 4's user-saved extension; `.logicx` is what our own
// exporter writes; `.logic` is the older form. TP Studio already imports all three
// (`importFromFlyingLogic`) — these constants just let a double-click route them in.

/** A specific (non-IANA) MIME so the association targets only these extensions,
 *  never generic `application/xml`. */
export const FLYING_LOGIC_FILE_MIME = 'application/x-flying-logic+xml';

/** The Flying Logic extensions a double-click should open in TP Studio. */
export const FLYING_LOGIC_FILE_EXTENSIONS = ['.xlogic', '.logicx', '.logic'] as const;
