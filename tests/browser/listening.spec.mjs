import { test, expect } from "@playwright/test";

// An original synthetic test tone exercises real browser decoding without
// downloading or caching the provider's promotional recordings in CI.
function tone() {
  const samples = 8000 * 12,
    buffer = Buffer.alloc(44 + samples * 2);
  buffer.write("RIFF");
  buffer.writeUInt32LE(buffer.length - 8, 4);
  buffer.write("WAVEfmt ", 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(8000, 24);
  buffer.writeUInt32LE(16000, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++)
    buffer.writeInt16LE(
      Math.round(Math.sin((i * Math.PI * 2 * 220) / 8000) * 120),
      44 + i * 2,
    );
  return buffer;
}
function serveTone(route) {
  const body = tone(),
    range = route
      .request()
      .headers()
      .range?.match(/^bytes=(\d+)-(\d*)$/);
  if (!range)
    return route.fulfill({
      contentType: "audio/wav",
      headers: { "accept-ranges": "bytes" },
      body,
    });
  const start = Number(range[1]),
    end = range[2]
      ? Math.min(Number(range[2]), body.length - 1)
      : body.length - 1;
  return route.fulfill({
    status: 206,
    contentType: "audio/wav",
    headers: {
      "accept-ranges": "bytes",
      "content-range": `bytes ${start}-${end}/${body.length}`,
    },
    body: body.subarray(start, end + 1),
  });
}
async function ready(page, route = "home") {
  await page.route("https://audio-ssl.itunes.apple.com/**", serveTone);
  await page.goto(`/#${route}`);
  await expect(page.locator("[data-bgm-toggle]")).toBeVisible();
  await expect(page.locator("main h1")).toBeVisible();
}
const playing = (page, id) =>
  page.locator(id).evaluate((el) => !el.paused && el.currentTime > 0);

test("BGM is one default-on looping switch, persists across routes and remembers OFF", async ({
  page,
}) => {
  await ready(page);
  await expect(page.locator("[data-bgm-toggle]")).toHaveAttribute(
    "role",
    "switch",
  );
  await expect(page.locator("[data-bgm-toggle]")).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await expect(page.locator(".listening-dock button")).toHaveCount(1);
  await expect(page.locator(".listening-dock input")).toHaveCount(0);
  expect(await page.locator("#bgm-audio").evaluate((el) => el.loop)).toBe(true);
  await page.locator("main h1").click();
  await expect.poll(() => playing(page, "#bgm-audio")).toBe(true);
  const before = await page.locator("#bgm-audio").evaluate((el) => {
    window.originalBgm = el;
    return el.currentTime;
  });
  await page.locator('.header a[href="#songs"]').click();
  await expect(page.locator(".collection-songs")).toBeVisible();
  await page.locator('[data-lang="zh"]').click();
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-Hans");
  expect(
    await page
      .locator("#bgm-audio")
      .evaluate(
        (el) => el === window.originalBgm && !el.paused && el.currentTime,
      ),
  ).toBeGreaterThan(before);
  await page.locator("[data-bgm-toggle]").click();
  await expect(page.locator("[data-bgm-toggle]")).toHaveAttribute(
    "aria-checked",
    "false",
  );
  expect(await page.locator("#bgm-audio").evaluate((el) => el.paused)).toBe(
    true,
  );
  await page.reload();
  await expect(page.locator("[data-bgm-toggle]")).toHaveAttribute(
    "aria-checked",
    "false",
  );
  await page.locator("main h1").click();
  await page.waitForTimeout(500);
  expect(await page.locator("#bgm-audio").evaluate((el) => el.paused)).toBe(
    true,
  );
});

test("previews suspend BGM and automatically return it; video pages restore it on close", async ({
  page,
}) => {
  await ready(page, "entry/inori");
  await page.locator("main h1").click();
  await expect.poll(() => playing(page, "#bgm-audio")).toBe(true);
  await page.locator("[data-preview-toggle]").click();
  await expect.poll(() => playing(page, "#preview-audio")).toBe(true);
  expect(await page.locator("#bgm-audio").evaluate((el) => el.paused)).toBe(
    true,
  );
  await page.locator("[data-preview-seek]").fill("50");
  expect(
    await page.locator("#preview-audio").evaluate((el) => el.currentTime),
  ).toBeGreaterThanOrEqual(5.9);
  await page.locator('[data-lang="zh"]').click();
  await expect(page.locator("[data-preview-toggle]")).toHaveAttribute(
    "aria-label",
    "暂停试听",
  );
  expect(await playing(page, "#preview-audio")).toBe(true);
  await page.locator("[data-preview-toggle]").click();
  await expect.poll(() => playing(page, "#bgm-audio")).toBe(true);
  await page.locator("[data-preview-toggle]").click();
  await page.locator("[data-preview-seek]").fill("99");
  await expect.poll(() => playing(page, "#bgm-audio")).toBe(true);
  expect(await page.locator("#preview-audio").evaluate((el) => el.ended)).toBe(
    true,
  );
  await page.locator('.header a[href="#videos"]').click();
  await expect(page.locator(".collection-videos")).toBeVisible();
  await page.locator("#results h3 a").first().click();
  await expect(page.locator(".video-poster")).toBeVisible();
  await page.locator(".video-poster").click();
  await expect(page.locator(".inline-player iframe")).toHaveCount(1);
  expect(await page.locator("#bgm-audio").evaluate((el) => el.paused)).toBe(
    true,
  );
  await page.locator("[data-close-video]").click();
  await expect.poll(() => playing(page, "#bgm-audio")).toBe(true);
  await expect(page.locator(".inline-player iframe")).toHaveCount(0);
  await page.locator(".video-poster").click();
  await page.locator('.header nav a[href="#home"]').click();
  await expect(page.locator(".intro-grid")).toBeVisible();
  await expect.poll(() => playing(page, "#bgm-audio")).toBe(true);
});

test("a saved OFF preference is respected after previews end and rapid switches settle", async ({
  page,
}) => {
  await ready(page, "entry/inori");
  await page.locator("[data-bgm-toggle]").click();
  await page.locator("[data-preview-toggle]").click();
  await expect.poll(() => playing(page, "#preview-audio")).toBe(true);
  await page.locator("[data-preview-seek]").fill("99");
  await expect
    .poll(() => page.locator("#preview-audio").evaluate((el) => el.ended))
    .toBe(true);
  expect(await page.locator("#bgm-audio").evaluate((el) => el.paused)).toBe(
    true,
  );
  for (let i = 0; i < 6; i++)
    await page.locator("[data-bgm-toggle]").click({ force: true });
  await page.waitForTimeout(800);
  expect(await page.locator("#bgm-audio").evaluate((el) => el.paused)).toBe(
    true,
  );
  await expect(page.locator("[data-bgm-toggle]")).toHaveAttribute(
    "aria-checked",
    "false",
  );
});

test("preview failures restore BGM, preserve the store link and allow retry", async ({
  page,
}) => {
  await ready(page, "entry/hibi");
  await page.unroute("https://audio-ssl.itunes.apple.com/**");
  await page.route("https://audio-ssl.itunes.apple.com/**", (r) => r.abort());
  await expect(page.locator(".preview-top small")).toContainText(
    "GAME VERSION",
  );
  await page.locator("[data-preview-toggle]").click();
  await expect(page.locator(".preview-status")).not.toBeEmpty();
  await expect(page.locator(".itunes-badge")).toHaveAttribute(
    "href",
    /music\.apple\.com/,
  );
  await expect.poll(() => playing(page, "#bgm-audio")).toBe(true);
  await page.unroute("https://audio-ssl.itunes.apple.com/**");
  await page.route("https://audio-ssl.itunes.apple.com/**", serveTone);
  await page.locator("[data-preview-toggle]").click();
  await expect.poll(() => playing(page, "#preview-audio")).toBe(true);
  await expect(page.locator(".preview-status")).toBeEmpty();
  expect(await page.locator("#bgm-audio").evaluate((el) => el.paused)).toBe(
    true,
  );
});

test("mobile Chinese controls fit the viewport and the BGM switch works by keyboard", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page, "entry/hibi");
  await page.locator('[data-lang="zh"]').click();
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-Hans");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.locator("[data-bgm-toggle]").focus();
  await page.keyboard.press("Space");
  await expect(page.locator("[data-bgm-toggle]")).toHaveAttribute(
    "aria-checked",
    "false",
  );
  await expect(page.locator("[data-bgm-toggle]")).toBeFocused();
  expect(await page.locator("#bgm-audio").evaluate((el) => el.paused)).toBe(
    true,
  );
});

test("blocked autoplay waits for a trusted gesture and restores the saved BGM position", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("yoshino-bgm-position", "42");
    let clicked = false;
    document.addEventListener(
      "click",
      (event) => {
        if (event.isTrusted) clicked = true;
      },
      { capture: true },
    );
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      if (this.id === "bgm-audio" && !clicked)
        return Promise.reject(
          new DOMException("Autoplay requires interaction", "NotAllowedError"),
        );
      return play.call(this);
    };
  });
  await ready(page);
  await page.waitForTimeout(350);
  expect(await page.locator("#bgm-audio").evaluate((el) => el.paused)).toBe(
    true,
  );
  await expect(page.locator("[data-bgm-toggle]")).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await page.locator("main h1").click();
  await expect.poll(() => playing(page, "#bgm-audio")).toBe(true);
  expect(
    await page.locator("#bgm-audio").evaluate((el) => el.currentTime),
  ).toBeGreaterThanOrEqual(42);
});
