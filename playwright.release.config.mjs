import config from "./playwright.config.mjs";

const baseURL =
  process.env.YOSHINO_TEST_BASE_URL || "http://127.0.0.1:4273/YoshinoDB/";
const testMatch = ["navigation.spec.mjs", "release-smoke.spec.mjs"];

export default {
  ...config,
  workers: 2,
  timeout: 45000,
  projects: config.projects.map((project) => ({ ...project, testMatch })),
  use: { ...config.use, baseURL },
  webServer: process.env.YOSHINO_TEST_BASE_URL
    ? undefined
    : {
        command:
          "npm run preview -- --port 4273 --strictPort --base /YoshinoDB/",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
      },
};
