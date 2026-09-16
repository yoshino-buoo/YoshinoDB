import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
const catalog = JSON.parse(await readFile("public/data/catalog.json", "utf8"));
const field = (page, path, locale = "zh") =>
  page.locator(
    `[data-field="${path}"]${locale ? `[data-locale="${locale}"]` : ""}`,
  );
async function ready(page, id) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    localStorage.setItem("yoshino-lang", "zh");
    localStorage.setItem("yoshino-bgm-enabled", "false");
  });
  await page.goto("/#editor");
  await expect(page.locator("#boot-screen")).toHaveCount(0, { timeout: 15000 });
  await page.locator("[data-search]").fill(id);
  await page.locator(`[data-select="${id}"]`).click();
}
async function preview(page) {
  await page.locator("[data-editor-preview]").click();
  await expect(page.locator("[data-preview-status]")).toContainText(
    "已自动保存",
  );
  return page.frameLocator("[data-live-preview]");
}

test("profile uses the public page shell, point edits are live and local, and nested asset picking keeps the editor open", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await ready(page, "profile-yoshino");
  const frame = await preview(page);
  await expect(frame.locator(".page-title")).toBeVisible();
  await expect(frame.locator(".entry-heading")).toHaveCount(0);
  await frame.locator(".profile-name").click();
  await expect(field(page, "profile.identity.name")).toBeFocused();
  await field(page, "profile.identity.name").fill("新的人物页姓名");
  await expect(frame.locator(".profile-name")).toHaveText("新的人物页姓名");
  await page.locator('[data-preview-lang="ja"]').click();
  await expect(frame.locator(".profile-name")).toHaveText("依田 芳乃");
  await frame.locator(".profile-art img").click();
  await page.locator('[data-pick-image="image"]').click();
  await expect(page.locator("dialog[open]")).toHaveCount(2);
  await page.locator("[data-modal-search]").fill("COCC-17288");
  await page.locator('[data-asset="assets/COCC-17288.jpg"]').click();
  await expect(page.locator("dialog[open]")).toHaveCount(1);
  await expect(frame.locator(".profile-art img")).toHaveAttribute(
    "src",
    /COCC-17288\.jpg$/,
  );
  await page.locator("[data-close]").click();
  await expect(page.locator("#record-form")).toHaveCount(1);
  await page.goto("/#profile");
  await expect(page.locator(".profile-name")).toHaveText("依田 芳乃");
  await page.goto("/#editor");
  await expect(page.locator("#boot-screen")).toHaveCount(0, { timeout: 15000 });
  await page.locator('[data-tab="details"]').click();
  await expect(field(page, "profile.identity.name")).toHaveValue(
    "新的人物页姓名",
  );
  expect(errors).toEqual([]);
});

test("song fields and uploaded images update the real page; preview sizes do not affect the writing controls", async ({
  page,
}) => {
  await ready(page, "inori");
  const frame = await preview(page);
  await expect(frame.locator(".song-listening")).toBeVisible();
  await expect(frame.locator(".related-grid").first()).toBeVisible();
  await frame.locator('[data-edit-path="music.credits.composers"]').click();
  await expect(field(page, "music.credits.composers", "")).toBeFocused();
  await field(page, "music.credits.composers", "").fill("新的作曲者");
  await expect(
    frame.locator('[data-edit-path="music.credits.composers"]'),
  ).toContainText("新的作曲者");
  await frame.locator(".album-art img").click();
  const chooser = page.waitForEvent("filechooser");
  await page.locator('[data-upload-image="image"]').click();
  await (await chooser).setFiles("public/assets/COCC-17288.jpg");
  await expect(frame.locator(".album-art img")).toHaveAttribute(
    "src",
    /^blob:/,
  );
  await page.locator('[data-preview-width="390"]').click();
  await expect
    .poll(() => frame.locator("html").evaluate(() => innerWidth))
    .toBe(390);
  await expect
    .poll(() =>
      frame
        .locator("html")
        .evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await page.locator('[data-preview-width="1280"]').click();
  await expect
    .poll(() => frame.locator("html").evaluate(() => innerWidth))
    .toBe(1280);
});

test("templates cover both games, outfits and all categories; copying an existing page preserves every content field", async ({
  page,
}) => {
  await ready(page, "inori");
  await page.locator("[data-new]").click();
  await expect(page.locator("[data-new-kind]")).toHaveCount(11);
  await page.locator(".studio-template-copy summary").click();
  await page.locator("[data-template-search]").fill("inori");
  await page.locator('[data-copy-template="inori"]').click();
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("yoshino-editor-draft-v2")),
  );
  const copied = stored.changes[stored.selected].value;
  const original = catalog.items.find((x) => x.id === "inori");
  expect(copied.id).not.toBe(original.id);
  expect({ ...copied, id: original.id, title: original.title }).toEqual(
    original,
  );
  const frame = await preview(page);
  await expect(frame.locator(".song-listening")).toBeVisible();
  await expect(frame.locator(".track-list li")).toHaveCount(
    original.music.album.tracks.length,
  );
});

