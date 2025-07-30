/** @type {import('tailwindcss').Config} */
// @ts-check
/* eslint-env node */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  plugins: [
    require('@tailwindcss/typography'),
  ],
}