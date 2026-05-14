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
  FilePlus,
  FileUp,
  HelpCircle,
  History,
  Layout,
  Redo,
  Scissors,
  Search,
  Settings,
  Sparkles,
  Undo,
  Upload,
  Zap,
} from 'lucide-react';

export const COMMAND_ICON_BY_ID: Record<string, LucideIcon | undefined> = {
  // File / doc
  'new-diagram': FilePlus,
  'load-example': Sparkles,
  'open-quick-capture': Zap,
  'new-from-template': Sparkles,
  'import-json': FileUp,
  'import-flying-logic': FileUp,
  'import-mermaid': FileUp,
  'import-csv': FileUp,
  'open-document-inspector': FilePlus,
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
  // Export — Session 90 funnels everything through one picker. The
  // legacy per-format icons were retired with their commands.
  'open-export-picker': Download,
  // Capture surface (kept open-ended for additions; the empty default
  // is intentional — unknown ids render text-only).
  'upload-file': Upload,
};

export const iconForCommandId = (id: string): LucideIcon | undefined => COMMAND_ICON_BY_ID[id];
