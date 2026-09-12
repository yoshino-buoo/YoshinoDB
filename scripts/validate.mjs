import { readFile, access } from "node:fs/promises";
import { validateCatalog } from "../lib/data.js";
for (const file of ["catalog", "generated"]) {
  const data = validateCatalog(
    JSON.parse(await readFile(`public/data/${file}.json`, "utf8")),
  );
  for (const item of data.items)
    if (item.image) await access(`public/${item.image}`);
  console.log(`${file}: ${data.items.length} valid records`);
}
