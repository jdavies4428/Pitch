/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        pixel: ['"Silkscreen"', 'monospace'],
      },
      colors: {
        teamA: { DEFAULT: '#70a1ff', light: '#a0c4ff', dark: '#4a80e0' },
        teamB: { DEFAULT: '#ff4757', light: '#ff6b81', dark: '#c0392b' },
        table: { bg: '#0a1a2e', dark: '#061420', border: '#1a3a5e' },
        suitRed: '#ff4757',
        suitBlack: '#e0e0ff',
        trump: '#ffd32a',
        gold: '#eccc68',
        bg: { primary: '#0a0a1a', secondary: '#121230', tertiary: '#0d0d25' },
      },
      animation: {
        shimmer: 'shimmer 3s linear infinite',
        glow: 'glow 2s ease-in-out infinite',
        slideUp: 'slideUp 0.4s ease-out',
        boardEntry: 'boardEntry 0.5s ease-out',
        pulse: 'pulse 1s ease-in-out infinite',
        cardPlay: 'cardPlay 0.3s ease-out forwards',
        cardDeal: 'cardDeal 0.3s ease-out forwards',
        trickCollect: 'trickCollect 0.4s ease-in forwards',
        setBack: 'setBack 0.6s ease-in-out',
        bidBubble: 'bidBubble 0.3s ease-out forwards',
        thinkDot: 'thinkDot 1s infinite',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition: '200% center' },
        },
        glow: {
          '0%, 100%': { opacity: '0.7' },
          '50%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(30px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        boardEntry: {
          '0%': { transform: 'scale(0.9)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        pulse: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.05)' },
        },
        cardPlay: {
          '0%': { transform: 'scale(1)', opacity: '1' },
          '100%': { transform: 'scale(0.85)', opacity: '0.9' },
        },
        cardDeal: {
          '0%': { transform: 'scale(0) rotate(180deg)', opacity: '0' },
          '100%': { transform: 'scale(1) rotate(0deg)', opacity: '1' },
        },
        trickCollect: {
          '0%': { transform: 'scale(1)', opacity: '1' },
          '100%': { transform: 'scale(0.3)', opacity: '0' },
        },
        setBack: {
          '0%': { color: '#ff4757' },
          '50%': { color: '#ff0000', transform: 'scale(1.3)' },
          '100%': { color: '#ff4757', transform: 'scale(1)' },
        },
        bidBubble: {
          '0%': { transform: 'scale(0)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        thinkDot: {
          '0%, 100%': { opacity: '0.3' },
          '50%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
