import { readFile, access } from "node:fs/promises";
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
  ])
    if (!ids.has(id)) throw Error(`Broken relation: ${item.id} → ${id}`);
}
