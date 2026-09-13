import { test, expect } from "@playwright/test";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { extname, resolve, sep } from "node:path";

test("a returning visitor sees new card data within the Pages cache lifetime", async ({
  page,
}) => {
  const dist = resolve("dist");
  const latest = JSON.parse(
    readFileSync(resolve(dist, "data/catalog.json"), "utf8"),
  );
  const previous = structuredClone(latest);
  previous.items.forEach((item) => {
    if (item.card) delete item.card.petit;
  });
  let published = false;
  const requests = [];
  // Use a real HTTP cache: Playwright request interception disables browser
  // caching and would hide the exact returning-visitor failure.
  const server = createServer((req, res) => {
    const path = new URL(req.url, "http://localhost").pathname;
    if (path === "/data/catalog.json") {
      requests.push({ published, cacheControl: req.headers["cache-control"] });
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Cache-Control", "max-age=600");
      const etag = published ? '"new-catalog"' : '"old-catalog"';
      res.setHeader("ETag", etag);
      if (req.headers["if-none-match"] === etag) res.writeHead(304).end();
      else res.end(JSON.stringify(published ? latest : previous));
      return;
    }
    const file = resolve(dist, path === "/" ? "index.html" : "." + path);
    if (!file.startsWith(dist + sep)) {
      res.writeHead(404).end();
      return;
    }
    try {
      const body = readFileSync(file);
      res.setHeader(
        "Content-Type",
        {
          ".html": "text/html",
          ".js": "text/javascript",
          ".css": "text/css",
          ".json": "application/json",
          ".svg": "image/svg+xml",
          ".png": "image/png",
          ".jpg": "image/jpeg",
          ".woff2": "font/woff2",
        }[extname(file)] || "application/octet-stream",
      );
      res.setHeader("Cache-Control", "no-cache");
      res.end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  try {
    await page.goto(
      `http://127.0.0.1:${server.address().port}/#entry/card-3611`,
    );
    await expect(page.locator(".entry-cards")).toBeVisible();
    await expect(page.locator("yoshino-petit")).toHaveCount(0);
    published = true;
    await page.reload();
    await expect(page.locator("yoshino-petit")).toHaveCount(1);
    expect(requests.some((request) => request.published)).toBe(true);
  } finally {
    server.closeAllConnections();
    await new Promise((done) => server.close(done));
  }
});
