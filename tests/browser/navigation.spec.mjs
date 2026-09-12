import { test, expect } from "@playwright/test";

async function settled(page) {
  await expect(page.locator("html[data-transitioning]")).toHaveCount(0);
  await expect(page.locator("[data-route-retiring]")).toHaveCount(0);
}

async function open(page, hash) {
  await page.goto(`./${hash}`);
  await expect(page.locator("#boot-screen")).toHaveCount(0, { timeout: 15000 });
  await page.evaluate(() => document.fonts.ready);
}

async function position(page, link) {
  await link.scrollIntoViewIfNeeded();
  await settled(page);
  // Automation may scroll a partly revealed link just before delivering a click.
  await page.evaluate(() =>
    document.addEventListener(
      "click",
      () => {
        window.clickedScroll = scrollY;
      },
      { capture: true, once: true },
    ),
  );
}

async function expectPosition(page, y) {
  await expect.poll(() => page.evaluate(() => scrollY)).toBeCloseTo(y, 0);
  await settled(page);
  expect(await page.evaluate(() => scrollY)).toBeCloseTo(y, 0);
}

for (const width of [390, 820]) {
  test(`card returns restore list and detail scroll at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1180 });
    await open(page, "#cards");
    const card = page.locator('.record-cover[href="#entry/card-1529"]');
    await position(page, card);
    await card.click();
    const listY = await page.evaluate(() => window.clickedScroll);
    expect(listY).toBeGreaterThan(500);
    await expect(page.locator(".entry-cards")).toBeVisible();
    await expectPosition(page, 0);
    // Read partway down the detail, then use the browser controls both ways.
    await page.evaluate(() => scrollTo(0, 350));
    const detailY = await page.evaluate(() => scrollY);
    await page.goBack();
    await expect(page.locator(".collection-cards")).toBeVisible();
    await expectPosition(page, listY);
    await page.goForward();
    await expect(page.locator(".entry-cards")).toBeVisible();
    await expectPosition(page, detailY);
    await page.locator(".entry-heading>a").click();
    await expect(page.locator(".collection-cards")).toBeVisible();
    await expectPosition(page, listY);
    // Opening the same record anew starts a fresh visit at the top.
    await card.click();
    await expect(page.locator(".entry-cards")).toBeVisible();
    await expectPosition(page, 0);
  });
}

test("detail Back preserves song filters, sort order and position", async ({
  page,
}) => {
  await open(page, "#songs");
  await page.locator('[data-filter-tag="unit"]').click();
  await page.locator('[name="sort"]').selectOption("oldest");
  // Measure the list's final scroll range, not the last pixel of its animated
  // filter resize (the browser clamps a bottom position as that range shrinks).
  await page
    .locator("#results")
    .evaluate((results) =>
      Promise.all(
        results
          .getAnimations()
          .map((animation) => animation.finished.catch(() => {})),
      ),
    );
  const ids = await page
    .locator("#results [data-entry]")
    .evaluateAll((rows) => rows.map((row) => row.dataset.entry));
  const song = page.locator("#results h3 a").last();
  await position(page, song);
  await song.click();
  const y = await page.evaluate(() => window.clickedScroll);
  expect(y).toBeGreaterThan(500);
  await expect(page.locator(".entry-songs")).toBeVisible();
  await settled(page);
  await page.locator(".entry-heading>a").click();
  await expect(page.locator(".collection-songs")).toBeVisible();
  await expectPosition(page, y);
  await expect(page.locator('[name="sort"]')).toHaveValue("oldest");
  await expect(page.locator('[data-filter-tag="unit"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(
    await page
      .locator("#results [data-entry]")
      .evaluateAll((rows) => rows.map((row) => row.dataset.entry)),
  ).toEqual(ids);
});

test("a directly opened detail has a safe category return", async ({
  page,
}) => {
  await open(page, "#entry/card-1529");
  await page.locator(".entry-heading>a").click();
  await expect(page.locator(".collection-cards")).toBeVisible();
  await expectPosition(page, 0);
});
