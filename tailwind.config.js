/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  "var(--text-primary)",
          100: "var(--text-secondary)",
          200: "var(--text-muted)",
          300: "var(--text-subtle)",
          700: "var(--surface-elevated)",
          800: "var(--surface)",
          900: "var(--background)",
          purple: "var(--primary)",
          violet: "var(--primary)",
          magenta:"var(--secondary)",
          pink:  "var(--secondary)",
          lavender:"var(--primary)",
          ice:   "var(--accent)",
        },
      },
      boxShadow: {
        soft: "var(--app-shadow)",
      },
    },
  },
  plugins: [],
};