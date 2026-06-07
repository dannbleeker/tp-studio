import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExportPickerDialog } from '@/components/export/ExportPickerDialog';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { seedEntity } from '../../helpers/seedDoc';

/**
 * Entity-gated options in the Export picker.
 *
 * Three exports declare `requiresEntityType` so they don't surface an
 * empty-CSV trap on documents that lack the relevant entity:
 *   - "Risk register (CSV)"     → `ude`
 *   - "Task tracker CSV"        → `action`
 *   - "Prerequisite plan (CSV)" → `intermediateObjective`
 *
 * The `intermediateObjective` guard was declared when the PRT-plan export
 * shipped (Session 162) but never wired into the picker's filter, so the
 * option leaked onto every document. Each test below pins one guard by
 * asserting the option is hidden until its entity type is present.
 */

// ---------------------------------------------------------------------------
// Module-level mocks — hoisted so Vitest replaces them before any import of
// ExportPickerDialog.tsx executes. We return spy functions so individual
// tests can assert the right exporter was called.
// ---------------------------------------------------------------------------

vi.mock('@/services/exporters', () => ({
  exportAnnotationsMd: vi.fn(),
  exportAnnotationsTxt: vi.fn(),
  exportCSV: vi.fn(),
  exportDOT: vi.fn(),
  exportFlyingLogic: vi.fn(),
  exportHTMLViewer: vi.fn().mockResolvedValue(undefined),
  exportJPEG: vi.fn().mockResolvedValue(undefined),
  exportJSON: vi.fn(),
  exportMermaid: vi.fn(),
  exportOPML: vi.fn(),
  exportPNG: vi.fn().mockResolvedValue(undefined),
  exportPPTX: vi.fn().mockResolvedValue(undefined),
  exportPrtPlan: vi.fn().mockReturnValue(3),
  exportReasoningNarrativeMd: vi.fn(),
  exportReasoningOutlineMd: vi.fn(),
  exportRiskRegister: vi.fn().mockReturnValue(2),
  exportSVG: vi.fn().mockResolvedValue(undefined),
  exportTtTasks: vi.fn().mockReturnValue(4),
  exportVGL: vi.fn(),
}));

