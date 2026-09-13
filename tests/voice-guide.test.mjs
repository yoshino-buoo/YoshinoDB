import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateCatalog, searchText } from "../lib/data.js";
import { voiceFileUrl } from "../lib/voice-guide.js";

test("voice file links preserve trained variants and reject paths outside the scene index", () => {
  const url = new URL(voiceFileUrl("CGSS-Yoshino-14+-4-01.mp3"));
  assert.equal(
    decodeURIComponent(url.pathname),
    "/imascg/文件:CGSS-Yoshino-14+-4-01.mp3",
  );
  const item = {
    id: "voice",
    kind: "cards",
    title: { ja: "芳乃" },
    source: "https://example.com",
    sourceName: "Example",
    official: false,
    voiceGuide: {
      source: "https://wiki.biligame.com/imascg/依田芳乃",
      stages: [{ groups: [{ clips: [{ file: "../../other.mp3" }] }] }],
    },
  };
  assert.throws(
    () => validateCatalog({ version: 1, items: [item] }),
    /voice file/,
  );
});

test("the audited card scenes and profile survive catalog validation and remain searchable", async () => {
  const data = validateCatalog(
    JSON.parse(await readFile("public/data/catalog.json", "utf8")),
  );
  const cards = data.items.filter((x) => x.game === "deresute" && x.voiceGuide);
  assert.equal(cards.length, 19);
  for (const card of cards) {
    assert.equal(card.voiceGuide.stages.length, 2);
    for (const stage of card.voiceGuide.stages) {
      assert.equal(
        stage.groups.reduce((n, g) => n + g.clips.length, 0),
        36,
      );
      assert.ok(stage.groups.every((g) => g.label.ja && g.label.zh));
    }
  }
  const profile = data.items.find((x) => x.kind === "profile");
  assert.ok(searchText(profile).includes("仙贝"));
  const seaside = cards.find((x) => x.id === "card-1529");
  assert.ok(searchText(seaside).includes("亲爱度"));
  assert.ok(!searchText(seaside).includes(".mp3"));
  const mobamas = data.items.filter((x) => x.game === "mobamas");
  assert.equal(mobamas.length, 20);
  assert.equal(
    mobamas.reduce((n, x) => n + x.gallery.length, 0),
    40,
  );
  assert.equal(
    data.items.find((x) => x.id === "mobamas-ddf7d3e8").date,
    "2014-05-28",
  );
});
