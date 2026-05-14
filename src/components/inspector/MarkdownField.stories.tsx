import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { MarkdownField } from './MarkdownField';

/**
 * Session 81 — Storybook coverage for `MarkdownField`. The component
 * is controlled (parent owns the string state), so the stories wrap it
 * in a tiny `useState` host. Three variants:
 *   - Editable: full edit/preview toggle.
 *   - Locked: read-only with the toggle hidden (Browse Lock mode).
 *   - Empty: blank initial value, default Edit mode.
 */
const meta: Meta<typeof MarkdownField> = {
  title: 'Inspector/MarkdownField',
  component: MarkdownField,
  argTypes: {
    locked: { control: 'boolean' },
    rows: { control: { type: 'number', min: 1, max: 12 } },
  },
};
export default meta;
type Story = StoryObj<typeof MarkdownField>;

type Args = Parameters<typeof MarkdownField>[0];

const Host = (args: Args) => {
  const [value, setValue] = useState<string>(args.value);
  return <MarkdownField {...args} value={value} onChange={setValue} />;
};

export const Editable: Story = {
  args: {
    label: 'Description',
    value: 'This entity rolls up *three* sub-effects from procurement. Renders **bold** + `code`.',
    placeholder: 'Add a markdown description…',
    rows: 4,
    locked: false,
  },
  render: (args) => <Host {...args} />,
};

export const Locked: Story = {
  args: {
    label: 'Description',
    value: 'Read-only because Browse Lock is engaged.',
    locked: true,
  },
  render: (args) => <Host {...args} />,
};

export const Empty: Story = {
  args: {
    label: 'Description',
    value: '',
    placeholder: 'No description yet — start typing markdown',
    rows: 3,
  },
  render: (args) => <Host {...args} />,
};
