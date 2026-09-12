import { test, expect } from "@playwright/test";

async function ready(page, route = "home") {
  await page.goto(`/#${route}`);
  await expect(page.locator("main h1")).toBeVisible();
  await expect(page.locator("#boot-screen")).toHaveCount(0);
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

test("timeline next links never lift unrelated artwork into an orphan snapshot", async ({
  page,
}) => {
  await observeSnapshots(page);
  await ready(page, "entry/history-20140528_1");
  await page.waitForTimeout(1000);
  for (let i = 0; i < 3; i++) {
    const next = page.locator(".milestone-nav a").last();
    const href = await next.getAttribute("href");
    await next.click();
    await expect(page.locator(".typed-entry")).toHaveAttribute(
      "data-entry",
      href.slice(7),
    );
    await page.waitForTimeout(1000);
    expect(await page.evaluate(() => window.motionSnapshots.length)).toBe(0);
    await expect(page.locator("[data-shared-art]")).toHaveCount(0);
    expect(await page.evaluate(() => scrollY)).toBe(0);
    expect(
      await page
        .locator(".milestone>img")
        .evaluate((el) => Number(getComputedStyle(el).opacity)),
    ).toBeGreaterThan(0.98);
  }
});

for (const viewport of [
  { width: 1280, height: 1000 },
  { width: 390, height: 844 },
]) {
  test(`shared artwork preserves its cover geometry at ${viewport.width}px`, async ({
    page,
  }) => {
    test.setTimeout(45000);
    await page.setViewportSize(viewport);
    await page.addInitScript(() => {
      window.coverHandoffs = [];
      document.addEventListener(
        "click",
        (event) => {
          const a = event.target.closest?.('a[href^="#entry/"]');
          if (!a) return;
          const surface = a.closest(".record")?.querySelector(".record-cover");
          if (surface)
            window.clickedCover = surface.getBoundingClientRect().toJSON();
        },
        { capture: true },
      );
      const start = document.startViewTransition.bind(document);
      document.startViewTransition = (update) => {
        const source = document.querySelector("[data-shared-art]"),
          sample = {
            clicked: window.clickedCover,
            source: source?.getBoundingClientRect().toJSON(),
          };
        window.coverHandoffs.push(sample);
        const run = start(update);
        run.ready.then(() => {
          sample.target = document.querySelector("[data-shared-art]");
          sample.captured = sample.target.getBoundingClientRect().toJSON();
        });
        run.finished.then(() => {
          sample.landed = sample.target.getBoundingClientRect().toJSON();
          delete sample.target;
          sample.finished = true;
        });
        return run;
      };
    });
    await ready(page, "songs");
    for (const kind of [
      "songs",
      "cards",
      "videos",
      "news",
      "stories",
      "units",
      "timeline",
    ]) {
      if (kind !== "songs") {
        await page.evaluate((kind) => (location.hash = kind), kind);
        await expect(page.locator(`.collection-${kind}`)).toBeVisible();
      }
      // This test measures a native artwork handoff. Interrupted category
      // navigation is covered separately by the retained-viewport regression.
      await expect(page.locator("[data-route-retiring]")).toHaveCount(0);
      await page.evaluate(() => (window.coverHandoffs = []));
      const cover = page.locator("#results .record-cover").first();
      await cover.hover();
      await page.waitForTimeout(110);
      await cover.click();
      await expect
        .poll(() => page.evaluate(() => window.coverHandoffs.at(-1)?.finished))
        .toBe(true);
      const sample = await page.evaluate(() => window.coverHandoffs.at(-1));
      for (const key of ["x", "y", "width", "height"]) {
        expect(
          Math.abs(sample.clicked[key] - sample.source[key]),
          `source ${kind} ${key}`,
        ).toBeLessThan(0.6);
        expect(
          Math.abs(sample.captured[key] - sample.landed[key]),
          `landing ${kind} ${key}`,
        ).toBeLessThan(0.6);
      }
    }
  });
}

test("the first shared-art frame is visually identical to the clicked cover", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const start = document.startViewTransition.bind(document);
    document.startViewTransition = (update) => {
      const run = start(update);
      run.ready.then(() => {
        window.snapshotAnimations = document
          .getAnimations()
          .filter((a) => a.effect?.pseudoElement?.includes("view-transition"));
        window.snapshotAnimations.forEach((a) => {
          a.pause();
          a.currentTime = 0;
        });
        window.snapshotReady = true;
      });
      return run;
    };
  });
  await ready(page, "songs");
  const cover = page.locator("#results .record-cover").first();
  await cover.hover();
  await page.waitForTimeout(650);
  const bounds = await cover.boundingBox(),
    clip = {
      x: Math.floor(bounds.x),
      y: Math.floor(bounds.y),
      width: Math.ceil(bounds.width),
      height: Math.ceil(bounds.height),
    };
  const before = await page.screenshot({ clip });
  await cover.click();
  await page.waitForFunction(() => window.snapshotReady);
  const after = await page.screenshot({ clip });
  const difference = await page.evaluate(
    async (images) => {
      const pixels = [];
      for (const base64 of images) {
        const img = await createImageBitmap(
          await (await fetch(`data:image/png;base64,${base64}`)).blob(),
        );
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const context = canvas.getContext("2d");
        context.drawImage(img, 0, 0);
        pixels.push(context.getImageData(0, 0, img.width, img.height).data);
        img.close();
      }
      return (
        pixels[0].reduce(
          (sum, value, i) => sum + Math.abs(value - pixels[1][i]),
          0,
        ) / pixels[0].length
      );
    },
    [before.toString("base64"), after.toString("base64")],
  );
  expect(
    difference,
    "Clicking must not instantly overlay a differently cropped detail image",
  ).toBeLessThan(2);
});

