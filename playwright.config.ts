import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  use: {
    baseURL: process.env.FRONTENDER_BASE_URL || "http://127.0.0.1:5181",
    channel: "msedge",
    headless: true,
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
  },
  webServer: process.env.FRONTENDER_BASE_URL
    ? undefined
    : {
        command: "npm run dev -- --port 5181",
        url: "http://127.0.0.1:5181",
        reuseExistingServer: false,
        timeout: 60000,
      },
});
