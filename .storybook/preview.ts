import type { Preview } from '@storybook/react';
import '../src/styles/index.css';

/**
 * Session 81 — global preview config for TP Studio's Storybook.
 *
 * `parameters.layout: 'padded'` gives stories a comfortable canvas
 * margin. The app's Tailwind stylesheet is imported once here so every
 * story renders with the same utility classes the production UI uses
 * — no second `<link>` to maintain.
 *
 * The `controls.matchers` pair is the recommended default: any prop
 * named `*color` or `*background` becomes a color picker, any prop
 * matching `*Date` becomes a date picker.
 */
const preview: Preview = {
  parameters: {
    layout: 'padded',
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
  },
};

export default preview;
