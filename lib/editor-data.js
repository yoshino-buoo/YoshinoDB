import { validateCatalog, isHttps, validDate } from "./data.js";
import {
  BASIC,
  DETAILS,
  BODY,
  IMAGES,
  RELATED,
  ADVANCED,
} from "./editor-schema.js";

const clone = (value) =>
  value === undefined ? undefined : structuredClone(value);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const object = (x) => x && typeof x === "object" && !Array.isArray(x);
// Arrays are ordered editorial units; never merge their rows by numeric index.
export function threeWay(base, local, remote, path = "") {
  if (same(local, base)) return { value: clone(remote), conflicts: [] };
  if (same(remote, base) || same(local, remote))
    return { value: clone(local), conflicts: [] };
  if (object(local) && object(remote) && (base === undefined || object(base))) {
    const value = {},
      conflicts = [];
    for (const key of new Set([
      ...Object.keys(base || {}),
      ...Object.keys(local),
      ...Object.keys(remote),
    ])) {
      const next = threeWay(
        base?.[key],
        local[key],
        remote[key],
        path ? `${path}.${key}` : key,
      );
      if (next.value !== undefined)
        Object.defineProperty(value, key, {
          value: next.value,
          enumerable: true,
          configurable: true,
          writable: true,
        });
      conflicts.push(...next.conflicts);
    }
    return { value, conflicts };
  }
  return { value: clone(local), conflicts: [path || "record"] };
}
export function materialize(catalog, changes) {
  const items = new Map(catalog.items.map((x) => [x.id, clone(x)])),
    conflicts = [];
  for (const [id, change] of Object.entries(changes)) {
    const merged = threeWay(
      change.base ?? undefined,
      change.value ?? undefined,
      items.get(id),
    );
    if (merged.value) items.set(id, merged.value);
    else items.delete(id);
    if (merged.conflicts.length)
      conflicts.push({ id, paths: merged.conflicts });
  }
  return { catalog: { ...catalog, items: [...items.values()] }, conflicts };
}
export function getPath(item, path) {
  return path ? path.split(".").reduce((x, k) => x?.[k], item) : item;
}
export function setPath(item, path, value) {
  const keys = path.split(".");
  if (keys.some((k) => ["__proto__", "prototype", "constructor"].includes(k)))
    throw Error("Invalid field path");
  let target = item;
  keys.forEach((key, i) => {
    if (i === keys.length - 1) target[key] = value;
    else {
      if (!target[key] || typeof target[key] !== "object")
        target[key] = /^\d+$/.test(keys[i + 1]) ? [] : {};
      target = target[key];
    }
  });
}
export function newRecord(kind = "news") {
  return {
    id: `entry-${crypto.randomUUID()}`,
    kind,
    title: { ja: "", zh: "" },
    description: { ja: "", zh: "" },
    date: "",
    source: "",
    sourceName: "",
    official: false,
    tags: [],
  };
}

export function validateEditorCatalog(catalog) {
  validateCatalog(catalog);
  const check = (item, fields, prefix = "") => {
    for (const field of fields) {
      const path = [prefix, field.key].filter(Boolean).join("."),
        value = getPath(item, path);
      if (value == null) continue;
      let valid = true;
      if (field.type === "rows") {
        valid = Array.isArray(value) && value.length <= 1000;
        if (valid)
          value.forEach((row, i) => {
            if (!row || typeof row !== "object") {
              if (
                !(
                  field.fields.length === 1 &&
                  field.fields[0].key === "" &&
                  typeof row === "string"
                )
              )
                throw Error(`${item.id}: ${path}.${i}`);
            }
            check(item, field.fields, `${path}.${i}`);
          });
      } else if (field.type === "localized")
        valid =
          typeof value === "string" ||
          (object(value) &&
            ["ja", "zh"].every(
              (k) => value[k] === undefined || typeof value[k] === "string",
            ));
      else if (["lines", "tags", "relations"].includes(field.type))
        valid =
          Array.isArray(value) && value.every((v) => typeof v === "string");
      else if (field.type === "number")
        valid = Number.isFinite(value) && value >= 0;
      else if (field.type === "boolean") valid = typeof value === "boolean";
      else valid = typeof value === "string";
      if (!valid) throw Error(`${item.id}: ${path} — invalid field format`);
    }
  };
  for (const item of catalog.items) {
    const definitions = [
      ...BASIC,
      ...Object.values(DETAILS).flat(),
      ...BODY,
      ...IMAGES,
      ...RELATED,
      ...ADVANCED,
    ];
    check(
      item,
      definitions.flatMap((b) => b.fields),
    );
  }
  return catalog;
}

// Return actionable paths so validation can take an editor directly to a field.
export function entryIssues(item, ids = new Set(), zh = false) {
  const issues = [],
    msg = (ja, cn) => (zh ? cn : ja);
  const add = (path, ja, cn) =>
    issues.push({ id: item.id, path, message: msg(ja, cn) });
  if (!item.title?.ja?.trim())
    add("title", "日本語のタイトルを入力してください", "请填写日文标题");
  if (!isHttps(item.source))
    add(
      "source",
      "https:// の掲載ページを入力してください",
      "请填写 https:// 来源网址",
    );
  if (!item.sourceName?.trim())
    add("sourceName", "掲載元の名前を入力してください", "请填写来源名称");
  const walk = (value, path = "") => {
    if (!value || typeof value !== "object") return;
    for (const [key, v] of Object.entries(value)) {
      const p = path ? `${path}.${key}` : key;
      if (
        ["url", "source", "imageSource", "reference"].includes(key) &&
        v &&
        !isHttps(v)
      )
        add(p, "リンクは https:// で入力してください", "链接须使用 https://");
      if (
        ["date", "releaseDate", "verifiedAt", "debut"].includes(key) &&
        v &&
        !validDate(v)
      )
        add(p, "日付を確認してください", "请检查日期格式");
      if (key === "entryId" && v && !ids.has(v))
        add(p, "関連する記録が見つかりません", "关联条目不存在");
      if (typeof v === "number" && (!Number.isFinite(v) || v < 0))
        add(p, "0以上の数値を入力してください", "请输入不小于零的有效数字");
      if (
        key === "image" &&
        v &&
        !/^assets\/[a-zA-Z0-9_.-]+\.(png|jpg|jpeg|webp)$/.test(v)
      )
        add(p, "assets/ 内の画像を指定してください", "请选择 assets/ 中的图片");
      walk(v, p);
    }
  };
  walk(item);
  for (const id of item.relatedIds || [])
    if (!ids.has(id))
      add(
        "relatedIds",
        `関連する記録 ${id} が見つかりません`,
        `找不到关联条目 ${id}`,
      );
  for (let i = 0; i < (item.gallery || []).length; i++)
    if (!item.gallery[i].image)
      add(
        `gallery.${i}.image`,
        "画像を選ぶか、この行を削除してください",
        "请选择图片，或移除此行",
      );
  try {
    validateEditorCatalog({ version: 1, items: [item] });
  } catch (error) {
    if (!issues.length)
      add(
        "advanced",
        `データを確認してください：${error.message}`,
        `请检查数据：${error.message}`,
      );
  }
  return issues;
}
