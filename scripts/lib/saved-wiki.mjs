import { load } from "cheerio";

export function readSavedWiki(html) {
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
  return { $, plain };
}

export function readWikiVoices($, plain, scope) {
  const clips = new Map();
  let voiceRows = 0;
  scope.find("audio[src]").each((_, element) => {
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
  return { clips, voiceRows };
}
