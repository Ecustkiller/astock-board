/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        up: 'var(--up)',
        down: 'var(--down)',
        panel: 'var(--panel)',
        panel2: 'var(--panel2)',
        edge: 'var(--edge)',
        ink: 'var(--ink)',
        sub: 'var(--sub)',
        blue: '#0071e3'
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)',
        'card-hover': '0 6px 18px rgba(0,0,0,0.10)'
      },
      borderRadius: {
        xl: '14px',
        '2xl': '18px'
      }
    }
  },
  plugins: []
}
