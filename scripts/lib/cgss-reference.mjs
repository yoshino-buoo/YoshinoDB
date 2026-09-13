import { readSavedWiki, readWikiVoices } from "./saved-wiki.mjs";

// Parse saved documents as data; never execute their scripts or copy page chrome.
export function parseCgssReference(html) {
  const { $, plain } = readSavedWiki(html);
  const table = $("table.bg-cgsscard").first();
  const { clips, voiceRows } = readWikiVoices($, plain, table);
  const lines = table
    .find(".Lyrics-line")
    .toArray()
    .map((line) => ({
      ja: plain($(line).find(".Lyrics-original")),
      zh: plain($(line).find(".Lyrics-translated")),
    }));
  const video = table.find(".bvideo[data-id]").first();
  const videoUrl = video.length
    ? `https://www.bilibili.com/video/${video.attr("data-id")}/?p=${video.attr("data-page") || 1}`
    : undefined;
  const rows = table.children("tbody").children("tr");
  const comicIndex = rows
    .toArray()
    .findIndex((el) => plain(el) === "卡牌配套小剧场");
  const comicRow = comicIndex >= 0 ? rows.eq(comicIndex + 1) : $();
  const comics = [];
  comicRow.find("img").each((_, element) => {
    const img = $(element);
    const match = /^CINGEKI-WIDE-(\d+)-(\d+)(T?)\.JPG$/i.exec(
      img.attr("alt") || "",
    );
    if (!match) return;
    const credit = img.closest(".bg-cingeki").children("a.external").first();
    comics.push({
      episode: Number(match[1]),
      part: Number(match[2]),
      locale: match[3] ? "zh" : "ja",
      savedPath: img.attr("src"),
      source: img.closest("a").attr("href"),
      width: Number(img.attr("width")),
      height: Number(img.attr("height")),
      ...(credit.length
        ? { credit: { name: plain(credit), url: credit.attr("href") } }
        : {}),
    });
  });
  if (!voiceRows || !lines.length)
    throw Error("Saved card page is missing voices or commu text");
  return {
    clips,
    voiceRows,
    commu: { lines, ...(videoUrl ? { videoUrl } : {}) },
    comics,
  };
}
