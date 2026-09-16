import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  previewFromResult,
  validateListening,
  appleTrackId,
  songMappings,
} from "../lib/listening.js";

test("song matching excludes unrelated performers, instrumentals and solo remixes", () => {
  const song = { title: { ja: "Snow＊Love" } };
  const result = {
    kind: "song",
    trackId: 123,
    trackName: "Snow*Love (GAME VERSION)",
    artistName: "依田芳乃",
    collectionName: "Album",
    previewUrl: "https://audio-ssl.itunes.apple.com/preview.m4a",
    trackViewUrl: "https://music.apple.com/jp/album/123?i=123",
  };
  assert.equal(previewFromResult(song, result).version, "game");
  assert.equal(
    previewFromResult(song, { ...result, artistName: "Other performer" }),
    null,
  );
  for (const name of [
    "Snow*Love (オリジナル・カラオケ)",
    "Snow*Love (M@STER VERSION) [依田芳乃ソロ・リミックス]",
    "Snow*Lover",
  ])
    assert.equal(previewFromResult(song, { ...result, trackName: name }), null);
  assert.equal(
    previewFromResult(song, {
      ...result,
      previewUrl: "https://audio-ssl.itunes.apple.com.evil.test/song.mp3",
    }),
    null,
  );
});

test("published previews map to catalog songs and trusted streaming URLs", async () => {
  const data = validateListening(
    JSON.parse(await readFile("public/data/listening.json", "utf8")),
  );
  const catalog = JSON.parse(
    await readFile("public/data/catalog.json", "utf8"),
  );
  for (const [id, track] of Object.entries(data.tracks)) {
    const item = catalog.items.find((x) => x.id === id && x.kind === "songs");
    if (item?.music?.appleTrackUrl)
      assert.equal(appleTrackId(item.music.appleTrackUrl), track.trackId);
    assert.match(track.artist, /依田芳乃/);
  }
  assert.throws(() =>
    validateListening({
      tracks: {
        inori: { ...data.tracks.inori, storeUrl: "javascript:alert(1)" },
      },
    }),
  );
});

test("song links select a specific Apple track; blank links disable previews and removed records are excluded", () => {
  assert.equal(
    appleTrackId("https://music.apple.com/jp/album/example/111?i=123"),
    123,
  );
  assert.equal(
    appleTrackId("https://music.apple.com/jp/song/example/123"),
    123,
  );
  assert.equal(
    appleTrackId("https://music.apple.com/jp/album/example/111"),
    null,
  );
  assert.equal(
    appleTrackId("https://music.apple.com.evil.test/jp/song/123"),
    null,
  );
  assert.deepEqual(
    songMappings(
      {
        items: [
          {
            id: "new",
            kind: "songs",
            music: {
              appleTrackUrl: "https://music.apple.com/jp/song/example/123",
            },
          },
          { id: "off", kind: "songs", music: { appleTrackUrl: "" } },
          { id: "old", kind: "songs" },
        ],
      },
      { off: 789, old: 456, removed: 999 },
    ),
    { new: 123, old: 456 },
  );
});
