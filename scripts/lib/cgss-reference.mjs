import { load } from "cheerio";

// Parse saved documents as data; never execute their scripts or copy page chrome.
export function parseCgssReference(html) {
  const $ = load(html);
  $(".producerName").text("○○");
  $("script, style, .resourceLoader").remove();
  const plain = (element) => {
    let output = "";
    const visit = (node) => {
      if (node.type === "text") {
        output += node.data;
        return;
      }
      if (node.name === "br") {
        output += "\n";
        return;
      }
      if (node.name === "p" && output && !output.endsWith("\n")) output += "\n";
      for (const child of node.children || []) visit(child);
      if (node.name === "p" && !output.endsWith("\n")) output += "\n";
    };
    $(element).each((_, node) => visit(node));
    return output
      .split("\n")
      .map((line) => line.trim())
      .join("\n")
      .trim();
  };
  const table = $("table.bg-cgsscard").first();
  const clips = new Map();
  let voiceRows = 0;
  table.find("audio[src]").each((_, element) => {
    const row = $(element).closest("tr");
    const file = row
      .find('a[title^="文件:CGSS-"]')
      .first()
      .attr("title")
      ?.slice(3);
    if (!file) throw Error("Missing voice filename");
    const cell = row.children("td").eq(1).clone();
    const translation = cell
      .find("span")
      .filter((_, el) => /#4d6bfe/i.test($(el).attr("style") || ""));
    const zh = plain(translation);
    translation.remove();
    const ja = plain(cell).replace(/^（未预设文本）$/, "");
    const clip = {
      audio: $(element).attr("src"),
      ...(ja || zh ? { text: { ja, zh } } : {}),
    };
    if (
      clips.has(file) &&
      JSON.stringify(clips.get(file)) !== JSON.stringify(clip)
    )
      throw Error(`Conflicting duplicate voice: ${file}`);
    clips.set(file, clip);
    voiceRows++;
  });
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
