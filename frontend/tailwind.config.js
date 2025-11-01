/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      spacing: {
        'card-sm': 'clamp(3.5rem, 15vw, 4rem)',
        'card-md': 'clamp(4rem, 18vw, 5rem)',
        'card-lg': 'clamp(5rem, 20vw, 6rem)',
      },
      height: {
        'card-sm': 'clamp(5.25rem, 22.5vw, 6rem)',
        'card-md': 'clamp(6rem, 27vw, 7.5rem)',
        'card-lg': 'clamp(7.5rem, 30vw, 9rem)',
      },
      minHeight: {
        'mobile-info': '20vh',
        'mobile-table': '40vh',
        'mobile-hand': '40vh',
      },
    },
  },
  plugins: [],
}
