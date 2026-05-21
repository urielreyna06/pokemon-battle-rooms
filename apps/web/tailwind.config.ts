import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './app/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'ink-1':        '#14101a',
        'ink-2':        '#2a1f2e',
        'ink-soft':     '#5b4a5e',
        'cream':        '#f8efd1',
        'cream-dk':     '#d8c8a0',
        'cream-shadow': '#8b7340',
        'paper':        '#ffffff',
        'hp-hi':        '#5fc63a',
        'hp-hi-dk':     '#2f8a18',
        'hp-mid':       '#f8b830',
        'hp-mid-dk':    '#b88018',
        'hp-lo':        '#e02828',
        'hp-lo-dk':     '#901818',
        'btn-red':      '#d83040',
        'btn-red-hi':   '#ff7080',
        'btn-yellow':   '#e8b020',
        'btn-yellow-hi':'#ffe070',
        'btn-green':    '#4ab030',
        'btn-green-hi': '#7fe060',
        'btn-blue':     '#3878c8',
        'btn-blue-hi':  '#70b8ff',
      },
      fontFamily: {
        pixel:      ['"Press Start 2P"', 'monospace'],
        'pixel-lg': ['Silkscreen', 'monospace'],
        'pixel-body':['VT323', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config;
