import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        aop: {
          purple:  '#7B6EE8',
          teal:    '#1CC8A0',
          amber:   '#F5A623',
          coral:   '#E85D40',
          bg:      '#07090D',
          surface: '#0C0F22',
          text:    '#EAE8F5',
          muted:   '#5A5870',
        },
      },
      fontFamily: {
        serif: ['Georgia', 'Times New Roman', 'serif'],
      },
    },
  },
  plugins: [],
}

export default config
