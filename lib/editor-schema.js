// The editor uses the same nested shapes as catalog.json. Unedited values,
// including fields added by future versions, never pass through a lossy form.
const f = (key, ja, zh, type = "text", extra = {}) => ({
  key,
  label: [ja, zh],
  type,
  ...extra,
});
const l = (key, ja, zh, long = false) => f(key, ja, zh, "localized", { long });
const rows = (key, ja, zh, fields, seed = {}) =>
  f(key, ja, zh, "rows", { fields, seed });
const block = (ja, zh, fields, folded = false, game) => ({
  label: [ja, zh],
  fields,
  folded,
  game,
});
const tracks = () =>
  rows(
    "tracks",
    "曲目",
    "曲目表",
    [f("number", "番号", "曲序", "number"), f("title", "曲名", "曲名")],
    { number: 1, title: "" },
  );
const members = (key) =>
  rows(key, "メンバー", "成员", [l("", "名前", "姓名")], { ja: "", zh: "" });
const facts = (key = "facts") =>
  rows(key, "情報の表", "信息表", [
    l("label", "項目名", "项目名称"),
    l("value", "内容", "内容", true),
  ]);
const voices = [
  block(
    "ことばと声",
    "话语与声音",
    [
      f(
        "voiceGuide.source",
        "台詞・ボイスのページ",
        "完整台词与语音页面",
        "url",
      ),
      rows("voiceGuide.stages", "段階・テーマ", "阶段与主题", [
        l("label", "段階名", "阶段名称"),
        l("title", "見出し", "主题标题"),
        rows(
          "paragraphs",
          "会話のあらすじ",
          "对话概述",
          [l("", "段落", "段落", true)],
          { ja: "", zh: "" },
        ),
        rows("groups", "ボイスの場面", "语音场景组", [
          l("label", "場面", "场景"),
          l("description", "場面の紹介", "场景介绍", true),
          rows("clips", "音声の入口", "语音入口", [
            l("label", "場面・番号", "场景与序号"),
            l("text", "台詞の原文", "台词原文", true),
            f(
              "file",
              "BWIKIの音声ファイル名（CGSS-…mp3）",
              "BWIKI 语音文件名（CGSS-…mp3）",
            ),
          ]),
        ]),
      ]),
    ],
    true,
  ),
];
const story = [
  block("コミュの情報", "剧情资料", [
    l("story.category", "種類", "剧情类型"),
    l("story.game", "ゲーム", "游戏"),
    f("story.period", "イベント期間", "活动期间"),
    l("story.series", "シリーズ", "系列"),
    members("story.members"),
  ]),
  block("エピソード", "篇章目录", [
    rows("story.chapters", "エピソード", "篇章", [
      l("title", "タイトル", "篇章标题"),
      f("source", "動画・掲載ページ", "视频／页面网址", "url"),
      f("entryId", "サイト内の記録", "站内条目", "relation"),
    ]),
  ]),
];
const video = [
  block("動画の情報", "视频资料", [
    f("video.uploader", "投稿者", "投稿者"),
    f("video.duration", "長さ（例 03:45）", "时长（如 03:45）"),
    l("video.series", "シリーズ", "系列"),
    rows("video.parts", "分割動画", "分集", [
      l("title", "タイトル", "分集标题"),
      f("duration", "長さ", "时长"),
    ]),
  ]),
];
export const BASIC = [
  block("表紙のことば", "标题与简介", [
    l("title", "タイトル", "标题"),
    l("description", "短い紹介", "简短介绍", true),
  ]),
  block("基本情報", "基本资料", [
    f("kind", "分類", "分类", "kind"),
    f("date", "日付（不明なら空欄）", "日期（不确定可留空）", "date"),
    l("dateLabel", "日付の意味", "日期含义"),
    f("tags", "タグ", "标签", "tags"),
    f("sourceName", "掲載元の名前", "来源名称"),
    f("source", "掲載ページ", "来源网址", "url"),
    f("official", "情報元", "来源类型", "boolean"),
    f("reference", "公式サイトなどのリンク", "补充官方网站链接", "url"),
  ]),
];
export const DETAILS = {
  cards: [
    block("カードの情報", "卡面资料", [
      f("rarity", "レアリティ", "稀有度", "text", {
        options: ["SSR", "SR", "R", "N"],
      }),
      f("game", "ゲーム", "游戏", "text", { options: ["deresute", "mobamas"] }),
      l("card.type", "タイプ", "属性"),
      l("card.acquisition", "入手方法", "获取方式"),
      f("card.pool", "登場ガシャ・イベント", "登场卡池／活动", "textarea"),
      f("card.source", "カードデータのページ", "卡片数据网址", "url"),
    ]),
    block(
      "特技とセンター効果",
      "特技与队长效果",
      [
        l("card.skill.name", "特技名", "特技名称"),
        f("card.skill.level", "特技レベル", "特技等级", "number"),
        l("card.skill.effect", "特技の効果", "特技效果", true),
        l("card.center.name", "センター効果名", "队长效果名称"),
        l("card.center.effect", "センター効果", "队长效果", true),
      ],
      false,
      "deresute",
    ),
    block(
      "デレステのステータス",
      "星光舞台能力值",
      [
        rows(
          "card.stats",
          "育成段階",
          "培养阶段",
          [
            l("label", "段階名", "阶段名称"),
            ...[
              ["maxLevel", "最大Lv", "最大等级"],
              ["maxBond", "最大親愛度", "最大亲爱度"],
              ["life", "Life", "Life"],
              ["vocal", "Vocal", "Vocal"],
              ["dance", "Dance", "Dance"],
              ["visual", "Visual", "Visual"],
              ["total", "合計（自動）", "合计（自动）"],
            ].map(([key, ja, zh]) =>
              f(key, ja, zh, "number", { readonly: key === "total" }),
            ),
          ],
          {
            label: { ja: "", zh: "" },
            life: 0,
            vocal: 0,
            dance: 0,
            visual: 0,
            total: 0,
          },
        ),
      ],
      false,
      "deresute",
    ),
    block(
      "モバマスのステータス・特技",
      "灰姑娘女孩能力值与特技",
      [
        rows(
          "card.mobamasStats",
          "育成段階",
          "培养阶段",
          [
            l("label", "段階名", "阶段名称"),
            f("cost", "コスト", "Cost", "number"),
            f("attack", "初期攻", "初始攻击", "number"),
            f("defense", "初期守", "初始防御", "number"),
          ],
          { label: { ja: "", zh: "" }, cost: 0, attack: 0, defense: 0 },
        ),
        rows("card.skills", "段階ごとの特技", "各阶段特技", [
          l("label", "段階名", "阶段名称"),
          l("name", "特技名", "特技名称"),
          l("effect", "効果", "效果", true),
          l("extraEffect", "ダブル特技の追加効果", "双重特技的附加效果", true),
        ]),
      ],
      false,
      "mobamas",
    ),
    ...voices.map((b) => ({ ...b, game: "deresute" })),
  ],
  songs: [
    block("歌唱と制作", "演唱与制作", [
      f("music.performers", "歌唱（1行に1人）", "演唱者（每行一位）", "lines"),
      rows("music.performerCredits", "キャスト", "声优对应", [
        f("name", "アイドル", "角色"),
        f("voiceActor", "声優", "声优"),
      ]),
      ...[
        ["lyricists", "作詞", "作词"],
        ["composers", "作曲", "作曲"],
        ["arrangers", "編曲", "编曲"],
      ].map(([key, ja, zh]) => f(`music.credits.${key}`, ja, zh, "lines")),
      f(
        "music.originalArtist",
        "原曲アーティスト（カバー曲）",
        "原唱（翻唱曲）",
      ),
    ]),
    block("収録アルバム", "收录唱片", [
      f("music.album.title", "アルバム名", "唱片标题"),
      f("music.album.catalogNumber", "品番", "唱片编号"),
      f("music.album.releaseDate", "発売日", "发售日期", "date"),
      f("music.album.discNumber", "ディスク番号", "碟片序号", "number"),
      f("music.album.trackNumber", "この楽曲の番号", "本曲序号", "number"),
      { ...tracks(), key: "music.album.tracks" },
    ]),
    block(
      "セット商品・ほかのディスク",
      "套装与其他碟片",
      [
        f("music.album.packageTitle", "セット名", "套装标题"),
        f("music.album.packageCatalogNumber", "セット品番", "套装编号"),
        rows("music.album.packageDiscs", "ディスク", "碟片", [
          f("title", "タイトル", "标题"),
          f("catalogNumber", "品番", "编号"),
          f("releaseDate", "発売日", "发售日期", "date"),
          f("discNumber", "ディスク番号", "碟片序号", "number"),
          tracks(),
        ]),
      ],
      true,
    ),
    block(
      "音楽情報のリンク",
      "音乐资料链接",
      [
        rows("music.sources", "リンク", "链接", [
          f("name", "サイト名", "网站名称"),
          f("url", "URL", "网址", "url"),
          f(
            "supports",
            "記録した情報（1行に1つ）",
            "资料范围（每行一项）",
            "lines",
          ),
        ]),
      ],
      true,
    ),
  ],
  stories: [...story, ...video.map((b) => ({ ...b, folded: true }))],
  videos: [...video, ...story.map((b) => ({ ...b, folded: true }))],
  units: [
    block("ユニットの情報", "组合资料", [
      members("unit.members"),
      f("unit.debut", "初のユニットイベント", "首次组合活动", "date"),
      f("unit.song", "代表曲", "代表歌曲"),
    ]),
  ],
  news: [],
  timeline: [],
  profile: [
    block("仲間とのご縁", "伙伴与缘分", [
      rows("profile.connections", "つながり", "伙伴关系", [
        l("name", "ユニット名", "组合名称"),
        l("members", "芳乃以外のメンバー", "芳乃之外的成员"),
        l("description", "紹介", "介绍", true),
        f("entryId", "サイト内のページ", "站内条目", "relation"),
      ]),
    ]),
    ...voices,
    block(
      "短いひとこと",
      "台词短句",
      [
        rows("voiceGuide.excerpts", "摘句", "摘句", [
          l("label", "場面", "场景"),
          l("text", "ひとこと", "短句"),
        ]),
      ],
      true,
    ),
    block(
      "紹介文のクレジット",
      "介绍文署名",
      [
        f("attribution.name", "掲載元・執筆者", "来源与作者"),
        f("attribution.url", "掲載ページ", "来源页面", "url"),
        l("attribution.note", "編集内容", "改编说明"),
        f("attribution.license", "ライセンス", "许可名称"),
        f("attribution.licenseUrl", "ライセンスのURL", "许可网址", "url"),
      ],
      true,
    ),
  ],
};
export const BODY = [
  block("本文", "详细正文", [
    rows("sections", "セクション", "章节", [
      l("title", "見出し", "章节标题"),
      rows("paragraphs", "段落", "段落", [l("", "本文", "正文", true)], {
        ja: "",
        zh: "",
      }),
      facts(),
    ]),
  ]),
  block("補足情報", "补充信息", [facts("details")], true),
];
export const IMAGES = [
  block("一覧の画像", "列表预览图", [
    f("image", "画像", "预览图", "image"),
    f("imageSource", "元画像のURL", "原图网址", "url"),
  ]),
  block("ギャラリー", "详情图集", [
    rows("gallery", "画像", "图片", [
      f("image", "画像", "图片", "image"),
      l("label", "キャプション・形態名", "说明／版本名称"),
      f("imageSource", "元画像のURL", "原图网址", "url"),
      f("source", "掲載ページ", "相关页面网址", "url"),
    ]),
  ]),
];
export const RELATED = [
  block("記録をつなぐ", "关联资料", [
    f("relatedIds", "関連する記録", "相关条目", "relations"),
    f(
      "entities",
      "共通する曲名・イベント名（1行に1つ）",
      "共同的曲名／活动名（每行一项）",
      "lines",
    ),
  ]),
];
export const ADVANCED = [
  block("追加の情報元", "更多来源", [
    rows("sources", "情報元", "来源", [
      f("name", "名前", "名称"),
      f("url", "URL", "网址", "url"),
      f("official", "情報元", "来源类型", "boolean"),
      f("fields", "記録した情報", "资料范围", "lines"),
    ]),
  ]),
  block(
    "管理用の情報",
    "管理信息",
    [
      f("id", "記録ID（変更不可）", "条目 ID（固定）", "text", {
        readonly: true,
      }),
      f("sourceTitle", "掲載元のタイトル", "来源原始标题"),
      f("verifiedAt", "確認日", "核对日期", "date"),
      f("sourceId", "取得元ID", "抓取来源 ID"),
      f("discoveredBy", "取得方法", "收录方式"),
    ],
    true,
  ),
];
