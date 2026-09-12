import { validateCatalog, KINDS } from "./lib/data.js";
let draft = null;
const draftKey = "yoshino-editor-draft-v1";
export function mountEditor(root, catalog, { t, tr, esc, label }) {
  if (!draft) {
    try {
      const saved = localStorage.getItem(draftKey);
      draft = saved
        ? validateCatalog(JSON.parse(saved))
        : structuredClone(catalog);
    } catch {
      draft = structuredClone(catalog);
    }
  }
  const options = draft.items
    .map(
      (x) =>
        `<option value="${esc(x.id)}">${esc(tr(x.title))} · ${label(x.kind)}</option>`,
    )
    .join("");
  const field = (name, title, type = "text", required = false) =>
    `<label>${title}<input name="${name}" type="${type}" ${required ? "required" : ""}></label>`;
  root.innerHTML = `<div class="editor-toolbar"><label>${t("既存の記録を編集", "编辑已有记录")}<select id="select-record"><option value="">${t("新しい記録", "新建记录")}</option>${options}</select></label><label class="import-label">${t("JSON を読み込む", "导入 JSON")}<input type="file" id="import-json" accept="application/json,.json"></label></div><form id="record-form" class="editor-form"><div class="editor-columns"><label>${t("分類", "分类")}<select name="kind">${KINDS.map((k) => `<option value="${k}">${label(k)}</option>`).join("")}</select></label><label>${t("情報元の種類", "来源类型")}<select name="official"><option value="false">${t("有志資料・非公式", "粉丝资料・非官方")}</option><option value="true">${t("公式", "官方")}</option></select></label>${field("jaTitle", t("日本語のタイトル（必須）", "日文标题（必填）"), "text", true)}${field("zhTitle", t("中国語のタイトル（任意）", "中文标题（可选）"))}<label>${t("日本語の説明", "日文说明")}<textarea name="jaDescription" rows="4"></textarea></label><label>${t("中国語の説明", "中文说明")}<textarea name="zhDescription" rows="4"></textarea></label>${field("source", t("出典URL（https://）", "来源网址（https://）"), "url", true)}${field("sourceName", t("出典の名前", "来源名称"), "text", true)}${field("image", t("画像ファイル（assets/example.jpg）", "预览图文件（assets/example.jpg）"), "text", false)}${field("imageSource", t("画像の元URL", "图片原网址"), "url")}${field("date", t("日付（不明なら空欄）", "日期（不确定请留空）"), "date")}${field("dateLabelJa", t("日付の意味・日本語（CD発売など）", "日期含义（日语，如 CD発売）"))}${field("dateLabelZh", t("日付の意味・中国語", "日期含义（中文）"))}${field("tags", t("タグ（カンマ区切り）", "标签（用逗号分隔）"))}</div><div class="editor-buttons"><button class="primary" type="submit">${t("下書きに保存", "保存到草稿")}</button><button type="button" id="preview-record" class="secondary">${t("プレビュー", "预览条目")}</button></div></form><div id="draft-preview"></div><p id="editor-status" role="status" aria-live="polite">${t(`下書きに ${draft.items.length} 件あります。`, `草稿中有 ${draft.items.length} 条记录。`)}</p><div class="export-panel"><div><h2>${t("公開用ファイルを書き出す", "导出用于发布的文件")}</h2><p>${t("下書きの保存だけではサイトは更新されません。書き出した JSON を GitHub の public/data/catalog.json に反映してください。", "保存草稿不会直接更新网站。请将导出的 JSON 替换到 GitHub 的 public/data/catalog.json，提交后自动发布。")}</p></div><button id="export-json" class="primary">${t("JSON をダウンロード", "下载 JSON")}</button></div>`;
  const form = root.querySelector("#record-form"),
    select = root.querySelector("#select-record"),
    status = root.querySelector("#editor-status");
  const say = (value) => (status.textContent = value);
  let current = null;
  function read() {
    const f = new FormData(form);
    return {
      ...(current || {}),
      id: current?.id || `entry-${crypto.randomUUID()}`,
      kind: f.get("kind"),
      official: f.get("official") === "true",
      title: { ja: f.get("jaTitle").trim(), zh: f.get("zhTitle").trim() },
      description: {
        ja: f.get("jaDescription").trim(),
        zh: f.get("zhDescription").trim(),
      },
      date: f.get("date"),
      dateLabel: {
        ja: f.get("dateLabelJa").trim(),
        zh: f.get("dateLabelZh").trim(),
      },
      source: f.get("source").trim(),
      sourceName: f.get("sourceName").trim(),
      image: f.get("image").trim(),
      imageSource: f.get("imageSource").trim(),
      tags: f
        .get("tags")
        .split(/[,，]/)
        .map((s) => s.trim())
        .filter(Boolean),
    };
  }
  select.onchange = () => {
    form.reset();
    current = draft.items.find((x) => x.id === select.value) || null;
    root.querySelector("#draft-preview").innerHTML = "";
    if (!current) return;
    const values = {
      kind: current.kind,
      official: String(current.official),
      jaTitle: current.title.ja,
      zhTitle: current.title.zh || "",
      jaDescription: current.description?.ja || "",
      zhDescription: current.description?.zh || "",
      source: current.source,
      sourceName: current.sourceName,
      image: current.image || "",
      imageSource: current.imageSource || "",
      date: current.date || "",
      dateLabelJa: current.dateLabel?.ja || "",
      dateLabelZh: current.dateLabel?.zh || "",
      tags: (current.tags || []).join(", "),
    };
    for (const [key, value] of Object.entries(values))
      form.elements[key].value = value;
  };
  form.onsubmit = (e) => {
    e.preventDefault();
    try {
      const item = read();
      validateCatalog({ version: 1, items: [item] });
      const index = draft.items.findIndex((x) => x.id === item.id);
      if (index >= 0) draft.items[index] = item;
      else draft.items.push(item);
      draft.updatedAt = new Date().toISOString().slice(0, 10);
      validateCatalog(draft);
      try {
        localStorage.setItem(draftKey, JSON.stringify(draft));
      } catch {
        say(
          t(
            "ブラウザーに保存できません。JSON をダウンロードしてください。",
            "浏览器无法保存，请下载 JSON 保留草稿。",
          ),
        );
        return;
      }
      mountEditor(root, catalog, { t, tr, esc, label });
      root.querySelector("#select-record").value = item.id;
      root.querySelector("#select-record").dispatchEvent(new Event("change"));
      root.querySelector("#editor-status").textContent = t(
        "下書きを保存しました。公開するには JSON を書き出してください。",
        "草稿已保存。导出 JSON 并提交到 GitHub 后才会公开。",
      );
    } catch (error) {
      say(t("保存できません：", "无法保存：") + error.message);
    }
  };
  root.querySelector("#preview-record").onclick = () => {
    if (!form.reportValidity()) return;
    try {
      const item = read();
      validateCatalog({ version: 1, items: [item] });
      root.querySelector("#draft-preview").innerHTML =
        `<article class="draft-card">${item.image ? `<img src="${import.meta.env.BASE_URL}${esc(item.image)}" alt="${esc(tr(item.title))}">` : ""}<small>${label(item.kind)} · ${item.official ? t("公式", "官方") : t("有志資料", "粉丝资料")}</small><h2>${esc(tr(item.title))}</h2><p>${esc(tr(item.description))}</p><p>${esc(item.date)} · ${esc(item.sourceName)}</p></article>`;
    } catch (error) {
      say(error.message);
    }
  };
  root.querySelector("#export-json").onclick = () => {
    try {
      validateCatalog(draft);
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(draft, null, 2) + "\n"], {
          type: "application/json",
        }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = "catalog.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      say(
        t(
          "保存した下書きを書き出しました。GitHub に反映して公開してください。",
          "已导出保存过的草稿，请提交到 GitHub 发布。",
        ),
      );
    } catch (error) {
      say(error.message);
    }
  };
  root.querySelector("#import-json").onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      if (file.size > 2_000_000) throw Error("Maximum 2 MB");
      const imported = validateCatalog(JSON.parse(await file.text()));
      draft = structuredClone(imported);
      try {
        localStorage.setItem(draftKey, JSON.stringify(draft));
      } catch {}
      mountEditor(root, catalog, { t, tr, esc, label });
      root.querySelector("#editor-status").textContent = t(
        "読み込みました。公開済みデータは変更されていません。",
        "导入完成。线上数据尚未改变。",
      );
    } catch (error) {
      say(t("読み込みエラー：", "导入错误：") + error.message);
    }
  };
}
