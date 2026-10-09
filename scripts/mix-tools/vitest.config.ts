import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['*.ts'],
      exclude: ['vitest.config.ts'],
      thresholds: { lines: 90, functions: 90, branches: 85, statements: 90 }
    }
  }
});
