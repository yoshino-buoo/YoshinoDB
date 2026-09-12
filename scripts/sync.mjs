import { readFile, writeFile, rename } from "node:fs/promises";
import * as cheerio from "cheerio";
import { mergeRecords, validateCatalog, isHttps } from "../lib/data.js";
import { matches, parseFeed, parseCgNews, makeItem } from "./sync-lib.mjs";
import { attachPreview } from "./images.mjs";
const config = JSON.parse(await readFile("public/data/sources.json", "utf8"));
const previous = validateCatalog(
  JSON.parse(await readFile("public/data/generated.json", "utf8")),
);
const now = new Date().toISOString();
async function get(url) {
  if (!isHttps(url)) throw Error("HTTPS is required");
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "YoshinoDB/1.0 (+https://github.com/yoshino-buoo/YoshinoDB)",
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw Error("HTTP " + response.status);
  const body = await response.text();
  if (body.length > 8_000_000) throw Error("Response exceeds size limit");
  return body;
}
async function syncSource(source) {
  if (source.type === "bilibili-rss") {
    // Bilibili's space endpoint is subject to access controls. Use a maintainer-provided,
    // permitted RSS service, or keep explicit manual links. No cookies/signature bypass.
    if (!process.env.BILIBILI_FEED_URL) return { status: "manual", items: [] };
    return {
      status: "ok",
      items: parseFeed(
        await get(process.env.BILIBILI_FEED_URL),
        source,
        config.keywords,
      ),
    };
  }
  const body = await get(source.url);
  if (source.type === "youtube")
    return { status: "ok", items: parseFeed(body, source, config.keywords) };
  if (source.type === "cg-news")
    return { status: "ok", items: parseCgNews(body, source, config.keywords) };
  if (source.type === "columbia-news") {
    const $ = cheerio.load(body);
    const urls = [
      ...new Set(
        $("a[href]")
          .toArray()
          .map((el) => new URL($(el).attr("href"), source.url).href)
          .filter((u) =>
            /^https:\/\/columbia.jp\/idolmaster\/imasnews\/\d{6}\.html$/.test(
              u,
            ),
          ),
      ),
    ]
      .sort()
      .reverse()
      .slice(0, 3);
    if (!urls.length) throw Error("Columbia news layout changed");
    const items = [];
    for (const url of urls) {
      const page = cheerio.load(await get(url));
      page("script,style,nav,header,footer").remove();
      const content = page("body").text();
      if (!matches(content, config.keywords)) continue;
      const code = url.match(/(\d{6})\.html$/)[1];
      const date = `20${code.slice(0, 2)}-${code.slice(2, 4)}-${code.slice(4, 6)}`;
      const keywords = config.keywords.filter((k) => matches(content, [k]));
      const item = makeItem(source, `日本コロムビア ${date} 更新`, url, date);
      item.title.zh = `日本哥伦比亚 ${date} 更新`;
      item.description = {
        ja: keywords.join("・"),
        zh: keywords.join("、"),
      };
      const image = page("img")
        .toArray()
        .find((el) => matches(page(el).attr("alt") || "", keywords));
      const src = image
        ? page(image).attr("src")
        : page('meta[property="og:image"]').attr("content");
      item.imageSource = src ? new URL(src, url).href : "";
      items.push(item);
    }
    return { status: "ok", items };
  }
  throw Error("Unsupported source type");
}
const results = await Promise.allSettled(
  config.sources.map(async (source) => {
    const result = await syncSource(source);
    const items = [],
      warnings = [];
    const retry = previous.items.filter(
      (x) =>
        x.sourceId === source.id &&
        x.previewStatus === "pending" &&
        !result.items.some((y) => y.source === x.source),
    );
    for (const item of [...result.items, ...retry]) {
      const old = previous.items.find(
        (x) => x.kind === item.kind && x.source === item.source,
      );
      items.push(
        await attachPreview(item, old, {
          onWarning: (warning) => warnings.push(warning),
        }),
      );
    }
    return {
      ...result,
      items,
      warnings,
    };
  }),
);
const incoming = [],
  states = [];
for (let i = 0; i < results.length; i++) {
  const result = results[i],
    source = config.sources[i],
    old = previous.sources?.find((s) => s.id === source.id);
  const status = result.status === "fulfilled" ? result.value.status : "error";
  const items = result.status === "fulfilled" ? result.value.items : [];
  incoming.push(...items);
  states.push({
    id: source.id,
    name: source.name,
    status,
    checkedAt: now,
    lastSuccess: status === "ok" ? now : (old?.lastSuccess ?? null),
    matches: items.length,
    ...(result.status === "fulfilled" && result.value.warnings.length
      ? { imageWarnings: result.value.warnings }
      : {}),
    ...(status === "error"
      ? {
          error: result.reason.message.replace(/https?:\/\/\S+/g, "[source]"),
        }
      : {}),
  });
  console.log(`${source.id}: ${status}, ${items.length} matches`);
}
const data = {
  version: 1,
  lastAttempt: now,
  items: mergeRecords(previous.items, incoming),
  sources: states,
};
validateCatalog(data);
// Validate everything before the atomic write. A source failure never removes old records.
await writeFile(
  "public/data/generated.json.tmp",
  JSON.stringify(data, null, 2) + "\n",
);
await rename("public/data/generated.json.tmp", "public/data/generated.json");
console.log(`${data.items.length} generated records retained`);
// Publish the health report and retained archive even on partial failure; Actions emits warnings.
for (const state of states)
  if (state.status === "error")
    console.log(
      `::warning title=Source unavailable::${state.id}: ${state.error}`,
    );
for (const state of states)
  for (const warning of state.imageWarnings || [])
    console.log(`::warning title=Preview pending::${warning}`);
if (process.env.GITHUB_STEP_SUMMARY)
  await writeFile(
    process.env.GITHUB_STEP_SUMMARY,
    states.map((s) => `- ${s.name}: ${s.status} (${s.matches})`).join("\n"),
  );
