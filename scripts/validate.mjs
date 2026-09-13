import { readFile, access } from "node:fs/promises";
import { validateListening } from "../lib/listening.js";
import { validateCatalog } from "../lib/data.js";
const items = [];
for (const file of ["catalog", "generated"]) {
  const data = validateCatalog(
    JSON.parse(await readFile(`public/data/${file}.json`, "utf8")),
  );
  items.push(...data.items);
  for (const item of data.items) {
    if (item.image) await access(`public/${item.image}`);
    for (const art of item.gallery || []) await access(`public/${art.image}`);
    for (const pose of item.card?.petit?.poses || [])
      await access(`public/${pose.image}`);
  }
  console.log(
    `${file}: ${data.items.length} valid records, ${data.items.filter((x) => x.image).length} with previews`,
  );
}

const ids = new Set(items.map((x) => x.id));
for (const item of items) {
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
for (const id of Object.keys(previews.tracks)) {
  if (!items.some((x) => x.id === id && x.kind === "songs"))
    throw Error(`Unknown preview song: ${id}`);
}
await access("public/audio/hibi-instrumental.m4a");
for (const lang of ["ja", "zh"])
  await access(`public/assets/providers/itunes-${lang}.svg`);
console.log(
  `listening: ${Object.keys(previews.tracks).length} song previews, BGM available`,
);
