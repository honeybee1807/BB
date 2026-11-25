import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config";

// Firefox and WebKit run apart from the main suite, one browser at a time: npm run test:e2e:browsers
export default defineConfig({
  ...base,
  workers: 1,
  testMatch: /.*\.ui\.spec\.ts/,
  projects: [
    { name: "desktop-firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "desktop-webkit", use: { ...devices["Desktop Safari"] } },
    { name: "iphone-webkit", use: { ...devices["iPhone 15"] } },
  ],
});
