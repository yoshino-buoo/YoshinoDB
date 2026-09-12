import { openFirstPage, failFirstPage } from "./loading.js";
import { validateCatalog, KINDS, isHttps, searchText } from "./lib/data.js";
import { createListening } from "./listening.js";
import { directoryArt } from "./home-art.js";
import { mountEditor } from "./editor.js";
import { createContentViews } from "./content.js";
import {
  revealContent,
  animatePage,
  transitionPage,
  transitionResults,
} from "./motion.js";
const base = import.meta.env.BASE_URL;
const app = document.querySelector("#app");
let booting = true;
const storage = {
  get(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {}
  },
};
let lang = storage.get("yoshino-lang") === "zh" ? "zh" : "ja";
let catalog = { items: [] },
  generated = { items: [], sources: [] };
const names = {
  search: ["資料検索", "资料搜索"],
  home: ["よりみち帖", "首页"],
  profile: ["芳乃について", "认识芳乃"],
  cards: ["カード・衣装", "卡面与服装"],
  songs: ["楽曲", "歌曲"],
  stories: ["コミュ", "剧情"],
  units: ["ユニット", "组合"],
  videos: ["動画", "视频"],
  timeline: ["あゆみ", "足迹"],
  news: ["お知らせ", "资讯"],
  sources: ["このサイトについて", "关于本站"],
  editor: ["資料を編集", "内容编辑"],
};
const t = (ja, zh) => (lang === "ja" ? ja : zh);
const tr = (v) =>
  typeof v === "object" && v ? v[lang] || v.ja || "" : v || "";
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const label = (k, locale = lang) =>
  names[k] ? names[k][locale === "ja" ? 0 : 1] : k;
const tagLabel = (k, locale = lang) => {
  const t = (ja, zh) => (locale === "ja" ? ja : zh);
  return (
    {
      passion: t("パッション", "Passion"),
      platinum: t("恒常", "常驻"),
      limited: t("期間限定", "期间限定"),
      fes: t("フェス", "FES"),
      "fes-blanc": t("ブランフェス", "Blanc FES"),
      "fes-noir": t("ノワールフェス", "Noir FES"),
      dominant: t("ドミナント", "Dominant"),
      "local-live": t("ローカル・LIVE", "本地扭蛋／LIVE"),
      anime: t("アニメ", "动画"),
      music: t("音楽", "音乐"),
      live: t("ライブ", "演出"),
      deresute: t("デレステ", "星光舞台"),
      mobamas: t("デレマス", "页游"),
      solo: t("ソロ", "个人曲"),
      unit: t("ユニット", "组合"),
      event: t("イベント", "活动"),
      cover: t("カバー", "翻唱"),
      preview: t("試聴", "试听"),
      voice: t("ボイス", "语音"),
      outfit: t("衣装", "服装"),
      memory: t("メモリアル", "回忆剧情"),
      business: t("営業", "营业剧情"),
      game: t("ゲーム", "小游戏"),
      goods: t("グッズ", "周边"),
      birthday: t("誕生日", "生日"),
      drama: t("ドラマ", "广播剧"),
      commu: t("コミュ", "剧情"),
      "cg-news": t("ニュース", "资讯"),
      story: t("ストーリー", "主线"),
      zh: t("中国語字幕", "中文字幕"),
      mv: "MV",
      youtube: "YouTube",
      bilibili: "Bilibili",
    }[k] || k
  );
};
const arrow = '<span aria-hidden="true">↗</span>';
const icon = (k) =>
  ({
    cards: "▧",
    songs: "♫",
    stories: "☷",
    units: "❋",
    videos: "▷",
    timeline: "◷",
    news: "◇",
    profile: "❀",
    sources: "※",
  })[k] || "❀";
const ext = (url, text, cls = "") =>
  !isHttps(url)
    ? `<span>${text}</span>`
    : `<a class="${cls}" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${text} ${arrow}</a>`;
const originLabel = (item) =>
  item.official
    ? t("公式", "官方")
    : item.source.includes("bilibili.com")
      ? t("ファン動画", "粉丝视频")
      : t("データベース", "资料库");
