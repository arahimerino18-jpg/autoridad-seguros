import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // ── Brand Colors ──────────────────────────────────────────────────────
      colors: {
        brand: {
          navy: {
            DEFAULT: '#1B2E6B',
            50: '#E8EDF7',
            100: '#D1DCEF',
            200: '#A3B9DF',
            300: '#7596CF',
            400: '#4773BF',
            500: '#1B2E6B',
            600: '#162558',
            700: '#111C45',
            800: '#0C1332',
            900: '#070A1F',
          },
          gold: {
            DEFAULT: '#D4A017',
            50: '#FDF6DC',
            100: '#FBECB9',
            200: '#F7D973',
            300: '#F3C62D',
            400: '#D4A017',
            500: '#A97D12',
            600: '#7F5E0E',
            700: '#543E09',
            800: '#2A1F05',
            900: '#150F02',
          },
          sky: {
            DEFAULT: '#4A90D9',
            50: '#E8F2FC',
            100: '#D1E5F9',
            200: '#A3CBF3',
            300: '#75B1ED',
            400: '#4A90D9',
            500: '#2E75C4',
            600: '#245CA0',
            700: '#1A437C',
            800: '#112A58',
            900: '#071534',
          },
        },
        // ── Semantic colors ─────────────────────────────────────────────────
        success: {
          DEFAULT: '#1A7F4B',
          light: '#E8F6EF',
          dark: '#155534',
        },
        warning: {
          DEFAULT: '#D4A017',
          light: '#FDF3D0',
          dark: '#92400E',
        },
        danger: {
          DEFAULT: '#C0392B',
          light: '#FDECEA',
          dark: '#8B1A1A',
        },
        // ── Neutrals override ────────────────────────────────────────────────
        surface: {
          DEFAULT: '#FFFFFF',
          subtle: '#F8F9FB',
          muted: '#F2F4F7',
        },
      },

      // ── Typography ────────────────────────────────────────────────────────
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        display: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'Courier New', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '1rem' }],
        xs: ['0.75rem', { lineHeight: '1.125rem' }],
        sm: ['0.875rem', { lineHeight: '1.375rem' }],
        base: ['1rem', { lineHeight: '1.625rem' }],
        lg: ['1.125rem', { lineHeight: '1.75rem' }],
        xl: ['1.25rem', { lineHeight: '1.875rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.375rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.75rem' }],
        '5xl': ['3rem', { lineHeight: '3.5rem' }],
      },
      fontWeight: {
        normal: '400',
        medium: '500',
        semibold: '600',
        bold: '700',
      },

      // ── Spacing & Layout ──────────────────────────────────────────────────
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
        '26': '6.5rem',
        '30': '7.5rem',
      },
      maxWidth: {
        '8xl': '88rem',
        '9xl': '96rem',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },

      // ── Shadows ───────────────────────────────────────────────────────────
      boxShadow: {
        'card': '0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04)',
        'card-md': '0 4px 6px rgba(0, 0, 0, 0.05), 0 2px 4px rgba(0, 0, 0, 0.04)',
        'card-lg': '0 10px 15px rgba(0, 0, 0, 0.05), 0 4px 6px rgba(0, 0, 0, 0.04)',
        'card-xl': '0 20px 25px rgba(0, 0, 0, 0.05), 0 10px 10px rgba(0, 0, 0, 0.04)',
        'brand': '0 4px 14px rgba(27, 46, 107, 0.15)',
        'brand-lg': '0 8px 24px rgba(27, 46, 107, 0.2)',
        'gold': '0 4px 14px rgba(212, 160, 23, 0.25)',
        'inner-subtle': 'inset 0 1px 2px rgba(0, 0, 0, 0.06)',
      },

      // ── Animations ────────────────────────────────────────────────────────
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in-up': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-right': {
          from: { opacity: '0', transform: 'translateX(12px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        'slide-in-left': {
          from: { opacity: '0', transform: 'translateX(-12px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
        'blink': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        'spin-slow': {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.2s ease-out',
        'fade-in-up': 'fade-in-up 0.3s ease-out',
        'slide-in-right': 'slide-in-right 0.25s ease-out',
        'slide-in-left': 'slide-in-left 0.25s ease-out',
        'scale-in': 'scale-in 0.2s ease-out',
        'shimmer': 'shimmer 2s linear infinite',
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
        'blink': 'blink 1s step-end infinite',
        'spin-slow': 'spin-slow 3s linear infinite',
      },

      // ── Transitions ───────────────────────────────────────────────────────
      transitionDuration: {
        '0': '0ms',
        '150': '150ms',
        '200': '200ms',
        '250': '250ms',
        '300': '300ms',
        '400': '400ms',
      },
      transitionTimingFunction: {
        'ease-in-out-quart': 'cubic-bezier(0.76, 0, 0.24, 1)',
        'ease-out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },

      // ── Background utilities ───────────────────────────────────────────────
      backgroundImage: {
        'gradient-brand': 'linear-gradient(135deg, #1B2E6B 0%, #2D4A9E 100%)',
        'gradient-brand-dark': 'linear-gradient(135deg, #111C45 0%, #1B2E6B 100%)',
        'gradient-gold': 'linear-gradient(135deg, #D4A017 0%, #F0BB30 100%)',
        'gradient-surface': 'linear-gradient(180deg, #FFFFFF 0%, #F8F9FB 100%)',
        'shimmer-base': 'linear-gradient(90deg, transparent 25%, rgba(255,255,255,0.4) 50%, transparent 75%)',
      },

      // ── Z-index scale ─────────────────────────────────────────────────────
      zIndex: {
        'sidebar': '40',
        'header': '50',
        'overlay': '60',
        'modal': '70',
        'toast': '80',
        'tooltip': '90',
      },
    },
  },
  plugins: [],
}

export default config
