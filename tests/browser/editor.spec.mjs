import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
const original = JSON.parse(await readFile("public/data/catalog.json", "utf8"));
async function ready(page) {
  await page.addInitScript(() => localStorage.setItem("yoshino-lang", "zh"));
  await page.goto("/#editor");
  await expect(page.locator("[data-new]")).toBeVisible();
  await expect(page.locator("#boot-screen")).toHaveCount(0);
}
async function select(page, id) {
  await page.locator("[data-search]").fill(id);
  await page.locator(`[data-select="${id}"]`).click();
}
const field = (page, path, locale) =>
  page.locator(
    `[data-field="${path}"]${locale ? `[data-locale="${locale}"]` : ""}`,
  );
async function exported(page) {
  await page.locator("[data-export]").click();
  await expect(page.locator("[data-download-json]")).toBeVisible();
  const pending = page.waitForEvent("download");
  await page.locator("[data-download-json]").click();
  const file = await pending;
  return JSON.parse(await readFile(await file.path(), "utf8"));
}

test("music details autosave, survive language/navigation/reload and export without losing nested package data", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await ready(page);
  await select(page, "inori");
  await page.locator('[data-tab="details"]').click();
  await field(page, "music.credits.composers").fill("新的作曲者");
  await field(page, "music.album.tracks.0.title").fill("祈りの花（編集）");
  await page.locator('[data-lang="ja"]').click();
  await expect(page.locator("html")).toHaveAttribute("lang", "ja");
  await expect(field(page, "music.album.tracks.0.title")).toHaveValue(
    "祈りの花（編集）",
  );
  await page.locator('.header nav a[href="#home"]').click();
  await expect(page.locator(".intro-grid")).toBeVisible();
  await page.locator('footer a[href="#editor"]').click();
  await expect(field(page, "music.credits.composers")).toHaveValue(
    "新的作曲者",
  );
  await page.reload();
  await expect(page.locator("#boot-screen")).toHaveCount(0);
  await expect(field(page, "music.credits.composers")).toHaveValue(
    "新的作曲者",
  );
  const data = await exported(page),
    song = data.items.find((x) => x.id === "inori"),
    old = original.items.find((x) => x.id === "inori");
  expect(song.music.credits.composers).toEqual(["新的作曲者"]);
  expect(song.music.album.packageDiscs).toEqual(old.music.album.packageDiscs);
  expect(song.music.sources).toEqual(old.music.sources);
  expect(song.description).toEqual(old.description);
  expect(data.items.length).toBe(original.items.length);
  expect(errors).toEqual([]);
});

test("cards calculate totals, gallery rows reorder and undo, and full previews use actual layouts", async ({
  page,
}) => {
  await ready(page);
  await select(page, "card-4125");
  await page.locator('[data-tab="details"]').click();
  const prior = Number(await field(page, "card.stats.0.total").inputValue()),
    vocal = Number(await field(page, "card.stats.0.vocal").inputValue());
  await field(page, "card.stats.0.vocal").fill(String(vocal + 50));
  await expect(field(page, "card.stats.0.total")).toHaveValue(
    String(prior + 50),
  );
  await page.locator('[data-tab="images"]').click();
  const first = await field(page, "gallery.0.image").inputValue();
  await page
    .locator('[data-move="gallery"][data-index="0"][data-direction="1"]')
    .click();
  expect(await field(page, "gallery.1.image").inputValue()).toBe(first);
  await page.locator("[data-undo]").click();
  await expect(field(page, "gallery.0.image")).toHaveValue(first);
  await page.locator("[data-editor-preview]").click();
  await expect(page.locator(".studio-preview .stats-table")).toBeVisible();
  await page.locator('.studio-preview [data-variant="1"]').click();
  await expect(
    page.locator('.studio-preview [data-variant-panel="1"]'),
  ).toBeVisible();
});

