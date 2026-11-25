import type { Config } from "tailwindcss";
import colors from "tailwindcss/colors";

/**
 * Paleta alineada con vstation: acento verde (vstation --secondary = hsl(142 70% 50%)) y grises
 * neutros (vstation usa negro puro en oscuro). Se remapean `indigo` y `gray`, que son los que usa
 * todo el panel, en lugar de cambiar cada clase.
 */
const vstationGreen = {
  50: "#ecfdf3",
  100: "#d1fae1",
  200: "#a7f3c6",
  300: "#6ee7a3",
  400: "#49df80", // vstation --secondary-light
  500: "#26d968", // vstation --secondary
  600: colors.green[600],
  700: colors.green[700],
  800: colors.green[800],
  900: colors.green[900],
  950: colors.green[950],
};

export default {
  darkMode: "class",
  content: {
    relative: true,
    files: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  },
  theme: {
    extend: {
      colors: {
        indigo: vstationGreen,
        gray: colors.neutral,
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
} satisfies Config;
