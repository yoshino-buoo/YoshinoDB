import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

// Inspect the compositor's recording, not just the DOM or the first native
// snapshot: the blank interval can occur between either of those observations.
const ffmpeg =
  process.env.FFMPEG_PATH ||
  (existsSync("/opt/homebrew/bin/ffmpeg")
    ? "/opt/homebrew/bin/ffmpeg"
    : "ffmpeg");

for (const mode of [
  "native artwork",
  "without View Transitions",
  "loading artwork",
]) {
  test(`${mode} keeps content visible from click through arrival`, async ({
    browser,
  }, testInfo) => {
    const mobile = testInfo.project.name === "webkit";
    const viewport = mobile
      ? { width: 390, height: 844 }
      : { width: 1280, height: 900 };
    const context = await browser.newContext({
      viewport,
      isMobile: mobile,
      hasTouch: mobile,
      recordVideo: { dir: testInfo.outputPath("video"), size: viewport },
    });
    const page = await context.newPage();
    try {
      if (mode === "without View Transitions")
        await page.addInitScript(() => {
          document.startViewTransition = undefined;
        });
      await page.goto(`${testInfo.project.use.baseURL}/#songs`);
      await expect(page.locator("#boot-screen")).toHaveCount(0);
      await page.evaluate(() => document.fonts.ready);
      const cover = page.locator("#results .record-cover").nth(8);
      await cover.evaluate((el) =>
        scrollTo({
          top:
            scrollY +
            el.getBoundingClientRect().top +
            el.clientHeight / 2 -
            innerHeight / 2,
          behavior: "instant",
        }),
      );
      await page.waitForTimeout(1400);
      if (mode === "loading artwork") {
        await page.route("**/__pending-cover.png", () => {});
        await cover.locator("img").evaluate((img) => {
          img.src = "/__pending-cover.png";
        });
      }
      await page.evaluate(() => {
        const marker = document.createElement("div");
        marker.style.cssText =
          "position:fixed;top:0;left:0;width:40px;height:40px;z-index:2147483647;background:#f0f;pointer-events:none";
        document.body.append(marker);
        document.addEventListener(
          "click",
          () => {
            marker.style.background = "#0f0";
          },
          { capture: true, once: true },
        );
      });
      await cover.click();
      await expect(page.locator(".entry-songs")).toBeVisible();
      await page.waitForTimeout(1800);
      const video = page.video();
      await context.close();
      const path = await video.path();
      const width = 160,
        height = Math.round((viewport.height / viewport.width) * width);
      const raw = execFileSync(
        ffmpeg,
        [
          "-v",
          "error",
          "-i",
          path,
          "-vf",
          `scale=${width}:${height}`,
          "-pix_fmt",
          "rgb24",
          "-f",
          "rawvideo",
          "pipe:1",
        ],
        { maxBuffer: 100 * 1024 * 1024 },
      );
      const frameSize = width * height * 3,
        coverage = [];
      let started = false;
      for (
        let offset = 0;
        offset + frameSize <= raw.length;
        offset += frameSize
      ) {
        const marker = offset + (width + 1) * 3;
        // Allow the color conversion used by WebKit's recording.
        if (raw[marker] < 150 && raw[marker + 1] > 200 && raw[marker + 2] < 100)
          started = true;
        // Once the click is located, keep every frame, even if a broken root
        // snapshot makes the marker itself disappear.
        if (!started) continue;
        let ink = 0,
          pixels = 0;
        // Exclude browser-independent header/marker and the persistent BGM dock.
        for (
          let y = Math.ceil((120 / viewport.height) * height);
          y < height * 0.82;
          y++
        )
          for (let x = 0; x < width; x++) {
            const i = offset + (y * width + x) * 3;
            if ((raw[i] + raw[i + 1] + raw[i + 2]) / 3 < 205) ink++;
            pixels++;
          }
        coverage.push(ink / pixels);
        if (coverage.length === 35) break;
      }
      await testInfo.attach("painted-content-per-frame", {
        body: JSON.stringify(coverage),
        contentType: "application/json",
      });
      expect(
        coverage.length,
        "Recording must include the click and complete transition",
      ).toBe(35);
      expect(
        Math.min(...coverage),
        "Every recorded frame after the click must contain visible page content",
      ).toBeGreaterThan(0.008);
    } finally {
      await context.close();
    }
  });
}

