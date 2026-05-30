import parentConfig from '../tailwind.config.ts'

export default {
  ...parentConfig,
  content: ['./index.html', './src/**/*.{ts,tsx}', '../src/**/*.{ts,tsx}'],
}