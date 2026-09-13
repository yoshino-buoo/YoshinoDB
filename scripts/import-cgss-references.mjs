import {
  readdir,
  readFile,
  writeFile,
  copyFile,
  access,
} from "node:fs/promises";
import { resolve, relative, extname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseCgssReference } from "./lib/cgss-reference.mjs";
import { validateCatalog } from "../lib/data.js";

const root = resolve(process.argv[2] || "references");
const catalogPath = "public/data/catalog.json";
const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
const manifestPath = "public/assets/manifest.json";
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const files = (await readdir(root))
  .filter((file) => file.endsWith(".html"))
  .sort();
const imported = new Set(),
  assets = new Map(),
  audit = [];
for (const filename of files) {
  const name = filename.split(" - ")[0].normalize("NFC");
  const card = catalog.items.find(
    (item) =>
      item.kind === "cards" &&
      item.game === "deresute" &&
      item.voiceGuide &&
      decodeURIComponent(new URL(item.voiceGuide.source).pathname)
        .split("/")
        .at(-1)
        .replaceAll("_", " ")
        .normalize("NFC") === name,
  );
  if (!card) throw Error(`No matching CGSS card: ${name}`);
  if (imported.has(card.id)) throw Error(`Duplicate card: ${name}`);
  imported.add(card.id);
  const parsed = parseCgssReference(
    await readFile(resolve(root, filename), "utf8"),
  );
  const used = new Set();
  let matched = 0;
  for (const stage of card.voiceGuide.stages)
    for (const group of stage.groups)
      for (const clip of group.clips) {
        const importedClip = parsed.clips.get(clip.file);
        if (!importedClip) throw Error(`Missing scene: ${name} / ${clip.file}`);
        delete clip.text;
        Object.assign(clip, importedClip);
        used.add(clip.file);
        matched++;
      }
  if (matched !== parsed.voiceRows || used.size !== parsed.clips.size)
    throw Error(`Incomplete voice import: ${name}`);
  card.commu = { source: card.voiceGuide.source, ...parsed.commu };
  if (parsed.comics.length) {
    const panels = [];
    for (const comic of parsed.comics) {
      const src = fileURLToPath(
        new URL(comic.savedPath, pathToFileURL(resolve(root, filename))),
      );
      if (
        relative(root, src).startsWith("..") ||
        !/\.jpe?g$/i.test(extname(src))
      )
        throw Error("Unexpected saved comic path");
      await access(src);
      const image = `assets/cingeki-${comic.episode}-${comic.part}-${comic.locale}.jpg`;
      assets.set(image, src);
      if (!manifest.some((art) => art.image === image))
        manifest.push({ image, source: comic.source });
      let panel = panels.find((panel) => panel.part === comic.part);
      if (!panel) {
        panel = { part: comic.part };
        panels.push(panel);
      }
      panel[comic.locale] = {
        image,
        source: comic.source,
        width: comic.width,
        height: comic.height,
      };
    }
    const credit = parsed.comics.find(
      (comic) => comic.locale === "zh" && comic.credit,
    )?.credit;
    card.theater = {
      episode: parsed.comics[0].episode,
      panels,
      ...(credit ? { translationCredit: credit } : {}),
    };
  }
  audit.push({
    id: card.id,
    card: name,
    rows: matched,
    files: used.size,
    text: [...parsed.clips.values()].filter((c) => c.text?.ja).length,
    lines: card.commu.lines.length,
    panels: card.theater?.panels.length || 0,
  });
}
const expected = catalog.items.filter(
  (item) => item.game === "deresute" && item.voiceGuide,
);
if (imported.size !== expected.length)
  throw Error(`Expected ${expected.length} card pages, found ${imported.size}`);
validateCatalog(catalog);
for (const [image, src] of assets) await copyFile(src, `public/${image}`);
await writeFile(catalogPath, JSON.stringify(catalog, null, 2) + "\n");
await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
console.table(audit);
console.log(
  `Imported ${imported.size} cards, ${audit.reduce((n, c) => n + c.rows, 0)} voice rows, ${audit.reduce((n, c) => n + c.lines, 0)} commu lines, ${assets.size} comic images.`,
);
