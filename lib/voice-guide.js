// Audio stays on BWIKI and is requested only after pressing play.
export function voiceFileUrl(file) {
  return `https://wiki.biligame.com/imascg/${encodeURIComponent(`文件:${file}`)}`;
}

export function isWikiAudio(value) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname === "patchwiki.biligame.com" &&
      !url.username &&
      !url.password &&
      !url.port &&
      /^\/images\/imascg\/[a-zA-Z0-9/_.-]+\.mp3$/.test(url.pathname)
    );
  } catch {
    return false;
  }
}

export function renderVoiceGuide(guide, { t, tr, esc, ext }) {
  if (!guide?.stages?.length) return "";
  const clipRow = (clip) => {
    const playable = isWikiAudio(clip.audio);
    const translated =
      t(false, true) && clip.text?.zh && clip.text.zh !== clip.text.ja;
    return `<li class="${playable ? "voice-clip" : ""}">${clip.text?.ja ? `<p class="voice-transcript" lang="ja">${esc(clip.text.ja)}</p>` : ""}${translated ? `<p class="voice-transcript voice-translation" lang="zh-Hans">${esc(clip.text.zh)}</p>` : ""}${playable ? `<div class="voice-controls"><button type="button" class="voice-toggle" data-voice-src="${esc(clip.audio)}" aria-pressed="false" aria-label="${esc(t("再生", "播放") + " · " + tr(clip.label))}"><svg viewBox="0 0 24 24" aria-hidden="true"><path class="voice-play-icon" d="m9 5 11 7-11 7z"/><path class="voice-pause-icon" d="M7 5h3v14H7zm7 0h3v14h-3z"/></svg><span>${esc(tr(clip.label))}</span></button><output class="voice-time" aria-hidden="true"></output>${ext(voiceFileUrl(clip.file), "Wiki", "voice-file")}</div><small class="voice-status" role="status"></small>` : ext(voiceFileUrl(clip.file), esc(tr(clip.label)))}</li>`;
  };
  return `<section class="entry-section voice-guide"><div class="voice-guide-heading"><div><small>WORDS & VOICE</small><h2>${t("ことばと声", "话语与声音")}</h2></div>${ext(guide.source, "BWIKI", "text-link")}</div>${guide.excerpts?.length ? `<div class="voice-excerpts">${guide.excerpts.map((q) => `<figure><blockquote lang="ja">${esc(q.text.ja)}</blockquote>${tr(q.text) !== q.text.ja ? `<p>${esc(tr(q.text))}</p>` : ""}<figcaption>${esc(tr(q.label))}</figcaption></figure>`).join("")}</div>` : ""}<div class="voice-stages">${(guide.stages || []).map((stage) => `<article class="voice-stage"><header>${stage.title ? `<span>${esc(tr(stage.label))}</span><h3>${esc(tr(stage.title))}</h3>` : `<h3>${esc(tr(stage.label))}</h3>`}</header>${stage.paragraphs?.length ? `<div class="voice-story"><small>${t("会話のあらすじ", "对话概述")}</small>${stage.paragraphs.map((p) => `<p>${esc(tr(p))}</p>`).join("")}</div>` : ""}<div class="voice-groups">${(stage.groups || []).map((group) => `<details class="voice-group"><summary><span>${esc(tr(group.label))}</span><small>${(group.clips || []).length}${t(" 音声", " 段语音")}</small><span class="voice-disclosure" aria-hidden="true">＋</span></summary>${tr(group.description) ? `<p>${esc(tr(group.description))}</p>` : ""}<ul class="voice-links ${(group.clips || []).some((clip) => clip.text || clip.audio) ? "has-transcripts" : ""}">${(group.clips || []).map(clipRow).join("")}</ul></details>`).join("")}</div></article>`).join("")}</div></section>`;
}
