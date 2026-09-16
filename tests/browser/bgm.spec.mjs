import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

const tracks = JSON.parse(await readFile("config/bgm.json", "utf8"));
const filename = (audio) => audio.evaluate((el) => new URL(el.src).pathname.split("/").pop());

test("BGM decodes all three tracks and shuffles complete rounds without repeats", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("./#home");
  await expect(page.locator("#boot-screen")).toHaveCount(0, { timeout: 15000 });
  await page.locator("main h1").click();
  const audio = page.locator("#bgm-audio");
  await expect.poll(() => audio.evaluate((el) => !el.paused && el.currentTime > 0)).toBe(true);
  await expect(audio).toHaveJSProperty("loop", false);
  const expected = tracks.map((track) => track.file.split("/").pop()).sort();
  const played = [];
  // Seek the real files near their end; native ended events must advance the
  // playlist, decode the next AAC file, and keep playing without another click.
  for (let i = 0; i < tracks.length * 2; i++) {
    await expect.poll(() => audio.evaluate((el) => el.duration)).toBeGreaterThan(260);
    const song = await filename(audio);
    played.push(song);
    expect(song).not.toBe(played[i - 1]);
    expect(await audio.evaluate((el) => el.error)).toBeNull();
    if (i === tracks.length * 2 - 1) break;
    await audio.evaluate((el) => { el.currentTime = el.duration - 0.15; });
    await expect.poll(() => filename(audio)).not.toBe(song);
    await expect.poll(() => audio.evaluate((el) => !el.paused && el.currentTime > 0)).toBe(true);
  }
  for (let i = 0; i < played.length; i += tracks.length)
    expect(played.slice(i, i + tracks.length).sort()).toEqual(expected);

  const current = await filename(audio);
  await page.locator('[data-bgm-toggle]').click();
  await expect(audio).toHaveJSProperty("paused", true);
  await page.locator('.header a[href="#songs"]').click();
  await expect(audio).toHaveJSProperty("paused", true);
  expect(await filename(audio)).toBe(current);
  await page.locator('[data-bgm-toggle]').click();
  await expect.poll(() => audio.evaluate((el) => !el.paused && el.currentTime > 0)).toBe(true);
  expect(await filename(audio)).toBe(current);
  expect(errors).toEqual([]);
});
