import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Config } from 'tailwindcss';
import { ENTITY_STRIPE_COLOR } from './src/domain/tokens';

const here = path.dirname(fileURLToPath(import.meta.url));

const config: Config = {
  content: [path.join(here, 'index.html'), path.join(here, 'src/**/*.{ts,tsx}')],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'sans-serif',
        ],
      },
      fontSize: {
        ui: ['13px', { lineHeight: '1.4' }],
        node: ['15px', { lineHeight: '1.35' }],
        edge: ['11px', { lineHeight: '1.2' }],
      },
      colors: {
        entity: ENTITY_STRIPE_COLOR,
      },
    },
  },
  plugins: [],
};

export default config;