const all = () => [
  ...catalog.items,
  ...generated.items.filter(
    (item) =>
      !catalog.items.some(
        (x) => x.source === item.source && x.kind === item.kind,
      ),
  ),
];
const count = (k) => all().filter((x) => x.kind === k).length;
function header(route) {
  return `<header class="header"><a class="brand" href="#home"><span class="seal">芳</span><span><strong>${t("芳乃のよりみち帖", "芳乃的漫步手帖")}</strong><small>YOSHINO DB</small></span></a><nav aria-label="${t("メインナビゲーション", "主导航")}">${["home", "cards", "songs", "stories", "videos", "timeline"].map((k) => `<a href="#${k}" ${route === k ? 'aria-current="page"' : ""}>${label(k)}</a>`).join("")}</nav><div class="language" aria-label="Language"><button data-lang="ja" aria-pressed="${lang === "ja"}">日本語</button><span>/</span><button data-lang="zh" aria-pressed="${lang === "zh"}">简中</button></div></header>`;
}
function footer() {
  return `<footer><div class="footer-top"><a class="brand" href="#home"><span class="seal">芳</span><span><strong>${t("芳乃のよりみち帖", "芳乃的漫步手帖")}</strong><small>YOSHINO DB · FAN ARCHIVE</small></span></a><div><a href="#sources">${label("sources")}</a><a href="#editor">${label("editor")}</a>${ext("https://github.com/yoshino-buoo/YoshinoDB/issues/new/choose", t("情報提供・訂正", "补充与纠错"))}</div></div><p>${t("依田芳乃を応援する、非公式・非営利のファンサイトです。株式会社バンダイナムコエンターテインメントおよび各関係企業とは関係ありません。", "本站为支持依田芳乃的非官方、非营利粉丝站，与万代南梦宫娱乐及相关企业无关。")}</p><p>${t("キャラクター・画像等の権利は各権利者に帰属します。", "角色、图像等素材权利归各自权利人所有。")} THE IDOLM@STER™ & ©Bandai Namco Entertainment Inc.</p></footer>`;
}
function sectionTitle(k, en, link = true) {
  return `<div class="section-heading"><h2><small>${en}</small>${label(k)}</h2>${link ? `<a href="#${k}">${t("すべて見る", "查看全部")} <span>→</span></a>` : ""}</div>`;
}
function record(item) {
  const image = item.image
    ? `<a class="record-cover" href="#entry/${esc(item.id)}" tabindex="-1" aria-hidden="true"><img class="record-image ${item.image.endsWith("yoshino.png") ? "standing" : ""}" src="${base}${esc(item.image)}" alt="${esc(tr(item.title))}" loading="lazy" decoding="async"></a>`
    : `<div class="record-icon" aria-hidden="true">${item.rarity ? esc(item.rarity) : icon(item.kind)}</div>`;
  return `<article class="record ${esc(item.kind)}" data-entry="${esc(item.id)}">${image}<div class="record-body"><div class="meta"><span class="badge ${item.official ? "official" : "fan"}">${originLabel(item)}</span><span>${esc(item.sourceName)}</span>${item.date ? `<time datetime="${esc(item.date)}">${esc(tr(item.dateLabel))} ${esc(item.date.replaceAll("-", "."))}</time>` : ""}</div><h3><a href="#entry/${esc(item.id)}">${esc(tr(item.title))}<span aria-hidden="true">→</span></a></h3>${tr(item.description) ? `<p>${esc(tr(item.description))}</p>` : ""}<div class="record-tags">${(
    item.tags || []
  )
    .slice(0, 4)
    .map((tag) => `<span>${esc(tagLabel(tag))}</span>`)
    .join("")}</div></div></article>`;
}
const listening = createListening({
  base,
  t,
  esc,
  onAudioStart: () => content.stopVideos(),
});
const content = createContentViews({
  base,
  t,
  tr,
  esc,
  label,
  tagLabel,
  ext,
  all,
  record,
  musicPreview: listening.detail,
  onVideoStart: listening.videoStarted,
  onVideoStop: listening.videoStopped,
});
const detail = content.detail;

