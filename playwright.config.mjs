import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  use: {
    baseURL: "http://127.0.0.1:5173",
    viewport: { width: 1280, height: 1000 },
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        browserName: "chromium",
        channel:
          process.platform === "darwin" &&
          existsSync(
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
          )
            ? "chrome"
            : undefined,
      },
    },
    {
      name: "webkit",
      testMatch: "navigation-frames.spec.mjs",
      use: { browserName: "webkit" },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: !process.env.CI,
  },
});
