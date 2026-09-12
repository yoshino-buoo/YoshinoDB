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

test("every provided preview and gallery image has valid image bytes", async () => {
  const { imageExtension } = await import("../scripts/images.mjs");
  for (const name of ["catalog", "generated"]) {
    const data = JSON.parse(await readFile(`public/data/${name}.json`, "utf8"));
    for (const item of data.items) {
      for (const image of [
        item.image,
        ...(item.gallery || []).map((x) => x.image),
      ].filter(Boolean)) {
        assert.ok(
          imageExtension(await readFile(`public/${image}`)),
          `${item.id}: invalid image`,
        );
      }
    }
  }
});

test("new entries publish when thumbnails fail and can acquire the image on a later run", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "yoshino-pending-"));
  try {
    const item = {
      id: "new-news",
      title: { ja: "依田芳乃" },
      imageSource: "https://i.ytimg.com/vi/KHOnP8fbrwo/hqdefault.jpg",
    };
    const pending = await attachPreview(item, null, {
      root,
      fetcher: async () => new Response("unavailable", { status: 503 }),
    });
    assert.equal(pending.id, item.id);
    assert.equal(pending.previewStatus, "pending");
    assert.equal(pending.image, undefined);
    const bytes = await readFile("public/assets/video-inori.jpg");
    const ready = await attachPreview(item, pending, {
      root,
      fetcher: async () => new Response(bytes),
    });
    assert.ok(ready.image);
    assert.equal(ready.previewStatus, undefined);
    const failedReplacement = await attachPreview(
      { ...item, imageSource: item.imageSource + "?changed=1" },
      ready,
      { root, fetcher: async () => new Response("bad", { status: 500 }) },
    );
    assert.equal(failedReplacement.image, ready.image);
    assert.equal(failedReplacement.previewStatus, "pending");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
