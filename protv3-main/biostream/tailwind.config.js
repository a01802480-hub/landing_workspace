/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        'dark-purple': '#1e1b4b',
        'indigo-accent': '#6366f1',
      },
      backgroundColor: {
        'dark-purple': '#1e1b4b',
        'indigo-accent': '#6366f1',
      },
      textColor: {
        'indigo-accent': '#6366f1',
      },
      borderColor: {
        'indigo-accent': '#6366f1',
      },
    },
  },
  plugins: [],
}