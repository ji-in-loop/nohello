import { defineConfig, coverageConfigDefaults } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['lcov', 'text-summary'],
      // src/standalone.ts is the env-var-driven CLI entrypoint — thin wiring with no branching
      // logic of its own, and not meaningfully unit-testable without mocking the whole process
      // lifecycle. createNoHelloBot (what it calls) is the tested surface.
      exclude: [...coverageConfigDefaults.exclude, 'src/standalone.ts'],
    },
  },
});
