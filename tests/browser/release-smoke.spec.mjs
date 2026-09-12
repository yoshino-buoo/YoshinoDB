import { test, expect } from "@playwright/test";

test("published app opens, switches language, keeps BGM controls and loads the editor", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("./#home");
  await expect(page.locator("#boot-screen")).toHaveCount(0, { timeout: 15000 });
  await expect(page.locator(".portrait-figure img")).toBeVisible();
  expect(
    await page
      .locator(".portrait-figure img")
      .evaluate((image) => image.naturalWidth),
  ).toBeGreaterThan(0);
  await page.locator('[data-lang="zh"]').click();
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-Hans");
  await expect(page.locator("main h1")).toContainText("与芳乃相遇");
  const bgm = page.locator("[data-bgm-toggle]");
  await bgm.click();
  await expect(bgm).toHaveAttribute("aria-checked", "false");
  await page.locator('footer a[href="#editor"]').click();
  await expect(page.locator("[data-new]")).toBeVisible();
  await expect(page.locator("[data-select]").first()).toBeVisible();
  await expect(bgm).toHaveAttribute("aria-checked", "false");
  expect(errors).toEqual([]);
});
