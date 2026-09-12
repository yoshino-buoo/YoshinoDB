import { test, expect } from "@playwright/test";

async function ready(page, route = "home") {
  await page.goto(`/#${route}`);
  await expect(page.locator("main h1")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

// Observe the real browser snapshot boundary; DOM-only opacity checks miss this bug.
async function observeSnapshots(page) {
  await page.addInitScript(() => {
    window.motionSnapshots = [];
    if (!document.startViewTransition) return;
    const original = document.startViewTransition.bind(document);
    const visible = () =>
      [
        ...document.querySelectorAll(
          "[data-reveal],.entry-summary>*,.album-art",
        ),
      ].filter((el) => {
        const r = el.getBoundingClientRect();
        return r.top < innerHeight && r.bottom > 0;
      });
    document.startViewTransition = (update) => {
      const sample = { route: location.hash, elements: [] };
      window.motionSnapshots.push(sample);
      const transition = original(async () => {
        await update();
        sample.elements = visible().map((el) => ({
          el,
          start: Number(getComputedStyle(el).opacity),
        }));
      });
      transition.finished
        .then(() => {
          sample.deltas = sample.elements
            .filter((x) => x.el.isConnected)
            .map((x) =>
              Math.abs(Number(getComputedStyle(x.el).opacity) - x.start),
            );
          delete sample.elements;
          sample.finished = true;
        })
        .catch(() => {});
      return transition;
    };
  });
}

test("category navigation and artwork transitions never uncover a different reveal state", async ({
  page,
}) => {
  await observeSnapshots(page);
  await ready(page);
  for (const route of ["cards", "songs", "videos", "songs"]) {
    await page.locator(`.header a[href="#${route}"]`).click();
    await expect(page.locator(`.collection-${route}`)).toBeVisible();
    await page.waitForTimeout(1050);
  }
  await page.locator('#results h3 a[href="#entry/enamoral"]').click();
  await expect(page.locator(".entry-songs")).toBeVisible();
  await page.waitForTimeout(1300);
  const snapshots = await page.evaluate(() => window.motionSnapshots);
  expect(snapshots.length).toBeGreaterThan(0);
  expect(snapshots.every((x) => x.finished)).toBe(true);
  const deltas = snapshots.flatMap((x) => x.deltas || []);
  expect(deltas.length).toBeGreaterThan(0);
  expect(
    Math.max(...deltas),
    "The captured page must match the live page when uncovered",
  ).toBeLessThan(0.08);
});

test("rapid navigation and filters settle on the last choice without hidden visible rows", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await ready(page, "cards");
  for (const route of ["songs", "videos", "stories", "songs"]) {
    await page.locator(`.header a[href="#${route}"]`).click({ force: true });
    await page.waitForTimeout(70);
  }
  await expect(page.locator(".collection-songs")).toBeVisible();
  for (const tag of ["solo", "unit", "cover", "all", "solo"]) {
    await page.locator(`[data-filter-tag="${tag}"]`).click({ force: true });
    await page.waitForTimeout(80);
  }
  await page.waitForTimeout(1600);
  await expect(page.locator('[data-filter-tag="solo"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  const state = await page.evaluate(() => ({
    hidden: [...document.querySelectorAll("#results .record")].filter((el) => {
      const r = el.getBoundingClientRect();
      return (
        r.top < innerHeight &&
        r.bottom > 0 &&
        Number(getComputedStyle(el).opacity) < 0.98
      );
    }).length,
    count: document.querySelector(".result-count").textContent.match(/\d+/)[0],
    rows: document.querySelectorAll("#results .record").length,
    overflow: document.documentElement.scrollWidth > innerWidth,
  }));
  expect(state.hidden).toBe(0);
  expect(Number(state.count)).toBe(state.rows);
  expect(state.overflow).toBe(false);
  expect(errors).toEqual([]);
});

test("reduced motion and the garden pause control stop continuous animation", async ({
  page,
}) => {
  await ready(page);
  await page.locator("[data-motion-toggle]").click();
  expect(
    await page
      .locator(".garden-haze")
      .evaluate((el) => getComputedStyle(el).animationPlayState),
  ).toBe("paused");
  await page.locator("[data-motion-toggle]").click();
  expect(
    await page
      .locator(".garden-haze")
      .evaluate((el) => getComputedStyle(el).animationPlayState),
  ).toBe("running");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator("[data-motion-toggle]")).toBeDisabled();
  await page.locator('.header a[href="#cards"]').click();
  await expect(page.locator(".collection-cards")).toBeVisible();
  expect(
    await page
      .locator("#results .record")
      .first()
      .evaluate((el) => getComputedStyle(el).opacity),
  ).toBe("1");
  expect(
    await page.evaluate(
      () =>
        document.getAnimations().filter((a) => a.playState === "running")
          .length,
    ),
  ).toBe(0);
});

