import { isWikiAudio } from "./voice-guide.js";

export const KINDS = [
  "cards",
  "songs",
  "stories",
  "units",
  "videos",
  "timeline",
  "news",
  "profile",
];
export function searchText(item) {
  const fields = [
    item.title,
    item.description,
    item.tags,
    item.music?.performers,
    item.music?.performerCredits,
    item.music?.credits,
    item.music?.album?.title,
    item.music?.album?.catalogNumber,
    item.card?.skill,
    item.card?.skills,
    item.card?.center,
    item.unit?.members,
    item.unit?.song,
    item.story?.members,
    item.commu?.lines,
    item.video?.uploader,
    item.sections,
    item.profile?.connections,
    item.profile?.stickers?.map(({ label }) => label),
    item.voiceGuide?.stages?.map(({ title, paragraphs, groups }) => ({
      title,
      paragraphs,
      scenes: groups?.map(({ label, description, clips }) => ({
        label,
        description,
        lines: clips?.map(({ label, text }) => ({ label, text })),
      })),
    })),
  ];
  const text = (value) =>
    typeof value === "string"
      ? value
      : value && typeof value === "object"
        ? Object.values(value).map(text).join(" ")
        : "";
  return fields.map(text).join(" ").toLocaleLowerCase();
}
export function isHttps(value) {
  try {
    const u = new URL(value);
    return u.protocol === "https:" && !u.username && !u.password;
  } catch {
    return false;
  }
}
export function validDate(value) {
  return (
    value === "" ||
    (typeof value === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      Number.isFinite(Date.parse(value)) &&
      new Date(value).toISOString().slice(0, 10) === value)
  );
}
export function validateCatalog(data) {
  if (!data || data.version !== 1 || !Array.isArray(data.items))
    throw Error("Invalid catalog: version 1 and items array required.");
  if (data.items.length > 10000) throw Error("Too many records.");
  const ids = new Set();
  for (const item of data.items) {
    if (
      !item ||
      !/^[-a-zA-Z0-9_]{1,100}$/.test(item.id || "") ||
      ids.has(item.id)
    )
      throw Error("Invalid or duplicate ID: " + item?.id);
    ids.add(item.id);
    if (!KINDS.includes(item.kind)) throw Error("Invalid category: " + item.id);
    if (
      item.kind === "cards" &&
      item.rarity &&
      !["deresute", "mobamas"].includes(item.game)
    )
      throw Error("Card game must be deresute or mobamas: " + item.id);
    if (
      !item.title ||
      typeof item.title.ja !== "string" ||
      !item.title.ja.trim() ||
      item.title.ja.length > 600
    )
      throw Error("Japanese title required: " + item.id);
    for (const key of ["title", "description", "dateLabel"])
      if (item[key])
        for (const locale of ["ja", "zh"])
          if (
            item[key][locale] !== undefined &&
            (typeof item[key][locale] !== "string" ||
              item[key][locale].length > 6000)
          )
            throw Error("Invalid localized text: " + item.id);
    if (!isHttps(item.source)) throw Error("HTTPS source required: " + item.id);
    if (
      typeof item.sourceName !== "string" ||
      !item.sourceName.trim() ||
      item.sourceName.length > 150
    )
      throw Error("Source name required: " + item.id);
    if (typeof item.official !== "boolean")
      throw Error("Source type required: " + item.id);
    if (!validDate(item.date ?? "")) throw Error("Invalid date: " + item.id);
    if (
      item.tags &&
      (!Array.isArray(item.tags) ||
        !item.tags.every((t) => typeof t === "string" && t.length <= 150))
    )
      throw Error("Invalid tags: " + item.id);
    if (
      item.image &&
      !/^assets\/[a-zA-Z0-9_.-]+\.(?:png|jpg|jpeg|webp)$/.test(item.image)
    )
      throw Error("Image must be a local assets file: " + item.id);
    if (item.profile?.stickers) {
      if (
        !Array.isArray(item.profile.stickers) ||
        item.profile.stickers.length > 100 ||
        !item.profile.stickers.every(
          (art) =>
            ["mobamas", "deresute", "line"].includes(art.group) &&
            validTranscript(art.label) &&
            /^assets\/[a-zA-Z0-9_.-]+\.(?:png|jpg|jpeg|webp|gif)$/.test(
              art.image || "",
            ) &&
            isHttps(art.source) &&
            ["width", "height"].every(
              (key) => Number.isFinite(art[key]) && art[key] > 0,
            ),
        )
      )
        throw Error("Invalid profile sticker: " + item.id);
    }
    if (item.card?.petit) {
      const petit = item.card.petit;
      if (
        item.kind !== "cards" ||
        item.game !== "deresute" ||
        !isHttps(petit.source) ||
        !Array.isArray(petit.poses) ||
        petit.poses.length < 1 ||
        petit.poses.length > 4 ||
        petit.poses.some(
          (pose) =>
            !/^assets\/[a-zA-Z0-9_.-]+\.(?:png|jpg|jpeg|webp)$/.test(
              pose?.image || "",
            ) ||
            (pose.imageSource && !isHttps(pose.imageSource)),
        )
      )
        throw Error("Invalid petit idol: " + item.id);
    }
    for (const url of [
      item.card?.source,
      ...(item.music?.sources || []).map((x) => x.url),
      ...(item.story?.chapters || []).map((x) => x.source),
      item.voiceGuide?.source,
      item.commu?.source,
      item.commu?.videoUrl,
      item.theater?.translationCredit?.url,
      item.attribution?.url,
      item.attribution?.licenseUrl,
    ].filter(Boolean))
      if (!isHttps(url)) throw Error("Invalid detail link: " + item.id);
    if (item.voiceGuide) {
      const g = item.voiceGuide;
      if (
        !isHttps(g.source) ||
        !Array.isArray(g.stages) ||
        g.stages.length > 10
      )
        throw Error("Invalid voice guide: " + item.id);
      for (const stage of g.stages) {
        if (!Array.isArray(stage.groups) || stage.groups.length > 30)
          throw Error("Invalid voice groups: " + item.id);
        for (const group of stage.groups) {
          if (
            !Array.isArray(group.clips) ||
            group.clips.length > 100 ||
            !group.clips.every(
              (clip) =>
                clip &&
                /^CGSS-[a-zA-Z0-9_+-]+\.mp3$/.test(clip.file) &&
                (!clip.audio || isWikiAudio(clip.audio)) &&
                (!clip.text || validTranscript(clip.text)),
            )
          )
            throw Error("Invalid voice file index: " + item.id);
        }
      }
    }
    if (
      item.commu &&
      (!isHttps(item.commu.source) ||
        !Array.isArray(item.commu.lines) ||
        item.commu.lines.length > 1500 ||
        !item.commu.lines.every(validTranscript))
    )
      throw Error("Invalid card commu: " + item.id);
    if (item.theater) {
      const theater = item.theater;
      if (
        !Number.isInteger(theater.episode) ||
        theater.episode < 1 ||
        !Array.isArray(theater.panels) ||
        theater.panels.length > 30 ||
        !theater.panels.every(
          (panel) =>
            Number.isInteger(panel.part) &&
            panel.part > 0 &&
            panel.ja &&
            [panel.ja, panel.zh]
              .filter(Boolean)
              .every(
                (art) =>
                  /^assets\/[a-zA-Z0-9_.-]+\.(?:png|jpg|jpeg|webp)$/.test(
                    art.image || "",
                  ) &&
                  isHttps(art.source) &&
                  ["width", "height"].every(
                    (key) => Number.isFinite(art[key]) && art[key] > 0,
                  ),
              ),
        )
      )
        throw Error("Invalid card theater: " + item.id);
    }
    for (const stage of item.card?.stats || []) {
      const values = ["life", "vocal", "dance", "visual", "total"].map(
        (key) => stage[key],
      );
      if (
        !values.every((value) => Number.isFinite(value) && value >= 0) ||
        stage.total !== stage.vocal + stage.dance + stage.visual
      )
        throw Error("Invalid card stats: " + item.id);
    }
    if (item.card?.mobamasStats !== undefined) {
      if (!Array.isArray(item.card.mobamasStats))
        throw Error("Invalid Mobamas stats: " + item.id);
      for (const stage of item.card.mobamasStats)
        if (
          !stage ||
          !["cost", "attack", "defense"].every(
            (key) => Number.isInteger(stage[key]) && stage[key] >= 0,
          )
        )
          throw Error("Invalid Mobamas stats: " + item.id);
    }
    if (
      item.relatedIds &&
      (!Array.isArray(item.relatedIds) ||
        !item.relatedIds.every((id) => typeof id === "string"))
    )
      throw Error("Invalid related records: " + item.id);
    if (item.reference && !isHttps(item.reference))
      throw Error("Invalid reference: " + item.id);
    if (item.imageSource && !isHttps(item.imageSource))
      throw Error("Invalid image source: " + item.id);
    if (
      item.gallery &&
      (!Array.isArray(item.gallery) ||
        item.gallery.length > 10 ||
        !item.gallery.every(
          (art) =>
            art &&
            /^assets\/[a-zA-Z0-9_.-]+\.(?:png|jpg|jpeg|webp)$/.test(art.image),
        ))
    )
      throw Error("Invalid image gallery: " + item.id);
  }
  return data;
}
export function mergeRecords(oldItems, newItems) {
  const result = new Map(oldItems.map((x) => [`${x.kind}:${x.source}`, x]));
  for (const item of newItems) result.set(`${item.kind}:${item.source}`, item);
  return [...result.values()].sort(
    (a, b) =>
      (b.date || "").localeCompare(a.date || "") || a.id.localeCompare(b.id),
  );
}

function validTranscript(value) {
  return (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    ["ja", "zh"].every(
      (locale) =>
        value[locale] === undefined ||
        (typeof value[locale] === "string" && value[locale].length <= 6000),
    )
  );
}

// Shared by release validation and the editor's asset export, including nested art.
export function recordImages(item) {
  const result = [];
  const visit = (value) => {
    if (!value || typeof value !== "object") return;
    if (typeof value.image === "string" && value.image) result.push(value);
    for (const child of Object.values(value))
      if (typeof child === "object") visit(child);
  };
  visit(item);
  return result;
}
