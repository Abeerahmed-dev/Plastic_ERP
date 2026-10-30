/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        dark: {
          bg: '#0A0B10',
          surface: '#0F111A',
          card: '#161925',
          cardElevated: '#1A1E2E',
          border: '#23283B',
          primary: '#3B82F6',
          purple: '#8B5CF6',
          textPrimary: '#FFFFFF',
          textSecondary: '#9CA3AF',
          textMuted: '#6B7280',
        },
      },
    },
  },
  plugins: [],
};
