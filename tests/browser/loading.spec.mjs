import { test, expect } from "@playwright/test";
test("the opening book waits for visible artwork and starts the home animation only after it is ready", async ({
  page,
}) => {
  let release;
  const gate = new Promise((resolve) => (release = resolve));
  await page.route("**/assets/yoshino.png", async (route) => {
    await gate;
    await route.continue();
  });
  await page.goto("/#home", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".intro-grid")).toBeAttached();
  await page.waitForTimeout(2000);
  await expect(page.locator("#boot-screen")).not.toHaveClass(/is-leaving/);
  expect(
    await page
      .locator(".portrait-figure>img")
      .evaluate((el) => el.getAnimations().length),
  ).toBe(0);
  release();
  await expect(page.locator("#boot-screen")).toHaveClass("is-leaving");
  const edges = await page.evaluate(() => {
    const left = document.querySelector(".boot-panel-left"),
      right = document.querySelector(".boot-panel-right");
    for (const el of [left, right])
      for (const animation of el.getAnimations()) {
        animation.pause();
        animation.currentTime = 300;
      }
    const result = {
      left: left.getBoundingClientRect().right,
      right: right.getBoundingClientRect().left,
      middle: innerWidth / 2,
    };
    for (const el of [left, right])
      for (const animation of el.getAnimations()) animation.play();
    return result;
  });
  expect(edges.left).toBeLessThan(edges.middle - 20);
  expect(edges.right).toBeGreaterThan(edges.middle + 20);
  await expect(page.locator("#boot-screen")).toHaveCount(0);
  await page.locator('.header a[href="#songs"]').click();
  await expect(page.locator(".collection-songs")).toBeVisible();
  await expect(page.locator("#boot-screen")).toHaveCount(0);
});
test("cached visits keep the minimum loading time, and reduced motion uses no page rotation", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    window.openingTimes = [];
    new MutationObserver(() => {
      const screen = document.querySelector("#boot-screen");
      if (screen?.classList.contains("is-leaving"))
        window.openingTimes.push(performance.now());
    }).observe(document, {
      subtree: true,
      attributes: true,
      attributeFilter: ["class"],
    });
  });
  await page.goto("/#home");
  await expect(page.locator("#boot-screen")).toHaveCount(0);
  const times = await page.evaluate(() => window.openingTimes);
  expect(times.length).toBeGreaterThan(0);
  expect(Math.min(...times)).toBeGreaterThanOrEqual(1750);
  expect(
    await page
      .locator(".portrait-figure")
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("none");
});
