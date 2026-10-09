import path from 'node:path';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig(async () => {
  const migrations = await readD1Migrations(path.join(import.meta.dirname, 'migrations'));

  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: './wrangler.jsonc' },
        miniflare: {
          bindings: { TEST_MIGRATIONS: migrations, ADMIN_TOKEN: 'test-admin-token' }
        }
      })
    ],
    test: {
      setupFiles: ['./test/apply-migrations.ts'],
      coverage: {
        provider: 'istanbul',
        include: ['src/**'],
        thresholds: { lines: 95, functions: 95, branches: 90, statements: 95 }
      }
    }
  };
});
