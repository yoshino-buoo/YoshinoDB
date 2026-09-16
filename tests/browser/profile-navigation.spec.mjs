import { test, expect } from "@playwright/test";

async function openProfile(page, route = "#profile") {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    localStorage.setItem("yoshino-lang", "zh");
    localStorage.setItem("yoshino-bgm-enabled", "false");
  });
  await page.goto(`./${route}`);
  await expect(page.locator("#boot-screen")).toHaveCount(0, { timeout: 15000 });
  await page.evaluate(() => document.fonts.ready);
}

for (const width of [320, 390, 820, 1024]) {
  test(`compact contents jump, track reading and dismiss without widening the page at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await openProfile(page);
    const toggle = page.locator(".profile-toc-toggle");
    const list = page.locator(".profile-toc-list");
    await expect(toggle).toBeVisible();
    await expect(list).toBeHidden();
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    const voices = page.locator("[data-profile-jump]").filter({ hasText: "话语与声音" });
    // Reaching a lower item must scroll the menu, then click before it closes.
    await voices.click();
    await expect(list).toBeHidden();
    await expect(voices).toHaveAttribute("aria-current", "location");
    await expect(page.locator(".profile-toc-current")).toHaveText("话语与声音");
    await expect(page).toHaveURL(/#profile$/);
    const heading = page.locator(".voice-guide h2");
    await expect(heading).toBeFocused();
    const barBox = await toggle.boundingBox();
    const headingBox = await heading.boundingBox();
    expect(headingBox.y).toBeGreaterThan(barBox.y + barBox.height);
    expect(barBox.y).toBeLessThan(20);
    // Ordinary reading also updates the compact label.
    await page.locator(".profile-stickers").evaluate((el) => el.scrollIntoView());
    await expect(page.locator(".profile-toc-current")).toHaveText("贴纸与小小日常");
    await toggle.click();
    await page.keyboard.press("Escape");
    await expect(list).toBeHidden();
    await expect(toggle).toBeFocused();
    await toggle.click();
    await page.locator(".profile-stickers h2").click();
    await expect(list).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await toggle.click();
    await page.locator('[data-profile-jump="0"]').click();
    await expect(page.locator(".profile-toc-current")).toHaveText("基本资料");
    expect(await page.locator(".profile-grid").evaluate((el) => el.getBoundingClientRect().top)).toBeGreaterThan(80);
  });
}

for (const width of [1280, 1440]) {
test(`wide contents preserve the reading width, fit short screens, and work on both profile routes at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 700 });
  await openProfile(page, "#entry/profile-yoshino");
  await expect(page.locator(".profile-toc-toggle")).toBeHidden();
  await expect(page.locator(".profile-toc-list")).toBeVisible();
  const reading = await page.locator(".profile-reading").boundingBox();
  expect(reading.width).toBe(900);
  expect(reading.x).toBe((width - 900) / 2);
  const last = page.locator("[data-profile-jump]").last();
  await last.click();
  await expect(last).toHaveAttribute("aria-current", "location");
  await expect(page).toHaveURL(/#entry\/profile-yoshino$/);
  const listBox = await page.locator(".profile-toc-list").boundingBox();
  expect(listBox.x).toBeGreaterThanOrEqual(0);
  expect(listBox.x).toBeGreaterThan(reading.x + reading.width);
  expect(listBox.x + listBox.width).toBeLessThanOrEqual(width);
  expect(listBox.y + listBox.height).toBeLessThanOrEqual(700);
  // Rebuilds and route changes must not retain an old menu or current section.
  await page.locator('.language [data-lang="ja"]').click();
  await expect(page.locator(".profile-toc-label").first()).toHaveText("目次");
  await page.goto("./#songs");
  await expect(page.locator("yoshino-profile-nav")).toHaveCount(0);
  await page.goto("./#profile");
  await expect(page.locator("#boot-screen")).toHaveCount(0, { timeout: 15000 });
  await expect(page.locator("yoshino-profile-nav")).toHaveCount(1);
  await expect(page.locator('[data-profile-jump="0"]')).toHaveAttribute("aria-current", "location");
});
}

test("preview navigation remains interactive and follows edited section titles", async ({ page }) => {
  await openProfile(page, "#editor");
  await page.locator("[data-search]").fill("profile-yoshino");
  await page.locator('[data-select="profile-yoshino"]').click();
  await page.locator("[data-editor-preview]").click();
  await expect(page.locator("[data-preview-status]")).toContainText("已自动保存");
  await page.locator('[data-preview-width="390"]').click();
  const frame = page.frameLocator("[data-live-preview]");
  await frame.locator(".profile-toc-toggle").click();
  await frame.locator('[data-profile-jump="1"]').click();
  await expect(frame.locator('[data-profile-jump="1"]')).toHaveAttribute("aria-current", "location");
  await frame.locator("#profile-section-1 h2").click();
  const title = page.locator('[data-field="sections.0.title"][data-locale="zh"]');
  await expect(title).toBeVisible();
  await title.fill("编辑后的章节标题");
  await expect(frame.locator(".profile-toc-current")).toHaveText("编辑后的章节标题");
  await frame.locator(".profile-toc-toggle").click();
  await expect(frame.locator('[data-profile-jump="1"]')).toContainText("编辑后的章节标题");
});
