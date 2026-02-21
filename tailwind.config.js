/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        teamA: '#6b8aad',
        teamB: '#ad6b6b',
        gold: '#c8aa50',
      },
    },
  },
  plugins: [],
};
