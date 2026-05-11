import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
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
        entity: {
          ude: '#ef4444',
          effect: '#737373',
          rootCause: '#d97706',
          injection: '#059669',
          desiredEffect: '#6366f1',
          assumption: '#8b5cf6',
        },
      },
    },
  },
  plugins: [],
};

export default config;
