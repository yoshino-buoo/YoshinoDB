import test from "node:test";
import assert from "node:assert/strict";
import { githubPublisher, REPOSITORY_URL } from "../lib/editor-publish.js";

const record = {
  id: "example",
  kind: "news",
  title: { ja: "お知らせ", zh: "资讯" },
  description: { ja: "", zh: "原文" },
  date: "",
  source: "https://example.com/article",
  sourceName: "Example",
  official: false,
  tags: [],
};
const catalog = { version: 1, items: [record] };
const changed = (update = {}) => ({
  example: {
    base: structuredClone(record),
    value: {
      ...structuredClone(record),
      description: { ja: "", zh: "更新" },
      ...update,
    },
  },
});

function github({ remote = structuredClone(catalog), failPR = false } = {}) {
  const calls = [],
    blobs = [],
    refs = new Map();
  let sha = "main-sha",
    pr,
    failed = false;
  const response = (body, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  const request = async (url, options) => {
    assert.ok(
      url.startsWith("https://api.github.com/repos/yoshino-buoo/YoshinoDB/"),
    );
    const path = url.split("YoshinoDB")[1],
      body = options.body && JSON.parse(options.body);
    calls.push({ path, method: options.method, body });
    if (path === "/git/ref/heads/main") return response({ object: { sha } });
    if (path.startsWith("/git/commits/") && options.method === "GET")
      return response({ tree: { sha: "base-tree" } });
    if (path.startsWith("/contents/public/data/catalog.json"))
      return response(remote);
    if (path.startsWith("/contents/public/data/generated.json"))
      return response({ version: 1, items: [] });
    if (path.startsWith("/contents/public/assets/manifest.json"))
      return response([
        { image: "assets/remote.png", source: "https://example.com" },
      ]);
    if (path.startsWith("/contents/")) return response({}, 404);
    if (path === "/git/blobs") {
      blobs.push(body);
      return response({ sha: `blob-${blobs.length}` });
    }
    if (path === "/git/trees") return response({ sha: "new-tree" });
    if (path === "/git/commits") return response({ sha: "new-commit" });
    if (path.startsWith("/git/ref/heads/"))
      return refs.has(path.slice(15))
        ? response({ object: { sha: refs.get(path.slice(15)) } })
        : response({}, 404);
    if (path === "/git/refs") {
      refs.set(body.ref.slice(11), body.sha);
      return response({ ref: body.ref });
    }
    if (path.startsWith("/pulls?")) return response(pr ? [pr] : []);
    if (path === "/pulls") {
      pr = { html_url: `${REPOSITORY_URL}/pull/42`, number: 42 };
      if (failPR && !failed) {
        failed = true;
        throw Error("connection lost after server accepted PR");
      }
      return response(pr);
    }
    throw Error(`Unexpected request: ${path}`);
  };
  return {
    request,
    calls,
    blobs,
    setHead(value) {
      sha = value;
    },
  };
}

test("review rebases against the pinned GitHub commit, includes binary images and preserves the remote manifest", async () => {
  const remote = structuredClone(catalog);
  remote.items[0].title.ja = "公開側の変更";
  remote.items.push({ ...record, id: "remote-new" });
  const mock = github({ remote }),
    publisher = githubPublisher("private-test-value", mock);
  const review = await publisher.review(
    changed({ image: "assets/upload-abc.png" }),
    [
      {
        path: "assets/upload-abc.png",
        blob: new Blob([new Uint8Array([0, 1, 2, 255])]),
      },
    ],
  );
  assert.equal(review.catalog.items[0].title.ja, "公開側の変更");
  assert.equal(review.catalog.items.length, 2);
  assert.equal(review.catalog.items[0].description.zh, "更新");
  assert.equal(
    mock.calls.some((x) => x.method !== "GET"),
    false,
  );
  assert.equal(
    JSON.parse(review.files["public/assets/manifest.json"]).length,
    2,
  );
  const pr = await publisher.submit(review, "资料更新");
  assert.equal(pr.number, 42);
  const tree = mock.calls.find((x) => x.path === "/git/trees").body;
  assert.equal(tree.base_tree, "base-tree");
  assert.deepEqual(
    tree.tree.map((x) => x.path),
    [
      "public/data/catalog.json",
      "public/assets/upload-abc.png",
      "public/assets/manifest.json",
    ],
  );
  assert.deepEqual(
    mock.calls.find((x) => x.path === "/git/commits" && x.method === "POST")
      .body.parents,
    ["main-sha"],
  );
  assert.match(
    mock.calls.find((x) => x.path === "/git/refs").body.ref,
    /^refs\/heads\/codex\/content-/,
  );
  assert.equal(
    mock.calls.some((x) => x.method === "PATCH"),
    false,
  );
  assert.equal(
    mock.blobs.find((x) => x.encoding === "base64").content,
    "AAEC/w==",
  );
  assert.equal(
    JSON.stringify(mock.calls).includes("private-test-value"),
    false,
  );
});

test("conflicting edits and missing assets stop publication before any write", async () => {
  const remote = structuredClone(catalog);
  remote.items[0].description.zh = "另一份修改";
  const mock = github({ remote });
  await assert.rejects(
    githubPublisher("test", mock).review(changed()),
    (e) =>
      e.code === "conflict" && e.conflicts[0].paths.includes("description.zh"),
  );
  assert.equal(
    mock.calls.every((x) => x.method === "GET"),
    true,
  );
  const missing = github();
  await assert.rejects(
    githubPublisher("test", missing).review(
      changed({ image: "assets/missing.png" }),
    ),
    (e) => e.status === 404,
  );
  assert.equal(
    missing.calls.every((x) => x.method === "GET"),
    true,
  );
});

test("main moving after review blocks writes; an uncertain PR request retries without duplicate branches or PRs", async () => {
  const mock = github();
  const publisher = githubPublisher("test", mock);
  const review = await publisher.review(changed());
  mock.setHead("new-main");
  await assert.rejects(
    publisher.submit(review, "Update"),
    (e) => e.code === "stale",
  );
  assert.equal(
    mock.calls.every((x) => x.method === "GET"),
    true,
  );
  const retry = github({ failPR: true }),
    retryPublisher = githubPublisher("test", retry);
  const retryReview = await retryPublisher.review(changed());
  await assert.rejects(
    retryPublisher.submit(retryReview, "Update"),
    (e) => e.code === "network" && e.branch.startsWith("codex/content-"),
  );
  assert.equal((await retryPublisher.submit(retryReview, "Update")).number, 42);
  assert.equal(
    retry.calls.filter((x) => x.path === "/pulls" && x.method === "POST")
      .length,
    1,
  );
  assert.equal(
    retry.calls.filter((x) => x.path === "/git/refs" && x.method === "POST")
      .length,
    1,
  );
});

test("already published changes and invalid authentication do not produce a PR", async () => {
  const remote = { version: 1, items: [changed().example.value] };
  await assert.rejects(
    githubPublisher("test", github({ remote })).review(changed()),
    (e) => e.code === "unchanged",
  );
  await assert.rejects(
    githubPublisher("test", {
      request: async () => new Response("{}", { status: 401 }),
    }).review(changed()),
    (e) => e.code === "authentication",
  );
});

test("a new session recovers an uncertain submission using only persisted non-secret attempt metadata", async () => {
  const mock = github({ failPR: true });
  let saved;
  const first = githubPublisher("not-saved", {
    ...mock,
    onAttempt: (attempt) => (saved = structuredClone(attempt)),
  });
  const review = await first.review(changed());
  await assert.rejects(
    first.submit(review, "Update"),
    (e) => e.code === "network",
  );
  assert.equal(saved.commitSha, "new-commit");
  assert.equal(JSON.stringify(saved).includes("not-saved"), false);
  const fresh = githubPublisher("new-token", mock);
  const recovered = await fresh.recover(saved);
  assert.equal(recovered.pr.number, 42);
  assert.equal(
    mock.calls.filter((x) => x.path === "/pulls" && x.method === "POST").length,
    1,
  );
  assert.equal(
    mock.calls.filter((x) => x.path === "/git/refs" && x.method === "POST")
      .length,
    1,
  );
});
