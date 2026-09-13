import { readSavedWiki, readWikiVoices } from "./saved-wiki.mjs";

export function parseProfileReference(html) {
  const { $, plain } = readSavedWiki(html);
  const common = $("#CGSS公共台词语音").closest("h2").nextUntil("h2");
  const { clips, voiceRows } = readWikiVoices($, plain, common);
  const introLink = $('a[title="文件:CGSS-INTRODUCE-Yoshino.mp3"]').first();
  const introRoot = introLink.closest(".cc-voice").parent();
  const introText = introRoot.find(".cc-dialogue-text .view-cgss-only");
  const introduction = {
    file: "CGSS-INTRODUCE-Yoshino.mp3",
    audio: introRoot.find("audio").first().attr("src"),
    text: {
      ja: plain(introText.find(".hover-change-after")),
      zh: plain(introText.find(".hover-change-before")),
    },
  };
  const stickers = $("#贴纸动画でしてー")
    .closest("h2")
    .nextUntil("h2")
    .find(".gallerybox")
    .toArray()
    .map((entry) => {
      const box = $(entry),
        img = box.find("img").first(),
        alt = img.attr("alt") || "";
      const caption = plain(box.find(".gallerytext"));
      const group = /Mobamas/.test(caption)
        ? "mobamas"
        : /CGSS/.test(caption)
          ? "deresute"
          : /Line/i.test(caption)
            ? "line"
            : null;
      if (!group) throw Error(`Unknown sticker group: ${caption}`);
      return {
        group,
        caption,
        file: alt,
        savedPath: img.attr("src"),
        source: img.closest("a").attr("href"),
        width: Number(img.attr("width")),
        height: Number(img.attr("height")),
      };
    });
  if (
    !voiceRows ||
    !introduction.audio ||
    !introduction.text.ja ||
    !stickers.length
  )
    throw Error("Saved profile is missing voices, introduction or stickers");
  return { clips, voiceRows, introduction, stickers };
}
