import { readFile, writeFile, rename } from "node:fs/promises";
import {
  previewFromResult,
  validateListening,
  songMappings,
} from "../lib/listening.js";

const read = async (path) => JSON.parse(await readFile(path, "utf8"));
const config = await read("config/listening.json");
const catalog = await read("public/data/catalog.json");
config.tracks = songMappings(catalog, config.tracks);
const target = "public/data/listening.json";
const previous = await read(target).catch(() => ({ tracks: {} }));
const tracks = {};
try {
  // One public metadata lookup for all curated track IDs; audio remains on Apple's CDN.
  const url = new URL("https://itunes.apple.com/lookup");
  url.search = new URLSearchParams({
    id: Object.values(config.tracks).join(","),
    country: config.country,
    entity: "song",
  });
  const response = await fetch(url, { signal: AbortSignal.timeout(25000) });
  if (!response.ok) throw Error(`iTunes lookup: ${response.status}`);
  const data = await response.json();
  if (!Array.isArray(data.results)) throw Error("No iTunes results");
  for (const [id, trackId] of Object.entries(config.tracks)) {
    const item = catalog.items.find((x) => x.id === id && x.kind === "songs");
    if (!item) throw Error(`Unknown song: ${id}`);
    const result = data.results.find((x) => x.trackId === trackId);
    const track = previewFromResult(item, result);
    if (track) tracks[id] = track;
    else {
      // A regional withdrawal or network failure must never remove the song itself.
      // Keep the last verified preview; its player also offers the original store link.
      if (previous.tracks[id]?.trackId === trackId)
        tracks[id] = previous.tracks[id];
      console.warn(
        `Preview unavailable or mismatched: ${id}; kept previous metadata if present`,
      );
    }
  }
  const next = validateListening({
    provider: "iTunes Search API",
    country: config.country,
    tracks,
  });
  if (JSON.stringify(next) !== JSON.stringify(previous)) {
    await writeFile(`${target}.tmp`, JSON.stringify(next, null, 2) + "\n");
    await rename(`${target}.tmp`, target);
  }
  console.log(
    `Music previews: ${Object.keys(tracks).length} verified mappings`,
  );
} catch (error) {
  if (!Object.keys(previous.tracks).length) throw error;
  console.warn(
    `Music preview refresh skipped: ${error.message}; existing data preserved`,
  );
}
