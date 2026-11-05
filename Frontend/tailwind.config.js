/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        page: '#edf1ff',
        ink: '#11131c',
        muted: '#303343',
        electric: '#2637de',
      },
      fontFamily: {
        sans: ['Montserrat', 'Poppins', 'Inter', 'Segoe UI', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        subtle: '0 18px 50px rgba(15, 20, 60, 0.08)',
      },
    },
  },
  plugins: [],
}
