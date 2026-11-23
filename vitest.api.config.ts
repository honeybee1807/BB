import { defineConfig } from "vitest/config";

// API tests run against the LOCAL Supabase stack only (npm run db:start first).
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/api/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 120_000,
    fileParallelism: false,
  },
});
