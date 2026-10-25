/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * `npm run test:solution` sets SOLUTION=1.
 * Then every `import ... from './index'` inside a *.test.ts(x) file is
 * redirected to './solution', so the same tests run against the reference answer.
 */
function solutionSwap(): Plugin {
  return {
    name: 'solution-swap',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (process.env.SOLUTION !== '1' || !importer) return null;
      if (!/\.test\.[jt]sx?$/.test(importer)) return null;
      if (source !== './index') return null;
      return this.resolve('./solution', importer, { ...options, skipSelf: true });
    },
  };
}

export default defineConfig({
  plugins: [react(), solutionSwap()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['{js,react,performance,ai}/**/*.test.{ts,tsx}'],
  },
});
