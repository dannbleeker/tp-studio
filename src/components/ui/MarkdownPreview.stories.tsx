import type { Meta, StoryObj } from '@storybook/react';
import { MarkdownPreview } from './MarkdownPreview';

/**
 * Session 81 — Storybook coverage for `MarkdownPreview`. Drives the
 * shared renderer with a few canonical fixtures: a short paragraph, a
 * list, a fenced code block, and an empty input (which falls back to a
 * "No description." italic line).
 *
 * Note: the embedded entity-ref delegation only resolves when the
 * markdown contains `data-entity-ref` anchors against a live document;
 * stories don't mount the store, so those anchors are inert here.
 */
const meta: Meta<typeof MarkdownPreview> = {
  title: 'UI/MarkdownPreview',
  component: MarkdownPreview,
  argTypes: {
    source: { control: 'text' },
  },
};
export default meta;
type Story = StoryObj<typeof MarkdownPreview>;

export const Paragraph: Story = {
  args: {
    source:
      'A short markdown paragraph with **bold**, *italic*, and `inline code`. Links are rendered as plain `<a>` tags.',
  },
};

export const ListAndHeading: Story = {
  args: {
    source: `## Acceptance criteria

- Validates input lengths on submit
- Renders the error banner inline
- Falls back to a toast when the form unmounts mid-submit`,
  },
};

export const CodeBlock: Story = {
  args: {
    source: `Use \`useFingerprintMemo\` to gate heavy recomputes:

\`\`\`ts
const fp = layoutFingerprint(doc);
const positions = useFingerprintMemo(() => computeLayout(...), fp);
\`\`\``,
  },
};

export const Empty: Story = {
  args: { source: '' },
};
