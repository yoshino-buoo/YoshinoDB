// This bridge runs only inside the editor's same-origin preview frame. The frame
// loads app.js and the public styles; it never has its own content renderer.
export function mountPreviewBridge({ renderDraft }) {
  let selectEnabled = true;
  const send = (message) => parent.postMessage(message, location.origin);
  const style = document.createElement("style");
  style.textContent = `html[data-studio-select] [data-edit-path]:hover { outline: 2px dashed #a46d3c; outline-offset: 3px; cursor: pointer; }`;
  document.head.append(style);
  document.documentElement.dataset.studioSelect = "";
  const mark = (selector, path) =>
    document.querySelectorAll(selector).forEach((el) => {
      if (!el.dataset.editPath) el.dataset.editPath = path;
    });
  const receive = (event) => {
    if (
      event.origin !== location.origin ||
      event.source !== parent ||
      event.data?.type !== "yoshino:preview"
    )
      return;
    const { catalog, id, locale, images = {}, select = true } = event.data;
    const item = catalog?.items?.find((x) => x.id === id);
    if (!item || !["ja", "zh"].includes(locale)) return;
    selectEnabled = select;
    document.documentElement.toggleAttribute("data-studio-select", select);
    const scroll = window.scrollY;
    const variant = document.querySelector(
      '[data-variant][aria-pressed="true"]',
    )?.dataset.variant;
    const expanded = [...document.querySelectorAll("main details")].map(
      (el) => el.open,
    );
    try {
      renderDraft({ catalog, id, locale });
      const regions = {
        ".profile-art": "image",
        ".profile-connections": "profile.connections",
        ".profile-attribution": "attribution",
        ".profile-stickers": "profile.stickers",
        ".card-gallery": item.gallery?.length ? "gallery" : "image",
        ".rarity-emblem": "rarity",
        ".card-detail-top .fact-list": "card.type",
        ".skill-block":
          item.game === "mobamas" ? "card.skills" : "card.skill.name",
        ".stats-table":
          item.game === "mobamas" ? "card.mobamasStats" : "card.stats",
        "yoshino-petit": "card.petit.poses",
        ".voice-guide": "voiceGuide.stages",
        ".card-commu": "commu.lines",
        ".card-theater": "theater.panels",
        ".album-art": "image",
        ".music-detail-top .fact-list": "music.performers",
        ".song-listening": "music.appleTrackUrl",
        ".album-heading,.track-list": "music.album.tracks",
        ".inline-player,.watch-actions": "source",
        ".watch-info": "video.uploader",
        ".watch-layout .chapter-list": "video.parts",
        ".story-art": "image",
        ".story-detail-top .fact-list": "story.members",
        ".entry-stories .chapter-list": "story.chapters",
        ".unit-art": "image",
        ".member-list": "unit.members",
        ".entry-units .fact-list": "unit.debut",
        ".article-meta,.milestone>time": "date",
        ".news-art,.milestone>img": "image",
        ".news-gallery": "gallery",
        ".related-grid": "relatedIds",
      };
      Object.entries(regions).forEach(([selector, path]) =>
        mark(selector, path),
      );
      document.querySelectorAll("main details").forEach((el, i) => {
        el.open = !!expanded[i];
      });
      const each = (selector, path) =>
        document
          .querySelectorAll(selector)
          .forEach((el, i) => (el.dataset.editPath = path(i)));
      each(".gallery-stage figure", (i) =>
        item.gallery?.length ? `gallery.${i}.image` : "image",
      );
      each(
        ".profile-connection",
        (i) => `profile.connections.${i}.description`,
      );
      each(".voice-stage", (i) => `voiceGuide.stages.${i}`);
      each(".track-list li", (i) => `music.album.tracks.${i}.title`);
      each(".member-list>div", (i) => `unit.members.${i}`);
      each(
        ".entry-stories .chapter-list li",
        (i) => `story.chapters.${i}.title`,
      );
      each(".entry-videos .chapter-list li", (i) => `video.parts.${i}.title`);
      mark(".album-heading h3", "music.album.title");
      mark(".album-heading span", "music.album.catalogNumber");
      document.querySelectorAll(".profile-sticker").forEach((el) => {
        const image = el.querySelector("img")?.getAttribute("src");
        const i = item.profile?.stickers?.findIndex((s) =>
          image?.endsWith(s.image),
        );
        if (i >= 0) el.dataset.editPath = `profile.stickers.${i}.image`;
      });
      document.querySelectorAll(".skill-block").forEach((el, i) => {
        const prefix =
          item.game === "mobamas"
            ? `card.skills.${i}`
            : item.card?.skill?.name && i === 0
              ? "card.skill"
              : "card.center";
        el.querySelector("h3")?.setAttribute(
          "data-edit-path",
          `${prefix}.name`,
        );
        el.querySelector("p")?.setAttribute(
          "data-edit-path",
          `${prefix}.effect`,
        );
      });
      // Local image uploads stay in the parent document's IndexedDB. Blob URLs
      // can be shared with a same-origin frame without writing public files.
      document.querySelectorAll("img").forEach((img) => {
        for (const attr of ["src", "data-petit-src"]) {
          const src = img.getAttribute(attr);
          if (!src) continue;
          const path = new URL(src, location.href).pathname.split(
            "/assets/",
          )[1];
          if (path && images[`assets/${path}`])
            img.setAttribute(attr, images[`assets/${path}`]);
        }
      });
      if (variant)
        document.querySelector(`[data-variant="${variant}"]`)?.click();
      window.scrollTo({ top: scroll, behavior: "instant" });
      send({ type: "yoshino:rendered", id });
    } catch {
      send({ type: "yoshino:preview-error" });
    }
  };
  window.addEventListener("message", receive);
  document.addEventListener(
    "click",
    (event) => {
      const target = event.target;
      if (
        target.closest(
          "yoshino-profile-nav, [data-variant], .voice-group summary, [data-petit-next], [data-petit-pause], [data-sticker-motion]",
        )
      )
        return;
      const field = target.closest("[data-edit-path]");
      if (field && selectEnabled) {
        event.preventDefault();
        event.stopImmediatePropagation();
        send({ type: "yoshino:select-field", path: field.dataset.editPath });
      } else if (target.closest("a,button,input")) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true,
  );
  send({ type: "yoshino:preview-ready" });
}
