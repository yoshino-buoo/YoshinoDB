import { switchArtwork } from "./motion.js";
import { relatedRecords, embedUrl } from "./lib/relations.js";
export function createContentViews({
  base,
  t,
  tr,
  esc,
  label,
  tagLabel,
  ext,
  all,
  record,
  musicPreview = () => "",
  onVideoStart = () => {},
  onVideoStop = () => {},
}) {
  const title = (item) => esc(tr(item.title));
  const link = (item, text = title(item)) =>
    `<a href="#entry/${esc(item.id)}">${text}</a>`;
  const image = (item, cls = "") =>
    item.image
      ? `<img class="${cls}" src="${base}${esc(item.image)}" alt="${title(item)}" loading="lazy">`
      : "";
  const localized = (value) =>
    Array.isArray(value) ? value.map(tr).join(t("・", "、")) : tr(value);
  const facts = (rows) =>
    `<dl class="fact-list">${rows
      .filter(
        (x) => x[1] !== undefined && x[1] !== null && localized(x[1]) !== "",
      )
      .map(
        ([key, value]) =>
          `<div><dt>${esc(key)}</dt><dd>${esc(localized(value))}</dd></div>`,
      )
      .join("")}</dl>`;
  const section = (heading, html, cls = "") =>
    html
      ? `<section class="entry-section ${cls}"><h2>${heading}</h2>${html}</section>`
      : "";
  const tags = (item) =>
    `<div class="record-tags">${(item.tags || [])
      .filter((x) => !["bilibili", "youtube", "SR", "SSR"].includes(x))
      .map((x) => `<span>${esc(tagLabel(x))}</span>`)
      .join("")}</div>`;
  const description = (item) =>
    tr(item.description)
      ? `<p class="entry-lead">${esc(tr(item.description))}</p>`
      : "";
  const extra = (item) =>
    Array.isArray(item.details) && item.details.length
      ? facts(item.details.map((x) => [tr(x.label), x.value]))
      : "";
  const source = (item) =>
    `<div class="entry-source">${ext(item.source, t("掲載ページ", "相关页面"))}<span>${esc(item.sourceName)}</span>${item.reference ? ext(item.reference, t("公式サイト", "官方网站")) : ""}${item.card?.source && item.card.source !== item.source ? ext(item.card.source, t("カードデータ", "卡片数据")) : ""}${item.music?.sources?.[0]?.url && item.music.sources[0].url !== item.source ? ext(item.music.sources[0].url, t("CD情報", "唱片介绍")) : ""}</div>`;
  const infoSections = (item) =>
    (item.sections || [])
      .map((s) =>
        section(
          esc(tr(s.title)),
          (s.paragraphs || []).map((p) => `<p>${esc(tr(p))}</p>`).join("") +
            (s.facts ? facts(s.facts.map((f) => [tr(f.label), f.value])) : ""),
        ),
      )
      .join("");
  function related(item, kinds) {
    const records = relatedRecords(item, all());
    return kinds
      .map((kind) => {
        const list = records
          .filter((x) => x.kind === kind)
          .slice(0, kind === "videos" ? 6 : 8);
        return list.length
          ? section(
              t("関連する", "相关") + label(kind),
              `<div class="related-grid">${list.map((x) => `<article class="related-tile" data-entry="${esc(x.id)}">${link(x, image(x) + `<span><small>${label(x.kind)}</small><strong>${title(x)}</strong>${x.date ? `<time>${x.date.replaceAll("-", ".")}</time>` : ""}</span>`)}</article>`).join("")}</div>`,
            )
          : "";
      })
      .join("");
  }
  const dateFact = (item) =>
    item.date
      ? [
          [
            tr(item.dateLabel) || t("日付", "日期"),
            item.date.replaceAll("-", "."),
          ],
        ]
      : [];
  function player(item) {
    if (!embedUrl(item.source)) return image(item, "entry-wide-image");
    return `<div class="inline-player"><button class="video-poster" data-play="${esc(item.id)}" aria-label="${esc(t("動画を再生", "播放视频"))}">${image(item)}<span class="play-circle">▷</span><span class="play-caption">${t("動画を再生", "播放视频")}</span></button></div>`;
  }
  function gallery(item) {
    const images = item.gallery?.length
      ? item.gallery
      : item.image
        ? [{ image: item.image }]
        : [];
    if (!images.length) return "";
    return `<div class="card-gallery"><div class="gallery-stage ${item.image?.endsWith("yoshino.png") ? "standing" : ""}">${images.map((art, index) => `<figure data-variant-panel="${index}" ${index ? "hidden" : ""}><a href="${base}${esc(art.image)}" target="_blank" rel="noopener"><img src="${base}${esc(art.image)}" alt="${title(item)} ${esc(tr(art.label))}"></a></figure>`).join("")}</div>${images.length > 1 ? `<div class="variant-tabs" role="group" aria-label="${t("カードの姿", "卡面版本")}">${images.map((art, index) => `<button data-variant="${index}" aria-pressed="${index === 0}">${esc(tr(art.label) || String(index + 1))}</button>`).join("")}</div>` : ""}</div>`;
  }
  function statTable(card) {
    const versions = card.stats || [];
    if (!versions.length) return "";
    return `<div class="table-scroll"><table class="stats-table"><thead><tr><th>${t("ステータス", "能力值")}</th>${versions.map((v) => `<th>${esc(tr(v.label))}</th>`).join("")}</tr></thead><tbody>${[
      ["life", "Life"],
      ["vocal", "Vocal"],
      ["dance", "Dance"],
      ["visual", "Visual"],
      ["total", t("合計", "合计")],
    ]
      .filter(([key]) => versions.some((v) => v[key] != null))
      .map(
        ([key, name]) =>
          `<tr><th>${name}</th>${versions.map((v) => `<td>${v[key] != null ? esc(v[key]) : "—"}</td>`).join("")}</tr>`,
      )
      .join("")}</tbody></table></div>`;
  }
  function cardDetail(item) {
    const c = item.card || {};
    return `<div class="card-detail-top">${gallery(item)}<aside class="entry-summary"><span class="rarity-emblem">${esc(item.rarity || t("衣装", "服装"))}</span>${description(item)}${facts([...dateFact(item), [t("ゲーム", "游戏"), item.game === "deresute" ? t("スターライトステージ", "星光舞台") : item.game], [t("タイプ", "属性"), c.type], [t("入手方法", "获取方式"), c.acquisition], [t("登場ガシャ・イベント", "登场卡池／活动"), c.pool]])}${tags(item)}</aside></div><div class="entry-columns">${section(t("特技・センター効果", "特技与队长效果"), [c.skill?.name ? `<div class="skill-block"><small>${t("特技", "特技")}${c.skill.level ? ` · Lv.${c.skill.level}` : ""}</small><h3>${esc(tr(c.skill.name))}</h3><p>${esc(tr(c.skill.effect))}</p></div>` : "", c.center?.name ? `<div class="skill-block"><small>${t("センター効果", "队长效果")}</small><h3>${esc(tr(c.center.name))}</h3><p>${esc(tr(c.center.effect))}</p></div>` : ""].join(""))}${section(t("ステータス", "能力值"), c.stats?.length ? `<p class="stats-caption">${t("最大Lv・親愛度MAX", "最大等级・亲爱度 MAX")}</p>${statTable(c)}` : "")}</div>${extra(item)}${infoSections(item)}${related(item, ["stories", "videos", "songs"])}`;
  }
  function musicDetail(item) {
    const music = item.music || {},
      album = music.album || {},
      credits = music.credits || {};
    const media = relatedRecords(item, all()).filter(
      (x) => x.kind === "videos",
    );
    const tracks = album.tracks || [];
    return `<div class="music-detail-top"><div class="album-art">${image(item)}<span>${esc(album.catalogNumber || "CINDERELLA GIRLS")}</span></div><div class="entry-summary"><span class="entry-kicker">${(item.tags || []).includes("cover") ? t("カバー曲", "翻唱曲") : (item.tags || []).includes("solo") ? t("ソロ曲", "个人曲") : t("ユニット・全体曲", "组合与全员曲")}</span>${description(item)}${musicPreview(item)}${facts([[t("歌唱", "演唱"), music.performers], [t("作詞", "作词"), credits.lyricists], [t("作曲", "作曲"), credits.composers], [t("編曲", "编曲"), credits.arrangers], ...dateFact(item)])}${media.length ? `<a class="source-button" href="#entry/${esc(media[0].id)}">▷ ${t("映像・試聴を見る", "观看 MV／试听")}</a>` : ""}</div></div>${album.title ? section(t("収録アルバム", "收录唱片"), `<div class="album-heading"><h3>${esc(album.title)}</h3><span>${esc(album.catalogNumber || "")} · ${esc(album.releaseDate || item.date)}</span></div>${tracks.length ? `<ol class="track-list">${tracks.map((track, i) => `<li class="${Number(track.number) === Number(album.trackNumber) ? "current-track" : ""}"><span class="track-number">${String(track.number || i + 1).padStart(2, "0")}</span><span>${esc(track.title)}</span>${Number(track.number) === Number(album.trackNumber) ? `<small>${t("この楽曲", "本曲")}</small>` : ""}</li>`).join("")}</ol>` : ""}`) : ""}${extra(item)}${infoSections(item)}${related(item, ["videos", "units", "stories", "news"])}`;
  }
  function videoDetail(item) {
    const video = item.video || {};
    const parts = video.parts || [];
    return `<div class="watch-layout"><div>${player(item)}<div class="watch-actions">${ext(item.source, t("配信元で見る", "在原站观看"), "source-button")}<span>${esc(video.duration || "")}${video.duration ? " · " : ""}${item.source.includes("bilibili.com") ? "Bilibili" : "YouTube"}</span></div>${description(item)}${parts.length > 1 ? section(t("分割動画", "分集"), `<ol class="chapter-list">${parts.map((part, i) => `<li><button data-part="${i + 1}" data-video="${esc(item.id)}"><span>${String(i + 1).padStart(2, "0")}</span><strong>${esc(tr(part.title))}</strong>${part.duration ? `<small>${esc(part.duration)}</small>` : ""}</button></li>`).join("")}</ol>`) : ""}</div><aside class="watch-info"><h2>${t("動画について", "视频信息")}</h2>${facts([[t("投稿者", "投稿者"), video.uploader || item.sourceName], ...dateFact(item), [t("長さ", "时长"), video.duration], [t("字幕", "字幕"), (item.tags || []).includes("zh") ? t("中国語字幕", "中文字幕") : ""], [t("シリーズ", "系列"), video.series]])}${tags(item)}${extra(item)}</aside></div>${infoSections(item)}${related(item, ["songs", "cards", "stories", "videos"])}`;
  }
  function storyDetail(item) {
    const story = item.story || {};
    const playable = Boolean(embedUrl(item.source));
    const chapters = story.chapters || [];
    return `<div class="story-detail-top"><div>${playable ? player(item) : image(item, "story-art")}${playable ? `<div class="watch-actions">${ext(item.source, t("配信元で見る", "在原站观看"), "text-link")}</div>` : ""}</div><div class="entry-summary"><span class="entry-kicker">${esc(tr(story.category) || t("コミュ", "剧情"))}</span>${description(item)}${facts([...dateFact(item), [t("ゲーム", "游戏"), story.game], [t("イベント期間", "活动期间"), story.period], [t("出演", "出演"), story.members], [t("シリーズ", "系列"), story.series]])}${tags(item)}</div></div>${chapters.length ? section(t("エピソード", "篇章"), `<ol class="chapter-list">${chapters.map((c, i) => `<li>${c.entryId ? `<a href="#entry/${esc(c.entryId)}">` : c.source ? `<a href="${esc(c.source)}" target="_blank" rel="noopener">` : "<div>"}<span>${String(i + 1).padStart(2, "0")}</span><strong>${esc(tr(c.title))}</strong>${c.entryId || c.source ? "<span>→</span></a>" : "</div>"}</li>`).join("")}</ol>`) : ""}${extra(item)}${infoSections(item)}${related(item, ["songs", "cards", "videos", "stories"])}`;
  }
  function unitDetail(item) {
    const unit = item.unit || {};
    return `<div class="unit-detail-top">${image(item, "unit-art")}<div class="entry-summary"><span class="entry-kicker">UNIT</span>${description(item)}${unit.members?.length ? `<div class="member-list">${unit.members.map((member, i) => `<div><span>${String(i + 1).padStart(2, "0")}</span><strong>${esc(tr(member))}</strong>${tr(member).includes("芳乃") ? `<a href="#profile">${t("プロフィール", "人物介绍")} →</a>` : ""}</div>`).join("")}</div>` : ""}${facts(
      [
        [t("初のユニットイベント", "首次组合活动"), unit.debut],
        [t("代表曲", "代表歌曲"), unit.song],
      ],
    )}</div></div>${infoSections(item)}${related(item, ["songs", "stories", "videos", "timeline"])}`;
  }
  function newsDetail(item) {
    return `<article class="news-article"><div class="article-meta"><time>${esc(item.date?.replaceAll("-", ".") || "")}</time><span>${esc(item.sourceName)}</span>${tags(item)}</div>${description(item)}${image(item, "news-art")}${infoSections(item)}${item.gallery?.length ? section(t("ギャラリー", "相关图片"), `<div class="news-gallery">${item.gallery.map((art) => `<a href="${base}${esc(art.image)}" target="_blank" rel="noopener"><img src="${base}${esc(art.image)}" alt="${title(item)}" loading="lazy"></a>`).join("")}</div>`) : ""}${extra(item)}${related(item, ["news", "songs", "videos", "cards", "timeline"])}</article>`;
  }
  function timelineDetail(item) {
    const entries = all()
      .filter((x) => x.kind === "timeline")
      .sort((a, b) => a.date.localeCompare(b.date));
    const index = entries.findIndex((x) => x.id === item.id);
    return `<div class="milestone"><time>${esc(item.date?.replaceAll("-", ".") || "")}</time>${image(item)}<div>${description(item)}${extra(item)}${infoSections(item)}</div></div>${related(item, ["songs", "stories", "cards", "units", "videos", "news"])}<nav class="milestone-nav">${entries[index - 1] ? link(entries[index - 1], `← <span>${entries[index - 1].date}<strong>${title(entries[index - 1])}</strong></span>`) : "<span></span>"}${entries[index + 1] ? link(entries[index + 1], `<span>${entries[index + 1].date}<strong>${title(entries[index + 1])}</strong></span> →`) : ""}</nav>`;
  }
  function detail(id) {
    const item = all().find((x) => x.id === id);
    if (!item)
      return `<div class="empty"><h1>${t("記録が見つかりません", "找不到这条记录")}</h1><a href="#home">${t("ホームへ", "返回首页")}</a></div>`;
    document.title = tr(item.title) + " · YoshinoDB";
    const renderer = {
      cards: cardDetail,
      songs: musicDetail,
      stories: storyDetail,
      units: unitDetail,
      videos: videoDetail,
      news: newsDetail,
      timeline: timelineDetail,
    }[item.kind];
    return `<div class="entry-heading"><a href="#${item.kind}">← ${label(item.kind)}</a><small>${item.kind.toUpperCase()}</small><h1>${title(item)}</h1></div><div class="typed-entry entry-${item.kind}" data-entry="${esc(item.id)}">${renderer(item)}${source(item)}</div>`;
  }
  function overview(kind) {
    if (kind === "search") return "";
    const items = all().filter((x) => x.kind === kind),
      latest = [...items]
        .filter((x) => x.date)
        .sort((a, b) => b.date.localeCompare(a.date));
    if (kind === "songs") {
      const solo = items.find((x) => x.id === "inori") || items[0];
      return `<div class="music-shelf-intro">${solo ? link(solo, image(solo)) : ""}<div><small>YOSHINO'S DISCOGRAPHY</small><h2>${t("歌声をたどって", "循着歌声")}</h2><p>${t("ソロからユニットまで。", "从个人曲到组合曲。")}</p><div class="collection-stats"><span><strong>${items.length}</strong>${t("楽曲", "首歌曲")}</span><span><strong>${new Set(items.map((x) => x.music?.album?.catalogNumber).filter(Boolean)).size}</strong>${t("アルバム", "张唱片")}</span></div></div></div>`;
    }
    if (kind === "cards")
      return `<div class="collection-stats card-stats">${["SSR", "SR", "N"]
        .map((r) => {
          const n = items.filter((x) => x.rarity === r).length;
          return n
            ? `<button data-rarity="${r}"><strong>${n}</strong><span>${r}</span></button>`
            : "";
        })
        .join(
          "",
        )}<span><strong>${items.filter((x) => x.gallery?.length > 1).length * 2}</strong>${t("特訓前・特訓後のイラスト", "张特训前后插画")}</span></div>`;
    if (kind === "stories")
      return `<div class="story-paths">${[
        ["story", t("メインストーリー", "主线剧情")],
        ["event", t("イベント", "活动剧情")],
        ["business", t("営業", "营业剧情")],
        ["memory", t("メモリアル・特訓", "回忆与特训")],
      ]
        .map(
          ([tag, name]) =>
            `<button data-filter-tag="${tag}"><small>${String(items.filter((x) => x.tags?.includes(tag)).length).padStart(2, "0")}</small><strong>${name}</strong><span>↗</span></button>`,
        )
        .join("")}</div>`;
    if (kind === "units")
      return `<div class="unit-directory">${items.map((x) => link(x, `<strong>${title(x)}</strong><small>${x.unit?.members?.length || ""} ${t("人", "人")}</small>`)).join("")}</div>`;
    if (kind === "timeline")
      return `<nav class="year-nav" aria-label="${t("年を選ぶ", "选择年份")}">${[
        ...new Set(items.map((x) => x.date?.slice(0, 4)).filter(Boolean)),
      ]
        .sort()
        .map((year) => `<a href="#timeline?year=${year}">${year}</a>`)
        .join("")}</nav>`;
    if (kind === "news" && latest.length) {
      const item = latest[0];
      return `<article class="news-feature">${link(item, image(item))}<div><small>${t("最新のお知らせ", "最新资讯")} · ${esc(item.date)}</small><h2>${link(item)}</h2><p>${esc(tr(item.description))}</p>${link(item, t("続きを読む", "阅读全文") + " →")}</div></article>`;
    }
    if (kind === "videos")
      return `<div class="collection-stats"><span><strong>${items.length}</strong>${t("本の動画", "个视频")}</span><span><strong>${items.filter((x) => x.official).length}</strong>${t("公式映像", "个官方视频")}</span><span><strong>${items.filter((x) => x.tags?.includes("zh")).length}</strong>${t("中国語字幕", "个中文字幕视频")}</span></div>`;
    return "";
  }
  function renderList(items, kind) {
    if (kind !== "timeline") return items.map(record).join("");
    const groups = new Map();
    for (const item of items) {
      const year = item.date?.slice(0, 4) || t("その他", "其他");
      if (!groups.has(year)) groups.set(year, []);
      groups.get(year).push(item);
    }
    return [...groups]
      .map(
        ([year, rows]) =>
          `<section class="year-section"><h2>${year}</h2><div>${rows.map(record).join("")}</div></section>`,
      )
      .join("");
  }
  const playerTimers = new WeakMap();
  function loadVideo(id, element, page = 1) {
    const item = all().find((x) => x.id === id);
    const url = item && embedUrl(item.source, page);
    if (!url || !element) return;
    onVideoStart();
    element.dataset.videoId = id;
    if (!element.nextElementSibling?.matches("[data-close-video]")) {
      const close = document.createElement("button");
      close.dataset.closeVideo = "";
      close.className = "video-close";
      close.textContent = t("動画を閉じる ×", "收起视频 ×");
      close.onclick = () => {
        stopVideos();
        onVideoStop();
      };
      element.after(close);
    }
    clearTimeout(playerTimers.get(element));
    const platform = item.source.includes("bilibili.com")
      ? "Bilibili"
      : "YouTube";
    const external = new URL(item.source);
    if (platform === "Bilibili") external.searchParams.set("p", page);
    // Some embedded browsers never load cross-origin frames. Keep a usable cover and link.
    element.innerHTML = `<div class="player-placeholder">${image(item)}<div><span class="player-loading-mark"></span><p role="status">${t("プレーヤーを読み込み中…", "正在载入播放器…")}</p>${ext(external.href, t(`${platform} で見る`, `在 ${platform} 观看`), "player-external")}</div></div><iframe class="player-frame" src="${url}" title="${title(item)}" allow="fullscreen; picture-in-picture; encrypted-media" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
    const frame = element.querySelector("iframe");
    frame.addEventListener(
      "load",
      () => {
        if (!frame.isConnected) return;
        clearTimeout(playerTimers.get(element));
        frame.classList.add("loaded");
        element
          .querySelector(".player-placeholder")
          ?.setAttribute("hidden", "");
      },
      { once: true },
    );
    playerTimers.set(
      element,
      setTimeout(() => {
        if (!frame.isConnected) return;
        element.querySelector(".player-loading-mark")?.remove();
        element.querySelector('[role="status"]').textContent = t(
          "配信元でもご覧いただけます",
          "也可以在原站观看",
        );
      }, 8000),
    );
  }
  function bind(root) {
    root
      .querySelectorAll("[data-play]")
      .forEach((button) =>
        button.addEventListener("click", () =>
          loadVideo(button.dataset.play, button.closest(".inline-player")),
        ),
      );
    root.querySelectorAll("[data-part]").forEach((button) =>
      button.addEventListener("click", () => {
        loadVideo(
          button.dataset.video,
          root.querySelector(".inline-player"),
          button.dataset.part,
        );
        root
          .querySelectorAll("[data-part]")
          .forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
        root.querySelector(".inline-player").scrollIntoView({
          block: "center",
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches
            ? "instant"
            : "smooth",
        });
      }),
    );
    root.querySelectorAll("[data-variant]").forEach((button) =>
      button.addEventListener("click", () => {
        switchArtwork(button.closest(".card-gallery"), button.dataset.variant);
      }),
    );
  }
  function stopVideos() {
    document
      .querySelectorAll(".inline-player[data-video-id]")
      .forEach((element) => {
        const item = all().find((x) => x.id === element.dataset.videoId);
        if (!item) return;
        clearTimeout(playerTimers.get(element));
        const template = document.createElement("template");
        template.innerHTML = player(item);
        const replacement = template.content.firstElementChild;
        if (element.nextElementSibling?.matches("[data-close-video]"))
          element.nextElementSibling.remove();
        element.replaceWith(replacement);
        bind(replacement);
      });
  }
  return { detail, overview, renderList, bind, stopVideos };
}
