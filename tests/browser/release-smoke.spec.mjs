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
  await expect(page.locator(".voice-links a")).toHaveCount(29);
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
  await expect(page.locator(".profile-stickers .profile-sticker")).toHaveCount(
    14,
  );
  await expect(page.locator("yoshino-sticker")).toHaveCount(8);
  await expect(page.locator("[data-voice-src]")).toHaveCount(29);
  await expect(page.locator(".voice-translation")).toHaveCount(16);
  const sticker = page.locator("yoshino-sticker").first();
  await sticker.scrollIntoViewIfNeeded();
  await expect(sticker).toHaveAttribute("data-running", "true");
  const gif = sticker.locator("img");
  await expect
    .poll(() => gif.evaluate((i) => i.complete && i.naturalWidth > 0))
    .toBe(true);
  await sticker.locator("[data-sticker-motion]").click();
  await expect(sticker).toHaveAttribute("data-running", "false");
  await expect(gif).toHaveAttribute("src", /^data:image\/png/);
  await sticker.locator("[data-sticker-motion]").click();
  await expect(gif).toHaveAttribute("src", /\.gif$/);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(sticker).toHaveAttribute("data-running", "false");
  await expect(gif).toHaveAttribute("src", /^data:image\/png/);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("./#entry/sr-20220819_1");
  await expect(page.locator(".voice-stage")).toHaveCount(2);
  await expect(page.locator(".voice-links a")).toHaveCount(72);
  await expect(page.locator("[data-variant]")).toHaveCount(2);
  await expect(page.locator("[data-variant-panel]")).toHaveCount(2);
  await page.locator('[data-variant="1"]').click();
  await expect(page.locator('[data-variant-panel="1"] img')).toBeVisible();
  expect(
    await page.locator('[data-variant-panel="1"] img').evaluate(async (i) => {
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
  await expect(page.locator("#edit-panel")).toContainText("贴纸与动图");
  await page.locator("[data-editor-preview]").click();
  await expect(
    page.locator(".studio-preview-content .profile-connections"),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("compact card art preference persists and opens both games on the clicked artwork", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./#cards");
  await expect(page.locator("#boot-screen")).toHaveCount(0, { timeout: 15000 });
  const catalog = await (
    await page.request.get(new URL("data/catalog.json", page.url()).href)
  ).json();
  const toggle = page.locator(".card-art-toggle");
  await expect(page.locator('[data-card-art="0"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await toggle.scrollIntoViewIfNeeded();
  const size = await toggle.boundingBox();
  const count = await page.locator(".result-count").boundingBox();
  expect(size.height).toBeLessThanOrEqual(32);
  expect(size.width).toBeLessThanOrEqual(125);
  expect(
    Math.abs(size.y + size.height / 2 - count.y - count.height / 2),
  ).toBeLessThan(2);
  await page.locator('[data-card-art="1"]').click();

  for (const game of ["deresute", "mobamas"]) {
    await page.locator(`[data-card-game="${game}"]`).click();
    const first = page.locator("#results .record").first();
    const id = await first.getAttribute("data-entry");
    const item = catalog.items.find((item) => item.id === id);
    expect(item.game).toBe(game);
    const cover = first.locator(".record-cover img");
    const expected = new URL(item.gallery[1].image, page.url()).href;
    await expect(cover).toHaveJSProperty("src", expected);
    // Capture the very first rendered gallery, before any entrance animation.
    await page.evaluate(() => {
      window.firstCardPanel = null;
      const observer = new MutationObserver(() => {
        const panel = document.querySelector(
          ".card-gallery [data-variant-panel]:not([hidden])",
        );
        if (!panel) return;
        window.firstCardPanel = {
          index: panel.dataset.variantPanel,
          src: panel.querySelector("img").src,
        };
        observer.disconnect();
      });
      observer.observe(document.querySelector("#app"), {
        childList: true,
        subtree: true,
      });
    });
    await cover.click();
    await expect(page.locator('[data-variant-panel="1"]')).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => window.firstCardPanel))
      .toEqual({ index: "1", src: expected });
    await expect(page.locator('[data-variant="1"]')).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    // A temporary choice inside a detail should not overwrite the list default.
    await page.locator('[data-variant="0"]').click();
    await expect(page.locator('[data-variant-panel="0"]')).toBeVisible();
    await page.goBack();
    await expect(page.locator('[data-card-art="1"]')).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(cover).toHaveJSProperty("src", expected);
  }
  await page.locator('[data-lang="zh"]').click();
  await expect(toggle).toContainText("特训后");
  await page.reload();
  await expect(page.locator('[data-card-art="1"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.locator('[data-card-art="0"]').click();
  const first = page.locator("#results .record").first();
  const id = await first.getAttribute("data-entry");
  const item = catalog.items.find((item) => item.id === id);
  await expect(first.locator("img")).toHaveJSProperty(
    "src",
    new URL(item.gallery[0].image, page.url()).href,
  );
  await first.locator(".record-cover").click();
  await expect(page.locator('[data-variant-panel="0"]')).toBeVisible();
});

test("petit costume switches decoded poses, pauses offscreen and works in the editor", async ({
  page,
}) => {
  const errors = [];
  const requests = new Set();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (r.url().includes("/petit-yoshino-")) requests.add(r.url());
  });
  await page.setViewportSize({ width: 1180, height: 820 });
  await page.goto("./#entry/card-3611");
  await expect(page.locator("#boot-screen")).toHaveCount(0, { timeout: 15000 });
  const petit = page.locator("yoshino-petit");
  await petit.scrollIntoViewIfNeeded();
  await expect(petit).toHaveAttribute("data-ready", "true");
  await expect(petit).toHaveAttribute("data-running", "true");
  expect(requests.size).toBe(4);
  expect(
    [...requests].every((url) => /petit-yoshino-15-[1-4]\.png$/.test(url)),
  ).toBe(true);
  for (const pose of [1, 2, 3, 0]) {
    await petit.locator("[data-petit-next]").click();
    await expect(petit).toHaveAttribute("data-pose", String(pose));
    await expect(petit.locator("img:not([hidden])")).toHaveCount(1);
    expect(
      await petit
        .locator("img:not([hidden])")
        .evaluate((i) => i.complete && i.naturalWidth > 0),
    ).toBe(true);
    await expect.poll(() => petit.evaluate((el) => el.busy)).toBe(false);
  }
  await petit.locator("[data-petit-pause]").click();
  await expect(petit).toHaveAttribute("data-running", "false");
  await petit.locator("[data-petit-next]").click();
  await expect(petit).toHaveAttribute("data-pose", "1");
  await petit.locator("[data-petit-pause]").click();
  await expect(petit).toHaveAttribute("data-running", "true");
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(petit).toHaveAttribute("data-running", "false");
  await petit.scrollIntoViewIfNeeded();
  await expect(petit).toHaveAttribute("data-running", "true");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(petit).toHaveAttribute("data-running", "false");
  await petit.locator("[data-petit-next]").click();
  await expect(petit).toHaveAttribute("data-pose", "2");
  await page.locator('header [data-lang="zh"]').click();
  await expect(petit).toContainText("Q 版芳乃");
  await petit.scrollIntoViewIfNeeded();
  await expect(petit).toHaveAttribute("data-ready", "true");
  const retired = await petit.elementHandle();
  await page.locator('header a[href="#songs"]').click();
  await expect(petit).toHaveCount(0);
  expect(
    await retired.evaluate(
      (el) => el.controller === null && el.dataset.running === "false",
    ),
  ).toBe(true);
  await page.goto("./#editor");
  await page.locator("[data-category]").selectOption("cards");
  await page.locator('[data-select="card-3611"]').click();
  await page.locator('[data-tab="details"]').click();
  await expect(page.locator("#edit-panel")).toContainText("Q 版芳乃");
  await page.locator("[data-editor-preview]").click();
  const preview = page.locator(".studio-preview-content yoshino-petit");
  await preview.scrollIntoViewIfNeeded();
  await expect(preview).toHaveAttribute("data-ready", "true");
  await preview.locator("[data-petit-next]").click();
  await expect(preview).toHaveAttribute("data-pose", "1");
  expect(errors).toEqual([]);
});

test("card voice clips load on demand, pause reliably and yield to BGM on completion or navigation", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  // Use deterministic audio bytes while keeping the real cross-origin URL contract.
  const rate = 8000,
    samples = rate * 12;
  const wav = Buffer.alloc(44 + samples * 2);
  wav.write("RIFF", 0);
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(rate, 24);
  wav.writeUInt32LE(rate * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(samples * 2, 40);
  let requested = 0;
  await page.route(
    "https://patchwiki.biligame.com/images/imascg/**/*.mp3",
    async (route) => {
      requested++;
      await route.fulfill({
        contentType: "audio/wav",
        body: wav,
        headers: { "access-control-allow-origin": "*" },
      });
    },
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./#entry/card-2323");
  await expect(page.locator("#boot-screen")).toHaveCount(0, { timeout: 15000 });
  await expect(page.locator("[data-voice-src]")).toHaveCount(72);
  expect(requested).toBe(0);
  await page.locator(".voice-group summary").first().click();
  const first = page.locator("[data-voice-src]").nth(0),
    second = page.locator("[data-voice-src]").nth(1);
  const voice = page.locator("#voice-audio"),
    bgm = page.locator("#bgm-audio");
  await first.click();
  await expect
    .poll(() => voice.evaluate((a) => a.currentTime))
    .toBeGreaterThan(0);
  await expect(bgm).toHaveJSProperty("paused", true);
  for (let i = 0; i < 3; i++) {
    await first.click();
    await expect(voice).toHaveJSProperty("paused", true);
    await expect(first).toHaveAttribute("aria-pressed", "false");
    await first.click();
    await expect(voice).toHaveJSProperty("paused", false);
    await expect(first).toHaveAttribute("aria-pressed", "true");
  }
  await second.click();
  await expect(first).toHaveAttribute("aria-pressed", "false");
  await expect(second).toHaveAttribute("aria-pressed", "true");
  await expect
    .poll(() => voice.evaluate((a) => a.currentTime))
    .toBeGreaterThan(0);
  await expect(voice).toHaveJSProperty(
    "src",
    await second.getAttribute("data-voice-src"),
  );
  await voice.evaluate((a) => (a.playbackRate = 8));
  await expect(voice).toHaveJSProperty("ended", true);
  await voice.evaluate((a) => (a.playbackRate = 1));
  await expect.poll(() => bgm.evaluate((a) => a.paused)).toBe(false);
  await first.click();
  await expect(voice).toHaveJSProperty("paused", false);
  await page.locator('header a[href="#songs"]').click();
  await expect(voice).toHaveJSProperty("paused", true);
  await expect(voice).not.toHaveAttribute("src");
  await expect.poll(() => bgm.evaluate((a) => a.paused)).toBe(false);
  await page.goto("./#entry/card-3883");
  await page.locator('header [data-lang="zh"]').click();
  await expect(page.locator(".commu-script")).toContainText("芳乃");
  await expect(page.locator(".voice-translation")).toHaveCount(58);
  await expect(page.locator(".theater-panels img").first()).toHaveAttribute(
    "src",
    /cingeki-739-1-zh\.jpg$/,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.goto("./#editor");
  await page.locator("[data-category]").selectOption("cards");
  await page.locator('[data-select="card-3883"]').click();
  await page.locator('[data-tab="details"]').click();
  await expect(page.locator("#edit-panel")).toContainText("特训剧情");
  await expect(page.locator("#edit-panel")).toContainText("小剧场 WIDE☆");
  expect(errors).toEqual([]);
});