function home() {
  return `<section class="intro-grid"><div class="intro" data-ambient><div class="eyebrow"><span></span>YORITA YOSHINO · FAN ARCHIVE</div><h1>${t("<span>ご縁をたどる、</span><span>芳乃の記録。</span>", "<span>循着缘分，</span><span>与芳乃相遇。</span>")}</h1><p class="intro-copy">${t("歌に、物語に、ひとつひとつの出会いに。<br>依田芳乃の歩みを、ここに綴ってゆきます。", "歌声、故事，还有一次次的相遇。<br>把依田芳乃走过的足迹，珍藏于此。")}</p><form class="search-form" role="search"><span aria-hidden="true">⌕</span><input name="q" aria-label="${t("資料を検索", "搜索资料")}" placeholder="${t("カード、楽曲、コミュを探す…", "搜索卡片、歌曲、剧情…")}" autocomplete="off"><button>${t("検索", "搜索")}</button></form><a class="profile-link" href="#profile">${t("はじめまして、依田芳乃です", "初次见面，我是依田芳乃")} <span>→</span></a><div class="intro-bottom"><span>七月三日</span><i></i><span>${t("鹿児島から、あなたのもとへ。", "从鹿儿岛，来到你身边。")}</span></div></div><div class="portrait"><div class="ambient-garden" aria-hidden="true"><span class="garden-haze"></span><svg class="garden-traces" viewBox="0 0 600 650" fill="none"><path class="trace-base" d="M-30 433C114 556 493 535 551 301S374 50 230 167S185 459 629 510"/><path class="trace-current" d="M-30 433C114 556 493 535 551 301S374 50 230 167S185 459 629 510"/><path class="trace-second" d="M50 530C-12 333 273 74 473 154S596 561 177 501"/></svg><span class="garden-motes"><i></i><i></i><i></i><i></i><i></i><i></i></span></div><div class="portrait-disc"></div><div class="vertical-copy" aria-hidden="true">${t("よきご縁が、ありますように。", "愿美好的缘分，与你相伴。")}</div><div class="portrait-figure"><img src="${base}assets/yoshino.png" alt="${t("依田芳乃の公式立ち絵", "依田芳乃官方立绘")}" fetchpriority="high"></div><div class="portrait-label"><span>よりた よしの</span><strong>依田 芳乃</strong><small>CV. ${t("高田憂希", "高田忧希")}</small></div><button class="motion-toggle" data-motion-toggle aria-label="${t("ホームの動きを止める", "暂停首页动效")}" aria-pressed="false">Ⅱ</button><a class="art-credit" href="#sources">©Bandai Namco Entertainment Inc.</a></div></section><section class="archive-section" data-ambient>${sectionTitle("home", "EXPLORE THE ARCHIVE", false).replace(`<h2><small>EXPLORE THE ARCHIVE</small>${label("home")}</h2>`, `<h2><small>EXPLORE THE ARCHIVE</small>${t("芳乃をめぐる、あれこれ", "关于芳乃的点点滴滴")}</h2><span class="subtle">${t("気になるページから、よりみち。", "从感兴趣的一页开始漫步。")}</span>`)}<div class="directory">${["cards", "songs", "stories", "units", "videos", "timeline"].map((k, i) => `<a href="#${k}"><span class="directory-num">0${i + 1}</span><span class="directory-icon">${directoryArt(k)}</span><strong>${label(k)}</strong><small>${t(...{ cards: ["姿と装いの記録", "记录每一份姿态与装扮"], songs: ["歌声に耳をすませて", "聆听芳乃的歌声"], stories: ["言の葉をたどって", "寻访故事中的言语"], units: ["ともに紡ぐご縁", "一同编织的缘分"], videos: ["映像でもう一度", "在影像中再次相遇"], timeline: ["これまでの足あと", "回望一路的足迹"] }[k])}</small><span class="dir-arrow">↗</span></a>`).join("")}</div></section><div class="home-lower"><section class="home-news" data-ambient>${sectionTitle("news", "NEWS & NOTES")}<div class="records">${all()
    .filter((x) => x.kind === "news")
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
    .slice(0, 3)
    .map(record)
    .join(
      "",
    )}</div></section><aside class="small-garden" data-ambient><span class="eyebrow">A LITTLE DETOUR</span><h2>${t("ひと息、ぶおー。", "歇一会儿，ぶおー。")}</h2><p>${t("芳乃といっしょに、法螺貝の修行を。", "和芳乃一起，来一场法螺贝修行。")}</p>${ext("https://yoshino-buoo.github.io/buo-dojo/", t("ぶおー法螺貝道場へ", "前往法螺贝道场"), "garden-link")}<span class="garden-bottom">${t("ちいさな遊び場、大きなご縁。", "小小的游乐场，大大的缘分。")}</span></aside></div>`;
}
function pageTitle(k, en, description = "") {
  return `<div class="page-title"><a href="#home">${label("home")}</a><small>${en}</small><h1>${label(k)}</h1>${description ? `<p>${description}</p>` : ""}</div>`;
}
const categoryFilters = {
  songs: [
    ["solo", "ソロ", "个人曲"],
    ["unit", "ユニット・全体曲", "组合与全员曲"],
    ["cover", "カバー", "翻唱"],
  ],
  stories: [
    ["story", "ストーリー", "主线"],
    ["event", "イベント", "活动"],
    ["business", "営業", "营业"],
    ["memory", "メモリアル・特訓", "回忆与特训"],
    ["birthday", "誕生日・季節", "生日与季节"],
  ],
  videos: [
    ["mv", "MV", "MV"],
    ["preview", "試聴", "试听"],
    ["commu", "コミュ", "剧情"],
    ["voice", "ボイス", "语音"],
    ["drama", "ドラマ", "广播剧"],
  ],
  news: [
    ["goods", "グッズ", "周边"],
    ["live", "ライブ", "演出"],
    ["music", "音楽", "音乐"],
    ["event", "イベント", "活动"],
  ],
};
function listing(route) {
  const query = new URLSearchParams(location.hash.split("?")[1] || "");
  const q = query.get("q") || "";
  const filters = categoryFilters[route] || [];
  const selected = query.get("tag") || "all";
  return `<div class="collection-page collection-${route}">${pageTitle(route, route.toUpperCase())}${content.overview(route)}${filters.length ? `<div class="category-tabs" role="group" aria-label="${t("分類", "分类")}"><button data-filter-tag="all" aria-pressed="${selected === "all"}">${t("すべて", "全部")}</button>${filters.map(([tag, ja, zh]) => `<button data-filter-tag="${tag}" aria-pressed="${tag === selected}">${t(ja, zh)}</button>`).join("")}</div>` : ""}<form class="list-controls" role="search"><input type="hidden" name="tag" value="${esc(selected)}"><input type="hidden" name="year" value="${esc(query.get("year") || "")}"><input name="q" value="${esc(q)}" placeholder="${t("キーワードで絞り込む", "输入关键词筛选")}" aria-label="${t("キーワード", "关键词")}"><select name="origin" aria-label="${t("情報元", "来源类型")}"><option value="all">${t("すべての情報元", "全部来源")}</option><option value="official">${t("公式のみ", "仅官方")}</option><option value="fan">${t("ファン投稿・データベース", "粉丝投稿与资料库")}</option></select>${route === "cards" ? `<select name="rarity" aria-label="${t("レアリティ", "稀有度")}"><option value="all">${t("すべてのレアリティ", "全部稀有度")}</option><option>SSR</option><option>SR</option><option>N</option></select>` : ""}<select name="sort" aria-label="${t("並び順", "排序")}"><option value="newest">${t("新しい順", "由新到旧")}</option><option value="oldest" ${route === "timeline" ? "selected" : ""}>${t("古い順", "由旧到新")}</option></select><button class="primary">${t("検索", "搜索")}</button></form><p class="result-count" aria-live="polite"></p><div id="results" class="records ${{ cards: "card-grid", songs: "song-grid", units: "unit-grid", videos: "video-grid", timeline: "timeline-list", news: "news-list", stories: "story-list" }[route] || ""}"></div></div>`;
}

