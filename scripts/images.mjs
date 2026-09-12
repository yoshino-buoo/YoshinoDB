import { writeFile, rename, mkdir, access } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { isHttps } from "../lib/data.js";

const hosts = [
  "i.ytimg.com",
  "img.youtube.com",
  "columbia.jp",
  "www.columbia.jp",
  "cinderellagirls.idolmaster-official.jp",
  "cinderella-library.idolmaster-official.jp",
  "idolmaster-official.jp",
  "cmsapi-frontend.idolmaster-official.jp",
  "www.idolmaster-official.jp",
  "bandainamco-am.co.jp",
  "i0.hdslb.com",
  "i1.hdslb.com",
  "i2.hdslb.com",
];
export function allowedImage(url) {
  return isHttps(url) && hosts.includes(new URL(url).hostname);
}
export function imageExtension(bytes) {
  if (bytes.length < 100) throw Error("Empty or truncated image");
  if (
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return "png";
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "jpg";
  if (
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  )
    return "webp";
  throw Error("Expected a PNG, JPEG or WebP image");
}
export async function cacheImage(
  url,
  { root = "public", fetcher = fetch } = {},
) {
  if (!allowedImage(url)) throw Error("Unrecognized thumbnail host");
  const response = await fetcher(url, {
    redirect: "error",
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw Error(`Thumbnail HTTP ${response.status}`);
  if (Number(response.headers.get("content-length")) > 8_000_000)
    throw Error("Image too large");
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > 8_000_000) throw Error("Image too large");
    chunks.push(chunk);
  }
  const bytes = Buffer.concat(chunks);
  const ext = imageExtension(bytes);
  const image = `assets/auto-${createHash("sha256").update(bytes).digest("hex").slice(0, 20)}.${ext}`;
  await mkdir(path.join(root, "assets"), { recursive: true });
  const target = path.join(root, image);
  await writeFile(target + ".tmp", bytes);
  await rename(target + ".tmp", target);
  return image;
}
export async function attachPreview(item, previous, options = {}) {
  const root = options.root || "public";
  if (
    previous?.image &&
    previous.previewStatus !== "pending" &&
    (!item.imageSource || previous.imageSource === item.imageSource)
  ) {
    try {
      await access(path.join(root, previous.image));
      return {
        ...item,
        image: previous.image,
        imageSource: previous.imageSource || "",
      };
    } catch {
      /* Recover the missing file from the source below. */
    }
  }
  try {
    const result = {
      ...item,
      image: await cacheImage(item.imageSource, options),
    };
    delete result.previewStatus;
    return result;
  } catch (error) {
    options.onWarning?.(`${item.id}: ${error.message}`);
    const result = { ...item, previewStatus: "pending" };
    delete result.image;
    if (previous?.image) {
      try {
        await access(path.join(root, previous.image));
        result.image = previous.image;
      } catch {
        /* The record still publishes without an image. */
      }
    }
    return result;
  }
}
