export function renderCardCommu(item, { base, t, tr, esc, ext }) {
  const commu = item.commu;
  const translated = t(false, true);
  const passage = (text, locale, cls = "") =>
    `<p class="${cls}" lang="${locale}">${esc(text)}</p>`;
  const blocks = [];
  for (const line of commu?.lines || []) {
    if (/^【[^】]+】$/.test(line.ja)) blocks.push({ speaker: line, lines: [] });
    else {
      if (!blocks.length) blocks.push({ lines: [] });
      blocks.at(-1).lines.push(line);
    }
  }
  const story = blocks.length
    ? `<section class="entry-section card-commu"><div class="voice-guide-heading"><div><small>CARD EPISODE</small><h2>${t("特訓エピソード", "特训剧情")}</h2></div><div class="commu-links">${commu.videoUrl ? ext(commu.videoUrl, t("映像で見る", "观看剧情视频"), "text-link") : ""}${ext(commu.source, "BWIKI", "text-link")}</div></div><div class="commu-script">${blocks.map((block) => `<article class="commu-dialogue">${block.speaker ? `<h3>${esc(tr(block.speaker))}</h3>` : ""}<div>${passage(block.lines.map((line) => line.ja).join("\n"), "ja")}${translated && block.lines.some((line) => line.zh) ? passage(block.lines.map((line) => line.zh).join("\n"), "zh-Hans", "commu-translation") : ""}</div></article>`).join("")}</div></section>`
    : "";
  const theater = item.theater;
  const comics = theater?.panels?.length
    ? `<section class="entry-section card-theater"><div class="voice-guide-heading"><div><small>CINDERELLA GIRLS THEATER WIDE</small><h2>${t("シンデレラガールズ劇場わいど☆", "灰姑娘女孩剧场 WIDE☆")}</h2></div><span class="theater-number">第${esc(theater.episode)}${t("話", "回")}</span></div><div class="theater-panels">${theater.panels
        .map((panel) => {
          const art = translated && panel.zh ? panel.zh : panel.ja;
          return `<figure><a href="${base}${esc(art.image)}" target="_blank" rel="noopener"><img src="${base}${esc(art.image)}" width="${art.width}" height="${art.height}" loading="lazy" decoding="async" alt="第${esc(theater.episode)}${t("話", "回")} · ${esc(panel.part)}"></a><figcaption><span>${String(panel.part).padStart(2, "0")}</span>${ext(art.source, "BWIKI", "text-link")}</figcaption></figure>`;
        })
        .join(
          "",
        )}</div>${translated && theater.translationCredit ? `<p class="theater-credit">${t("翻訳", "汉化")} · ${ext(theater.translationCredit.url, esc(theater.translationCredit.name))}</p>` : ""}</section>`
    : "";
  return story + comics;
}
