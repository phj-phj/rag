import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/__tests__/**/*.test.ts'],
    environment: 'node',
    fileParallelism: false,
    setupFiles: ['src/__tests__/helpers/test-setup.ts'],
    env: {
      NODE_ENV: 'test',
      DB_NAME: 'papier_test',
      DEBUG_AI: 'false',
    },
  },
})
