import type { Meta, StoryObj } from '@storybook/react';
import { ErrorBoundary } from './ErrorBoundary';

/**
 * Session 81 — Storybook coverage for `ErrorBoundary`.
 *
 * Two modes:
 *   - Root (no `label`) — full-screen recovery card with a Reload button.
 *     Shown via a child component that throws on first render.
 *   - Nested (with `label`) — inline card that fills the failing subtree.
 *
 * The "happy path" story renders normal children so the playground also
 * documents the no-error case (boundary is invisible).
 */
function Boom({ message }: { message: string }): null {
  throw new Error(message);
}

const meta: Meta<typeof ErrorBoundary> = {
  title: 'UI/ErrorBoundary',
  component: ErrorBoundary,
  argTypes: {
    label: { control: 'text' },
  },
};
export default meta;
type Story = StoryObj<typeof ErrorBoundary>;

export const HappyPath: Story = {
  args: { label: 'Inspector' },
  render: (args) => (
    <ErrorBoundary {...args}>
      <p className="rounded border border-neutral-200 p-3 text-sm">
        Children render normally — the boundary is invisible.
      </p>
    </ErrorBoundary>
  ),
};

export const RootFallback: Story = {
  render: () => (
    <ErrorBoundary>
      <Boom message="Root boundary smoke-test: forced crash to render the full-screen card." />
    </ErrorBoundary>
  ),
};

export const NestedFallback: Story = {
  args: { label: 'Inspector' },
  render: (args) => (
    <ErrorBoundary {...args}>
      <Boom message="Nested boundary smoke-test: forced crash inside an Inspector-shaped subtree." />
    </ErrorBoundary>
  ),
};
