import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#0870e4',
          primaryLight: '#3B9EFF',
          primaryDark: '#0659B8',
          pink: '#D80364',
          orange: '#0870e4',
          dark: '#12081F',
          surface: '#1E122E',
          glass: 'rgba(255, 255, 255, 0.03)',
          glassBorder: 'rgba(255, 255, 255, 0.08)',
          pastel: {
            blue: '#E6F2FF',
            pink: '#FCE7F3',
            green: '#D1FAE5',
            yellow: '#FEF3C7',
            orange: '#E6F2FF',
          },
          accent: {
            mint: '#10B981',
            coral: '#F87171',
            violet: '#0870e4',
            amber: '#F59E0B',
            blue: '#0870e4',
          },
          accentLight: {
            mint: '#D1FAE5',
            coral: '#FEE2E2',
            violet: '#E6F2FF',
            amber: '#FEF3C7',
            blue: '#E6F2FF',
          }
        }
      },
      fontFamily: {
        sans: ['var(--font-poppins)', 'sans-serif'],
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #0870e4 0%, #3B9EFF 100%)',
        'blue-gradient': 'linear-gradient(135deg, #0870e4 0%, #3B9EFF 100%)',
        'blue-gradient-light': 'linear-gradient(135deg, #3B9EFF 0%, #5AB0FF 100%)',
        'surface-gradient': 'linear-gradient(180deg, rgba(30, 18, 46, 0.7) 0%, rgba(18, 8, 31, 0.9) 100%)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out forwards',
        'slide-up': 'slideUp 0.5s ease-out forwards',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'scale-in': 'scaleIn 0.2s ease-out forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      boxShadow: {
        'soft': '0 2px 8px rgba(0, 0, 0, 0.04)',
        'soft-md': '0 4px 12px rgba(0, 0, 0, 0.08)',
        'soft-lg': '0 8px 24px rgba(0, 0, 0, 0.12)',
      }
    },
  },
  plugins: [],
};

export default config;
