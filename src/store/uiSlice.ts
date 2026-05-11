import type { StateCreator } from 'zustand';
import { TOAST_AUTO_DISMISS_MS } from '../domain/constants';
import type { RootStore } from './index';

export type Selection =
  | { kind: 'entity'; id: string }
  | { kind: 'edge'; id: string }
  | { kind: 'none' };

export type Theme = 'light' | 'dark';

export type ContextMenuTarget =
  | { kind: 'entity'; id: string }
  | { kind: 'edge'; id: string }
  | { kind: 'pane' };

export type ContextMenuState =
  | { open: true; x: number; y: number; target: ContextMenuTarget }
  | { open: false };

export type ToastKind = 'info' | 'success' | 'error';
export type Toast = { id: number; kind: ToastKind; message: string };

const STORAGE_THEME_KEY = 'tp-studio:theme';

const readInitialTheme = (): Theme => {
  if (typeof globalThis.localStorage === 'undefined') return 'light';
  return globalThis.localStorage.getItem(STORAGE_THEME_KEY) === 'dark' ? 'dark' : 'light';
};

const writeTheme = (theme: Theme): void => {
  if (typeof globalThis.localStorage === 'undefined') return;
  globalThis.localStorage.setItem(STORAGE_THEME_KEY, theme);
};

export type UISlice = {
  selection: Selection;
  editingEntityId: string | null;
  paletteOpen: boolean;
  paletteInitialQuery: string;
  helpOpen: boolean;
  theme: Theme;
  contextMenu: ContextMenuState;
  toasts: Toast[];

  select: (sel: Selection) => void;
  beginEditing: (id: string) => void;
  endEditing: () => void;

  openPalette: () => void;
  openPaletteWithQuery: (query: string) => void;
  closePalette: () => void;
  togglePalette: () => void;

  openHelp: () => void;
  closeHelp: () => void;

  openContextMenu: (target: ContextMenuTarget, x: number, y: number) => void;
  closeContextMenu: () => void;

  showToast: (kind: ToastKind, message: string) => void;
  dismissToast: (id: number) => void;

  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

export const createUISlice: StateCreator<RootStore, [], [], UISlice> = (set, get) => ({
  selection: { kind: 'none' },
  editingEntityId: null,
  paletteOpen: false,
  paletteInitialQuery: '',
  helpOpen: false,
  theme: readInitialTheme(),
  contextMenu: { open: false },
  toasts: [],

  select: (selection) => set({ selection }),
  beginEditing: (id) => set({ editingEntityId: id, selection: { kind: 'entity', id } }),
  endEditing: () => set({ editingEntityId: null }),

  openPalette: () => set({ paletteOpen: true, paletteInitialQuery: '' }),
  openPaletteWithQuery: (query) => set({ paletteOpen: true, paletteInitialQuery: query }),
  closePalette: () => set({ paletteOpen: false }),
  togglePalette: () => set({ paletteOpen: !get().paletteOpen, paletteInitialQuery: '' }),

  openHelp: () => set({ helpOpen: true }),
  closeHelp: () => set({ helpOpen: false }),

  openContextMenu: (target, x, y) => set({ contextMenu: { open: true, target, x, y } }),
  closeContextMenu: () => set({ contextMenu: { open: false } }),

  showToast: (kind, message) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    set({ toasts: [...get().toasts, { id, kind, message }] });
    setTimeout(() => {
      set({ toasts: get().toasts.filter((t) => t.id !== id) });
    }, TOAST_AUTO_DISMISS_MS);
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),

  setTheme: (theme) => {
    writeTheme(theme);
    set({ theme });
  },
  toggleTheme: () => {
    const next: Theme = get().theme === 'dark' ? 'light' : 'dark';
    writeTheme(next);
    set({ theme: next });
  },
});
