import { defineConfig, devices } from "@playwright/test";

// End-to-end tests run against `npm run dev` and the LOCAL Supabase stack only.
const baseURL = "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: "list",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [
    // Route-level security tests: once, on desktop.
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    // UI tests also on a phone-sized viewport.
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] }, testMatch: /.*\.ui\.spec\.ts/ },
  ],
  webServer: {
    command: "npm run dev",
    url: `${baseURL}/admin/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
