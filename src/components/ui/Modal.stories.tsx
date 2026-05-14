import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { Button } from './Button';
import { Modal } from './Modal';

/**
 * Session 81 — Storybook coverage for `Modal`. Wraps a stateful demo so
 * the user can toggle the modal open / closed in the playground;
 * `onDismiss` resets the wrapper state. The Esc + outside-click
 * dismissal hook is inert in Storybook (no Esc / no backdrop) — open
 * the playground in a real browser tab to exercise those paths.
 */
const meta: Meta<typeof Modal> = {
  title: 'UI/Modal',
  component: Modal,
  argTypes: {
    align: { control: 'radio', options: ['center', 'top'] },
    widthClass: { control: 'text' },
  },
};
export default meta;

type Story = StoryObj<typeof Modal>;

const Demo = ({ align }: { align?: 'center' | 'top' }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        Open modal
      </Button>
      <Modal open={open} onDismiss={() => setOpen(false)} align={align}>
        <div className="flex flex-col gap-3 p-5">
          <h2 className="font-semibold text-neutral-900 text-sm dark:text-neutral-100">
            Confirm destructive action
          </h2>
          <p className="text-neutral-600 text-xs dark:text-neutral-400">
            This is a demonstration modal. Click outside, press Esc, or use the buttons below to
            dismiss.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => setOpen(false)}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export const Center: Story = {
  render: () => <Demo align="center" />,
};

export const Top: Story = {
  render: () => <Demo align="top" />,
};
