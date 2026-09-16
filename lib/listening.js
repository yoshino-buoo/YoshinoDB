export function isPreviewUrl(value) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" && url.hostname === "audio-ssl.itunes.apple.com"
    );
  } catch {
    return false;
  }
}

export function isMusicStoreUrl(value) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      ["music.apple.com", "itunes.apple.com"].includes(url.hostname)
    );
  } catch {
    return false;
  }
}

export function appleTrackId(value) {
  if (!isMusicStoreUrl(value)) return null;
  const url = new URL(value);
  const id =
    url.searchParams.get("i") ||
    (/\/song\//.test(url.pathname)
      ? url.pathname.match(/\/(?:id)?(\d+)\/?$/)?.[1]
      : null);
  return /^\d+$/.test(id || "") &&
    Number.isSafeInteger(Number(id)) &&
    Number(id) > 0
    ? Number(id)
    : null;
}

export function songMappings(catalog, fallback = {}) {
  return Object.fromEntries(
    catalog.items
      .filter((x) => x.kind === "songs")
      .map((item) => [
        item.id,
        Object.hasOwn(item.music || {}, "appleTrackUrl")
          ? appleTrackId(item.music.appleTrackUrl)
          : fallback[item.id],
      ])
      .filter(([, id]) => id),
  );
}

const normalize = (name) =>
  name
    .normalize("NFKC")
    .replace(/\s*\((?:GAME|M@STER) VERSION\)\s*/gi, "")
    .replace(/\s/g, "")
    .toLowerCase();

export function previewFromResult(item, result) {
  if (
    !result ||
    result.kind !== "song" ||
    !result.artistName?.includes("依田芳乃") ||
    normalize(item.title.ja) !== normalize(result.trackName || "") ||
    !isPreviewUrl(result.previewUrl) ||
    !isMusicStoreUrl(result.trackViewUrl)
  )
    return null;
  const store = new URL(result.trackViewUrl);
  store.searchParams.set("app", "itunes");
  return {
    trackId: result.trackId,
    title: result.trackName,
    artist: result.artistName,
    album: result.collectionName,
    version: result.trackName.includes("GAME VERSION")
      ? "game"
      : result.trackName.includes("M@STER VERSION")
        ? "master"
        : "original",
    previewUrl: result.previewUrl,
    storeUrl: store.href,
  };
}

export function validateListening(data) {
  if (
    !data ||
    !data.tracks ||
    typeof data.tracks !== "object" ||
    Array.isArray(data.tracks)
  )
    throw Error("Invalid listening data");
  for (const [id, track] of Object.entries(data.tracks)) {
    if (
      !/^[a-z0-9-]+$/.test(id) ||
      !Number.isSafeInteger(track.trackId) ||
      typeof track.title !== "string" ||
      typeof track.artist !== "string" ||
      !["original", "game", "master"].includes(track.version) ||
      !isPreviewUrl(track.previewUrl) ||
      !isMusicStoreUrl(track.storeUrl)
    )
      throw Error(`Invalid preview: ${id}`);
  }
  return data;
}
