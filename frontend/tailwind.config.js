/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
      },
      colors: {
        ink: "#042C53",
        amber: {
          DEFAULT: "#EF9F27",
          dark: "#854F0B",
        },
      },
    },
  },
  plugins: [],
};