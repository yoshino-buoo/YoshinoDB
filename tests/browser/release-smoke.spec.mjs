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
  await expect(page.locator(".result-count")).toHaveText("20 件の記録");
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

test("profile and card voice scenes render in both languages and open in the editor", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./#profile");
  await expect(page.locator("#boot-screen")).toHaveCount(0, { timeout: 15000 });
  await expect(
    page.locator(".profile-connections .profile-connection"),
  ).toHaveCount(10);
  await expect(page.locator(".voice-links a")).toHaveCount(28);
  await page.locator('[data-lang="zh"]').click();
  await expect(page.locator(".profile-reading")).toContainText(
    "2014 年 5 月 28 日",
  );
  await page.locator(".voice-group summary").first().click();
  await expect(page.locator(".voice-links a").first()).toBeVisible();
  await expect(page.locator(".voice-links a").first()).toHaveAttribute(
    "href",
    /^https:\/\/wiki\.biligame\.com\/imascg\//,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.goto("./#entry/sr-20220819_1");
  await expect(page.locator(".voice-stage")).toHaveCount(2);
  await expect(page.locator(".voice-links a")).toHaveCount(72);
  await page.locator('[data-variant="2"]').click();
  await expect(page.locator('[data-variant-panel="2"] img')).toBeVisible();
  expect(
    await page.locator('[data-variant-panel="2"] img').evaluate(async (i) => {
      await i.decode();
      return i.naturalWidth;
    }),
  ).toBe(1280);
  await page.goto("./#editor");
  await page.locator("[data-category]").selectOption("profile");
  await page.locator('[data-select="profile-yoshino"]').click();
  await page.locator('[data-tab="details"]').click();
  await expect(page.locator("#edit-panel")).toContainText("伙伴与缘分");
  await expect(page.locator("#edit-panel")).toContainText("话语与声音");
  await page.locator("[data-editor-preview]").click();
  await expect(
    page.locator(".studio-preview-content .profile-connections"),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