vi.mock('@/services/exporters/ecWorkshopExport', () => ({
  exportECWorkshopSheet: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/services/canvasRef', async () => {
  const actual =
    await vi.importActual<typeof import('@/services/canvasRef')>('@/services/canvasRef');
  return {
    ...actual,
    getCanvasNodes: vi.fn(() => []),
  };
});

vi.mock('@/services/shareLink', () => ({
  generateShareLink: vi.fn().mockResolvedValue('https://example.com/share/test'),
  SHARE_LINK_SOFT_WARN_BYTES: 65536,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const openPicker = (): void => {
  act(() => useDocumentStore.getState().openExportPicker());
};

/**
 * Each export card is a <button> containing two <span> children:
 *   - first span: the label (font-medium)
 *   - second span: the hint text
 * `textContent` returns label+hint concatenated, so we match by the
 * first span's text content.
 */
const clickButton = (container: HTMLElement, label: string): void => {
  const btn = Array.from(container.querySelectorAll('button')).find((b) => {
    const firstSpan = b.querySelector('span');
    return firstSpan?.textContent?.trim() === label;
  });
  if (!btn) throw new Error(`No export card button with label "${label}"`);
  act(() => fireEvent.click(btn));
};

beforeEach(() => {
  resetStoreForTest();
  vi.clearAllMocks();
});
afterEach(cleanup);

// ---------------------------------------------------------------------------
// Baseline rendering
// ---------------------------------------------------------------------------

describe('ExportPickerDialog — rendering', () => {
  it('renders nothing when exportPickerOpen is false', () => {
    const { container } = render(<ExportPickerDialog />);
    expect(container.querySelector('dialog')).toBeNull();
  });

  it('renders the dialog with the "Export" title when open', () => {
    openPicker();
    const { getByText } = render(<ExportPickerDialog />);
    expect(getByText('Export')).toBeTruthy();
  });

  it('renders all five category headings when a doc has ude + action + intermediateObjective and is EC', () => {
    act(() => useDocumentStore.getState().newDocument('ec'));
    seedEntity('A ude', 'ude');
    seedEntity('An action', 'action');
    seedEntity('An IO', 'intermediateObjective');
    openPicker();
    const { getByText } = render(<ExportPickerDialog />);
    expect(getByText('Images')).toBeTruthy();
    expect(getByText('Documents')).toBeTruthy();
    expect(getByText('Data')).toBeTruthy();
    expect(getByText('Annotations & reasoning')).toBeTruthy();
    expect(getByText('Share')).toBeTruthy();
  });

  it('always renders PNG, JPEG, SVG export cards', () => {
    openPicker();
    const { getByText } = render(<ExportPickerDialog />);
    expect(getByText('PNG (2×)')).toBeTruthy();
    expect(getByText('JPEG (2×)')).toBeTruthy();
    expect(getByText('SVG')).toBeTruthy();
  });

  it('always renders print / HTML-viewer / PowerPoint cards (unconditional documents)', () => {
    openPicker();
    const { getByText } = render(<ExportPickerDialog />);
    expect(getByText('Print / Save as PDF…')).toBeTruthy();
    expect(getByText('Self-contained HTML viewer')).toBeTruthy();
    expect(getByText('PowerPoint deck (.pptx)')).toBeTruthy();
  });

  it('always renders all Data + Annotations & Share category cards', () => {
    openPicker();
    const { getByText } = render(<ExportPickerDialog />);
    // Data
    expect(getByText('JSON')).toBeTruthy();
    expect(getByText('JSON (redacted)')).toBeTruthy();
    expect(getByText('Flying Logic')).toBeTruthy();
    expect(getByText('OPML outline')).toBeTruthy();
    expect(getByText('Graphviz DOT')).toBeTruthy();
    expect(getByText('Mermaid')).toBeTruthy();
    expect(getByText('VGL (declarative)')).toBeTruthy();
    expect(getByText('CSV')).toBeTruthy();
    // Annotations
    expect(getByText('Annotations (Markdown)')).toBeTruthy();
    expect(getByText('Annotations (plain text)')).toBeTruthy();
    expect(getByText('Reasoning as narrative (Markdown)')).toBeTruthy();
    expect(getByText('Reasoning as outline (Markdown)')).toBeTruthy();
    // Share
    expect(getByText('Copy read-only share link')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Diagram-type gating (onlyOnECDoc)
// ---------------------------------------------------------------------------

describe('ExportPickerDialog — EC-only items', () => {
  it('hides EC workshop sheet on non-EC documents', () => {
    // Default doc type is CRT
    openPicker();
    const { queryByText } = render(<ExportPickerDialog />);
    expect(queryByText('EC workshop sheet (PDF)')).toBeNull();
  });

  it('shows EC workshop sheet on EC documents', () => {
    act(() => useDocumentStore.getState().newDocument('ec'));
    openPicker();
    const { getByText } = render(<ExportPickerDialog />);
    expect(getByText('EC workshop sheet (PDF)')).toBeTruthy();
  });

  it('hides EC workshop sheet when diagram type switches away from EC', () => {
    act(() => useDocumentStore.getState().newDocument('ec'));
    openPicker();
    const { queryByText } = render(<ExportPickerDialog />);
    expect(queryByText('EC workshop sheet (PDF)')).not.toBeNull();

    // Switch to a non-EC diagram type
    act(() => useDocumentStore.getState().newDocument('crt'));
    expect(queryByText('EC workshop sheet (PDF)')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Entity-gated options (requiresEntityType)
// ---------------------------------------------------------------------------

describe('ExportPickerDialog — entity-gated options', () => {
  it('gates "Prerequisite plan (CSV)" on Intermediate Objectives', () => {
    // The doc has no Intermediate Objectives — the option must stay hidden.
    // (Pre-fix it leaked onto every doc, the regression this guards.)
    seedEntity('A plain effect', 'effect');
    openPicker();
    const { queryByText } = render(<ExportPickerDialog />);
    expect(queryByText('Prerequisite plan (CSV)')).toBeNull();

    // Add one Intermediate Objective and the option appears.
    act(() => {
      seedEntity('Defeat the obstacle', 'intermediateObjective');
    });
    expect(queryByText('Prerequisite plan (CSV)')).not.toBeNull();
  });

  it('gates "Risk register (CSV)" on UDEs', () => {
    seedEntity('A plain effect', 'effect');
    openPicker();
    const { queryByText } = render(<ExportPickerDialog />);
    expect(queryByText('Risk register (CSV)')).toBeNull();

    act(() => {
      seedEntity('Customers churn', 'ude');
    });
    expect(queryByText('Risk register (CSV)')).not.toBeNull();
  });

  it('gates "Task tracker CSV" on Actions', () => {
    seedEntity('A plain effect', 'effect');
    openPicker();
    const { queryByText } = render(<ExportPickerDialog />);
    expect(queryByText('Task tracker CSV')).toBeNull();

    act(() => {
      seedEntity('Ship the change', 'action');
    });
    expect(queryByText('Task tracker CSV')).not.toBeNull();
  });

  it('shows all three gated items when all entity types are present', () => {
    seedEntity('UDE', 'ude');
    seedEntity('Action', 'action');
    seedEntity('IO', 'intermediateObjective');
    openPicker();
    const { getByText } = render(<ExportPickerDialog />);
    expect(getByText('Risk register (CSV)')).toBeTruthy();
    expect(getByText('Task tracker CSV')).toBeTruthy();
    expect(getByText('Prerequisite plan (CSV)')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Close behaviour
// ---------------------------------------------------------------------------

describe('ExportPickerDialog — close', () => {
  it('Close button sets exportPickerOpen to false', () => {
    openPicker();
    expect(useDocumentStore.getState().exportPickerOpen).toBe(true);
    const { container } = render(<ExportPickerDialog />);
    const closeBtn = container.querySelector(
      'button[aria-label="Close export picker"]'
    ) as HTMLButtonElement | null;
    expect(closeBtn).toBeTruthy();
    act(() => fireEvent.click(closeBtn!));
    expect(useDocumentStore.getState().exportPickerOpen).toBe(false);
  });

  it('store toggle round-trips through openExportPicker / closeExportPicker', () => {
    expect(useDocumentStore.getState().exportPickerOpen).toBe(false);
    act(() => useDocumentStore.getState().openExportPicker());
    expect(useDocumentStore.getState().exportPickerOpen).toBe(true);
    act(() => useDocumentStore.getState().closeExportPicker());
    expect(useDocumentStore.getState().exportPickerOpen).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Click → exporter called + dialog closes
// ---------------------------------------------------------------------------

describe('ExportPickerDialog — click fires exporter and closes', () => {
  it('clicking PNG closes the picker and calls exportPNG', async () => {
    const { exportPNG } = await import('@/services/exporters');
    openPicker();
    const { container } = render(<ExportPickerDialog />);
    await act(async () => {
      clickButton(container, 'PNG (2×)');
    });
    expect(useDocumentStore.getState().exportPickerOpen).toBe(false);
    expect(exportPNG).toHaveBeenCalledOnce();
  });

  it('clicking JPEG closes the picker and calls exportJPEG', async () => {
    const { exportJPEG } = await import('@/services/exporters');
    openPicker();
    const { container } = render(<ExportPickerDialog />);
    await act(async () => {
      clickButton(container, 'JPEG (2×)');
    });
    expect(useDocumentStore.getState().exportPickerOpen).toBe(false);
    expect(exportJPEG).toHaveBeenCalledOnce();
  });

  it('clicking SVG closes the picker and calls exportSVG', async () => {
    const { exportSVG } = await import('@/services/exporters');
    openPicker();
    const { container } = render(<ExportPickerDialog />);
    await act(async () => {
      clickButton(container, 'SVG');
    });
    expect(useDocumentStore.getState().exportPickerOpen).toBe(false);
    expect(exportSVG).toHaveBeenCalledOnce();
  });

  it('clicking "Print / Save as PDF…" closes the picker and opens print preview', async () => {
    openPicker();
    const { container } = render(<ExportPickerDialog />);
    await act(async () => {
      clickButton(container, 'Print / Save as PDF…');
    });
    expect(useDocumentStore.getState().exportPickerOpen).toBe(false);
    expect(useDocumentStore.getState().printOpen).toBe(true);
  });

  it('clicking "Self-contained HTML viewer" closes the picker and calls exportHTMLViewer', async () => {
    const { exportHTMLViewer } = await import('@/services/exporters');
    openPicker();
    const { container } = render(<ExportPickerDialog />);
    await act(async () => {
      clickButton(container, 'Self-contained HTML viewer');
    });
    expect(useDocumentStore.getState().exportPickerOpen).toBe(false);
    expect(exportHTMLViewer).toHaveBeenCalledOnce();
  });

  it('clicking "PowerPoint deck (.pptx)" closes the picker and calls exportPPTX', async () => {
    const { exportPPTX } = await import('@/services/exporters');
    openPicker();
    const { container } = render(<ExportPickerDialog />);
    await act(async () => {
      clickButton(container, 'PowerPoint deck (.pptx)');
    });
    expect(useDocumentStore.getState().exportPickerOpen).toBe(false);
    expect(exportPPTX).toHaveBeenCalledOnce();
  });

  it('clicking "Risk register (CSV)" (with UDE present) closes the picker and calls exportRiskRegister', async () => {
    const { exportRiskRegister } = await import('@/services/exporters');
    seedEntity('UDE', 'ude');
    openPicker();
    const { container } = render(<ExportPickerDialog />);
    await act(async () => {
      clickButton(container, 'Risk register (CSV)');
    });
    expect(useDocumentStore.getState().exportPickerOpen).toBe(false);
    expect(exportRiskRegister).toHaveBeenCalledOnce();
  });

  it('clicking "Task tracker CSV" (with action present) closes the picker and calls exportTtTasks', async () => {
    const { exportTtTasks } = await import('@/services/exporters');
    seedEntity('Action', 'action');
    openPicker();
    const { container } = render(<ExportPickerDialog />);
    await act(async () => {
      clickButton(container, 'Task tracker CSV');
    });
    expect(useDocumentStore.getState().exportPickerOpen).toBe(false);
    expect(exportTtTasks).toHaveBeenCalledOnce();
  });

  it('clicking "Prerequisite plan (CSV)" (with IO present) closes the picker and calls exportPrtPlan', async () => {
    const { exportPrtPlan } = await import('@/services/exporters');
    seedEntity('IO', 'intermediateObjective');
    openPicker();
    const { container } = render(<ExportPickerDialog />);
    await act(async () => {
      clickButton(container, 'Prerequisite plan (CSV)');
    });
    expect(useDocumentStore.getState().exportPickerOpen).toBe(false);
    expect(exportPrtPlan).toHaveBeenCalledOnce();
  });

  it('clicking JSON closes the picker and calls exportJSON', async () => {
    const { exportJSON } = await import('@/services/exporters');
    openPicker();
    const { container } = render(<ExportPickerDialog />);
    await act(async () => {
      clickButton(container, 'JSON');
    });
    expect(useDocumentStore.getState().exportPickerOpen).toBe(false);
    expect(exportJSON).toHaveBeenCalledOnce();
  });

  it('clicking "JSON (redacted)" closes the picker and calls exportJSON with a redacted doc', async () => {
    const { exportJSON } = await import('@/services/exporters');
    openPicker();
    const { container } = render(<ExportPickerDialog />);
    await act(async () => {
      clickButton(container, 'JSON (redacted)');
    });
    expect(useDocumentStore.getState().exportPickerOpen).toBe(false);
    expect(exportJSON).toHaveBeenCalledOnce();
  });

  it('clicking "Flying Logic" closes the picker and calls exportFlyingLogic', async () => {
    const { exportFlyingLogic } = await import('@/services/exporters');
    openPicker();
    const { container } = render(<ExportPickerDialog />);
    await act(async () => {
      clickButton(container, 'Flying Logic');
    });
    expect(useDocumentStore.getState().exportPickerOpen).toBe(false);
    expect(exportFlyingLogic).toHaveBeenCalledOnce();
  });

  it('clicking "OPML outline" closes the picker and calls exportOPML', async () => {
    const { exportOPML } = await import('@/services/exporters');
    openPicker();
    const { container } = render(<ExportPickerDialog />);
    await act(async () => {
      clickButton(container, 'OPML outline');
    });
    expect(useDocumentStore.getState().exportPickerOpen).toBe(false);
    expect(exportOPML).toHaveBeenCalledOnce();
  });

  it('clicking "Graphviz DOT" closes the picker and calls exportDOT', async () => {
    const { exportDOT } = await import('@/services/exporters');
    openPicker();
    const { container } = render(<ExportPickerDialog />);
    await act(async () => {
      clickButton(container, 'Graphviz DOT');
    });
    expect(useDocumentStore.getState().exportPickerOpen).toBe(false);
    expect(exportDOT).toHaveBeenCalledOnce();
  });

  it('clicking "Mermaid" closes the picker and calls exportMermaid', async () => {
    const { exportMermaid } = await import('@/services/exporters');
    openPicker();
    const { container } = render(<ExportPickerDialog />);
    await act(async () => {
      clickButton(container, 'Mermaid');
    });
    expect(useDocumentStore.getState().exportPickerOpen).toBe(false);
    expect(exportMermaid).toHaveBeenCalledOnce();
  });

  it('clicking "VGL (declarative)" closes the picker and calls exportVGL', async () => {
    const { exportVGL } = await import('@/services/exporters');
    openPicker();
    const { container } = render(<ExportPickerDialog />);
    await act(async () => {
      clickButton(container, 'VGL (declarative)');
    });
    expect(useDocumentStore.getState().exportPickerOpen).toBe(false);
    expect(exportVGL).toHaveBeenCalledOnce();
  });

  it('clicking "CSV" closes the picker and calls exportCSV', async () => {
    const { exportCSV } = await import('@/services/exporters');
    openPicker();
    const { container } = render(<ExportPickerDialog />);
    await act(async () => {
      clickButton(container, 'CSV');
    });
    expect(useDocumentStore.getState().exportPickerOpen).toBe(false);
    expect(exportCSV).toHaveBeenCalledOnce();
  });

  it('clicking "Annotations (Markdown)" closes the picker and calls exportAnnotationsMd', async () => {
    const { exportAnnotationsMd } = await import('@/services/exporters');
    openPicker();
    const { container } = render(<ExportPickerDialog />);
    await act(async () => {
      clickButton(container, 'Annotations (Markdown)');
    });
    expect(useDocumentStore.getState().exportPickerOpen).toBe(false);
    expect(exportAnnotationsMd).toHaveBeenCalledOnce();
  });

  it('clicking "Annotations (plain text)" closes the picker and calls exportAnnotationsTxt', async () => {
    const { exportAnnotationsTxt } = await import('@/services/exporters');
    openPicker();
    const { container } = render(<ExportPickerDialog />);
    await act(async () => {
      clickButton(container, 'Annotations (plain text)');
    });
    expect(useDocumentStore.getState().exportPickerOpen).toBe(false);
    expect(exportAnnotationsTxt).toHaveBeenCalledOnce();
  });

  it('clicking "Reasoning as narrative (Markdown)" closes the picker and calls exportReasoningNarrativeMd', async () => {
    const { exportReasoningNarrativeMd } = await import('@/services/exporters');
    openPicker();
    const { container } = render(<ExportPickerDialog />);
    await act(async () => {
      clickButton(container, 'Reasoning as narrative (Markdown)');
    });
    expect(useDocumentStore.getState().exportPickerOpen).toBe(false);
    expect(exportReasoningNarrativeMd).toHaveBeenCalledOnce();
  });

  it('clicking "Reasoning as outline (Markdown)" closes the picker and calls exportReasoningOutlineMd', async () => {
    const { exportReasoningOutlineMd } = await import('@/services/exporters');
    openPicker();
    const { container } = render(<ExportPickerDialog />);
    await act(async () => {
      clickButton(container, 'Reasoning as outline (Markdown)');
    });
    expect(useDocumentStore.getState().exportPickerOpen).toBe(false);
    expect(exportReasoningOutlineMd).toHaveBeenCalledOnce();
  });

  it('clicking "Copy read-only share link" closes the picker and calls generateShareLink', async () => {
    const { generateShareLink } = await import('@/services/shareLink');
    openPicker();
    const { container } = render(<ExportPickerDialog />);
    await act(async () => {
      clickButton(container, 'Copy read-only share link');
    });
    expect(useDocumentStore.getState().exportPickerOpen).toBe(false);
    expect(generateShareLink).toHaveBeenCalledOnce();
  });

  it('clicking "EC workshop sheet (PDF)" on an EC doc closes the picker and calls exportECWorkshopSheet', async () => {
    const { exportECWorkshopSheet } = await import('@/services/exporters/ecWorkshopExport');
    act(() => useDocumentStore.getState().newDocument('ec'));
    openPicker();
    const { container } = render(<ExportPickerDialog />);
    await act(async () => {
      clickButton(container, 'EC workshop sheet (PDF)');
    });
    expect(useDocumentStore.getState().exportPickerOpen).toBe(false);
    expect(exportECWorkshopSheet).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// Toast side-effects from exporters
// ---------------------------------------------------------------------------

describe('ExportPickerDialog — toast side-effects', () => {
  it('risk register export shows a success toast with the count', async () => {
    const { exportRiskRegister } = await import('@/services/exporters');
    (exportRiskRegister as ReturnType<typeof vi.fn>).mockReturnValue(2);
    seedEntity('UDE', 'ude');
    openPicker();
    const { container } = render(<ExportPickerDialog />);
    act(() => {
      clickButton(container, 'Risk register (CSV)');
    });
    await waitFor(() => {
      const toasts = useDocumentStore.getState().toasts;
      expect(toasts.length).toBeGreaterThan(0);
      expect(toasts[0]?.kind).toBe('success');
      expect(toasts[0]?.message).toMatch(/risk/i);
    });
  });

  it('task tracker export shows a success toast with the count', async () => {
    const { exportTtTasks } = await import('@/services/exporters');
    (exportTtTasks as ReturnType<typeof vi.fn>).mockReturnValue(4);
    seedEntity('Action', 'action');
    openPicker();
    const { container } = render(<ExportPickerDialog />);
    act(() => {
      clickButton(container, 'Task tracker CSV');
    });
    await waitFor(() => {
      const toasts = useDocumentStore.getState().toasts;
      expect(toasts.length).toBeGreaterThan(0);
      expect(toasts[0]?.kind).toBe('success');
      expect(toasts[0]?.message).toMatch(/action/i);
    });
  });

  it('prt plan export shows a success toast with the count', async () => {
    const { exportPrtPlan } = await import('@/services/exporters');
    (exportPrtPlan as ReturnType<typeof vi.fn>).mockReturnValue(3);
    seedEntity('IO', 'intermediateObjective');
    openPicker();
    const { container } = render(<ExportPickerDialog />);
    act(() => {
      clickButton(container, 'Prerequisite plan (CSV)');
    });
    await waitFor(() => {
      const toasts = useDocumentStore.getState().toasts;
      expect(toasts.length).toBeGreaterThan(0);
      expect(toasts[0]?.kind).toBe('success');
      expect(toasts[0]?.message).toMatch(/objective/i);
    });
  });

  it('EC workshop sheet shows a success toast on success', async () => {
    const { exportECWorkshopSheet } = await import('@/services/exporters/ecWorkshopExport');
    (exportECWorkshopSheet as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    act(() => useDocumentStore.getState().newDocument('ec'));
    openPicker();
    const { container } = render(<ExportPickerDialog />);
    act(() => {
      clickButton(container, 'EC workshop sheet (PDF)');
    });
    await waitFor(() => {
      const toasts = useDocumentStore.getState().toasts;
      expect(toasts.length).toBeGreaterThan(0);
      expect(toasts[0]?.kind).toBe('success');
    });
  });

  it('EC workshop sheet shows an error toast on failure', async () => {
    const { exportECWorkshopSheet } = await import('@/services/exporters/ecWorkshopExport');
    (exportECWorkshopSheet as ReturnType<typeof vi.fn>).mockResolvedValue(false);
    act(() => useDocumentStore.getState().newDocument('ec'));
    openPicker();
    const { container } = render(<ExportPickerDialog />);
    act(() => {
      clickButton(container, 'EC workshop sheet (PDF)');
    });
    await waitFor(() => {
      const toasts = useDocumentStore.getState().toasts;
      expect(toasts.length).toBeGreaterThan(0);
      expect(toasts[0]?.kind).toBe('error');
    });
  });

  it('PowerPoint export shows an error toast when exportPPTX throws', async () => {
    const { exportPPTX } = await import('@/services/exporters');
    (exportPPTX as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('PPTX generation failed')
    );
    openPicker();
    const { container } = render(<ExportPickerDialog />);
    act(() => {
      clickButton(container, 'PowerPoint deck (.pptx)');
    });
    await waitFor(() => {
      const toasts = useDocumentStore.getState().toasts;
      expect(toasts.length).toBeGreaterThan(0);
      expect(toasts[0]?.kind).toBe('error');
      expect(toasts[0]?.message).toMatch(/PPTX generation failed/i);
    });
  });

  it('share link shows success toast when navigator.clipboard is available', async () => {
    const { generateShareLink } = await import('@/services/shareLink');
    (generateShareLink as ReturnType<typeof vi.fn>).mockResolvedValue('https://example.com/s');
    // Stub navigator.clipboard.writeText
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    openPicker();
    const { container } = render(<ExportPickerDialog />);
    act(() => {
      clickButton(container, 'Copy read-only share link');
    });
    await waitFor(() => {
      const toasts = useDocumentStore.getState().toasts;
      expect(toasts.length).toBeGreaterThan(0);
      expect(toasts[0]?.kind).toBe('success');
      expect(toasts[0]?.message).toMatch(/share link copied/i);
    });
  });
});
