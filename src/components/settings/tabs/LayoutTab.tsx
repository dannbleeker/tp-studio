import { RotateCcw } from 'lucide-react';
import { useShallow } from 'zustand/shallow';
import { Field } from '@/components/inspector/Field';
import { Button } from '@/components/ui/Button';
import { LAYOUT_NODE_SEPARATION, LAYOUT_RANK_SEPARATION } from '@/domain/constants';
import { LAYOUT_STRATEGY } from '@/domain/layoutStrategy';
import type { LayoutConfig } from '@/domain/types';
import { useDocumentStore } from '@/store';
import { currentDoc } from '@/store/selectors';
import { RadioGroup, Section, Slider } from '../formPrimitives';

/**
 * Block A — Layout direction options for the Settings radio group. The
 * label captures the read direction (e.g. "Bottom → Top" for `BT` means
 * causes at the bottom, effects above — the conventional CRT shape).
 */
type LayoutDirectionId = NonNullable<LayoutConfig['direction']>;
const DIRECTION_OPTIONS: { id: LayoutDirectionId; label: string; hint?: string }[] = [
  { id: 'BT', label: 'Bottom → Top', hint: 'Default for CRT / FRT' },
  { id: 'TB', label: 'Top → Bottom', hint: 'Goal at top' },
  { id: 'LR', label: 'Left → Right' },
  { id: 'RL', label: 'Right → Left' },
];

/**
 * Bias options. `'auto'` is the sentinel for "don't pass `align` to dagre"
 * — dagre's own balancing kicks in. UL / UR / DL / DR shift the diagonal
 * preference of multi-parent placements; useful when a graph has a strong
 * primary axis the user wants emphasized.
 */
type BiasId = 'auto' | NonNullable<LayoutConfig['align']>;
const BIAS_OPTIONS: { id: BiasId; label: string; hint?: string }[] = [
  { id: 'auto', label: 'Auto', hint: 'Dagre balances' },
  { id: 'UL', label: 'Upper-left' },
  { id: 'UR', label: 'Upper-right' },
  { id: 'DL', label: 'Lower-left' },
  { id: 'DR', label: 'Lower-right' },
];

/**
 * Compactness slider conversion. The slider runs 0 → 100; 50 maps to the
 * exact app defaults (`LAYOUT_RANK_SEPARATION`, `LAYOUT_NODE_SEPARATION`);
 * each side scales exponentially via `factor = 2^((slider − 50) / 50)` so
 * 0 is half-spacing and 100 is double-spacing. Symmetric exponential
 * keeps the visual change at each end feel even rather than dragging
 * through a long flat patch in the middle.
 */
const sliderToCompactness = (slider: number): { nodesep: number; ranksep: number } => {
  const factor = 2 ** ((slider - 50) / 50);
  return {
    nodesep: Math.round(LAYOUT_NODE_SEPARATION * factor),
    ranksep: Math.round(LAYOUT_RANK_SEPARATION * factor),
  };
};

/**
 * Inverse: read the slider position from the stored `ranksep` (we anchor
 * on ranksep — nodesep would give the same answer because they scale
 * together). Clamped to 0..100 so an out-of-band number imported from a
 * future feature doesn't push the thumb off the track.
 */
const compactnessToSlider = (cfg: LayoutConfig | undefined): number => {
  const ranksep = cfg?.ranksep ?? LAYOUT_RANK_SEPARATION;
  const slider = Math.round(50 + 50 * Math.log2(ranksep / LAYOUT_RANK_SEPARATION));
  return Math.max(0, Math.min(100, slider));
};

const hasLayoutOverride = (cfg: LayoutConfig | undefined): boolean =>
  Boolean(cfg && Object.keys(cfg).length > 0);

/**
 * Session 121 — Layout tab extracted from `SettingsDialog`. Block A
 * (Session 47) introduced these knobs; the Layout section is only
 * meaningful for auto-layout diagrams. EC and freeform ignore dagre
 * entirely (positions live on entities); showing the knobs there would
 * mislead the user, so the tab renders an explanatory note instead.
 */
export function LayoutTab() {
  const { diagramType, layoutConfig, setLayoutConfig } = useDocumentStore(
    useShallow((s) => ({
      diagramType: currentDoc(s).diagramType,
      layoutConfig: currentDoc(s).layoutConfig,
      setLayoutConfig: s.setLayoutConfig,
    }))
  );

  const layoutKnobsEnabled = LAYOUT_STRATEGY[diagramType] === 'auto';
  const directionValue = layoutConfig?.direction ?? 'BT';
  const biasValue: BiasId = layoutConfig?.align ?? 'auto';
  const compactnessSlider = compactnessToSlider(layoutConfig);

  return (
    <Section title="Layout">
      {layoutKnobsEnabled ? (
        <>
          <Field label="Direction">
            <RadioGroup
              name="layoutDirection"
              value={directionValue}
              onChange={(id) => setLayoutConfig({ direction: id })}
              options={DIRECTION_OPTIONS}
            />
          </Field>
          <Slider
            label="Compactness"
            hint="Tighten or loosen the spacing dagre uses between entities. 50 is the app default."
            value={compactnessSlider}
            onChange={(v) => setLayoutConfig(sliderToCompactness(v))}
          />
          <Field label="Bias">
            <RadioGroup
              name="layoutBias"
              value={biasValue}
              onChange={(id) => setLayoutConfig(id === 'auto' ? {} : { align: id })}
              options={BIAS_OPTIONS}
            />
          </Field>
          {hasLayoutOverride(layoutConfig) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLayoutConfig(undefined)}
              className="self-start"
              aria-label="Reset layout to defaults"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Reset to defaults</span>
            </Button>
          )}
        </>
      ) : (
        <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
          This diagram uses hand-positioned layout — drag entities directly on the canvas to
          reposition them. The Direction / Compactness / Bias knobs only apply to auto-layout
          diagrams (CRT, FRT, PRT, TT).
        </p>
      )}
    </Section>
  );
}