test("new records support rich paragraphs, related entries and persistent uploaded images in the ZIP", async ({
  page,
}) => {
  await ready(page);
  await page.locator("[data-new]").click();
  await page.locator('[data-new-kind="news"]').click();
  await field(page, "title", "ja").fill("新しいお知らせ");
  await field(page, "title", "zh").fill("新的资讯");
  await field(page, "source").fill("https://idolmaster-official.jp/news/test");
  await field(page, "sourceName").fill("アイドルマスター");
  await page.locator('[data-tab="body"]').click();
  await page.locator('[data-add="sections"]').click();
  await field(page, "sections.0.title", "ja").fill("内容");
  await page.locator('[data-add="sections.0.paragraphs"]').click();
  await field(page, "sections.0.paragraphs.0", "zh").fill("这里是详细内容。");
  await page.locator('[data-tab="related"]').click();
  await page.locator("[data-pick-relations]").click();
  await page.locator("[data-modal-search]").fill("祈りの花");
  await page.locator('[data-related="inori"]').check();
  await page.locator("[data-done]").click();
  await page.locator('[data-tab="images"]').click();
  const chooser = page.waitForEvent("filechooser");
  await page.locator('[data-upload-image="image"]').click();
  await (await chooser).setFiles("public/assets/COCC-17288.jpg");
  await expect(field(page, "image")).toHaveValue(/^assets\/upload-/);
  const image = await field(page, "image").inputValue();
  await page.reload();
  await expect(page.locator("#boot-screen")).toHaveCount(0);
  await expect(field(page, "image")).toHaveValue(image);
  await expect
    .poll(() =>
      page
        .locator('[data-image-for="image"] img')
        .evaluate((el) => el.complete && el.naturalWidth > 0),
    )
    .toBe(true);
  await page.locator("[data-editor-preview]").click();
  await expect(page.locator(".studio-preview .news-article")).toContainText(
    "这里是详细内容。",
  );
  await page.locator("[data-close]").click();
  await page.locator("[data-export]").click();
  await expect(page.locator("[data-download-json]")).toBeDisabled();
  const pending = page.waitForEvent("download");
  await page.locator("[data-download-package]").click();
  const download = await pending,
    buffer = await readFile(await download.path());
  expect(buffer.includes(Buffer.from(`public/${image}`))).toBe(true);
  expect(buffer.includes(Buffer.from("这里是详细内容。"))).toBe(true);
  expect(buffer.includes(Buffer.from("public/assets/manifest.json"))).toBe(
    true,
  );
});

test("incomplete new entries are kept, and export validation takes the writer to the missing field", async ({
  page,
}) => {
  await ready(page);
  await page.locator("[data-new]").click();
  await page.locator('[data-new-kind="timeline"]').click();
  await field(page, "title", "ja").fill("新しい足あと");
  await page.locator("[data-export]").click();
  await expect(page.locator(".studio-issue-list")).toBeVisible();
  await page
    .locator("[data-issue]")
    .filter({ hasText: "请填写 https:// 来源网址" })
    .first()
    .click();
  await expect(field(page, "source")).toBeFocused();
  await expect(field(page, "title", "ja")).toHaveValue("新しい足あと");
});

test("import merges instead of dropping absent records and can be undone; mobile Chinese stays within viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  const record = structuredClone(original.items[0]);
  record.title.zh = "导入的标题";
  const chooser = page.waitForEvent("filechooser");
  await page.locator("[data-import]").click();
  await (
    await chooser
  ).setFiles({
    name: "catalog.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ version: 1, items: [record] })),
  });
  await page.locator("[data-confirm-import]").click();
  await expect(field(page, "title", "zh")).toHaveValue("导入的标题");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.locator("[data-undo]").click();
  await expect(field(page, "title", "zh")).toHaveValue(
    original.items[0].title.zh,
  );
  const data = await exported(page);
  expect(data.items.length).toBe(original.items.length);
});

test("a concurrent published edit is detected before export and resolved without dropping new entries", async ({
  page,
}) => {
  await ready(page);
  await select(page, "inori");
  await field(page, "description", "zh").fill("我的修改");
  const remote = structuredClone(original);
  remote.items.find((x) => x.id === "inori").description.zh = "线上的修改";
  remote.items.push({ ...original.items[1], id: "published-after-open" });
  await page.route("**/data/catalog.json", (r) => r.fulfill({ json: remote }));
  await page.locator("[data-export]").click();
  await expect(page.locator(".studio-conflict")).toBeVisible();
  await page.locator('[data-resolve="local"]').click();
  const data = await exported(page);
  expect(data.items.find((x) => x.id === "inori").description.zh).toBe(
    "我的修改",
  );
  expect(data.items.some((x) => x.id === "published-after-open")).toBe(true);
});

test("advanced JSON is retained until explicitly applied, and preview language changes its labels and font stack", async ({
  page,
}) => {
  await ready(page);
  await select(page, "inori");
  await page.locator('[data-tab="advanced"]').click();
  await page.locator(".studio-raw summary").click();
  const raw = JSON.parse(await page.locator("[data-raw]").inputValue());
  raw.future = { notes: ["保留的新字段"] };
  await page.locator("[data-raw]").fill(JSON.stringify(raw));
  await page.locator('[data-tab="basic"]').click();
  await page.locator("[data-export]").click();
  await expect(page.locator("[data-raw]")).toBeFocused();
  await page.locator("[data-apply-raw]").click();
  await page.locator("[data-editor-preview]").click();
  await page.locator('[data-preview-lang="ja"]').click();
  await expect(page.locator(".studio-preview .entry-heading>a")).toContainText(
    "楽曲",
  );
  expect(
    await page
      .locator(".studio-preview-content")
      .evaluate((el) => getComputedStyle(el).getPropertyValue("--serif")),
  ).toContain("Noto Serif JP");
  await page.locator("[data-close]").click();
  const data = await exported(page);
  expect(data.items.find((x) => x.id === "inori").future).toEqual(raw.future);
});
