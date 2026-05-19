/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  "#f4f2fa",
          100: "#f0eff0",
          200: "#d9d9d9",
          300: "#b3b3b3",
          700: "#6557b1",
          800: "#17046b",
          900: "#0c0919",
          purple: "#7f129f",
          violet: "#9b34ba",
          magenta:"#be0c8a",
          pink:  "#dc3aa4",
          lavender:"#8070cd",
          ice:   "#dff0ff",
        },
      },
      boxShadow: {
        soft: "0 10px 30px rgba(12,9,25,.25)",
      },
    },
  },
  plugins: [],
};