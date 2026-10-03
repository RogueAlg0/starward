/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,html}"],
  theme: {
    extend: {
      colors: {
        abyss: "#0b0e1a",
        panel: "#131829",
        panel2: "#1a2138",
        line: "#2a3354",
        ink: "#d7def5",
        dim: "#8b94b8",
        accent: "#6fd3ff",
        gold: "#ffd36f",
        good: "#7dffa8",
        bad: "#ff8d7d",
        warn: "#ffb46f",
      },
      fontFamily: {
        mono: ["Consolas", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};