test("mobile visual editing stays within the screen and restores the form on Escape", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page, "inori");
  const frame = await preview(page);
  await page.locator('[data-preview-width="390"]').click();
  await frame.locator(".entry-heading h1").click();
  await field(page, "title").fill("手机修改");
  await expect(frame.locator(".entry-heading h1")).toHaveText("手机修改");
  expect(
    await page
      .locator("dialog")
      .evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  await expect(field(page, "title")).toHaveValue("手机修改");
});

test("the publication wizard shows the exact change and creates one PR only after confirmation without storing credentials", async ({
  page,
}) => {
  const writes = [];
  let pr;
  await page.route(
    "https://api.github.com/repos/yoshino-buoo/YoshinoDB/**",
    async (route) => {
      const request = route.request(),
        path = new URL(request.url()).pathname.split("YoshinoDB")[1];
      if (request.method() !== "GET")
        writes.push({ path, body: request.postDataJSON() });
      let data = {};
      if (path === "/git/ref/heads/main")
        data = { object: { sha: "base-sha" } };
      else if (path === "/git/commits/base-sha")
        data = { tree: { sha: "tree-sha" } };
      else if (path === "/contents/public/data/catalog.json") data = catalog;
      else if (path === "/contents/public/data/generated.json")
        data = { version: 1, items: [] };
      else if (path.startsWith("/git/ref/heads/")) {
        await route.fulfill({ status: 404, json: {} });
        return;
      } else if (["/git/blobs", "/git/trees", "/git/commits"].includes(path))
        data = { sha: "new-sha" };
      else if (path === "/pulls" && request.method() === "GET")
        data = pr ? [pr] : [];
      else if (path === "/pulls")
        data = pr = {
          number: 7,
          html_url: "https://github.com/yoshino-buoo/YoshinoDB/pull/7",
        };
      await route.fulfill({ json: data });
    },
  );
  await ready(page, "inori");
  await field(page, "description").fill("等待发布的新简介");
  await page.locator("[data-export]").click();
  await page.locator(".studio-review-list summary").first().click();
  await expect(page.locator(".studio-review-list ins")).toContainText(
    "等待发布的新简介",
  );
  await page.locator("[data-github-token]").fill("not-a-real-secret");
  await page.locator("[data-connect-github] button[type=submit]").click();
  await expect(page.locator("[data-submit-pr]")).toBeVisible();
  expect(writes).toEqual([]);
  await page.locator("[data-submit-pr]").click();
  await expect(page.locator(".studio-publish-success")).toContainText(
    "更新提案已创建",
  );
  expect(writes.filter((x) => x.path === "/pulls")).toHaveLength(1);
  expect(writes.find((x) => x.path === "/git/refs").body.ref).toMatch(
    /^refs\/heads\/codex\/content-/,
  );
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(
    "not-a-real-secret",
  );
  await page.locator("[data-close]").click();
  await page.locator("[data-export]").click();
  await expect(page.locator(".studio-publication")).toContainText(
    "这份修改已提交",
  );
  await expect(page.locator("[data-github-token]")).toHaveCount(0);
});

test("refreshing public data before export does not let a stale form overwrite someone else's change", async ({
  page,
}) => {
  await ready(page, "inori");
  const remote = structuredClone(catalog);
  remote.items.find((x) => x.id === "inori").description.zh =
    "其他编辑者刚刚更新的简介";
  await page.route("**/data/catalog.json", (route) =>
    route.fulfill({ json: remote }),
  );
  await page.locator("[data-export]").click();
  await expect(page.locator("[data-download-json]")).toBeVisible();
  await page.locator("[data-close]").click();
  await expect(field(page, "description")).toHaveValue(
    "其他编辑者刚刚更新的简介",
  );
  await field(page, "title").fill("只修改标题");
  const draft = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("yoshino-editor-draft-v2")),
  );
  expect(draft.changes.inori.value.description.zh).toBe(
    "其他编辑者刚刚更新的简介",
  );
  expect(draft.changes.inori.base.description.zh).toBe(
    "其他编辑者刚刚更新的简介",
  );
});

test("optional profile sections can be added, removed and undone entirely through the live forms", async ({
  page,
}) => {
  await ready(page, "profile-yoshino");
  const frame = await preview(page);
  await page.locator("[data-preview-group]").selectOption("details");
  await page.locator('[data-add="profile.stickers"]').evaluate((el) => {
    el.closest("details").open = true;
  });
  await page.locator('[data-add="profile.stickers"]').click();
  await expect(page.locator("[data-preview-status]")).toContainText(
    "已自动保存",
  );
  await expect(frame.locator(".profile-grid")).toBeVisible();
  await page.locator("[data-preview-undo]").click();
  await page.locator('[data-clear-block="profile.stickers"]').evaluate((el) => {
    el.closest("details").open = true;
  });
  await page.locator('[data-clear-block="profile.stickers"]').click();
  await expect(frame.locator(".profile-stickers")).toHaveCount(0);
  await page.locator("[data-preview-undo]").click();
  await expect(frame.locator(".profile-sticker")).toHaveCount(14);
  await page.locator("[data-close]").click();
  await expect(page.locator('[data-tab="details"]')).toHaveAttribute(
    "aria-selected",
    "true",
  );
});
