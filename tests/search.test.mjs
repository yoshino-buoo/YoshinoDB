import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { searchText } from "../lib/data.js";

const catalog = JSON.parse(
  readFileSync(new URL("../public/data/catalog.json", import.meta.url)),
);

test("song credits remain searchable independently of editorial introductions", () => {
  for (const song of catalog.items.filter((item) => item.kind === "songs")) {
    const searchable = searchText(song);
    for (const name of Object.values(song.music.credits).flat())
      assert.ok(searchable.includes(name.toLocaleLowerCase()), song.id);
    assert.ok(
      searchable.includes(song.music.album.catalogNumber.toLocaleLowerCase()),
      song.id,
    );
  }
});

test("search includes both languages and detail fields without matching source URLs", () => {
  const item = {
    title: { ja: "祈りの花", zh: "祈愿之花" },
    description: { ja: "やさしい歌声", zh: "温柔的歌声" },
    source: "https://example.com/unrelated-path",
    music: {
      performers: ["依田芳乃"],
      credits: { composers: ["BNSI（トリ音）"] },
    },
    unit: { members: [{ ja: "高森藍子", zh: "高森蓝子" }] },
    card: { skill: { name: "薄紅ひとひら" } },
  };
  const searchable = searchText(item);
  for (const query of [
    "祈愿之花",
    "やさしい歌声",
    "温柔的歌声",
    "依田芳乃",
    "bnsi",
    "高森蓝子",
    "薄紅ひとひら",
  ])
    assert.ok(searchable.includes(query), query);
  assert.equal(searchable.includes("unrelated-path"), false);
  assert.equal(searchText({}).trim(), "");
});
