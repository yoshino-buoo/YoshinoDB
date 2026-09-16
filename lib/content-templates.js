import { newRecord } from "./editor-data.js";

// Layout belongs to content.js; templates only describe editable content.
export const PAGE_TEMPLATES = [
  {
    id: "cards",
    kind: "cards",
    label: ["デレステのカード", "星光舞台卡面"],
    hint: [
      "2つの姿・特技・ステータス・コミュ",
      "双版本卡面、特技、能力值与剧情",
    ],
    seed: {
      game: "deresute",
      rarity: "SSR",
      card: {
        stats: [
          {
            label: { ja: "特訓前", zh: "特训前" },
            life: 0,
            vocal: 0,
            dance: 0,
            visual: 0,
            total: 0,
          },
          {
            label: { ja: "特訓後", zh: "特训后" },
            life: 0,
            vocal: 0,
            dance: 0,
            visual: 0,
            total: 0,
          },
        ],
      },
    },
  },
  {
    id: "mobamas",
    kind: "cards",
    label: ["モバマスのカード", "灰姑娘女孩卡面"],
    hint: [
      "カード・コスト・攻守・段階別の特技",
      "卡面、Cost、攻防与各阶段特技",
    ],
    seed: {
      game: "mobamas",
      rarity: "SR",
      card: {
        mobamasStats: [
          {
            label: { ja: "特訓前", zh: "特训前" },
            cost: 0,
            attack: 0,
            defense: 0,
          },
        ],
        skills: [],
      },
    },
  },
  {
    id: "outfit",
    kind: "cards",
    label: ["衣装・立ち絵", "服装与立绘"],
    hint: ["立ち絵・衣装の紹介・ギャラリー", "立绘、服装介绍与图集"],
    seed: { game: "", card: {} },
  },
  {
    id: "songs",
    kind: "songs",
    label: ["楽曲", "歌曲"],
    hint: [
      "ジャケット・歌唱・制作陣・収録CD",
      "封面、演唱者、制作人员与唱片曲目",
    ],
    seed: { music: { performers: [], credits: {}, album: { tracks: [] } } },
  },
  {
    id: "stories",
    kind: "stories",
    label: ["コミュ", "剧情"],
    hint: ["あらすじ・出演者・エピソード", "简介、出演成员与篇章目录"],
    seed: { story: { members: [], chapters: [] } },
  },
  {
    id: "story-video",
    kind: "stories",
    label: ["動画付きコミュ", "视频剧情"],
    hint: [
      "YouTube / Bilibili のリンクで動画を表示",
      "填写 YouTube／Bilibili 链接即可展示播放器",
    ],
    seed: { story: { members: [], chapters: [] }, tags: ["commu"] },
  },
  {
    id: "videos",
    kind: "videos",
    label: ["動画", "视频"],
    hint: ["カバー・再生・投稿者・分割動画", "封面、播放入口、投稿者与分集"],
    seed: { video: { parts: [] } },
  },
  {
    id: "units",
    kind: "units",
    label: ["ユニット", "组合"],
    hint: ["メンバー・初登場・代表曲", "成员、首次登场与代表曲"],
    seed: { unit: { members: [] } },
  },
  {
    id: "news",
    kind: "news",
    label: ["お知らせ", "资讯"],
    hint: ["記事・段落・情報表・画像", "文章、段落、信息表与图片"],
    seed: {},
  },
  {
    id: "timeline",
    kind: "timeline",
    label: ["あゆみ", "足迹"],
    hint: ["日付・写真・出来事の記録", "日期、图片与事件记录"],
    seed: {},
  },
  {
    id: "profile",
    kind: "profile",
    label: ["人物紹介", "人物介绍"],
    hint: ["名前・紹介文・ご縁・声・スタンプ", "姓名、介绍、伙伴、语音与贴纸"],
    seed: {
      profile: {
        identity: {
          name: { ja: "", zh: "" },
          romanized: "",
          franchise: { ja: "", zh: "" },
          type: "",
        },
        connections: [],
        stickers: [],
      },
    },
  },
];

export function fromTemplate(templateId) {
  const template = PAGE_TEMPLATES.find((x) => x.id === templateId);
  if (!template) throw Error("Unknown page template");
  return { ...newRecord(template.kind), ...structuredClone(template.seed) };
}

export function duplicateRecord(item) {
  const value = structuredClone(item);
  value.id = newRecord(item.kind).id;
  value.title = {
    ja: `${item.title.ja}（コピー）`,
    zh: `${item.title.zh || item.title.ja}（副本）`,
  };
  return value;
}
