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
          100: '#e9ecf0',
          200: '#c9ced6',
          300: '#a3aab5',
          400: '#7d8591',
          500: '#5d6571',
        },
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
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'Liberation Mono', 'monospace'],
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
