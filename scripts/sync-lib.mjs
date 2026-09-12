import { createHash } from "node:crypto";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import * as cheerio from "cheerio";
import { isHttps } from "../lib/data.js";
const array = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);
const text = (v) =>
  typeof v === "object" ? String(v?.["#text"] || "") : String(v ?? "");
export function matches(value, keywords) {
  return keywords.some((k) =>
    value
      .normalize("NFKC")
      .toLowerCase()
      .includes(k.normalize("NFKC").toLowerCase()),
  );
}
export function makeItem(source, title, url, date, kind = "news") {
  const id =
    "auto-" +
    createHash("sha256")
      .update(source.id + url)
      .digest("hex")
      .slice(0, 16);
  return {
    id,
    kind,
    title: { ja: title, zh: "" },
    description: { ja: "", zh: "" },
    date,
    source: url,
    sourceName: source.name,
    sourceId: source.id,
    official: source.official,
    tags: [source.type],
    discoveredBy: "scheduled-sync",
  };
}
export function parseFeed(xml, source, keywords) {
  if (XMLValidator.validate(xml) !== true)
    throw Error("Invalid RSS/Atom document");
  const doc = new XMLParser({
    ignoreAttributes: false,
    processEntities: true,
  }).parse(xml);
  if (!doc.feed && !doc.rss?.channel) throw Error("Expected RSS/Atom feed");
  const entries = array(doc.feed?.entry ?? doc.rss?.channel?.item);
  return entries.flatMap((e) => {
    const title = text(e.title).trim();
    const description = text(
      e["media:group"]?.["media:description"] || e.description || e.summary,
    );
    if (!title || !matches(title + " " + description, keywords)) return [];
    let url =
      typeof e.link === "string"
        ? e.link
        : array(e.link).find((l) => l["@_rel"] === "alternate")?.["@_href"];
    if (!isHttps(url)) return [];
    const parsed = new URL(url);
    if (source.type === "youtube") {
      if (
        !["www.youtube.com", "youtube.com"].includes(parsed.hostname) ||
        parsed.pathname !== "/watch" ||
        !/^[-\w]{11}$/.test(parsed.searchParams.get("v") || "")
      )
        return [];
      url = "https://www.youtube.com/watch?v=" + parsed.searchParams.get("v");
    } else {
      if (
        !["www.bilibili.com", "bilibili.com"].includes(parsed.hostname) ||
        !/^\/video\/BV[0-9A-Za-z]+\/?$/.test(parsed.pathname)
      )
        return [];
      url = "https://www.bilibili.com" + parsed.pathname.replace(/\/?$/, "/");
    }
    const published = Date.parse(text(e.published || e.pubDate || e.updated));
    if (!Number.isFinite(published)) return [];
    const item = makeItem(
      source,
      title,
      url,
      new Date(published).toISOString().slice(0, 10),
      "videos",
    );
    const thumbnail = array(
      e["media:group"]?.["media:thumbnail"] || e["media:thumbnail"],
    )
      .map((m) => m?.["@_url"])
      .find(isHttps);
    const embedded = cheerio.load(description)("img").first().attr("src");
    const enclosure = array(e.enclosure).find((m) =>
      m?.["@_type"]?.startsWith("image/"),
    )?.["@_url"];
    item.imageSource =
      thumbnail || (isHttps(embedded) ? embedded : enclosure) || "";
    return [item];
  });
}
export function parseCgNews(html, source, keywords) {
  const $ = cheerio.load(html);
  const links = $("a.top-news__link");
  if (!links.length)
    throw Error("Official news layout changed: no article links");
  return links.toArray().flatMap((el) => {
    const title = $(el).find(".top-news__title").text().trim();
    const url = $(el).attr("href");
    const date = $(el)
      .find(".top-news__date")
      .text()
      .trim()
      .replaceAll(".", "-");
    if (
      !matches(title, keywords) ||
      !isHttps(url) ||
      new URL(url).hostname !== "idolmaster-official.jp" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date)
    )
      return [];
    const item = makeItem(source, title, url, date);
    item.imageSource = $(el).find("img").first().attr("src") || "";
    return [item];
  });
}