for (const viewport of [
  { width: 1366, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`scrolled cover navigation does not expose the header reset at ${viewport.width}px`, async ({
    page,
  }) => {
    test.setTimeout(60000);
    await page.setViewportSize(viewport);
    await page.addInitScript(() => {
      const start = document.startViewTransition.bind(document);
      document.startViewTransition = (update) => {
        const run = start(update);
        run.ready.then(() => {
          window.frozenHandoff = document
            .getAnimations()
            .filter((a) =>
              a.effect?.pseudoElement?.includes("view-transition"),
            );
          window.frozenHandoff.forEach((a) => {
            a.pause();
            a.currentTime = 0;
          });
          window.handoffReady = true;
        });
        run.finished.then(() => (window.handoffFinished = true));
        return run;
      };
    });
    await ready(page, "songs");
    for (const kind of [
      "songs",
      "videos",
      "news",
      "stories",
      "units",
      "timeline",
      "cards",
    ]) {
      if (kind !== "songs") {
        await page.evaluate((kind) => (location.hash = kind), kind);
        await expect(page.locator(`.collection-${kind}`)).toBeVisible();
      }
      const covers = page.locator("#results .record-cover"),
        cover = covers.nth(Math.min(8, (await covers.count()) - 1));
      await cover.evaluate((el) =>
        window.scrollTo({
          top:
            window.scrollY +
            el.getBoundingClientRect().top +
            el.clientHeight / 2 -
            innerHeight / 2,
          behavior: "instant",
        }),
      );
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(1300);
      const bounds = await cover.boundingBox(),
        x = bounds.x + bounds.width / 2,
        y = bounds.y + bounds.height / 2;
      await page.mouse.move(x, y);
      await page.waitForTimeout(250);
      expect(
        await page.evaluate(() => scrollY),
        `${kind} must actually be scrolled`,
      ).toBeGreaterThan(100);
      const clip = {
          x: 20,
          y: 10,
          width: Math.min(viewport.width - 40, 450),
          height: 100,
        },
        before = await page.screenshot({ clip });
      await page.evaluate(() => {
        window.handoffReady = false;
        window.handoffFinished = false;
      });
      // A physical click is essential: Locator.click can scroll again itself.
      await page.mouse.click(x, y);
      await page.waitForFunction(() => window.handoffReady);
      const after = await page.screenshot({ clip });
      const difference = await page.evaluate(
        async (images) => {
          const pixels = [];
          for (const base64 of images) {
            const img = await createImageBitmap(
              await (await fetch(`data:image/png;base64,${base64}`)).blob(),
            );
            const canvas = document.createElement("canvas");
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0);
            pixels.push(ctx.getImageData(0, 0, img.width, img.height).data);
            img.close();
          }
          return (
            pixels[0].reduce(
              (sum, v, i) => sum + Math.abs(v - pixels[1][i]),
              0,
            ) / pixels[0].length
          );
        },
        [before.toString("base64"), after.toString("base64")],
      );
      expect(
        difference,
        `${kind}: resetting scroll must not reveal the page header ahead of the transition`,
      ).toBeLessThan(0.3);
      await page.evaluate(() => window.frozenHandoff.forEach((a) => a.play()));
      await page.waitForFunction(() => window.handoffFinished);
      expect(await page.evaluate(() => scrollY)).toBe(0);
      await expect(page.locator("html")).not.toHaveAttribute(
        "data-scroll-transition",
      );
    }
  });
}
