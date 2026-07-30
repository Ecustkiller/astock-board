/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        up: '#ef4444',
        down: '#22c55e',
        panel: '#121620',
        panel2: '#1a1f2e',
        edge: '#262c3a'
      }
    }
  },
  plugins: []
}
