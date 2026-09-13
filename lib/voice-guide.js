// Voice files remain on BWIKI; opening a scene never preloads audio or interrupts BGM.
export function voiceFileUrl(file) {
  return `https://wiki.biligame.com/imascg/${encodeURIComponent(`文件:${file}`)}`;
}

export function renderVoiceGuide(guide, { t, tr, esc, ext }) {
  if (!guide?.stages?.length) return "";
  return `<section class="entry-section voice-guide"><div class="voice-guide-heading"><div><small>WORDS & VOICE</small><h2>${t("ことばと声", "话语与声音")}</h2></div>${ext(guide.source, t("台詞・ボイスのページ", "台词与语音页面"), "text-link")}</div>${guide.excerpts?.length ? `<div class="voice-excerpts">${guide.excerpts.map((q) => `<figure><blockquote lang="ja">${esc(q.text.ja)}</blockquote>${tr(q.text) !== q.text.ja ? `<p>${esc(tr(q.text))}</p>` : ""}<figcaption>${esc(tr(q.label))}</figcaption></figure>`).join("")}</div>` : ""}<div class="voice-stages">${guide.stages.map((stage) => `<article class="voice-stage"><header><span>${esc(tr(stage.label))}</span><h3>${esc(tr(stage.title))}</h3></header>${stage.paragraphs?.length ? `<div class="voice-story"><small>${t("会話のあらすじ", "对话概述")}</small>${stage.paragraphs.map((p) => `<p>${esc(tr(p))}</p>`).join("")}</div>` : ""}<div class="voice-groups">${stage.groups.map((group) => `<details class="voice-group"><summary><span>${esc(tr(group.label))}</span><small>${group.clips.length}${t(" 音声", " 段语音")}</small><span class="voice-disclosure" aria-hidden="true">＋</span></summary>${tr(group.description) ? `<p>${esc(tr(group.description))}</p>` : ""}<ul class="voice-links">${group.clips.map((clip) => `<li>${ext(voiceFileUrl(clip.file), esc(tr(clip.label)))}</li>`).join("")}</ul></details>`).join("")}</div></article>`).join("")}</div></section>`;
}
