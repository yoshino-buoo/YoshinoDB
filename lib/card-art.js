// Lists and detail galleries open on the same artwork for shared transitions.
export function cardArtwork(item, preferred = 0) {
  const gallery = item.kind === "cards" ? item.gallery : null;
  const index = preferred === 1 && gallery?.[1]?.image ? 1 : 0;
  return { index, image: gallery?.[index]?.image || item.image };
}
