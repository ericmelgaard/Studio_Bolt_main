/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Rubik', 'Arial', 'Helvetica', 'sans-serif'],
      },
      colors: {
        // Style guide tokens (CLAUDE.md): primary action + brand header
        brand: {
          DEFAULT: '#00adf0',
          dark: '#008ec5',
          navy: '#002e5e',
        },
        wand: {
          magenta: {
            50: '#fdf4fd',
            100: '#fbe8fb',
            200: '#f7d1f7',
            300: '#f3aaf3',
            400: '#eb74eb',
            500: '#de38de',
            600: '#c820c8',
            700: '#a518a5',
            800: '#851485',
            900: '#6b116b',
          },
          cyan: {
            50: '#e6f8ff',
            100: '#ccf1ff',
            200: '#99e3ff',
            300: '#66d5ff',
            400: '#33c7ff',
            500: '#00adf0',
            600: '#0094d1',
            700: '#0077a8',
            800: '#005a80',
            900: '#003d57',
          },
          navy: {
            50: '#e6eaed',
            100: '#ccd5db',
            200: '#99abb7',
            300: '#668193',
            400: '#33576f',
            500: '#002e5e',
            600: '#002550',
            700: '#001d40',
            800: '#001530',
            900: '#000c20',
          },
        },
      },
    },
  },
  plugins: [],
};
