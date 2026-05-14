import type { Meta, StoryObj } from '@storybook/react';
import { Save } from 'lucide-react';
import { Button } from './Button';

/**
 * Session 81 — Storybook coverage for `Button`. Showcases every variant
 * (primary / ghost / softNeutral / softViolet / destructive) and each
 * size (sm / md / icon). The icon variant uses a real Lucide glyph so
 * the rendered card looks like the production button.
 */
const meta: Meta<typeof Button> = {
  title: 'UI/Button',
  component: Button,
  argTypes: {
    variant: {
      control: 'radio',
      options: ['primary', 'ghost', 'softNeutral', 'softViolet', 'destructive'],
    },
    size: {
      control: 'radio',
      options: ['sm', 'md', 'icon'],
    },
    disabled: { control: 'boolean' },
    children: { control: 'text' },
  },
  args: {
    variant: 'primary',
    size: 'md',
    children: 'Save changes',
    disabled: false,
  },
};
export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = {};

export const Ghost: Story = {
  args: { variant: 'ghost', children: 'Cancel' },
};

export const SoftViolet: Story = {
  args: { variant: 'softViolet', children: 'New injection' },
};

export const Destructive: Story = {
  args: { variant: 'destructive', children: 'Delete' },
};

export const Disabled: Story = {
  args: { disabled: true },
};

export const Icon: Story = {
  args: { size: 'icon', children: <Save className="h-4 w-4" />, 'aria-label': 'Save' },
};
