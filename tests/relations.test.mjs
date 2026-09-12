import test from "node:test";
import assert from "node:assert/strict";
import { relatedRecords, embedUrl } from "../lib/relations.js";
import { validateCatalog } from "../lib/data.js";
const song = {
  id: "inori",
  kind: "songs",
  title: { ja: "祈りの花" },
  source: "https://example.com/inori",
  tags: ["solo", "deresute"],
  sourceName: "Test",
  official: true,
};
test("relations connect named works and explicit entries without linking every shared platform tag", () => {
  const video = {
    id: "video",
    kind: "videos",
    title: { ja: "祈りの花 · 公式MV" },
    source: "https://example.com/video",
    tags: ["youtube", "deresute"],
  };
  const unrelated = {
    id: "other",
    kind: "videos",
    title: { ja: "違う曲" },
    source: "https://example.com/other",
    tags: ["youtube", "deresute"],
  };
  assert.deepEqual(
    relatedRecords(song, [song, video, unrelated]).map((x) => x.id),
    ["video"],
  );
  assert.deepEqual(relatedRecords(video, [video, unrelated]), []);
  assert.deepEqual(
    relatedRecords({ ...video, relatedIds: ["inori"] }, [song, video]).map(
      (x) => x.id,
    ),
    ["inori"],
  );
});
test("players use only supported HTTPS platforms and preserve Bilibili part selection", () => {
  assert.equal(
    embedUrl("https://www.bilibili.com/video/BV1VQcFzrEa5/", 3),
    "https://player.bilibili.com/player.html?bvid=BV1VQcFzrEa5&page=3&autoplay=0",
  );
  assert.equal(
    embedUrl("https://www.youtube.com/watch?v=gcKwbJ0est0"),
    "https://www.youtube-nocookie.com/embed/gcKwbJ0est0?rel=0&autoplay=0",
  );
  for (const url of [
    "http://www.youtube.com/watch?v=gcKwbJ0est0",
    "https://evil.example/video/BV1VQcFzrEa5/",
    "https://www.youtube.com/watch?v=<iframe>",
  ])
    assert.equal(embedUrl(url), null);
});
test("typed detail validation catches unsafe chapter links and incorrect card totals", () => {
  assert.throws(() =>
    validateCatalog({
      version: 1,
      items: [
        { ...song, story: { chapters: [{ source: "javascript:alert(1)" }] } },
      ],
    }),
  );
  assert.throws(() =>
    validateCatalog({
      version: 1,
      items: [
        {
          ...song,
          card: {
            stats: [{ life: 10, vocal: 1, dance: 2, visual: 3, total: 7 }],
          },
        },
      ],
    }),
  );
  assert.doesNotThrow(() =>
    validateCatalog({
      version: 1,
      items: [
        {
          ...song,
          card: {
            stats: [{ life: 10, vocal: 1, dance: 2, visual: 3, total: 6 }],
          },
        },
      ],
    }),
  );
});
