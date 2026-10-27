/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Murmura / Editorial Palette Tokens
        cream: '#f5efe2',
        sand: '#e8dcc4',
        sage: '#a8b89a',
        moss: {
          light: '#728560',
          DEFAULT: '#5a6b4a',
          dark: '#414e35',
        },
        bark: {
          light: '#4a4338',
          DEFAULT: '#3a3528',
          dark: '#242018',
        },
        terra: {
          light: '#d9926f',
          DEFAULT: '#c47a55',
          dark: '#a85f3b',
          soft: 'rgba(196,122,85,0.15)',
        },
        sky: '#b8c8d4',
        ink: {
          DEFAULT: '#2a2620',
          muted: '#4a4338',
          subtle: '#6a6358',
          light: '#8a8274',
        },
        hairline: 'rgba(58,53,40,0.08)',
        'hairline-strong': 'rgba(58,53,40,0.15)',
        glass: 'rgba(255,255,255,0.65)',
        'glass-cream': 'rgba(245,239,226,0.92)',
        
        // Backward-compatible aliases for existing components
        paper: '#f5efe2',
        surface: '#ffffff',
        evergreen: {
          50: '#F0F6F4',
          100: '#DDECE8',
          600: '#5a6b4a',
          700: '#414e35',
          800: '#3a3528',
          900: '#2a2620',
          950: '#1b1814',
        },
        coral: {
          50: '#FDF3F1',
          100: '#FCE4DF',
          500: '#c47a55',
          600: '#b06742',
          700: '#94512f',
        },
        marigold: {
          50: '#FCF8EE',
          100: '#F7EED2',
          500: '#D7AA4A',
          600: '#C29437',
        },
        warmgray: {
          100: '#f5efe2',
          200: 'rgba(58,53,40,0.08)',
          300: 'rgba(58,53,40,0.15)',
          400: '#8a8274',
        },
      },
      fontFamily: {
        serif: ['"Instrument Serif"', 'Georgia', 'serif'],
        sans: ['Manrope', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'card-float': '0 14px 36px rgba(58, 53, 40, 0.18)',
        'card-hover': '0 30px 60px rgba(58, 53, 40, 0.10)',
        'hero-img': '0 30px 80px rgba(58, 53, 40, 0.18)',
        warm: '0 4px 20px -2px rgba(58, 53, 40, 0.06), 0 2px 6px -1px rgba(58, 53, 40, 0.04)',
        'warm-lg': '0 10px 30px -3px rgba(58, 53, 40, 0.08), 0 4px 12px -2px rgba(58, 53, 40, 0.05)',
      },
    },
  },
  plugins: [],
};
