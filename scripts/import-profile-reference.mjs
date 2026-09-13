import { readFile, writeFile, copyFile, access } from "node:fs/promises";
import { resolve, relative, extname } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { parseProfileReference } from "./lib/profile-reference.mjs";
import { validateCatalog } from "../lib/data.js";
const filename = resolve(
  process.argv[2] ||
    "references/依田芳乃 - 偶像大师灰姑娘女孩WIKI_BWIKI_哔哩哔哩.html",
);
const catalogPath = "public/data/catalog.json",
  manifestPath = "public/assets/manifest.json";
const catalog = JSON.parse(await readFile(catalogPath, "utf8")),
  manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const profile = catalog.items.find((item) => item.id === "profile-yoshino");
const parsed = parseProfileReference(await readFile(filename, "utf8"));
const groups = profile.voiceGuide.stages[0].groups.filter(
  (g) => !g.clips.some((c) => c.file === parsed.introduction.file),
);
const used = new Set();
for (const group of groups)
  for (const clip of group.clips) {
    const data = parsed.clips.get(clip.file);
    if (!data) throw Error(`Missing common voice: ${clip.file}`);
    delete clip.text;
    Object.assign(clip, data);
    used.add(clip.file);
  }
if (used.size !== parsed.clips.size || used.size !== parsed.voiceRows)
  throw Error("Incomplete common voice import");
groups.unshift({
  label: { ja: "はじめまして", zh: "初次见面" },
  clips: [
    { label: { ja: "自己紹介", zh: "自我介绍" }, ...parsed.introduction },
  ],
});
profile.voiceGuide.stages[0].groups = groups;
delete profile.voiceGuide.excerpts;
const files = [],
  counters = {};
profile.profile.stickers = parsed.stickers.map((art) => {
  const extension = extname(art.file).toLowerCase();
  if (![".png", ".gif"].includes(extension))
    throw Error(`Unexpected sticker: ${art.file}`);
  const source = fileURLToPath(new URL(art.savedPath, pathToFileURL(filename)));
  if (relative(resolve(filename, ".."), source).startsWith(".."))
    throw Error("Sticker outside saved reference");
  const image = `assets/sticker-${art.file
    .replace(/\.(png|gif)$/i, "")
    .replaceAll(" ", "-")
    .toLowerCase()}${extension}`;
  const kind = /过场/.test(art.caption) ? "loading" : "stamp",
    counter = `${art.group}:${kind}`;
  const number = (counters[counter] = (counters[counter] || 0) + 1);
  const label =
    kind === "loading"
      ? { ja: `ローディング ${number}`, zh: `过场动画 ${number}` }
      : { ja: `スタンプ ${number}`, zh: `贴纸 ${number}` };
  files.push({ source, image });
  if (!manifest.some((entry) => entry.image === image))
    manifest.push({ image, source: art.source });
  return {
    group: art.group,
    label,
    image,
    source: art.source,
    width: art.width,
    height: art.height,
  };
});
validateCatalog(catalog);
for (const file of files) await access(file.source);
for (const file of files) await copyFile(file.source, `public/${file.image}`);
await writeFile(catalogPath, JSON.stringify(catalog, null, 2) + "\n");
await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
console.log(
  `Imported ${used.size} common voices, introduction, ${files.length} stickers (${files.filter((f) => f.image.endsWith(".gif")).length} animated).`,
);
