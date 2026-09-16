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

const previews = validateListening(
  JSON.parse(await readFile("public/data/listening.json", "utf8")),
);
// This is an external metadata cache. Entries for removed songs are unused and
// are pruned at the next sync; they must not prevent an editorial deletion.
await access("public/audio/hibi-instrumental.m4a");
for (const lang of ["ja", "zh"])
  await access(`public/assets/providers/itunes-${lang}.svg`);
console.log(
  `listening: ${Object.keys(previews.tracks).length} song previews, BGM available`,
);
