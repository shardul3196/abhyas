/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        warm: {
          50: '#fbf9f5',
          100: '#f6f1e8',
          200: '#ede2d0',
          300: '#e1cdb2',
          400: '#cfb28f',
          500: '#bf986f',
          600: '#a87f57',
          700: '#8c6646',
          800: '#5c432d',
          900: '#3a2b1c',
          950: '#23180f',
        }
      }
    },
  },
  plugins: [],
}
