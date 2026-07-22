/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f2f5ff",
          100: "#e2e8ff",
          400: "#7c8cff",
          500: "#5865f2",
          600: "#4650c9",
          700: "#363da0",
        },
      },
    },
  },
  plugins: [],
};
