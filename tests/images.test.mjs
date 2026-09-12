import test from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { allowedImage, cacheImage, attachPreview } from "../scripts/images.mjs";

test("thumbnail cache rejects HTML responses and leaves existing records intact on failure", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "yoshino-images-"));
  try {
    const bytes = await readFile("public/assets/video-inori.jpg");
    const url = "https://i.ytimg.com/vi/KHOnP8fbrwo/maxresdefault.jpg";
    const options = { root, fetcher: async () => new Response(bytes) };
    const image = await cacheImage(url, options);
    assert.deepEqual(await readFile(path.join(root, image)), bytes);
    const old = {
      id: "old",
      source: "https://example.com",
      image,
      imageSource: url,
    };
    const existing = await attachPreview(
      { ...old, title: { ja: "updated" } },
      old,
      {
        root,
        fetcher: () => {
          throw Error("network not needed");
        },
      },
    );
    assert.equal(existing.image, image);
    await assert.rejects(
      cacheImage(url, {
        root,
        fetcher: async () => new Response("<html>captcha</html>"),
      }),
      /image/i,
    );
    assert.deepEqual(await readFile(path.join(root, image)), bytes);
    assert.equal(allowedImage("https://127.0.0.1/internal"), false);
    assert.equal(
      allowedImage("https://i.ytimg.com.attacker.test/test.jpg"),
      false,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("every published record and gallery image has valid image bytes", async () => {
  const { imageExtension } = await import("../scripts/images.mjs");
  for (const name of ["catalog", "generated"]) {
    const data = JSON.parse(await readFile(`public/data/${name}.json`, "utf8"));
    for (const item of data.items) {
      assert.ok(item.image, `${item.id}: missing preview`);
      for (const image of [
        item.image,
        ...(item.gallery || []).map((x) => x.image),
      ]) {
        assert.ok(
          imageExtension(await readFile(`public/${image}`)),
          `${item.id}: invalid image`,
        );
      }
    }
  }
});
