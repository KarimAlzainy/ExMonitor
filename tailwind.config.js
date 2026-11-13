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
          950: '#07090e',
          900: '#0b0f17',
          850: '#101623',
          800: '#161f31',
          700: '#23304b',
          600: '#344569',
        },
        nasa: {
          red: '#fc3d21',
          blue: '#0b3d91',
          cyan: '#00f0ff',
        },
        vital: {
          emerald: '#10b981',
          amber: '#f59e0b',
          crimson: '#ef4444',
        }
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'Liberation Mono', 'monospace'],
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      animation: {
        'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'strobe': 'strobe 0.7s ease-in-out infinite',
        'scanline': 'scanline 8s linear infinite',
      },
      keyframes: {
        strobe: {
          '0%, 100%': { opacity: '1', backgroundColor: 'rgba(239, 68, 68, 0.25)' },
          '50%': { opacity: '0.4', backgroundColor: 'rgba(239, 68, 68, 0.05)' },
        },
        scanline: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(1000%)' }
        }
      }
    },
  },
  plugins: [],
}
