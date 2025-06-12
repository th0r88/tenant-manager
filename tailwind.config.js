/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/frontend/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [
    require('daisyui'),
  ],
  daisyui: {
    themes: ["business"],
  },
}