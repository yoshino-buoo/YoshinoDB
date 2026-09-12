import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  materialize,
  threeWay,
  entryIssues,
  validateEditorCatalog,
  setPath,
  newRecord,
} from "../lib/editor-data.js";
import { zipFiles } from "../lib/editor-assets.js";
const catalog = JSON.parse(
  await readFile(new URL("../public/data/catalog.json", import.meta.url)),
);

test("cards must belong to a game so editor updates remain visible in the library", () => {
  assert.equal(newRecord("cards").game, "deresute");
  const item = structuredClone(catalog.items.find((x) => x.game === "mobamas"));
  delete item.game;
  assert.ok(entryIssues(item).some((x) => x.path === "game"));
  assert.throws(
    () => validateEditorCatalog({ version: 1, items: [item] }),
    /game/,
  );
});

test("the editor accepts every current detail shape without rewriting any data", () => {
  const before = JSON.stringify(catalog);
  validateEditorCatalog(catalog);
  const ids = new Set(catalog.items.map((x) => x.id));
  assert.deepEqual(
    catalog.items.flatMap((x) => entryIssues(x, ids, true)),
    [],
  );
  assert.equal(JSON.stringify(materialize(catalog, {}).catalog), before);
});
test("rebasing a small local edit preserves newly published records, nested fields and unknown metadata", () => {
  const old = structuredClone(catalog.items.find((x) => x.id === "inori")),
    local = structuredClone(old),
    remote = structuredClone(old);
  local.description.zh = "编辑过的导语";
  remote.music.album.catalogNumber = "UPDATED";
  remote.future = { nested: [{ value: "new" }] };
  const published = {
    version: 1,
    items: [remote, { ...catalog.items[1], id: "brand-new" }],
  };
  const result = materialize(published, {
    [old.id]: { base: old, value: local },
  });
  assert.equal(result.catalog.items.length, 2);
  assert.deepEqual(result.conflicts, []);
  const merged = result.catalog.items[0];
  assert.equal(merged.description.zh, local.description.zh);
  assert.equal(merged.music.album.catalogNumber, "UPDATED");
  assert.deepEqual(merged.future, remote.future);
  assert.deepEqual(
    merged.music.album.packageDiscs,
    old.music.album.packageDiscs,
  );
});
test("conflicting edits and reordered arrays require a deliberate choice", () => {
  const base = {
    title: { ja: "old", zh: "旧" },
    tracks: [
      { number: 1, title: "a" },
      { number: 2, title: "b" },
    ],
  };
  const local = {
      title: { ja: "old", zh: "本地" },
      tracks: [...base.tracks].reverse(),
    },
    remote = {
      title: { ja: "remote", zh: "线上" },
      tracks: [...base.tracks, { number: 3, title: "c" }],
    };
  const result = threeWay(base, local, remote);
  assert.deepEqual(result.conflicts, ["title.zh", "tracks"]);
  assert.equal(result.value.title.ja, "remote");
  assert.deepEqual(result.value.tracks, local.tracks);
});
test("validation identifies missing links and images, rejects malformed nested forms and unsafe paths", () => {
  const item = structuredClone(catalog.items[0]);
  item.relatedIds = ["missing"];
  item.gallery = [{ image: "" }];
  const issues = entryIssues(item, new Set(), true);
  assert.ok(issues.some((x) => x.path === "relatedIds"));
  assert.ok(issues.some((x) => x.path === "gallery.0.image"));
  item.music.album.tracks = {};
  assert.throws(() => validateEditorCatalog({ version: 1, items: [item] }));
  assert.throws(() => setPath({}, "__proto__.polluted", true));
  assert.equal({}.polluted, undefined);
});
test("publication ZIP stores exact UTF-8 JSON and binary artwork in repository paths", async () => {
  const json = '{"title":"芳乃"}\n',
    bytes = new Uint8Array([0, 1, 2, 255]),
    blob = zipFiles({
      "public/data/catalog.json": json,
      "public/assets/new.png": bytes,
    }),
    buffer = Buffer.from(await blob.arrayBuffer());
  const files = {};
  let offset = 0;
  while (buffer.readUInt32LE(offset) === 0x04034b50) {
    const size = buffer.readUInt32LE(offset + 18),
      length = buffer.readUInt16LE(offset + 26),
      name = buffer.toString("utf8", offset + 30, offset + 30 + length),
      start = offset + 30 + length;
    files[name] = buffer.subarray(start, start + size);
    offset = start + size;
  }
  assert.equal(files["public/data/catalog.json"].toString(), json);
  assert.deepEqual(files["public/assets/new.png"], Buffer.from(bytes));
  assert.equal(buffer.readUInt32LE(buffer.length - 22), 0x06054b50);
});
