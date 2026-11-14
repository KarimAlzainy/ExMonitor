/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        space: {
          950: '#08090c',
          900: '#0d0f13',
          850: '#12151a',
          800: '#181c22',
          700: '#262b33',
          600: '#3a414c',
        },
        ink: {
          100: '#f4f6f8',
          200: '#d5dbe3',
          300: '#b0b8c4',
          400: '#929ba8',
          500: '#78828f',
          600: '#5d6571',
        },
        // One warm light tone for primary actions and the selected tab.
        // Everything else stays in the existing dark space/ink palette.
        chalk: '#f3efe4',
        signal: {
          DEFAULT: '#7aa7c7',
          strong: '#9bc0da',
          dim: '#5d8eae',
        },
        phosphor: '#59c98d',
        positive: '#59c98d',
        caution: '#d7a45a',
        critical: {
          DEFAULT: '#e56767',
          strong: '#b23a3a',
        },
      },
      fontFamily: {
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
        sans: ['"IBM Plex Sans Variable"', '"IBM Plex Sans"', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
