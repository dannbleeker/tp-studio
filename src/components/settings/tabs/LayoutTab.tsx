import { RotateCcw } from 'lucide-react';
import { useShallow } from 'zustand/shallow';
import { Field } from '@/components/inspector/Field';
import { Button } from '@/components/ui/Button';
import { LAYOUT_NODE_SEPARATION, LAYOUT_RANK_SEPARATION } from '@/domain/constants';
import { LAYOUT_STRATEGY } from '@/domain/layoutStrategy';
import type { LayoutConfig } from '@/domain/types';
import { useT } from '@/i18n/useT';
import { useDocumentStore } from '@/store';
import { currentDoc } from '@/store/selectors';
import { RadioGroup, Section, Slider } from '../formPrimitives';

/**
 * Block A — Layout direction options for the Settings radio group. The
 * label captures the read direction (e.g. "Bottom → Top" for `BT` means
 * causes at the bottom, effects above — the conventional CRT shape).
 */
type LayoutDirectionId = NonNullable<LayoutConfig['direction']>;
/**
 * Bias options. `'auto'` is the sentinel for "don't pass `align` to dagre"
 * — dagre's own balancing kicks in. UL / UR / DL / DR shift the diagonal
 * preference of multi-parent placements; useful when a graph has a strong
 * primary axis the user wants emphasized.
 */
type BiasId = 'auto' | NonNullable<LayoutConfig['align']>;
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
  const t = useT();
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

  const l = t.settings.layout;
  const directionOptions: { id: LayoutDirectionId; label: string; hint?: string }[] = [
    { id: 'BT', label: l.directions.bt, hint: l.directions.btHint },
    { id: 'TB', label: l.directions.tb, hint: l.directions.tbHint },
    { id: 'LR', label: l.directions.lr },
    { id: 'RL', label: l.directions.rl },
  ];
  const biasOptions: { id: BiasId; label: string; hint?: string }[] = [
    { id: 'auto', label: l.biases.auto, hint: l.biases.autoHint },
    { id: 'UL', label: l.biases.ul },
    { id: 'UR', label: l.biases.ur },
    { id: 'DL', label: l.biases.dl },
    { id: 'DR', label: l.biases.dr },
  ];

  return (
    <Section title={l.section}>
      {layoutKnobsEnabled ? (
        <>
          <Field label={l.direction}>
            <RadioGroup
              name="layoutDirection"
              value={directionValue}
              onChange={(id) => setLayoutConfig({ direction: id })}
              options={directionOptions}
            />
          </Field>
          <Slider
            label={l.compactness}
            hint={l.compactnessHint}
            value={compactnessSlider}
            onChange={(v) => setLayoutConfig(sliderToCompactness(v))}
          />
          <Field label={l.bias}>
            <RadioGroup
              name="layoutBias"
              value={biasValue}
              onChange={(id) => setLayoutConfig(id === 'auto' ? {} : { align: id })}
              options={biasOptions}
            />
          </Field>
          {hasLayoutOverride(layoutConfig) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLayoutConfig(undefined)}
              className="self-start"
              aria-label={l.resetLayout}
            >
              <RotateCcw className="h-3 w-3" />
              <span>{l.resetToDefaults}</span>
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
