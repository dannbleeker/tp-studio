import type { Meta, StoryObj } from '@storybook/react';
import { Field } from './Field';

/**
 * Session 81 — Storybook coverage for `Field`. The component is a
 * label-over-input wrapper used throughout the EntityInspector,
 * EdgeInspector, DocumentInspector, and SettingsDialog. The two
 * stories show plain-text and rich-element labels.
 */
const meta: Meta<typeof Field> = {
  title: 'Inspector/Field',
  component: Field,
};
export default meta;
type Story = StoryObj<typeof Field>;

export const TextLabel: Story = {
  args: {
    label: 'Title',
    children: (
      <input
        type="text"
        defaultValue="Customer satisfaction is declining"
        className="rounded-md border border-neutral-200 px-2 py-1 text-sm"
      />
    ),
  },
};

export const RichLabel: Story = {
  args: {
    label: (
      <div className="flex items-center justify-between">
        <span>Description</span>
        <span className="text-[9px] text-neutral-400">markdown</span>
      </div>
    ),
    children: (
      <textarea
        rows={3}
        defaultValue="Lengthy entity description. Supports **bold** and `code`."
        className="rounded-md border border-neutral-200 px-2 py-1.5 font-mono text-xs"
      />
    ),
  },
};
