import {
  validateCatalog,
  KINDS,
  searchText,
  recordImages,
} from "./lib/data.js";
import {
  PAGE_TEMPLATES,
  fromTemplate,
  duplicateRecord,
} from "./lib/content-templates.js";
import {
  editorGroups,
  fieldLocation,
  emptyRow,
  removableBlock,
} from "./lib/editor-fields.js";
import {
  githubPublisher,
  changedRecords,
  changedFields,
  REPOSITORY_URL,
} from "./lib/editor-publish.js";
import { DETAILS } from "./lib/editor-schema.js";
import {
  materialize,
  getPath,
  setPath,
  entryIssues,
  validateEditorCatalog,
} from "./lib/editor-data.js";
import { imageStore, zipFiles } from "./lib/editor-assets.js";
import "./editor.css";

const key = "yoshino-editor-draft-v2";
let session,
  undo,
  pendingImages = new Map(),
  imageLoad;
const copy = (x) => structuredClone(x);
const date = () => new Date().toISOString().slice(0, 10);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const join = (a, b) => [a, b].filter((x) => x !== "").join(".");
function download(blob, name) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
export function mountEditor(
  root,
  published,
  { t, tr, esc, label, tagLabel, generated = [] },
) {
  if (!session) {
    try {
      session = JSON.parse(localStorage.getItem(key));
    } catch {}
    if (
      session?.version !== 2 ||
      !session.changes ||
      typeof session.changes !== "object" ||
      Array.isArray(session.changes)
    )
      session = {
        version: 2,
        changes: {},
        selected: published.items[0]?.id,
        tab: "basic",
      };
  }
  session.changes = Object.assign(Object.create(null), session.changes);
  let catalog = published,
    query = session.filters?.query || "",
    category = session.filters?.category || "all",
    changedOnly = session.filters?.changedOnly || false,
    working,
    descriptors = new Map(),
    previewState = null;
  const base = import.meta.env.BASE_URL,
    zh = t(false, true);
  const translated = (pair) => t(...pair);
  const currentData = () => materialize(catalog, session.changes);
  const items = () => {
    const manual = currentData().catalog.items;
    return [
      ...manual,
      ...generated.filter(
        (g) =>
          !manual.some(
            (x) =>
              x.id === g.id || (x.kind === g.kind && x.source === g.source),
          ),
      ),
    ];
  };
  const assetURL = (path) => pendingImages.get(path)?.url || `${base}${path}`;
  root.className = "studio";
  root.innerHTML = `<div class="studio-intro"><div><span class="studio-kicker">THE EDITOR'S DESK</span><p>${t("テンプレートを選んで、ページを見ながら編集。", "选择页面模板，点选预览内容就能编辑。")}</p></div><div class="studio-tools"><button type="button" data-new class="primary">＋ ${t("新しい記録", "新建条目")}</button><button type="button" data-import class="secondary">${t("読み込む", "导入资料")}</button><button type="button" data-export class="secondary">${t("変更を確認して送信", "检查并提交")} ↗</button></div></div><div class="studio-save"><span id="editor-status" role="status" aria-live="polite"></span><button type="button" data-undo hidden>${t("直前の操作を戻す", "撤销上一步操作")}</button><span data-change-count></span></div><div class="studio-layout"><aside class="studio-library"><label class="studio-search">${t("記録を探す", "查找条目")}<input type="search" data-search placeholder="${t("タイトル・歌い手・品番…", "标题、演唱者、唱片编号…")}"></label><div class="studio-library-filters"><select data-category aria-label="${t("分類を絞る", "筛选分类")}"><option value="all">${t("すべての分類", "全部分类")}</option>${KINDS.map((k) => `<option value="${k}">${label(k)}</option>`).join("")}</select><label><input type="checkbox" data-changed>${t("編集中", "已修改")}</label></div><p data-list-count class="studio-note"></p><div class="studio-records" role="list" aria-label="${t("記録の一覧", "条目列表")}"></div></aside><section class="studio-workspace"><div data-working></div></section></div><dialog class="studio-dialog" data-modal></dialog><input type="file" data-import-file accept="application/json,.json" hidden>`;
  const say = (text, error = false) => {
    const status = root.querySelector("#editor-status");
    status.textContent = text;
    status.classList.toggle("has-error", error);
    const previewStatus = root.querySelector("[data-preview-status]");
    if (previewStatus) previewStatus.textContent = text;
  };
  function persist() {
    session.filters = { query, category, changedOnly };
    try {
      localStorage.setItem(key, JSON.stringify(session));
      say(t("このブラウザーに自動保存済み", "已自动保存到此浏览器"));
    } catch {
      say(
        t(
          "保存領域が使えません。ページを閉じる前に書き出してください。",
          "浏览器存储不可用，请在关闭页面前导出保存。",
        ),
        true,
      );
    }
    root.querySelector("[data-change-count]").textContent = t(
      `${Object.keys(session.changes).length} 件の変更`,
      `${Object.keys(session.changes).length} 条修改`,
    );
    root.querySelector("[data-undo]").hidden = !undo;
    const previewUndo = root.querySelector("[data-preview-undo]");
    if (previewUndo)
      previewUndo.disabled = !undo || undo.selected !== session.selected;
  }
  function checkpoint() {
    undo = copy(session);
  }
  function remember() {
    const original = catalog.items.find((x) => x.id === working.id);
    if (same(original, working)) delete session.changes[working.id];
    else
      session.changes[working.id] = {
        base: session.changes[working.id]?.base ?? copy(original || null),
        value: copy(working),
      };
    persist();
    previewState?.sync();
  }
  function adoptCatalog(next) {
    const merged = materialize(next, session.changes);
    if (!merged.conflicts.length) {
      for (const id of Object.keys(session.changes)) {
        const original = next.items.find((x) => x.id === id);
        const value = merged.catalog.items.find((x) => x.id === id);
        if (same(original, value)) delete session.changes[id];
        else
          session.changes[id] = {
            base: copy(original || null),
            value: copy(value || null),
          };
      }
    }
    catalog = next;
    renderWorking();
    list();
    persist();
  }
  function list() {
    const rows = items().filter(
      (x) =>
        (category === "all" || x.kind === category) &&
        (!changedOnly || session.changes[x.id]) &&
        (!query ||
          searchText(x).includes(query) ||
          x.id.toLowerCase().includes(query)),
    );
    root.querySelector("[data-list-count]").textContent = t(
      `${rows.length} 件`,
      `${rows.length} 条资料`,
    );
    root.querySelector(".studio-records").innerHTML = rows.length
      ? rows
          .map(
            (x) =>
              `<button type="button" role="listitem" data-select="${esc(x.id)}" ${x.id === session.selected ? 'aria-current="true"' : ""}><span class="studio-thumb">${x.image ? `<img loading="lazy" src="${esc(assetURL(x.image))}" alt="">` : `<span>${esc(label(x.kind).slice(0, 1))}</span>`}</span><span><small>${label(x.kind)}${session.changes[x.id] ? ` · ${t("編集中", "已修改")}` : ""}</small><strong>${esc(tr(x.title) || t("タイトル未入力", "尚未填写标题"))}</strong><time>${esc(x.date || "")}</time></span></button>`,
          )
          .join("")
      : `<div class="studio-empty">${t("該当する記録はありません。", "没有找到符合条件的条目。")}</div>`;
    root.querySelectorAll("[data-select]").forEach(
      (button) =>
        (button.onclick = () => {
          session.selected = button.dataset.select;
          renderWorking();
          list();
          persist();
        }),
    );
  }
  function field(def, prefix = "") {
    const path = join(prefix, def.key),
      value = getPath(working, path),
      name = translated(def.label);
    descriptors.set(path, def);
    const attr = `data-field="${esc(path)}" data-type="${def.type}" name="${esc(path)}"`;
    const control = (type, val, extra = "") =>
      `<input type="${type}" ${attr} value="${esc(val ?? "")}" ${extra} ${def.readonly ? "readonly" : ""}>`;
    if (def.type === "localized")
      return `<fieldset class="studio-localized studio-wide" data-field-group="${esc(path)}"><legend>${esc(name)}${path === "title" ? ` <small>${t("日本語は必須", "日文必填")}</small>` : ""}</legend><div class="studio-bilingual">${["ja", "zh"].map((locale) => `<label><span>${locale === "ja" ? t("日本語", "日文") : t("简体中文 · 任意", "简体中文 · 可选")}</span>${def.long ? `<textarea rows="3" ${attr} data-locale="${locale}" lang="${locale === "ja" ? "ja" : "zh-Hans"}">${esc(typeof value === "string" ? (locale === "ja" ? value : "") : value?.[locale] || "")}</textarea>` : `<input ${attr} data-locale="${locale}" lang="${locale === "ja" ? "ja" : "zh-Hans"}" value="${esc(typeof value === "string" ? (locale === "ja" ? value : "") : value?.[locale] || "")}">`}</label>`).join("")}</div>${path === "description" ? `<p class="studio-hint">${t("雰囲気や見どころを短く。作詞・作曲、数値やメンバーは詳細情報へ。", "用一两句话介绍气质或看点；制作名单、数值和成员请填在详细资料中。")}</p>` : ""}</fieldset>`;
    if (def.type === "rows")
      return `<div class="studio-rows studio-wide" data-rows="${esc(path)}"><div class="studio-row-heading"><h3>${esc(name)} <small>${value?.length || 0}</small></h3><button type="button" data-add="${esc(path)}" ${path === "gallery" && value?.length >= 10 ? "disabled" : ""}>＋ ${t("追加", "添加")}</button></div>${(value || []).map((row, i) => `<fieldset class="studio-row" data-row="${esc(path)}.${i}"><legend>${esc(name)} ${String(i + 1).padStart(2, "0")}</legend><div class="studio-row-actions"><button type="button" data-move="${esc(path)}" data-index="${i}" data-direction="-1" ${!i ? "disabled" : ""} aria-label="${t("上へ", "上移")}">↑</button><button type="button" data-move="${esc(path)}" data-index="${i}" data-direction="1" ${i === value.length - 1 ? "disabled" : ""} aria-label="${t("下へ", "下移")}">↓</button><button type="button" data-remove="${esc(path)}" data-index="${i}">${t("削除", "移除")}</button></div><div class="studio-fields">${def.fields.map((d) => field(d, `${path}.${i}`)).join("")}</div></fieldset>`).join("")}${!value?.length ? `<p class="studio-hint">${t("必要なときに追加できます。", "需要时点击添加。")}</p>` : ""}</div>`;
    if (def.type === "image")
      return `<div class="studio-image-field studio-wide" data-field-group="${esc(path)}"><strong>${esc(name)}</strong><details class="studio-image-path"><summary>${t("画像のパスを指定", "手动指定图片地址")}</summary><label>${esc(name)}${control("text", value, 'placeholder="assets/example.jpg"')}</label></details><div class="studio-image-choice"><div class="studio-image-preview" data-image-for="${esc(path)}">${value ? `<img src="${esc(assetURL(value))}" alt="${esc(name)}">` : `<span>${t("画像なし", "暂无图片")}</span>`}</div><div><button type="button" data-pick-image="${esc(path)}">${t("画像ライブラリ", "从素材库选择")}</button><button type="button" data-upload-image="${esc(path)}">${t("画像をアップロード", "上传新图片")}</button><p class="studio-hint">${t("PNG / JPG / WebP（スタンプは GIF も可）・8 MBまで。新しい画像は公開用パッケージに同梱します。", "PNG / JPG / WebP（贴纸另支持 GIF），最大 8 MB。新图片会随发布包一起导出。")}</p></div></div></div>`;
    if (def.type === "relations")
      return `<div class="studio-wide" data-field-group="${esc(path)}"><h3>${esc(name)}</h3><div class="studio-linked">${(
        value || []
      )
        .map((id) => {
          const entry = items().find((x) => x.id === id);
          return `<span>${esc(entry ? tr(entry.title) : id)}<button type="button" data-unlink="${esc(id)}" aria-label="${t("関連を外す", "移除关联")}">×</button></span>`;
        })
        .join(
          "",
        )}</div><button type="button" data-pick-relations>${t("記録を選ぶ", "选择关联条目")} ＋</button><p class="studio-hint">${t("曲名などの共通キーワードでも、関連ページがつながります。", "共同的曲名或活动名也会用于匹配相关资料。")}</p></div>`;
    if (def.type === "relation")
      return `<label>${esc(name)}<select ${attr}><option value="">${t("指定なし", "不指定")}</option>${items()
        .filter((x) => x.id !== working.id)
        .map(
          (x) =>
            `<option value="${esc(x.id)}" ${x.id === value ? "selected" : ""}>${esc(tr(x.title))}</option>`,
        )
        .join("")}</select></label>`;
    if (def.type === "kind")
      return `<label>${esc(name)}<select ${attr}>${KINDS.map((k) => `<option value="${k}" ${k === value ? "selected" : ""}>${label(k)}</option>`).join("")}</select></label>`;
    if (def.type === "boolean")
      return `<label>${esc(name)}<select ${attr}><option value="false" ${!value ? "selected" : ""}>${t("ファン投稿・データベース", "粉丝投稿／资料库")}</option><option value="true" ${value ? "selected" : ""}>${t("公式", "官方")}</option></select></label>`;
    if (["textarea", "lines"].includes(def.type))
      return `<label class="${def.type === "textarea" ? "studio-wide" : ""}">${esc(name)}<textarea rows="3" ${attr}>${esc(Array.isArray(value) ? value.join("\n") : value || "")}</textarea>${def.type === "lines" ? `<small>${t("1行に1つ入力", "每行填写一项")}</small>` : ""}</label>`;
    if (def.type === "tags")
      return `<div class="studio-wide"><label>${esc(name)}${control("text", (value || []).join(", "), `placeholder="${t("カンマ区切り", "用逗号分隔")}"`)}</label><div class="studio-tag-suggestions">${({ cards: ["SSR", "SR", "deresute", "limited", "event"], songs: ["solo", "unit", "cover", "deresute"], stories: ["story", "event", "business", "memory", "zh"], videos: ["youtube", "bilibili", "mv", "live", "zh"], news: ["goods", "music", "live"], units: ["unit"], timeline: ["birthday", "music", "event"] }[working.kind] || []).map((tag) => `<button type="button" data-tag="${tag}" aria-pressed="${value?.includes(tag) || false}">${esc(tagLabel?.(tag) || tag)}</button>`).join("")}</div></div>`;
    return `<label data-field-group="${esc(path)}">${esc(name)}${control(["url", "date", "number"].includes(def.type) ? def.type : "text", value, `${def.type === "number" ? 'min="0" step="1"' : ""} ${def.options ? `list="choices-${esc(path)}"` : ""}`)}${def.hint ? `<small>${esc(translated(def.hint))}</small>` : ""}${def.options ? `<datalist id="choices-${esc(path)}">${def.options.map((x) => `<option>${esc(x)}</option>`).join("")}</datalist>` : ""}</label>`;
  }
  function blocks(defs) {
    return defs
      .filter((b) => !b.game || b.game === (working.game || "deresute"))
      .map(
        (b, i) =>
          `<details class="studio-block" ${!b.folded ? "open" : ""}><summary>${esc(translated(b.label))}</summary>${removableBlock(b, working) ? `<div class="studio-block-toolbar"><button type="button" data-clear-block="${removableBlock(b, working)}">${t("この部分を取り除く", "移除此部分")}</button></div>` : ""}<div class="studio-fields">${b.fields.map((d) => field(d)).join("")}</div></details>`,
      )
      .join("");
  }
  const tabs = () => [
    ["basic", t("基本", "基本信息")],
    ...((DETAILS[working.kind] || []).length
      ? [["details", t("詳細", "专属资料")]]
      : []),
    ["body", t("本文", "详细正文")],
    ["images", t("画像", "图片")],
    ["related", t("関連", "关联")],
    ["advanced", t("管理", "管理")],
  ];
  function renderWorking() {
    if (previewState) closeModal();
    working = items().find((x) => x.id === session.selected);
    if (!working) {
      session.selected = items()[0]?.id;
      working = items()[0];
    }
    const host = root.querySelector("[data-working]");
    if (!working) {
      host.innerHTML = `<div class="studio-empty">${t("新しい記録を追加しましょう。", "点击新建条目，开始填写资料。")}</div>`;
      return;
    }
    if (!tabs().some(([id]) => id === session.tab)) session.tab = "basic";
    const conflict = currentData().conflicts.find((c) => c.id === working.id);
    host.innerHTML = `<div class="studio-document-head"><div><small>${label(working.kind)}</small><h2 data-edit-title>${esc(tr(working.title) || t("新しい記録", "新条目"))}</h2></div><button type="button" data-editor-preview class="primary">${t("見ながら編集", "边看边编辑")} ↗</button></div>${conflict ? `<div class="studio-conflict"><strong>${t("公開データにも変更があります", "线上同一处资料也有更新")}</strong><p>${esc(conflict.paths.join(" · "))}</p><button data-resolve="local">${t("自分の編集を使う", "保留我的修改")}</button><button data-resolve="remote">${t("公開中の内容を使う", "使用线上版本")}</button></div>` : ""}<div class="studio-tabs" role="tablist" aria-label="${t("編集項目", "编辑分组")}">${tabs()
      .map(
        ([id, name]) =>
          `<button type="button" role="tab" id="edit-tab-${id}" aria-controls="edit-panel" data-tab="${id}" aria-selected="${session.tab === id}" tabindex="${session.tab === id ? 0 : -1}">${name}</button>`,
      )
      .join(
        "",
      )}</div><form id="record-form" novalidate><div id="edit-panel" role="tabpanel" aria-labelledby="edit-tab-${session.tab}" tabindex="0"></div></form><div class="studio-action-rail"><button type="button" data-preview-bottom>${t("見ながら編集", "边看边编辑")}</button><button type="button" data-export-bottom class="primary">${t("変更を確認して送信", "检查并提交")} ↗</button></div><div class="studio-document-actions"><button type="button" data-duplicate>${t("複製して新規作成", "复制为新条目")}</button><button type="button" data-reset>${t("この記録の編集を戻す", "还原此条修改")}</button><button type="button" data-delete class="studio-danger">${t("記録を削除", "删除条目")}</button></div>`;
    renderPanel();
    host.querySelectorAll("[data-tab]").forEach((button) => {
      button.onclick = () => {
        session.tab = button.dataset.tab;
        renderWorking();
        persist();
        root
          .querySelector(`[data-tab="${session.tab}"]`)
          .focus({ preventScroll: true });
      };
      button.onkeydown = (event) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
          return;
        event.preventDefault();
        const buttons = [...host.querySelectorAll("[data-tab]")],
          i = buttons.indexOf(button);
        buttons[
          event.key === "Home"
            ? 0
            : event.key === "End"
              ? buttons.length - 1
              : (i + (event.key === "ArrowRight" ? 1 : -1) + buttons.length) %
                buttons.length
        ].click();
      };
    });
    host.querySelector("[data-editor-preview]").onclick = preview;
    host.querySelector("[data-preview-bottom]").onclick = preview;
    host.querySelector("[data-export-bottom]").onclick = () =>
      root.querySelector("[data-export]").click();
    host.querySelector("[data-duplicate]").onclick = () => {
      checkpoint();
      working = duplicateRecord(working);
      session.selected = working.id;
      remember();
      renderWorking();
      list();
    };
    host.querySelector("[data-reset]").onclick = () => {
      checkpoint();
      delete session.changes[working.id];
      renderWorking();
      list();
      persist();
    };
    host.querySelector("[data-delete]").onclick = removeRecord;
    host.querySelectorAll("[data-resolve]").forEach(
      (button) =>
        (button.onclick = () => {
          checkpoint();
          const id = working.id;
          if (button.dataset.resolve === "remote") delete session.changes[id];
          else
            session.changes[id] = {
              base: copy(catalog.items.find((x) => x.id === id) || null),
              value: copy(working),
            };
          renderWorking();
          list();
          persist();
        }),
    );
    host.querySelector("form").onsubmit = (event) => {
      event.preventDefault();
      preview();
    };
  }
  function renderPanel() {
    descriptors = new Map();
    const defs = editorGroups(working)[session.tab] || [];
    const panel = root.querySelector("#edit-panel");
    panel.innerHTML =
      blocks(defs) +
      (session.tab === "advanced"
        ? `<details class="studio-block studio-raw"><summary>${t("詳細な JSON を編集", "高级 JSON 编辑")}</summary><p class="studio-hint">${t("通常は上のフォームだけで編集できます。ID は固定です。", "日常更新使用表单即可；此处用于扩展字段，条目 ID 保持固定。")}</p><textarea data-raw spellcheck="false" rows="18" aria-label="JSON">${esc(session.rawDrafts?.[working.id] ?? JSON.stringify(working, null, 2))}</textarea><button type="button" data-apply-raw>${t("JSON を適用", "应用 JSON")}</button><button type="button" data-discard-raw>${t("JSON の編集を取り消す", "放弃 JSON 修改")}</button><p data-raw-status role="status"></p></details>`
        : "");
    panel.querySelectorAll("[data-field]").forEach((input) => {
      input.addEventListener("input", () => {
        if (input.readOnly) return;
        const path = input.dataset.field,
          kind = input.dataset.type;
        let value = input.value;
        if (input.dataset.locale) {
          const prev = getPath(working, path);
          value = {
            ...(typeof prev === "string" ? { ja: prev } : prev || {}),
            [input.dataset.locale]: value,
          };
        } else if (kind === "number")
          value = input.value === "" ? undefined : Number(input.value);
        else if (kind === "boolean") value = input.value === "true";
        else if (["lines", "tags"].includes(kind))
          value = input.value
            .split(kind === "lines" ? /\n/ : /[,，]/)
            .map((s) => s.trim())
            .filter(Boolean);
        setPath(working, path, value);
        if (/^card\.stats\.\d+\.(vocal|dance|visual)$/.test(path)) {
          const parent = path.split(".").slice(0, -1).join("."),
            stats = getPath(working, parent);
          stats.total =
            (stats.vocal || 0) + (stats.dance || 0) + (stats.visual || 0);
          panel.querySelector(`[data-field="${parent}.total"]`).value =
            stats.total;
        }
        remember();
        if (path === "kind") {
          renderWorking();
          list();
        }
        if (path === "title")
          root.querySelector("[data-edit-title]").textContent =
            tr(working.title) || t("新しい記録", "新条目");
        if (kind === "image")
          panel.querySelector(`[data-image-for="${path}"]`).innerHTML = value
            ? `<img src="${esc(assetURL(value))}" alt="">`
            : "";
        input.removeAttribute("aria-invalid");
      });
      input.addEventListener("change", () => {
        if (input.dataset.field === "game") renderPanel();
        list();
      });
    });
    panel.querySelectorAll("[data-clear-block]").forEach(
      (button) =>
        (button.onclick = () => {
          checkpoint();
          setPath(working, button.dataset.clearBlock, undefined);
          remember();
          renderPanel();
        }),
    );
    panel.querySelectorAll("[data-add]").forEach(
      (button) =>
        (button.onclick = () => {
          checkpoint();
          const path = button.dataset.add,
            definition = descriptors.get(path),
            rows = getPath(working, path) || [],
            seed = emptyRow(definition);
          if (path.endsWith("tracks")) seed.number = rows.length + 1;
          rows.push(seed);
          setPath(working, path, rows);
          remember();
          renderPanel();
          const row = root.querySelector(
            `[data-row="${path}.${rows.length - 1}"]`,
          );
          row?.querySelector("input,textarea")?.focus();
        }),
    );
    panel.querySelectorAll("[data-remove],[data-move]").forEach(
      (button) =>
        (button.onclick = () => {
          checkpoint();
          const path = button.dataset.remove || button.dataset.move,
            rows = getPath(working, path),
            index = Number(button.dataset.index);
          if (button.dataset.remove) rows.splice(index, 1);
          else {
            const other = index + Number(button.dataset.direction);
            [rows[index], rows[other]] = [rows[other], rows[index]];
          }
          remember();
          renderPanel();
        }),
    );
    panel.querySelectorAll("[data-tag]").forEach(
      (button) =>
        (button.onclick = () => {
          const tag = button.dataset.tag;
          working.tags ||= [];
          working.tags = working.tags.includes(tag)
            ? working.tags.filter((x) => x !== tag)
            : [...working.tags, tag];
          remember();
          renderPanel();
        }),
    );
    panel.querySelectorAll("[data-unlink]").forEach(
      (button) =>
        (button.onclick = () => {
          checkpoint();
          working.relatedIds = working.relatedIds.filter(
            (id) => id !== button.dataset.unlink,
          );
          remember();
          renderPanel();
        }),
    );
    panel
      .querySelector("[data-pick-relations]")
      ?.addEventListener("click", pickRelations);
    panel
      .querySelectorAll("[data-pick-image]")
      .forEach((b) => (b.onclick = () => pickImage(b.dataset.pickImage)));
    panel
      .querySelectorAll("[data-upload-image]")
      .forEach((b) => (b.onclick = () => uploadImage(b.dataset.uploadImage)));
    panel.querySelector("[data-raw]")?.addEventListener("input", (event) => {
      session.rawDrafts ||= Object.create(null);
      session.rawDrafts[working.id] = event.target.value;
      persist();
      say(
        t(
          "JSON の編集は一時保存済み。適用してから書き出してください。",
          "JSON 修改已暂存，应用后才会计入导出。",
        ),
      );
    });
    panel.querySelector("[data-discard-raw]")?.addEventListener("click", () => {
      if (session.rawDrafts) delete session.rawDrafts[working.id];
      persist();
      renderPanel();
    });
    panel.querySelector("[data-apply-raw]")?.addEventListener("click", () => {
      try {
        const value = JSON.parse(panel.querySelector("[data-raw]").value);
        validateEditorCatalog({ version: 1, items: [value] });
        if (value.id !== working.id)
          throw Error(t("ID は変更できません", "不能修改条目 ID"));
        checkpoint();
        working = value;
        if (session.rawDrafts) delete session.rawDrafts[working.id];
        remember();
        renderWorking();
        list();
      } catch (error) {
        panel.querySelector("[data-raw-status]").textContent = error.message;
      }
    });
  }
  const baseModal = root.querySelector("[data-modal]");
  let modal = baseModal;
  const dialogStack = [];
  let returnFocus;
  function closeModal() {
    const restoredPreview = modal === baseModal && !!previewState;
    if (restoredPreview) {
      const state = previewState;
      previewState = null;
      state.cleanup();
      root
        .querySelector(".studio-action-rail")
        .before(modal.querySelector("#record-form"));
    }
    modal.close();
    modal.innerHTML = "";
    if (dialogStack.length) {
      modal.remove();
      ({ modal, returnFocus } = dialogStack.pop());
    }
    if (restoredPreview) {
      renderWorking();
      list();
    }
    returnFocus?.isConnected && returnFocus.focus({ preventScroll: true });
  }
  function openModal(title, html, cls = "") {
    if (previewState && modal === baseModal) {
      dialogStack.push({ modal, returnFocus: document.activeElement });
      modal = document.createElement("dialog");
      root.append(modal);
    }
    returnFocus = document.activeElement;
    modal.className = `studio-dialog ${cls}`;
    modal.innerHTML = `<div class="studio-modal-head"><h2>${esc(title)}</h2><button type="button" data-close aria-label="${t("閉じる", "关闭")}">×</button></div>${html}`;
    modal.querySelector("[data-close]").onclick = closeModal;
    modal.oncancel = (event) => {
      event.preventDefault();
      closeModal();
    };
    if (!modal.open) modal.showModal();
  }
  function pickRelations() {
    openModal(
      t("関連する記録を選ぶ", "选择关联条目"),
      `<input type="search" data-modal-search aria-label="${t("記録を検索", "搜索条目")}" placeholder="${t("タイトルを検索", "搜索标题")}"><div class="studio-picker-list"></div><button type="button" data-done class="primary">${t("完了", "完成")}</button>`,
    );
    const draw = () => {
      const q = modal.querySelector("[data-modal-search]").value.toLowerCase();
      modal.querySelector(".studio-picker-list").innerHTML = items()
        .filter((x) => x.id !== working.id && searchText(x).includes(q))
        .map(
          (x) =>
            `<label class="studio-pick-record"><input type="checkbox" data-related="${esc(x.id)}" ${working.relatedIds?.includes(x.id) ? "checked" : ""}>${x.image ? `<img loading="lazy" src="${esc(assetURL(x.image))}" alt="">` : ""}<span><small>${label(x.kind)}</small>${esc(tr(x.title))}</span></label>`,
        )
        .join("");
      modal.querySelectorAll("[data-related]").forEach(
        (box) =>
          (box.onchange = () => {
            working.relatedIds = (working.relatedIds || []).filter(
              (id) => id !== box.dataset.related,
            );
            if (box.checked) working.relatedIds.push(box.dataset.related);
            remember();
            renderPanel();
          }),
      );
    };
    modal.querySelector("[data-modal-search]").oninput = draw;
    modal.querySelector("[data-done]").onclick = closeModal;
    draw();
  }
  function chooseImage(path, art) {
    checkpoint();
    setPath(working, path, art.image);
    if (art.imageSource)
      setPath(working, path.replace(/image$/, "imageSource"), art.imageSource);
    remember();
    renderPanel();
    list();
  }
  async function pickImage(path) {
    openModal(
      t("画像ライブラリ", "素材库"),
      `<input type="search" data-modal-search aria-label="${t("画像を検索", "搜索图片")}" placeholder="${t("タイトル・ファイル名", "条目标题或文件名")}"><div class="studio-asset-grid"></div>`,
    );
    const library = new Map();
    for (const entry of items())
      for (const art of recordImages(entry))
        if (art.image)
          library.set(art.image, { ...art, name: tr(entry.title) });
    for (const [image, art] of pendingImages)
      library.set(image, { image, name: art.name });
    const draw = () => {
      if (!modal.open || !modal.querySelector(".studio-asset-grid")) return;
      const q = modal.querySelector("[data-modal-search]").value.toLowerCase();
      modal.querySelector(".studio-asset-grid").innerHTML = [
        ...library.values(),
      ]
        .filter(
          (a) =>
            (path.startsWith("profile.stickers.") ||
              !a.image.endsWith(".gif")) &&
            `${a.name} ${a.image}`.toLowerCase().includes(q),
        )
        .map(
          (a) =>
            `<button type="button" data-asset="${esc(a.image)}"><img loading="lazy" src="${esc(assetURL(a.image))}" alt=""><strong>${esc(a.name || a.image)}</strong><small>${esc(a.image)}</small></button>`,
        )
        .join("");
      modal.querySelectorAll("[data-asset]").forEach(
        (b) =>
          (b.onclick = () => {
            chooseImage(path, library.get(b.dataset.asset));
            closeModal();
          }),
      );
    };
    modal.querySelector("[data-modal-search]").oninput = draw;
    draw();
    try {
      const response = await fetch(`${base}assets/manifest.json`);
      for (const art of await response.json())
        if (
          !library.has(art.image) &&
          /^assets\/[\w.-]+\.(png|jpg|jpeg|webp|gif)$/.test(art.image)
        )
          library.set(art.image, art);
      draw();
    } catch {}
  }
  async function uploadImage(path) {
    const input = document.createElement("input");
    input.type = "file";
    const formats = [
      "image/png",
      "image/jpeg",
      "image/webp",
      ...(path.startsWith("profile.stickers.") ? ["image/gif"] : []),
    ];
    input.accept = formats.join(",");
    input.onchange = async () => {
      const file = input.files[0];
      if (!file) return;
      try {
        if (!formats.includes(file.type) || file.size > 8_000_000)
          throw Error(
            t(
              "PNG / JPG / WebP、8 MB以内の画像を選んでください。",
              "请选择 8 MB 以内的 PNG / JPG / WebP 图片。",
            ),
          );
        const checkURL = URL.createObjectURL(file);
        try {
          const check = new Image();
          check.src = checkURL;
          await check.decode();
          if (!check.naturalWidth)
            throw Error(t("画像を読み込めません", "无法读取图片"));
        } finally {
          URL.revokeObjectURL(checkURL);
        }
        const extension = {
            "image/png": "png",
            "image/jpeg": "jpg",
            "image/webp": "webp",
            "image/gif": "gif",
          }[file.type],
          image = `assets/upload-${crypto.randomUUID()}.${extension}`;
        const stored = { path: image, name: file.name, blob: file };
        await imageStore("put", stored);
        pendingImages.set(image, { ...stored, url: URL.createObjectURL(file) });
        chooseImage(path, { image });
      } catch (error) {
        say(
          t("画像を保存できません：", "图片保存失败：") +
            (error?.message || t("画像を選び直してください", "请重新选择图片")),
          true,
        );
      }
    };
    input.click();
  }
  function preview() {
    const form = root.querySelector("#record-form");
    openModal(
      t("見ながら編集", "边看边编辑"),
      `<div class="studio-preview-controls"><div><button type="button" data-preview-lang="ja">日本語</button><button type="button" data-preview-lang="zh">简体中文</button></div><div><button type="button" data-preview-width="1280">${t("PC", "电脑")}</button><button type="button" data-preview-width="768">${t("タブレット", "平板")}</button><button type="button" data-preview-width="390">${t("スマートフォン", "手机")}</button></div><label><input type="checkbox" data-preview-select checked>${t("クリックして編集", "点选内容修改")}</label><button type="button" data-preview-undo ${!undo || undo.selected !== session.selected ? "disabled" : ""}>${t("操作を戻す", "撤销操作")}</button><button type="button" data-preview-publish class="primary">${t("変更を確認して送信", "检查并提交")}</button></div><div class="studio-visual-layout"><div class="studio-preview-stage"><iframe data-live-preview title="${t("公開ページのプレビュー", "主站页面实时预览")}"></iframe></div><aside class="studio-preview-fields"><p class="studio-note">${t("ページ上の文章や画像を選ぶと、ここで編集できます。", "点击预览中的文字或图片，在这里修改，页面会实时更新。")}</p><label>${t("編集する内容", "编辑内容")}<select data-preview-group>${tabs()
        .map(([id, name]) => `<option value="${id}">${name}</option>`)
        .join(
          "",
        )}</select></label><p data-preview-status role="status">${t("ページを読み込み中…", "正在加载主站预览…")}</p><div data-preview-fields></div></aside></div>`,
      "studio-preview studio-live",
    );
    const dialog = modal,
      frame = dialog.querySelector("iframe"),
      stage = frame.parentElement;
    dialog.querySelector("[data-preview-fields]").append(form);
    dialog.querySelector("[data-preview-group]").value = session.tab;
    let locale = zh ? "zh" : "ja",
      timer,
      ready = false,
      width = 1280;
    const status = (message) => {
      dialog.querySelector("[data-preview-status]").textContent = message;
    };
    const send = () => {
      if (!ready || !frame.isConnected) return;
      frame.contentWindow.postMessage(
        {
          type: "yoshino:preview",
          catalog: currentData().catalog,
          id: working.id,
          locale,
          images: Object.fromEntries(
            [...pendingImages].map(([path, art]) => [path, art.url]),
          ),
          select: dialog.querySelector("[data-preview-select]").checked,
        },
        location.origin,
      );
      dialog
        .querySelectorAll("[data-preview-lang]")
        .forEach((b) =>
          b.setAttribute(
            "aria-pressed",
            String(b.dataset.previewLang === locale),
          ),
        );
    };
    const resize = () => {
      const scale = Math.min(1, stage.clientWidth / width);
      frame.style.width = `${width}px`;
      frame.style.height = `${stage.clientHeight / scale}px`;
      frame.style.transform = `scale(${scale})`;
      dialog
        .querySelectorAll("[data-preview-width]")
        .forEach((b) =>
          b.setAttribute(
            "aria-pressed",
            String(Number(b.dataset.previewWidth) === width),
          ),
        );
    };
    const receive = (event) => {
      if (
        event.origin !== location.origin ||
        event.source !== frame.contentWindow
      )
        return;
      if (event.data?.type === "yoshino:preview-ready") {
        ready = true;
        send();
      }
      if (event.data?.type === "yoshino:rendered")
        status(
          t(
            "自動保存済み · 公開前のプレビュー",
            "已自动保存 · 当前为发布前预览",
          ),
        );
      if (event.data?.type === "yoshino:preview-error")
        status(
          t(
            "未入力の項目をフォームで補ってください。",
            "请在表单中补充尚未填写的内容。",
          ),
        );
      if (event.data?.type !== "yoshino:select-field") return;
      const path = event.data.path;
      if (typeof path !== "string") return;
      const fieldInfo = fieldLocation(working, path);
      if (!fieldInfo) return;
      session.tab = fieldInfo.tab;
      dialog.querySelector("[data-preview-group]").value = session.tab;
      renderPanel();
      persist();
      const escaped = CSS.escape(path);
      const target =
        form.querySelector(
          `[data-field="${escaped}"][data-locale="${locale}"]`,
        ) ||
        form.querySelector(
          `[data-field="${escaped}"], [data-rows="${escaped}"], [data-field-group="${escaped}"]`,
        ) ||
        [...form.querySelectorAll("[data-field]")].find((el) =>
          el.dataset.field.startsWith(path + "."),
        );
      if (target) {
        for (let el = target; el && el !== form; el = el.parentElement)
          if (el.tagName === "DETAILS") el.open = true;
        target.scrollIntoView({ block: "center" });
        (target.matches("input,textarea,select")
          ? target
          : target.querySelector("input,textarea,button")
        )?.focus({ preventScroll: true });
      }
    };
    const observer = new ResizeObserver(resize);
    observer.observe(stage);
    window.addEventListener("message", receive);
    previewState = {
      sync() {
        clearTimeout(timer);
        timer = setTimeout(send, 180);
      },
      cleanup() {
        clearTimeout(timer);
        window.removeEventListener("message", receive);
        observer.disconnect();
      },
    };
    dialog.querySelectorAll("[data-preview-lang]").forEach(
      (b) =>
        (b.onclick = () => {
          locale = b.dataset.previewLang;
          send();
        }),
    );
    dialog.querySelectorAll("[data-preview-width]").forEach(
      (b) =>
        (b.onclick = () => {
          width = Number(b.dataset.previewWidth);
          resize();
        }),
    );
    dialog.querySelector("[data-preview-select]").onchange = send;
    dialog.querySelector("[data-preview-group]").onchange = (event) => {
      session.tab = event.target.value;
      renderPanel();
      persist();
    };
    dialog.querySelector("[data-preview-undo]").onclick = () => {
      if (!undo || undo.selected !== session.selected) return;
      session = undo;
      undo = null;
      working = items().find((x) => x.id === session.selected);
      dialog.querySelector("[data-preview-group]").value = session.tab;
      renderPanel();
      list();
      persist();
      previewState.sync();
    };
    dialog.querySelector("[data-preview-publish]").onclick = () => {
      closeModal();
      exportDraft();
    };
    const route =
      working.kind === "profile" ? "profile" : `entry/${working.id}`;
    frame.src = `${base}?studio-preview=1#${route}`;
    resize();
  }
  async function removeRecord() {
    const references = items().filter(
      (x) =>
        x.id !== working.id &&
        (x.relatedIds?.includes(working.id) ||
          x.story?.chapters?.some((c) => c.entryId === working.id)),
    );
    let listening;
    try {
      listening = await (
        await fetch(`${base}data/listening.json`, {
          signal: AbortSignal.timeout(5000),
        })
      ).json();
    } catch {
      say(
        t(
          "試聴の参照を確認できません。時間をおいて再試行してください。",
          "暂时无法检查试听关联，请稍后重试删除。",
        ),
        true,
      );
      return;
    }
    if (references.length || listening.tracks?.[working.id]) {
      openModal(
        t("この記録は使われています", "此条目正在被引用"),
        `<p>${t("削除する前に関連を外してください。", "删除前请先移除这些关联。")}</p><ul>${references.map((x) => `<li>${esc(tr(x.title))}</li>`).join("")}${listening.tracks?.[working.id] ? `<li>${t("歌曲試聴の設定（config/listening.json）", "歌曲试听配置（config/listening.json）")}</li>` : ""}</ul>`,
      );
      return;
    }
    openModal(
      t("記録を削除", "删除条目"),
      `<p>${esc(tr(working.title))}</p><p>${t("公開前なら直前の操作を戻せます。", "删除先保存在本地，可以撤销。")}</p><button type="button" data-confirm-delete class="primary">${t("下書きから削除", "从草稿中删除")}</button>`,
    );
    modal.querySelector("[data-confirm-delete]").onclick = () => {
      checkpoint();
      const id = working.id,
        original = catalog.items.find((x) => x.id === id);
      if (original) session.changes[id] = { base: copy(original), value: null };
      else delete session.changes[id];
      closeModal();
      renderWorking();
      list();
      persist();
    };
  }
  function showIssues(issues) {
    openModal(
      t("書き出す前に確認", "导出前检查"),
      `<p>${t(`${issues.length} か所を確認してください。項目を押すと編集できます。`, `有 ${issues.length} 处需要补充或修正，点击即可定位。`)}</p><div class="studio-issue-list">${issues.map((issue, i) => `<button type="button" data-issue="${i}"><strong>${esc(tr(items().find((x) => x.id === issue.id)?.title) || issue.id)}</strong><span>${esc(issue.message)}</span></button>`).join("")}</div>`,
    );
    modal.querySelectorAll("[data-issue]").forEach(
      (b) =>
        (b.onclick = () => {
          const issue = issues[Number(b.dataset.issue)];
          session.selected = issue.id;
          session.tab =
            fieldLocation(
              items().find((x) => x.id === issue.id) || working,
              issue.path,
            )?.tab || "basic";
          closeModal();
          renderWorking();
          list();
          const inputs = [...root.querySelectorAll("[data-field]")],
            input =
              inputs.find((x) => x.dataset.field === issue.path) ||
              inputs.find((x) => issue.path.startsWith(x.dataset.field)) ||
              inputs.find((x) => x.dataset.field.startsWith(issue.path + "."));
          if (input) {
            for (let p = input.parentElement; p; p = p.parentElement)
              if (p.tagName === "DETAILS") p.open = true;
            input.setAttribute("aria-invalid", "true");
            input.focus();
          }
          persist();
        }),
    );
  }
  function publicationMessage(error) {
    return (
      {
        authentication: t(
          "接続キーを確認してください。期限切れの場合は作り直してください。",
          "连接密钥无效或已过期，请重新创建。",
        ),
        permission: t(
          "YoshinoDB の Contents と Pull requests の書き込み権限が必要です。",
          "请确认对 YoshinoDB 的 Contents 和 Pull requests 有写入权限。",
        ),
        network: t(
          "通信が途切れました。同じボタンで再試行できます。",
          "网络连接中断，可点击原按钮重试。",
        ),
        conflict: t(
          "公開データにも変更があります。重複箇所を選んでから再確認してください。",
          "线上同一处资料也有修改，请先处理冲突再提交。",
        ),
        stale: t(
          "確認後に main が更新されました。この画面を閉じ、もう一度変更を確認してください。",
          "确认后主站又有更新，请关闭此窗口并重新检查修改。",
        ),
        unchanged: t(
          "この変更はすでに公開データに反映されています。",
          "这些修改已包含在 GitHub 最新资料中，无需重复提交。",
        ),
        validation: t(
          "未入力の項目があります。フォームを確認してください。",
          "有未完成或无效字段，请返回表单检查。",
        ),
        image: t(
          "画像を選び直してください。",
          "图片格式或大小不正确，请重新选择。",
        ),
      }[error.code] ||
      t(
        "GitHub への送信に失敗しました。接続・権限を確認するか、公開用 ZIP を保存してください。",
        "GitHub 提交失败，请检查连接与权限，或使用发布包导出。",
      )
    );
  }
  function renderChangeReview(changes) {
    const value = (v) => {
      if (v === undefined || v === null || v === "")
        return t("（なし）", "（空）");
      if (typeof v === "boolean")
        return v ? t("はい", "是") : t("いいえ", "否");
      if (Array.isArray(v)) return v.map(value).join(" · ");
      if (typeof v === "object") return Object.values(v).map(value).join(" / ");
      return String(v);
    };
    return `<div class="studio-review-list">${changes
      .map((change) => {
        const item = change.after || change.before;
        const action = {
          add: t("追加", "新增"),
          edit: t("編集", "修改"),
          delete: t("削除", "删除"),
        }[change.action];
        return `<details><summary><span>${action}</span> ${esc(tr(item.title))} <small>${label(item.kind)}</small></summary><dl>${changedFields(
          change.before || {},
          change.after || {},
        )
          .filter((x) => x.path !== "id")
          .map((field) => {
            const location = fieldLocation(item, field.path);
            const name = location
              ? translated(location.field.label)
              : t("追加情報", "补充信息");
            return `<div><dt>${esc(name)}${/\.ja$/.test(field.path) ? " · 日本語" : /\.zh$/.test(field.path) ? " · 简体中文" : ""}</dt><dd><del>${esc(value(field.before))}</del><ins>${esc(value(field.after))}</ins></dd></div>`;
          })
          .join("")}</dl></details>`;
      })
      .join("")}</div>`;
  }
  async function exportDraft() {
    const exportButton = root.querySelector("[data-export]");
    exportButton.disabled = true;
    try {
      say(t("公開データと入力内容を確認中…", "正在检查最新资料与填写内容…"));
      try {
        const response = await fetch(`${base}data/catalog.json`, {
          cache: "no-store",
          signal: AbortSignal.timeout(5000),
        });
        if (response.ok) adoptCatalog(validateCatalog(await response.json()));
      } catch {}
      const rawId = Object.keys(session.rawDrafts || {}).find((id) =>
        items().some((x) => x.id === id),
      );
      if (rawId) {
        session.selected = rawId;
        session.tab = "advanced";
        renderWorking();
        root.querySelector(".studio-raw").open = true;
        root.querySelector("[data-raw]").focus();
        say(
          t(
            "書き出す前に JSON の編集を適用するか取り消してください。",
            "请先应用或放弃暂存的 JSON 修改，再导出。",
          ),
          true,
        );
        return;
      }
      const result = currentData();
      if (result.conflicts.length) {
        session.selected = result.conflicts[0].id;
        renderWorking();
        list();
        say(
          t(
            "公開データとの重複する変更を選んでください。",
            "请先处理与线上资料重复修改的部分。",
          ),
          true,
        );
        return;
      }
      const ids = new Set(items().map((x) => x.id)),
        issues = result.catalog.items.flatMap((x) => entryIssues(x, ids, zh));
      if (issues.length) {
        showIssues(issues);
        return;
      }
      validateEditorCatalog(result.catalog);
      await imageLoad;
      const used = new Set(
        result.catalog.items
          .flatMap((x) => recordImages(x).map((art) => art.image))
          .filter(Boolean),
      );
      const known = new Set(
        published.items
          .flatMap((x) => recordImages(x).map((art) => art.image))
          .filter(Boolean),
      );
      for (const path of used)
        if (!known.has(path) && !pendingImages.has(path)) {
          const r = await fetch(`${base}${path}`, {
            method: "HEAD",
            signal: AbortSignal.timeout(5000),
          });
          if (!r.ok || !r.headers.get("content-type")?.startsWith("image/")) {
            const item = result.catalog.items.find((x) =>
              recordImages(x).some((art) => art.image === path),
            );
            issues.push({
              id: item.id,
              path: item.image === path ? "image" : "gallery",
              message: t(
                `画像 ${path} が見つかりません。アップロードするか、画像欄を空にしてください。`,
                `找不到图片 ${path}，请上传图片或清空该图片字段。`,
              ),
            });
          }
        }
      if (issues.length) {
        showIssues(issues);
        return;
      }
      result.catalog.updatedAt = date();
      const data = JSON.stringify(result.catalog, null, 2) + "\n",
        files = { "public/data/catalog.json": data };
      const addedImages = [...pendingImages.values()].filter(
        (x) => used.has(x.path) && !known.has(x.path),
      );
      for (const art of addedImages)
        files[`public/${art.path}`] = new Uint8Array(
          await art.blob.arrayBuffer(),
        );
      if (addedImages.length) {
        let manifest = [];
        try {
          manifest = await (await fetch(`${base}assets/manifest.json`)).json();
        } catch {}
        for (const art of addedImages) {
          const item = result.catalog.items.find((x) =>
              recordImages(x).some((info) => info.image === art.path),
            ),
            info = recordImages(item).find((info) => info.image === art.path);
          manifest.push({
            image: art.path,
            imageSource: info.imageSource || "",
            source: info.source || item.source,
          });
        }
        files["public/assets/manifest.json"] =
          JSON.stringify(manifest, null, 2) + "\n";
      }
      files["README.txt"] =
        t(
          "YoshinoDB 公開用ファイル\n\n解凍した public フォルダーを GitHub のアップロード画面にドラッグし、main にコミットしてください。GitHub Actions が検証・公開します。ブラウザーの下書き保存だけでは公開されません。\n",
          "YoshinoDB 发布文件\n\n将解压后的 public 文件夹整体拖入仓库根目录的上传页面，提交到 main 后 GitHub Actions 会校验并发布。仅保存浏览器草稿不会公开。\n",
        ) + "https://github.com/yoshino-buoo/YoshinoDB/upload/main\n";
      const count = Object.keys(session.changes).length;
      openModal(
        t("公開の準備ができました", "资料已检查，可以导出"),
        `<div class="studio-export-summary"><strong>${count}</strong><span>${t("件の変更", "条修改")}</span><strong>${addedImages.length}</strong><span>${t("枚の新しい画像", "张新图片")}</span></div><ol class="studio-publish-steps"><li>${t("公開用パッケージを保存して解凍します。", "下载并解压发布包。")}</li><li>${t("GitHub のアップロード画面へ public フォルダーごとドラッグします。", "将解压出的 public 文件夹整体拖入 GitHub 上传页。")}</li><li>${t("Commit changes を押すと、自動で検証・公開されます。", "点击 Commit changes，网站会自动校验并发布。")}</li></ol><div class="studio-modal-actions"><button type="button" data-download-package class="primary">${t("公開用 ZIP を保存", "下载发布包 ZIP")}</button><button type="button" data-download-json ${addedImages.length ? "disabled" : ""}>${t("JSON だけ保存", "仅下载 JSON")}</button></div><p class="studio-note">${t("公開は GitHub への反映後。下書きには新しい画像も保存されています。", "提交到 GitHub 后才会更新公开网站。新图片也已保存在本机草稿中。")}</p><div class="studio-publish-links"><a href="https://github.com/yoshino-buoo/YoshinoDB/upload/main" target="_blank" rel="noopener">${t("public フォルダーをアップロード", "上传 public 文件夹")} ↗</a><a href="https://github.com/yoshino-buoo/YoshinoDB/actions/workflows/pages.yml" target="_blank" rel="noopener">${t("公開の進み具合", "查看发布进度")} ↗</a></div>`,
      );
      const exportDialog = modal;
      const reviewPanel = document.createElement("section");
      reviewPanel.className = "studio-publication";
      let signature = JSON.stringify(session.changes);
      const prior =
        session.lastSubmission?.signature === signature
          ? session.lastSubmission
          : null;
      reviewPanel.innerHTML = `<h3>${t("GitHub に変更を提案", "提交更新提案")}</h3><p>${t("変更を確認して PR を作成。チェック後に GitHub でマージすると、主サイトが自動更新されます。", "检查修改后创建 PR。检查通过后，在 GitHub 合并提案，主站会自动更新。")}</p>${renderChangeReview(changedRecords(catalog, result.catalog))}${prior ? `<p><a href="${esc(prior.url)}" target="_blank" rel="noopener">${t("この変更は送信済み：PR を開く", "这份修改已提交：查看 PR")} #${prior.number} ↗</a></p>` : `<form data-connect-github><label>${t("GitHub の接続キー", "GitHub 连接密钥")}<input type="password" data-github-token required autocomplete="off" placeholder="${t("接続キーを貼り付け", "粘贴连接密钥")}"></label><details class="studio-connection-help"><summary>${t("初めて接続する", "首次连接指南")}</summary><ol><li><a href="https://github.com/settings/personal-access-tokens/new?name=YoshinoDB+Editor&target_name=yoshino-buoo&contents=write&pull_requests=write" target="_blank" rel="noopener">${t("GitHub で接続キーを作る", "在 GitHub 创建连接密钥")} ↗</a></li><li>${t("Repository access は YoshinoDB のみ。Contents と Pull requests を Read and write にします。", "仓库选择 YoshinoDB；将 Contents 和 Pull requests 设为 Read and write。")}</li><li>${t("生成したキーをここに貼り付けます。キーは今回の接続中だけ使用し、保存しません。", "将生成的密钥粘贴到这里。密钥仅用于本次连接，不会写入草稿或文件。")}</li></ol></details><button type="submit" class="primary" ${count ? "" : "disabled"}>${t("接続して最新の変更を確認", "连接并核对最新资料")}</button></form>`}<div data-github-review></div><p data-github-status role="status" aria-live="polite"></p>`;
      exportDialog.querySelector(".studio-modal-head").after(reviewPanel);
      // ZIP export remains available for contributors without write access.
      exportDialog
        .querySelector(".studio-publish-steps")
        .insertAdjacentHTML(
          "beforebegin",
          `<h3>${t("ファイルで渡す場合", "备用方式：导出文件")}</h3>`,
        );
      const connection = reviewPanel.querySelector("[data-connect-github]");
      connection?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const tokenInput = connection.querySelector("[data-github-token]");
        const token = tokenInput.value.trim();
        if (!token) return;
        const status = reviewPanel.querySelector("[data-github-status]");
        const connectButton = connection.querySelector("button[type=submit]");
        connectButton.disabled = true;
        const publisher = githubPublisher(token, {
          onAttempt(attempt) {
            session.pendingPublication = { ...attempt, signature };
            persist();
          },
          onProgress(stage) {
            status.textContent = {
              reading: t(
                "GitHub の最新資料を確認中…",
                "正在读取 GitHub 最新资料…",
              ),
              uploading: t("変更と画像を送信中…", "正在提交修改和图片…"),
              creating: t("提案を作成中…", "正在创建更新提案…"),
            }[stage];
          },
        });
        const failure = (error) => {
          status.textContent = publicationMessage(error);
          if (error.branch) {
            const link = document.createElement("a");
            link.href = `${REPOSITORY_URL}/compare/main...${error.branch}`;
            link.target = "_blank";
            link.rel = "noopener";
            link.textContent = t(
              " GitHub で送信状況を確認 ↗",
              " 在 GitHub 查看提交状态 ↗",
            );
            status.append(link);
          }
        };
        try {
          const pending = session.pendingPublication;
          const recovered = pending ? await publisher.recover(pending) : null;
          if (recovered?.pr) {
            session.lastSubmission = {
              ...recovered.pr,
              signature: pending.signature,
            };
            delete session.pendingPublication;
            persist();
            tokenInput.value = "";
            connection.hidden = true;
            reviewPanel.querySelector("[data-github-review]").innerHTML =
              `<p>${t("前回の提案が見つかりました。重複して作成しません。", "已找回上次提交的提案，无需重复创建。")}</p><a href="${esc(recovered.pr.url)}" target="_blank" rel="noopener">PR #${recovered.pr.number} ↗</a>`;
            status.textContent = t(
              "編集中の内容はこのブラウザーに残っています。",
              "当前草稿仍保留在此浏览器。",
            );
            return;
          }
          const review =
            recovered?.review ||
            (await publisher.review(copy(session.changes), [
              ...pendingImages.values(),
            ]));
          if (review.recovered) signature = pending.signature;
          else {
            adoptCatalog(review.remote);
            signature = JSON.stringify(session.changes);
          }
          tokenInput.value = "";
          connection.hidden = true;
          const host = reviewPanel.querySelector("[data-github-review]");
          host.innerHTML = `<p>${t("GitHub の最新版と照合済み。以下の内容で提案を作成します。", "已与 GitHub 最新版本核对。请确认以下修改，再创建提案。")}</p>${renderChangeReview(review.changed)}<label>${t("変更の説明", "本次更新说明")}<input data-pr-title maxlength="200" value="${esc(t("資料を更新", "更新站点资料"))}"></label><button type="button" data-submit-pr class="primary">${t("確認して PR を作成", "确认修改并创建 PR")}</button>`;
          status.textContent = t(
            "まだ送信していません。確認ボタンで PR を作成します。",
            "尚未提交，点击确认后创建 PR。",
          );
          host.querySelector("[data-submit-pr]").onclick = async () => {
            const button = host.querySelector("[data-submit-pr]");
            button.disabled = true;
            try {
              const pr = await publisher.submit(
                review,
                host.querySelector("[data-pr-title]").value,
              );
              session.lastSubmission = { ...pr, signature };
              delete session.pendingPublication;
              persist();
              host.innerHTML = `<div class="studio-publish-success"><h3>${t("変更を提案しました", "更新提案已创建")}</h3><p>${t("チェック完了後に GitHub でマージすると公開されます。下書きはこのブラウザーにも残ります。", "GitHub 检查完成后，合并提案即可更新主站。草稿仍保留在此浏览器。")}</p><a href="${esc(pr.url)}" target="_blank" rel="noopener">${t("PR を確認する", "查看更新提案")} #${pr.number} ↗</a></div>`;
              status.textContent = "";
            } catch (error) {
              failure(error);
              button.disabled = error.code === "stale";
            }
          };
        } catch (error) {
          if (error.code === "conflict") {
            closeModal();
            adoptCatalog(error.catalog);
            session.selected = error.conflicts[0].id;
            renderWorking();
            list();
            say(publicationMessage(error), true);
          } else if (error.code === "unchanged") {
            status.textContent = publicationMessage(error);
            connection.hidden = true;
            tokenInput.value = "";
            adoptCatalog(error.catalog);
          } else {
            failure(error);
            connectButton.disabled = false;
          }
        }
      });
      modal.querySelector("[data-download-package]").onclick = () =>
        download(zipFiles(files), `YoshinoDB-${date()}.zip`);
      modal.querySelector("[data-download-json]").onclick = () =>
        download(
          new Blob([data], { type: "application/json" }),
          "catalog.json",
        );
      say(
        t(
          "入力内容を確認しました。公開用ファイルを保存できます。",
          "已检查当前输入，可以下载发布文件。",
        ),
      );
    } catch (error) {
      say(t("書き出せません：", "无法导出：") + error.message, true);
    } finally {
      exportButton.disabled = false;
    }
  }
  root.querySelector("[data-search]").oninput = (e) => {
    query = e.target.value.trim().toLowerCase();
    list();
    persist();
  };
  root.querySelector("[data-category]").onchange = (e) => {
    category = e.target.value;
    list();
    persist();
  };
  root.querySelector("[data-changed]").onchange = (e) => {
    changedOnly = e.target.checked;
    list();
    persist();
  };
  root.querySelector("[data-undo]").onclick = () => {
    if (!undo) return;
    const previous = undo;
    undo = null;
    session = previous;
    renderWorking();
    list();
    persist();
  };
  root.querySelector("[data-new]").onclick = () => {
    openModal(
      t("テンプレートから始める", "从页面模板开始"),
      `<p>${t("公開ページと同じテンプレートです。内容を入れるだけで、同じ見た目になります。", "这些模板直接使用主站现有排版，填写内容即可。也可以完整复用一张已有页面。")}</p><div class="studio-kind-picker">${PAGE_TEMPLATES.map((template, i) => `<button type="button" data-new-kind="${template.id}"><small>${String(i + 1).padStart(2, "0")}</small><strong>${translated(template.label)}</strong><span>${translated(template.hint)}</span></button>`).join("")}</div><details class="studio-template-copy"><summary>${t("既存のページをそのまま複製", "完整复用已有页面")}</summary><label>${t("ページを探す", "搜索页面")}<input type="search" data-template-search></label><div data-template-list></div></details>`,
    );
    const create = (value) => {
      checkpoint();
      working = value;
      session.selected = working.id;
      session.tab = "basic";
      remember();
      closeModal();
      renderWorking();
      list();
      root.querySelector('[data-field="title"][data-locale="ja"]').focus();
    };
    modal
      .querySelectorAll("[data-new-kind]")
      .forEach(
        (b) => (b.onclick = () => create(fromTemplate(b.dataset.newKind))),
      );
    const draw = () => {
      const query = modal
        .querySelector("[data-template-search]")
        .value.toLowerCase();
      modal.querySelector("[data-template-list]").innerHTML = items()
        .filter(
          (x) =>
            !query || searchText(x).includes(query) || x.id.includes(query),
        )
        .slice(0, 30)
        .map(
          (x) =>
            `<button type="button" data-copy-template="${esc(x.id)}">${x.image ? `<img src="${esc(assetURL(x.image))}" alt="" loading="lazy">` : ""}<span><small>${label(x.kind)}</small>${esc(tr(x.title))}</span></button>`,
        )
        .join("");
      modal
        .querySelectorAll("[data-copy-template]")
        .forEach(
          (b) =>
            (b.onclick = () =>
              create(
                duplicateRecord(
                  items().find((x) => x.id === b.dataset.copyTemplate),
                ),
              )),
        );
    };
    modal.querySelector("[data-template-search]").oninput = draw;
    draw();
  };
  root.querySelector("[data-export]").onclick = exportDraft;
  const importFile = root.querySelector("[data-import-file]");
  root.querySelector("[data-import]").onclick = () => importFile.click();
  function stageImport(imported) {
    validateEditorCatalog(imported);
    const current = items(),
      added = imported.items.filter(
        (x) => !current.some((c) => c.id === x.id),
      ).length,
      updated = imported.items.filter((x) => {
        const old = current.find((c) => c.id === x.id);
        return old && !same(old, x);
      }).length;
    openModal(
      t("資料を読み込む", "导入资料"),
      `<p>${t(`${added} 件を追加、${updated} 件を更新します。ファイルに含まれない記録は残ります。`, `将新增 ${added} 条、更新 ${updated} 条。文件中未包含的现有条目会保留。`)}</p><p class="studio-note">${t("同じ ID の記録は読み込む内容に置き換わります。直前の操作は戻せます。", "相同 ID 的条目将采用导入内容，此操作可以撤销。")}</p><button type="button" data-confirm-import class="primary">${t("読み込んでまとめる", "导入并合并")}</button>`,
    );
    modal.querySelector("[data-confirm-import]").onclick = () => {
      checkpoint();
      for (const item of imported.items) {
        const original = catalog.items.find((x) => x.id === item.id);
        if (same(item, original)) delete session.changes[item.id];
        else
          session.changes[item.id] = {
            base: copy(original || null),
            value: copy(item),
          };
      }
      session.selected = imported.items[0]?.id || session.selected;
      closeModal();
      renderWorking();
      list();
      persist();
    };
  }
  importFile.onchange = async () => {
    const file = importFile.files[0];
    if (!file) return;
    try {
      if (file.size > 4_000_000) throw Error("Maximum 4 MB");
      await stageImport(JSON.parse(await file.text()));
    } catch (error) {
      say(t("読み込みエラー：", "导入错误：") + error.message, true);
    }
    importFile.value = "";
  };
  root.querySelector("[data-search]").value = query;
  root.querySelector("[data-category]").value = category;
  root.querySelector("[data-changed]").checked = changedOnly;
  renderWorking();
  list();
  persist();
  imageLoad ||= imageStore("getAll")
    .then((rows) => {
      for (const row of rows)
        pendingImages.set(row.path, {
          ...row,
          url: URL.createObjectURL(row.blob),
        });
    })
    .catch(() => {});
  imageLoad.then(() => {
    if (root.isConnected) {
      list();
      if (session.tab === "images") renderPanel();
    }
  });
  try {
    const old = localStorage.getItem("yoshino-editor-draft-v1");
    if (old && !session.legacyDismissed) {
      const notice = document.createElement("div");
      notice.className = "studio-legacy";
      notice.innerHTML = `<span>${t("以前の編集器の下書きが残っています。", "发现旧版编辑器留下的草稿。")}</span><button data-legacy-import>${t("内容を確認して読み込む", "检查并导入")}</button><button data-legacy-dismiss>${t("今は閉じる", "暂时收起")}</button>`;
      root.prepend(notice);
      notice.querySelector("[data-legacy-import]").onclick = () => {
        try {
          stageImport(JSON.parse(old));
        } catch (error) {
          say(error.message, true);
        }
      };
      notice.querySelector("[data-legacy-dismiss]").onclick = () => {
        session.legacyDismissed = true;
        persist();
        notice.remove();
      };
    }
  } catch {}
  return () => {
    previewState?.cleanup();
    previewState = null;
    root.querySelectorAll("dialog[open]").forEach((dialog) => dialog.close());
  };
}
