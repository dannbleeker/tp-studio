import type { Meta, StoryObj } from '@storybook/react';
import { EmptyHint } from './EmptyHint';

/**
 * Session 112 — Storybook coverage for `EmptyHint`. Pure
 * presentational — the canvas-empty zero state surfaces the
 * double-click gesture plus the two alternate entry paths added in
 * Session 87. Stories render the component on a neutral background
 * with the same absolute-positioned center frame the canvas uses.
 */
const meta: Meta<typeof EmptyHint> = {
  title: 'Canvas/EmptyHint',
  component: EmptyHint,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Shown when the canvas has zero entities. Three discovery paths surfaced: double-click gesture, palette commands (Cmd/Ctrl+K), and the templates picker.',
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="relative h-screen w-screen bg-neutral-50 dark:bg-neutral-950">
        <Story />
      </div>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof EmptyHint>;

export const Default: Story = {};