function profile() {
  return `${pageTitle("profile", "ABOUT YOSHINO")}<div class="profile-grid"><div class="profile-art"><img src="${base}assets/yoshino.png" alt="依田芳乃"></div><div><span class="eyebrow">YORITA YOSHINO</span><h2 class="profile-name">依田 芳乃</h2><p>${t("アイドルマスター シンデレラガールズ", "偶像大师 灰姑娘女孩")} · Passion</p><dl>${[
    [t("年齢", "年龄"), t("16歳", "16 岁")],
    [t("誕生日", "生日"), t("7月3日 · かに座", "7 月 3 日 · 巨蟹座")],
    [t("身長 / 体重", "身高 / 体重"), "151 cm / 40 kg"],
    [t("血液型", "血型"), "O"],
    [t("出身地", "出身地"), t("鹿児島", "鹿儿岛")],
    ["CV", t("高田憂希", "高田忧希")],
    [
      t("趣味", "兴趣"),
      t("悩み事解決・石ころ集め・失せ物探し", "解决烦恼、收集石头、寻找失物"),
    ],
  ]
    .map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`)
    .join(
      "",
    )}</dl>${ext("https://cinderellagirls.idolmaster-official.jp/idol/yoshino/", t("公式プロフィール", "官方人物介绍"), "text-link")}</div></div>`;
}
function render(filterState = null) {
  let route = location.hash.slice(1).split("?")[0] || "home";
  const entryId = route.startsWith("entry/") ? route.slice(6) : null;
  if (!names[route] && route !== "search" && !entryId) route = "home";
  document.documentElement.lang = lang === "ja" ? "ja" : "zh-Hans";
  document.title = `${label(route)} · YoshinoDB`;
  app.innerHTML =
    header(entryId ? all().find((x) => x.id === entryId)?.kind : route) +
    `<main id="main" tabindex="-1" class="${route === "home" ? "home-page" : ""}">${entryId ? detail(entryId) : route === "home" ? home() : route === "profile" ? profile() : route === "sources" ? sources() : route === "editor" ? editor() : listing(route)}</main>` +
    footer();
  app.querySelectorAll("[data-lang]").forEach(
    (b) =>
      (b.onclick = () => {
        if (lang === b.dataset.lang) return;
        const activeForm = app.querySelector(".list-controls");
        const filters = activeForm
          ? Object.fromEntries(new FormData(activeForm))
          : null;
        lang = b.dataset.lang;
        storage.set("yoshino-lang", lang);
        transitionPage(() => render(filters));
      }),
  );
  app.querySelector(".search-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    location.hash = `search?q=${encodeURIComponent(new FormData(e.target).get("q"))}`;
  });
  if (document.querySelector("#results")) {
    const form = document.querySelector(".list-controls");
    if (filterState)
      for (const [key, value] of Object.entries(filterState)) {
        const field = form.elements.namedItem(key);
        if (field) field.value = value;
      }
    let resultsMounted = false;
    function update() {
      document
        .querySelectorAll("[data-filter-tag]")
        .forEach((b) =>
          b.setAttribute(
            "aria-pressed",
            String(b.dataset.filterTag === form.elements.tag.value),
          ),
        );
      let q = form.q.value.toLocaleLowerCase().trim();
      let items = all()
        .filter(
          (x) =>
            (route === "search" || x.kind === route) &&
            (!q || searchText(x).includes(q)) &&
            (form.origin.value === "all" ||
              x.official === (form.origin.value === "official")) &&
            (form.elements.tag.value === "all" ||
              (x.tags || []).includes(form.elements.tag.value)) &&
            (!form.elements.year.value ||
              x.date?.startsWith(form.elements.year.value)) &&
            (!form.rarity ||
              form.rarity.value === "all" ||
              x.rarity === form.rarity.value),
        )
        .sort((a, b) =>
          form.sort.value === "oldest"
            ? (a.date || "9999").localeCompare(b.date || "9999")
            : (b.date || "").localeCompare(a.date || ""),
        );
      const results = document.querySelector("#results");
      const paint = () => {
        document.querySelector(".result-count").textContent = t(
          `${items.length} 件の記録`,
          `${items.length} 条记录`,
        );
        document.querySelector("#results").innerHTML = items.length
          ? content.renderList(items, route)
          : `<div class="empty"><span>◇</span><h2>${t("該当する記録がありません", "没有找到匹配的记录")}</h2><p>${t("別のキーワードをお試しください。資料の追加もお待ちしています。", "试试其他关键词，也欢迎补充资料。")}</p><a href="#editor">${label("editor")} →</a></div>`;
        revealContent(document.querySelector("#results"));
      };
      if (resultsMounted) transitionResults(results, paint);
      else paint();
      resultsMounted = true;
    }
    app.querySelectorAll("[data-filter-tag]").forEach(
      (button) =>
        (button.onclick = () => {
          if (form.elements.tag.value === button.dataset.filterTag) return;
          form.elements.tag.value = button.dataset.filterTag;
          app
            .querySelectorAll("[data-filter-tag]")
            .forEach((b) =>
              b.setAttribute(
                "aria-pressed",
                String(b.dataset.filterTag === button.dataset.filterTag),
              ),
            );
          update();
        }),
    );
    app.querySelectorAll("[data-rarity]").forEach(
      (button) =>
        (button.onclick = () => {
          if (form.rarity.value === button.dataset.rarity) return;
          form.rarity.value = button.dataset.rarity;
          update();
        }),
    );
    form.onsubmit = (e) => {
      e.preventDefault();
      update();
    };
    form.origin.onchange = update;
    form.sort.onchange = update;
    if (form.rarity) form.rarity.onchange = update;
    update();
  }
  if (route === "editor") bindEditor();
  content.bind(app);
  listening.bind(app);
  if (!booting) {
    animatePage(document.querySelector("main"));
    revealContent(document.querySelector("main"));
  }
}
function sources() {
  return (
    pageTitle("sources", "ABOUT THIS LITTLE ARCHIVE") +
    `<div class="prose"><h2>${t("ご縁を、少しずつ。", "把与芳乃的相遇，慢慢收藏。")}</h2><p>${t("好きな歌を聴き返したり、懐かしいコミュを開いたり。芳乃のことをもっと知りたい日に、ふらりと立ち寄れる場所です。", "重听一首喜欢的歌，翻开一段怀念的剧情。想多了解一点芳乃的时候，就来这里逛逛吧。")}</p><h2>${t("リンク", "一起逛逛")}</h2>${[
      [
        "シンデレラガールズ 公式サイト",
        "https://cinderellagirls.idolmaster-official.jp/idol/yoshino/",
      ],
      [
        "シンデレラライブラリー",
        "https://cinderella-library.idolmaster-official.jp/",
      ],
      ["日本コロムビア", "https://columbia.jp/idolmaster/"],
      ["アイドルマスター ポータル", "https://idolmaster-official.jp/"],
      ["依田こころ · Bilibili", "https://space.bilibili.com/11748057"],
      ["SugarHeartDB", "https://nagomi-sugarheart.github.io/SugarHeartDB/"],
    ]
      .map(([n, u]) => `<p>${ext(u, n)}</p>`)
      .join("")}
    <h2>${t("この場所に流れる音楽", "陪伴漫步的音乐")}</h2><p>日々あどべんちゃーなのでしてー · ${t("オリジナル・カラオケ", "原版伴奏")}<br>THE IDOLM@STER CINDERELLA GIRLS STARLIGHT MASTER GOLD RUSH! 12 パ・リ・ラ</p><p>${ext("https://cinderellagirls.idolmaster-official.jp/discography/cocc-17842/", t("CD のページへ", "唱片介绍"))}<br>℗ NIPPON COLUMBIA CO., LTD.</p><h2>${t("この手帖を育てる", "一起添上新的一页")}</h2><p>${t("好きなカードや動画、思い出のエピソード。おすすめや訂正をお待ちしています。", "喜欢的卡面、视频，或是难忘的小故事，都欢迎来补充。")}</p>${ext("https://github.com/yoshino-buoo/YoshinoDB/issues/new/choose", t("情報を寄せる", "补充内容"), "text-link")}</div>`
  );
}

function editor() {
  return pageTitle("editor", "CONTENT EDITOR") + `<div id="editor-ui"></div>`;
}
function bindEditor() {
  mountEditor(document.querySelector("#editor-ui"), catalog, {
    lang,
    t,
    tr,
    esc,
    label,
    tagLabel,
    generated: generated.items,
  });
}

document.querySelector(".skip").addEventListener("click", (e) => {
  e.preventDefault();
  document.querySelector("#main")?.focus();
});
window.addEventListener("hashchange", () => {
  transitionPage(() => render(), { resetScroll: true });
});
try {
  const loaded = await Promise.allSettled(
    ["catalog", "generated"].map((name) =>
      fetch(`${base}data/${name}.json`, {
        signal: AbortSignal.timeout(12000),
      }).then(async (r) => {
        if (!r.ok) throw Error(r.status);
        return validateCatalog(await r.json());
      }),
    ),
  );
  if (loaded[0].status !== "fulfilled") throw Error("Catalog unavailable");
  catalog = loaded[0].value;
  if (loaded[1].status === "fulfilled") generated = loaded[1].value;
  try {
    const response = await fetch(`${base}data/listening.json`, {
      signal: AbortSignal.timeout(5000),
    });
    if (response.ok) listening.setData(await response.json());
  } catch {
    /* The archive and BGM remain usable if preview metadata is unavailable. */
  }
  render();
  await openFirstPage(() => {
    booting = false;
    animatePage(document.querySelector("main"));
    revealContent(document.querySelector("main"));
  });
} catch {
  failFirstPage();
  app.innerHTML = `<main class="prose"><h1>資料を読み込めませんでした / 资料加载失败</h1><p>ページを再読み込みしてください。 / 请重新加载页面。</p><button onclick="location.reload()">再読み込み / 重试</button></main>`;
}
