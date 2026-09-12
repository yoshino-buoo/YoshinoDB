const generic = new Set([
  "deresute",
  "mobamas",
  "bilibili",
  "youtube",
  "solo",
  "unit",
  "event",
  "voice",
  "preview",
  "mv",
  "commu",
  "story",
  "memory",
  "business",
  "game",
  "goods",
  "birthday",
  "drama",
  "zh",
  "SR",
  "SSR",
  "N",
  "R",
  "イベント",
  "cg-news",
]);
const normalize = (value) =>
  String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s・·「」『』［］\[\]【】（）()]+/g, "");
export function relatedRecords(item, items) {
  const ids = new Set(item.relatedIds || []);
  const entities = (item.entities || item.tags || [])
    .filter((x) => !generic.has(x))
    .map(normalize)
    .filter((x) => x.length > 2);
  return items
    .filter((x) => x.id !== item.id)
    .map((x) => {
      let score =
        ids.has(x.id) || (x.relatedIds || []).includes(item.id) ? 100 : 0;
      if (x.source === item.source) score += 30;
      const other = (x.entities || x.tags || [])
        .filter((y) => !generic.has(y))
        .map(normalize);
      score += entities.filter((key) => other.includes(key)).length * 10;
      if (
        item.kind === "songs" &&
        normalize(x.title?.ja).includes(normalize(item.title?.ja))
      )
        score += 15;
      return { item: x, score };
    })
    .filter((x) => x.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        (b.item.date || "").localeCompare(a.item.date || ""),
    )
    .map((x) => x.item);
}
export function embedUrl(source, page = 1) {
  try {
    const url = new URL(source);
    if (url.protocol !== "https:") return null;
    if (
      ["www.youtube.com", "youtube.com"].includes(url.hostname) &&
      /^[-\w]{11}$/.test(url.searchParams.get("v") || "")
    )
      return `https://www.youtube-nocookie.com/embed/${url.searchParams.get("v")}?rel=0&autoplay=0`;
    const match = url.pathname.match(/^\/video\/(BV[\w]{10})\/?$/);
    if (["www.bilibili.com", "bilibili.com"].includes(url.hostname) && match)
      return `https://player.bilibili.com/player.html?bvid=${match[1]}&page=${Math.max(1, Number(page) || 1)}&autoplay=0`;
  } catch {}
  return null;
}
