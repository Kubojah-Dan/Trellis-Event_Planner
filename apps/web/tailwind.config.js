/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#F7F5EF',
        surface: '#FFFFFF',
        ink: {
          DEFAULT: '#202823',
          muted: '#626B65',
          light: '#8F9992',
        },
        evergreen: {
          50: '#F0F6F4',
          100: '#DDECE8',
          600: '#3D7767',
          700: '#2F6254',
          800: '#214D42',
          900: '#163A32',
          950: '#0C221D',
        },
        coral: {
          50: '#FDF3F1',
          100: '#FCE4DF',
          500: '#E77B62',
          600: '#D56248',
          700: '#B84B34',
        },
        marigold: {
          50: '#FCF8EE',
          100: '#F7EED2',
          500: '#D7AA4A',
          600: '#C29437',
        },
        warmgray: {
          100: '#F2EFE8',
          200: '#E4E1D8',
          300: '#D1CDC1',
          400: '#B5B0A2',
        },
      },
      fontFamily: {
        serif: ['Fraunces', 'Playfair Display', 'Georgia', 'serif'],
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        warm: '0 4px 20px -2px rgba(22, 58, 50, 0.06), 0 2px 6px -1px rgba(22, 58, 50, 0.04)',
        'warm-lg': '0 10px 30px -3px rgba(22, 58, 50, 0.08), 0 4px 12px -2px rgba(22, 58, 50, 0.05)',
      },
    },
  },
  plugins: [],
};
