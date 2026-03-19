import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#6C47FF',
          light: '#8B6FFF',
          dark: '#5035CC',
        },
        purple: {
          bg: '#EDE9FF',
          text: '#6C47FF',
        },
        app: {
          bg: '#F4F4F8',
          dark: '#1A1A2E',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
