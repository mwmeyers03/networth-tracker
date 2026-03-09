/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'primary': '#1c64f2',
        'primary-focus': '#0e4abf',
        'secondary': '#7e3af2',
        'secondary-focus': '#6c2bd9',
        'accent': '#10b981',
        'accent-focus': '#059669',
        'neutral': '#1f2937',
        'neutral-focus': '#111827',
        'base-100': '#ffffff',
        'base-200': '#f9fafb',
        'base-300': '#f3f4f6',
        'info': '#2563eb',
        'success': '#10b981',
        'warning': '#f59e0b',
        'error': '#ef4444',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.5s ease-out',
        'fade-in-up': 'fade-in-up 0.5s ease-out',
      },
    },
  },
  plugins: [],
}