test("artwork reversals settle to one complete image", async ({ page }) => {
  await ready(page, "entry/card-4089");
  for (const variant of ["1", "0", "1", "0", "1"]) {
    await page.locator(`[data-variant="${variant}"]`).click({ force: true });
    await page.waitForTimeout(100);
  }
  await page.waitForTimeout(1300);
  await expect(page.locator("[data-variant-panel]:not([hidden])")).toHaveCount(
    1,
  );
  await expect(page.locator('[data-variant="1"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator('[data-variant-panel="1"]')).toBeVisible();
  expect(
    await page
      .locator(".art-sheen")
      .evaluate((el) => getComputedStyle(el).opacity),
  ).toBe("0");
});

test("mobile language changes and wrapped category controls keep their geometry", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  await page.locator('[data-lang="zh"]').click();
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-Hans");
  await expect(page.locator("[data-motion-toggle]")).toBeEnabled();
  await page.locator("[data-motion-toggle]").click();
  await expect(page.locator("[data-motion-toggle]")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.locator('.header a[href="#videos"]').click();
  await expect(page.locator(".collection-videos")).toBeVisible();
  const filter = page.locator("[data-filter-tag]").last();
  await filter.click();
  await page.waitForTimeout(1200);
  const geometry = await page.evaluate(() => {
    const ink = document
      .querySelector(".category-tabs .selection-ink")
      .getBoundingClientRect();
    const active = document
      .querySelector('.category-tabs [aria-pressed="true"]')
      .getBoundingClientRect();
    return {
      error: Math.max(
        Math.abs(ink.left - active.left),
        Math.abs(ink.top - active.top),
        Math.abs(ink.width - active.width),
      ),
      overflow: document.documentElement.scrollWidth > innerWidth,
    };
  });
  expect(geometry.error).toBeLessThan(1);
  expect(geometry.overflow).toBe(false);
});

test("gold threads actually travel and wrap at a complete dash period", async ({
  page,
}) => {
  await ready(page);
  for (const selector of [".trace-current", ".trace-second"]) {
    const values = await page.locator(selector).evaluate(async (el) => {
      const animation = el.getAnimations()[0];
      animation.pause();
      await animation.ready;
      const duration = Number(animation.effect.getTiming().duration);
      const read = async (time) => {
        animation.currentTime = time;
        await new Promise(requestAnimationFrame);
        return parseFloat(getComputedStyle(el).strokeDashoffset);
      };
      const start = await read(0),
        middle = await read(duration / 2);
      const before = await read(duration - 1),
        after = await read(duration + 1);
      const period = getComputedStyle(el)
        .strokeDasharray.split(",")
        .reduce((sum, x) => sum + parseFloat(x), 0);
      const seam = Math.abs(before - after) % period;
      return {
        travel: Math.abs(middle - start),
        seam: Math.min(seam, period - seam),
      };
    });
    expect(values.travel).toBeGreaterThan(100);
    expect(values.seam).toBeLessThan(1);
  }
});

test("home drawings animate in view and the pause preference covers the whole page", async ({
  page,
}) => {
  await ready(page);
  await page.locator(".small-garden").scrollIntoViewIfNeeded();
  await page.waitForTimeout(1200);
  const shell = page.locator(".small-garden");
  expect(
    await shell.evaluate(
      (el) => getComputedStyle(el, "::after").animationPlayState,
    ),
  ).toBe("running");
  const before = await shell.evaluate(
    (el) => getComputedStyle(el, "::after").transform,
  );
  await page.waitForTimeout(350);
  expect(
    await shell.evaluate((el) => getComputedStyle(el, "::after").transform),
  ).not.toBe(before);
  await page.locator("[data-motion-toggle]").click();
  await page.locator(".small-garden").scrollIntoViewIfNeeded();
  expect(
    await shell.evaluate(
      (el) => getComputedStyle(el, "::after").animationPlayState,
    ),
  ).toBe("paused");
  expect(
    await page
      .locator(".icon-note")
      .evaluate((el) => getComputedStyle(el).animationPlayState),
  ).toBe("paused");
  await page.reload();
  await expect(page.locator("[data-motion-toggle]")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator("[data-motion-toggle]")).toBeDisabled();
  expect(
    await page
      .locator(".small-garden")
      .evaluate((el) => getComputedStyle(el, "::after").animationName),
  ).toBe("none");
});
