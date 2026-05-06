/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        neon: {
          cyan: '#00f0ff',
          magenta: '#ff00ff',
          lime: '#00ff00',
          pink: '#ff006e',
          purple: '#b800d9',
          orange: '#ff6d00',
        },
        dark: {
          bg: '#0a0e27',
          surface: '#1a1f3a',
          border: '#2a3050',
        }
      },
      fontFamily: {
        mono: ['Courier New', 'monospace'],
      },
      boxShadow: {
        neon: '0 0 10px rgba(0, 240, 255, 0.5)',
        'neon-lg': '0 0 20px rgba(0, 240, 255, 0.8)',
      },
      animation: {
        pulse: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}
