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

test("card games stay separate and return to the selected game's filters", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./#cards");
  await expect(page.locator("#boot-screen")).toHaveCount(0, { timeout: 15000 });
  const catalog = await (
    await page.request.get(new URL("data/catalog.json", page.url()).href)
  ).json();
  const count = (game, rarity) =>
    catalog.items.filter(
      (x) =>
        x.kind === "cards" &&
        x.game === game &&
        (!rarity || x.rarity === rarity),
    ).length;
  const records = page.locator("#results .record");
  await expect(records).toHaveCount(count("deresute"));
  await expect(page.locator('#results [data-entry^="mobamas-"]')).toHaveCount(
    0,
  );
  await page.locator('[data-card-game="mobamas"]').click();
  await expect(page.locator('#results [data-entry^="mobamas-"]')).toHaveCount(
    count("mobamas"),
  );
  await expect(records).toHaveCount(count("mobamas"));
  await page.locator('[data-rarity="R"]').click();
  await expect(records).toHaveCount(count("mobamas", "R"));
  const art = records.first().locator(".record-cover");
  await art.click();
  await expect(page.locator(".entry-cards .mobamas-art")).toBeVisible();
  await expect(page.locator(".stats-table")).toContainText("初期攻");
  await expect(page.locator(".stats-table")).not.toContainText("Vocal");
  await page.locator('[data-variant="1"]').click();
  await expect(page.locator('[data-variant-panel="1"]')).toBeVisible();
  await page.goBack();
  await expect(records).toHaveCount(count("mobamas", "R"));
  await expect(page.locator('[data-card-game="mobamas"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator('[name="rarity"]')).toHaveValue("R");
  await page.locator('[data-card-game="deresute"]').click();
  await expect(records).toHaveCount(count("deresute"));
  await expect(page.locator('[name="rarity"]')).toHaveValue("all");
});
