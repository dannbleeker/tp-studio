/**
 * Session 88 (S16) — central icon map for the command palette.
 *
 * The `Command` type carries an optional `icon?: LucideIcon` field; per-
 * file annotation across 9 command files would scatter the visual
 * contract over the code. This map keeps the icon decisions in one
 * place so a future audit can scan the visual identity of the
 * palette at a glance, and so new commands inherit nothing by
 * default (we want icons used deliberately, not sprinkled).
 *
 * Selection criteria: highest-traffic commands and commands whose
 * icon-form is already familiar (File → /; Undo / Redo arrows; the
 * keyboard for shortcuts, etc.). Less-used commands stay text-only
 * to avoid visual noise — the palette is a fallback for users who
 * forgot the keyboard shortcut, not a primary toolbar.
 */
import type { LucideIcon } from 'lucide-react';
import {
  Copy,
  Download,
  FileDown,
  FilePlus,
  FileUp,
  HelpCircle,
  History,
  Image as ImageIcon,
  Layout,
  Printer,
  Redo,
  Scissors,
  Search,
  Settings,
  Share2,
  Sparkles,
  Undo,
  Upload,
  Zap,
} from 'lucide-react';

export const COMMAND_ICON_BY_ID: Record<string, LucideIcon | undefined> = {
  // File / doc
  'open-quick-capture': Zap,
  'new-from-template': Sparkles,
  'import-json': FileUp,
  'import-flying-logic': FileUp,
  'import-mermaid': FileUp,
  'import-csv': FileUp,
  'open-document-inspector': FilePlus,
  'open-history-panel': History,
  'capture-snapshot': History,
  // Edit
  undo: Undo,
  redo: Redo,
  'copy-selection': Copy,
  'cut-selection': Scissors,
  'paste-clipboard': FilePlus,
  // View / nav
  'open-search': Search,
  'open-settings': Settings,
  'reset-layout': Layout,
  // Help
  help: HelpCircle,
  // Export — every flavour shares the same Download icon so the row
  // groups visually without forcing per-format glyphs.
  'export-json': Download,
  'export-json-redacted': Download,
  'export-flying-logic': Download,
  'export-mermaid': Download,
  'export-dot': Download,
  'export-opml': Download,
  'export-vgl': Download,
  'export-reasoning-narrative': Download,
  'export-reasoning-outline': Download,
  'export-html-viewer': Download,
  'export-csv': Download,
  'export-annotations-md': Download,
  'export-annotations-txt': Download,
  'export-png': ImageIcon,
  'export-jpeg': ImageIcon,
  'export-svg': ImageIcon,
  'export-ec-workshop-sheet': FileDown,
  'copy-share-link': Share2,
  print: Printer,
  // Capture surface (kept open-ended for additions; the empty default
  // is intentional — unknown ids render text-only).
  'upload-file': Upload,
};

export const iconForCommandId = (id: string): LucideIcon | undefined => COMMAND_ICON_BY_ID[id];
