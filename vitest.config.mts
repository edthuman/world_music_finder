import { existsSync } from "node:fs";
import { defineConfig } from "vitest/config";

if (existsSync(".env.test")) process.loadEnvFile(".env.test");
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) {
  throw new Error(
    "Missing TEST_DATABASE_URL - set one in .env.test",
  );
}

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/global-setup.ts"],
    env: { DATABASE_URL: testDatabaseUrl },
    fileParallelism: false,
  },
});
