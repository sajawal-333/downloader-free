/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        heading: ['"Syne"', 'system-ui', 'sans-serif'],
        mono: ['"Space Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace']
      },
      colors: {
        neon: {
          cyan: '#00FFB2',
          pink: '#FF3CAC'
        },
        surface: {
          glass: 'rgba(255,255,255,0.05)'
        }
      },
      boxShadow: {
        glow: '0 0 30px rgba(0,255,178,0.45)'
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 0 rgba(0,255,178,0.0)' },
          '50%': { boxShadow: '0 0 30px rgba(0,255,178,0.45)' }
        }
      },
      animation: {
        'pulse-glow': 'pulse-glow 1.8s ease-in-out infinite'
      }
    }
  },
  plugins: []
};

