import { readFile, access } from "node:fs/promises";
import { validateCatalog } from "../lib/data.js";
for (const file of ["catalog", "generated"]) {
  const data = validateCatalog(
    JSON.parse(await readFile(`public/data/${file}.json`, "utf8")),
  );
  for (const item of data.items) {
    if (!item.image) throw Error(`Preview image required: ${item.id}`);
    await access(`public/${item.image}`);
    for (const art of item.gallery || []) await access(`public/${art.image}`);
  }
  console.log(
    `${file}: ${data.items.length} valid records, all previews present`,
  );
}
