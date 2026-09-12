import test from "node:test";
import assert from "node:assert/strict";
import { validateCatalog, mergeRecords, validDate } from "../lib/data.js";
import { parseFeed, parseCgNews } from "../scripts/sync-lib.mjs";
const item = {
  id: "inori",
  kind: "videos",
  title: { ja: "祈りの花" },
  date: "2017-02-24",
  source: "https://www.youtube.com/watch?v=KHOnP8fbrwo",
  sourceName: "日本コロムビア",
  official: true,
};
const source = {
  id: "columbia",
  name: "Columbia",
  type: "youtube",
  official: true,
};
test("reject unsafe links, duplicate IDs and invalid dates before publishing", () => {
  for (const broken of [
    { ...item, source: "javascript:alert(1)" },
    { ...item, date: "2026-02-30" },
    { ...item, image: "assets/../../secret.png" },
  ])
    assert.throws(() => validateCatalog({ version: 1, items: [broken] }));
  assert.throws(() => validateCatalog({ version: 1, items: [item, item] }));
  assert.equal(validDate("2024-02-29"), true);
});
test("sync is idempotent and preserves records absent from a feed", () => {
  const old = { ...item, id: "old", source: "https://example.com/archive" };
  const updated = { ...item, title: { ja: "Updated" } };
  const merged = mergeRecords([old, item], [updated, updated]);
  assert.equal(merged.length, 2);
  assert.equal(merged.find((x) => x.id === item.id).title.ja, "Updated");
  assert.deepEqual(mergeRecords(merged, []), merged);
});
test("Atom filters by title or description and rejects off-platform URLs", () => {
  const xml = `<feed><entry><title>公式動画</title><link rel="alternate" href="${item.source}"/><published>2017-02-24T00:00:00Z</published><media:group><media:description>依田芳乃</media:description></media:group></entry><entry><title>依田芳乃</title><link rel="alternate" href="https://evil.example/watch?v=KHOnP8fbrwo"/><published>2017-02-24T00:00:00Z</published></entry><entry><title>無関係</title><link rel="alternate" href="https://www.youtube.com/watch?v=aaaaaaaaaaa"/><published>2017-02-24T00:00:00Z</published></entry></feed>`;
  const records = parseFeed(xml, source, ["依田芳乃"]);
  assert.equal(records.length, 1);
  assert.equal(records[0].source, item.source);
  assert.equal(records[0].official, true);
  assert.throws(() => parseFeed("<html>captcha</html>", source, ["依田芳乃"]));
});
test("Bilibili feed links are attributed as fan uploads and normalized", () => {
  const xml =
    "<rss><channel><item><title>依田芳乃 中文字幕</title><link>https://www.bilibili.com/video/BV1Ja411K7UR/?from=test</link><pubDate>Thu, 04 Aug 2022 10:48:57 GMT</pubDate></item></channel></rss>";
  const records = parseFeed(
    xml,
    { ...source, id: "kokoro", official: false, type: "bilibili-rss" },
    ["芳乃"],
  );
  assert.equal(records[0].official, false);
  assert.equal(
    records[0].source,
    "https://www.bilibili.com/video/BV1Ja411K7UR/",
  );
});
test("official news ignores navigation and reports source layout breakage", () => {
  const html =
    '<nav>依田芳乃</nav><a class="top-news__link" href="https://idolmaster-official.jp/news/01_19791"><p class="top-news__title">依田芳乃 Memory Pict.</p><p class="top-news__date">2026.09.04</p></a>';
  assert.equal(parseCgNews(html, source, ["芳乃"])[0].date, "2026-09-04");
  assert.throws(() => parseCgNews("<p>Captcha</p>", source, ["芳乃"]));
});

test("preview URLs are carried through official Atom and article parsing", () => {
  const xml = `<feed><entry><title>依田芳乃</title><link rel="alternate" href="${item.source}"/><published>2017-02-24T00:00:00Z</published><media:group><media:thumbnail url="https://i.ytimg.com/vi/KHOnP8fbrwo/hqdefault.jpg"/></media:group></entry></feed>`;
  assert.equal(
    parseFeed(xml, source, ["芳乃"])[0].imageSource,
    "https://i.ytimg.com/vi/KHOnP8fbrwo/hqdefault.jpg",
  );
  const html =
    '<a class="top-news__link" href="https://idolmaster-official.jp/news/01_19791"><img src="https://cinderellagirls.idolmaster-official.jp/memopic11.png"><p class="top-news__title">依田芳乃</p><p class="top-news__date">2026.09.04</p></a>';
  assert.equal(
    parseCgNews(html, source, ["芳乃"])[0].imageSource,
    "https://cinderellagirls.idolmaster-official.jp/memopic11.png",
  );
});

test("gallery file paths cannot escape the assets directory", () => {
  assert.throws(() =>
    validateCatalog({
      version: 1,
      items: [{ ...item, gallery: [{ image: "assets/../../secret.jpg" }] }],
    }),
  );
});
