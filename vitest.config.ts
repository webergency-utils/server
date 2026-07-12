import { defineConfig } from 'vitest/config';

import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      'typescript': path.resolve('./src/compiler/ts.ts')
    }
  },
  test: {
    environment: 'node',
    include: ['src/tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/cli.ts', 'src/transformer.ts']
    }
  }
});
