import {
  BASIC,
  DETAILS,
  BODY,
  IMAGES,
  RELATED,
  ADVANCED,
} from "./editor-schema.js";
import { getPath, setPath } from "./editor-data.js";

export function emptyRow(definition) {
  const value = structuredClone(definition.seed || {});
  for (const field of definition.fields) {
    if (!field.key || getPath(value, field.key) !== undefined) continue;
    if (field.type === "rows") setPath(value, field.key, []);
    if (field.type === "localized")
      setPath(value, field.key, { ja: "", zh: "" });
    if (field.type === "image") setPath(value, field.key, "");
  }
  return value;
}

export function removableBlock(block, item) {
  return [
    "voiceGuide.excerpts",
    "voiceGuide",
    "card.petit",
    "commu",
    "theater",
    "profile.stickers",
    "profile.connections",
    "attribution",
  ].find(
    (path) =>
      getPath(item, path) !== undefined &&
      block.fields.every(
        (field) => field.key === path || field.key.startsWith(path + "."),
      ),
  );
}

export function editorGroups(item) {
  return {
    basic: BASIC,
    details: DETAILS[item.kind] || [],
    body: BODY,
    images: IMAGES,
    related: RELATED,
    advanced: ADVANCED,
  };
}

// Resolve a renderer's field path through the same schema used by the forms.
// Arrays are matched structurally, so a click on any row opens the right tab.
export function fieldLocation(item, path) {
  const matches = [];
  function visit(fields, prefix, tab) {
    for (const field of fields) {
      const pattern = [prefix, field.key].filter(Boolean).join(".");
      const expression = new RegExp(
        `^${pattern.replaceAll(".", "\\.").replaceAll("*", "\\d+")}(?:\\.|$)`,
      );
      if (expression.test(path) || pattern.startsWith(path + "."))
        matches.push({ tab, field, depth: pattern.length });
      if (field.type === "rows") visit(field.fields, `${pattern}.*`, tab);
    }
  }
  for (const [tab, blocks] of Object.entries(editorGroups(item)))
    for (const block of blocks) visit(block.fields, "", tab);
  return matches.sort((a, b) => b.depth - a.depth)[0] || null;
}