for (const width of [390, 820]) {
  for (const entry of ["enamoral", "song-mirai-compass"]) {
    test(`a delayed artwork snapshot never exposes the list top: ${entry} at ${width}px`, async ({
      browser,
    }, testInfo) => {
      const viewport = { width, height: width === 390 ? 844 : 1180 };
      const context = await browser.newContext({
        viewport,
        isMobile: true,
        hasTouch: true,
        recordVideo: {
          dir: testInfo.outputPath("scroll-video"),
          size: viewport,
        },
      });
      try {
        const page = await context.newPage();
        await page.addInitScript(() => {
          const start = document.startViewTransition.bind(document);
          document.startViewTransition = (update) =>
            start(async () => {
              await update();
              // Exercise the real rendering-suppression interval used while a new
              // detail image decodes. Cached images normally make it too brief.
              await new Promise((resolve) => setTimeout(resolve, 300));
            });
        });
        await page.goto(`${testInfo.project.use.baseURL}/#songs`);
        await expect(page.locator("#boot-screen")).toHaveCount(0);
        await page.evaluate(() => document.fonts.ready);
        const cover = page.locator(
          `#results .record-cover[href="#entry/${entry}"]`,
        );
        await cover.evaluate((el) => {
          const intro = document.querySelector(".music-shelf-intro");
          scrollTo(
            0,
            Math.max(
              scrollY + el.getBoundingClientRect().top - 320,
              scrollY + intro.getBoundingClientRect().bottom + 40,
            ),
          );
        });
        await page.waitForTimeout(1400);
        await page.evaluate(() => {
          const intro = document.querySelector(".music-shelf-intro");
          if (intro.getBoundingClientRect().bottom > 0)
            throw Error("The list introduction must be outside the viewport");
          intro.style.background = "#ff00ff";
          const marker = document.createElement("div");
          marker.style.cssText =
            "position:fixed;top:0;left:0;width:40px;height:40px;z-index:2147483647;background:#0f0;pointer-events:none";
          document.body.append(marker);
        });
        // Paint the recording marker before entering rendering suppression.
        await page.waitForTimeout(80);
        // The user's second recording follows the text link further down the list.
        const link =
          entry === "enamoral"
            ? cover
            : page.locator(`#results h3 a[href="#entry/${entry}"]`);
        const bounds = await link.boundingBox();
        await page.touchscreen.tap(
          bounds.x + bounds.width / 2,
          bounds.y + bounds.height / 2,
        );
        await page.waitForTimeout(1800);
        expect(await page.evaluate(() => scrollY)).toBe(0);
        const video = page.video();
        await context.close();
        const frameWidth = 195,
          frameHeight = Math.round((195 * viewport.height) / viewport.width);
        const raw = execFileSync(
          ffmpeg,
          [
            "-v",
            "error",
            "-i",
            await video.path(),
            "-vf",
            `scale=${frameWidth}:${frameHeight}`,
            "-pix_fmt",
            "rgb24",
            "-f",
            "rawvideo",
            "pipe:1",
          ],
          { maxBuffer: 100 * 1024 * 1024 },
        );
        const frameBytes = frameWidth * frameHeight * 3;
        let started = false;
        const flashes = [];
        const coverage = [];
        for (
          let offset = 0;
          offset + frameBytes <= raw.length;
          offset += frameBytes
        ) {
          const marker = offset + (195 + 1) * 3;
          if (
            raw[marker] < 150 &&
            raw[marker + 1] > 200 &&
            raw[marker + 2] < 100
          )
            started = true;
          if (!started) continue;
          let magenta = 0;
          for (let i = offset; i < offset + frameBytes; i += 3)
            if (raw[i] > 210 && raw[i + 1] < 60 && raw[i + 2] > 210) magenta++;
          if (magenta > 100) flashes.push(offset / frameBytes);
          let ink = 0,
            pixels = 0;
          for (
            let y = Math.ceil((120 * frameWidth) / viewport.width);
            y < frameHeight * 0.82;
            y++
          )
            for (let x = 0; x < frameWidth; x++) {
              const i = offset + (y * frameWidth + x) * 3;
              if ((raw[i] + raw[i + 1] + raw[i + 2]) / 3 < 205) ink++;
              pixels++;
            }
          coverage.push(ink / pixels);
        }
        expect(started, "Recording must include the transition").toBe(true);
        expect(
          flashes,
          "The offscreen list introduction must never flash into view",
        ).toEqual([]);
        expect(coverage.length).toBeGreaterThan(35);
        expect(
          Math.min(...coverage),
          "No frame may lose all page content",
        ).toBeGreaterThan(0.008);
      } finally {
        await context.close();
      }
    });
  }
}

test("retained viewport preserves scroll and settles after interrupted navigation", async ({
  page,
}, testInfo) => {
  if (testInfo.project.name === "webkit")
    await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    document.startViewTransition = undefined;
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (...args) {
      const animation = animate.apply(this, args);
      if (
        this.hasAttribute("data-route-retiring") &&
        !window.retirementCaptured
      ) {
        animation.pause();
        animation.currentTime = 0;
        window.retirementCaptured = true;
      }
      return animation;
    };
  });
  await page.goto("/#songs");
  await expect(page.locator("#boot-screen")).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
  const cover = page.locator("#results .record-cover").nth(8);
  await cover.evaluate((el) =>
    scrollTo({
      top:
        scrollY +
        el.getBoundingClientRect().top +
        el.clientHeight / 2 -
        innerHeight / 2,
      behavior: "instant",
    }),
  );
  await cover.hover();
  await page.waitForTimeout(1400);
  const bounds = await cover.boundingBox();
  const viewport = page.viewportSize();
  const clip = {
    x: 0,
    y: 0,
    width: viewport.width,
    height: viewport.height - 140,
  };
  const before = await page.screenshot({ clip });
  await page.mouse.click(
    bounds.x + bounds.width / 2,
    bounds.y + bounds.height / 2,
  );
  await page.waitForFunction(() => window.retirementCaptured);
  const after = await page.screenshot({ clip });
  await testInfo.attach("viewport-before", {
    body: before,
    contentType: "image/png",
  });
  await testInfo.attach("viewport-retained", {
    body: after,
    contentType: "image/png",
  });
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
        pixels[0].reduce((sum, v, i) => sum + Math.abs(v - pixels[1][i]), 0) /
        pixels[0].length
      );
    },
    [before.toString("base64"), after.toString("base64")],
  );
  expect(
    difference,
    "Retaining a viewport must not alter its layout, crop, or scroll position",
  ).toBeLessThan(1);
  for (const route of ["videos", "songs", "cards"]) {
    await page.locator(`.header a[href="#${route}"]`).click({ force: true });
    await page.waitForTimeout(70);
  }
  await expect(page.locator(".collection-cards")).toBeVisible();
  await expect(page.locator("[data-route-retiring]")).toHaveCount(0);
  await expect(page.locator("#app")).toHaveCount(1);
  expect(await page.evaluate(() => scrollY)).toBe(0);
});
