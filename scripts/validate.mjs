import { readFile, access } from "node:fs/promises";
import { validateListening } from "../lib/listening.js";
import { validateCatalog, recordImages } from "../lib/data.js";
import { validateEditorCatalog, entryIssues } from "../lib/editor-data.js";
const items = [];
for (const file of ["catalog", "generated"]) {
  const data = validateCatalog(
    JSON.parse(await readFile(`public/data/${file}.json`, "utf8")),
  );
  if (file === "catalog") validateEditorCatalog(data);
  items.push(...data.items);
  for (const item of data.items) {
    for (const art of recordImages(item)) await access(`public/${art.image}`);
  }
  console.log(
    `${file}: ${data.items.length} valid records, ${data.items.filter((x) => x.image).length} with previews`,
  );
}

const ids = new Set(items.map((x) => x.id));
for (const item of items) {
  const issues = entryIssues(item, ids);
  if (issues.length)
    throw Error(`${item.id}: ${issues[0].path} — ${issues[0].message}`);
  for (const id of [
    ...(item.relatedIds || []),
    ...(item.story?.chapters || []).map((x) => x.entryId).filter(Boolean),
    ...(item.profile?.connections || []).map((x) => x.entryId).filter(Boolean),
  ])
    if (!ids.has(id)) throw Error(`Broken relation: ${item.id} → ${id}`);
}

// This is an external metadata cache. Entries for removed songs are unused and
// are pruned at the next sync; they must not prevent an editorial deletion.
const previews = validateListening(
  JSON.parse(await readFile("public/data/listening.json", "utf8")),
);
const bgmTracks = JSON.parse(await readFile("config/bgm.json", "utf8"));
if (!Array.isArray(bgmTracks) || !bgmTracks.length)
  throw Error("BGM playlist is empty");
const bgmFiles = new Set();
for (const track of bgmTracks) {
  if (
    !/^audio\/[a-z0-9-]+\.m4a$/.test(track.file || "") ||
    bgmFiles.has(track.file) ||
    !track.title ||
    !track.album ||
    !/^https:\/\/cinderellagirls\.idolmaster-official\.jp\//.test(
      track.source || "",
    )
  )
    throw Error("Invalid BGM track");
  bgmFiles.add(track.file);
  await access(`public/${track.file}`);
}
for (const lang of ["ja", "zh"])
  await access(`public/assets/providers/itunes-${lang}.svg`);
console.log(
  `listening: ${Object.keys(previews.tracks).length} song previews, ${bgmTracks.length} BGM tracks available`,
);
