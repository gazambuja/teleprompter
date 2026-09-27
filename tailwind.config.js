/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        serif: ['"Newsreader Variable"', 'Georgia', 'serif'],
        sans: ['"JetBrains Mono Variable"', 'ui-sans-serif', 'system-ui'],
        mono: ['"JetBrains Mono Variable"', 'ui-monospace', 'monospace']
      },
      // Channels come from the active theme (App sets --paper/--accent/--ink/--spoken).
      colors: {
        ink: 'rgb(var(--ink) / <alpha-value>)',
        paper: {
          DEFAULT: 'rgb(var(--paper) / <alpha-value>)',
          dim: 'rgb(var(--paper) / 0.55)',
          muted: 'rgb(var(--paper) / 0.32)'
        },
        amber: {
          DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
          glow: 'rgb(var(--accent) / 0.18)'
        },
        cyan: { DEFAULT: 'rgb(var(--spoken) / <alpha-value>)' }
      },
      boxShadow: {
        'inner-glow': 'inset 0 0 0 1px rgb(var(--paper) / 0.06)',
        'panel': '0 24px 60px -20px rgba(0,0,0,0.6), 0 0 0 1px rgb(var(--paper) / 0.06)'
      },
      transitionTimingFunction: {
        'premium': 'cubic-bezier(0.4, 0, 0.2, 1)'
      }
    }
  },
  plugins: []
};
