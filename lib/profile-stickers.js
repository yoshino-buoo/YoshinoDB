export function renderProfileStickers(stickers, { base, t, tr, esc, ext }) {
  if (!stickers?.length) return "";
  const names = {
    mobamas: t("シンデレラガールズ", "灰姑娘女孩（原作）"),
    deresute: t("スターライトステージ", "星光舞台"),
    line: "LINE",
  };
  return `<section class="entry-section profile-stickers"><div class="voice-guide-heading"><div><small>STAMPS & LITTLE MOMENTS</small><h2>${t("スタンプと小さなひとこま", "贴纸与小小日常")}</h2></div></div>${Object.entries(
    names,
  )
    .map(([group, name]) => {
      const items = stickers.filter((s) => s.group === group);
      return items.length
        ? `<div class="sticker-group"><h3>${name}</h3><div class="sticker-grid">${items
            .map((art) => {
              const animated = art.image.endsWith(".gif");
              return `<figure class="profile-sticker">${animated ? "<yoshino-sticker>" : ""}<a class="sticker-art" href="${base}${esc(art.image)}" target="_blank" rel="noopener"><img src="${base}${esc(art.image)}" ${animated ? "data-sticker-image" : ""} alt="${esc(name + " · " + tr(art.label))}" width="${art.width}" height="${art.height}" loading="lazy" decoding="async"></a>${animated ? `<button type="button" class="sticker-motion" data-sticker-motion aria-pressed="true" data-label="${t("アニメーション", "动画")}" aria-label="${t("アニメーション", "动画")}"><span>${t("アニメーション", "动画")}</span><span data-sticker-state>ON</span></button></yoshino-sticker>` : ""}<figcaption><span>${esc(tr(art.label))}</span>${ext(art.source, "Wiki", "text-link")}</figcaption></figure>`;
            })
            .join("")}</div></div>`
        : "";
    })
    .join("")}</section>`;
}

// Keep original GIF files intact. Freeze the displayed frame when offscreen,
// paused, or reduced motion is requested; no animation timer is added.
if (
  typeof customElements !== "undefined" &&
  !customElements.get("yoshino-sticker")
) {
  customElements.define(
    "yoshino-sticker",
    class extends HTMLElement {
      connectedCallback() {
        if (this.getRootNode() !== document || this.controller) return;
        this.controller = new AbortController();
        const { signal } = this.controller;
        queueMicrotask(() => {
          if (signal.aborted) return;
          this.image = this.querySelector("[data-sticker-image]");
          this.button = this.querySelector("[data-sticker-motion]");
          this.original = this.image.getAttribute("src");
          this.reduced = matchMedia("(prefers-reduced-motion: reduce)");
          this.paused = this.reduced.matches;
          this.visible = false;
          this.image.addEventListener("load", () => this.updateMotion(), {
            signal,
          });
          this.button.addEventListener(
            "click",
            () => {
              this.paused = !this.paused;
              this.updateMotion();
            },
            { signal },
          );
          this.reduced.addEventListener(
            "change",
            () => {
              this.paused = this.reduced.matches;
              this.updateMotion();
            },
            { signal },
          );
          document.addEventListener(
            "visibilitychange",
            () => this.updateMotion(),
            { signal },
          );
          this.observer = new IntersectionObserver(([entry]) => {
            this.visible = entry.isIntersecting;
            this.updateMotion();
          });
          this.observer.observe(this);
          this.updateMotion();
        });
      }
      updateMotion() {
        if (!this.image || !this.controller || this.controller.signal.aborted)
          return;
        const running = this.visible && !this.paused && !document.hidden;
        this.dataset.running = String(running);
        this.button.setAttribute("aria-pressed", String(!this.paused));
        this.querySelector("[data-sticker-state]").textContent = this.paused
          ? "OFF"
          : "ON";
        if (running) {
          if (this.image.getAttribute("src") !== this.original)
            this.image.src = this.original;
        } else if (
          this.image.getAttribute("src") === this.original &&
          this.image.complete &&
          this.image.naturalWidth
        ) {
          try {
            const canvas = document.createElement("canvas");
            canvas.width = this.image.naturalWidth;
            canvas.height = this.image.naturalHeight;
            canvas.getContext("2d").drawImage(this.image, 0, 0);
            this.image.src = canvas.toDataURL("image/png");
          } catch {
            /* The original image and file link remain usable. */
          }
        }
      }
      disconnectedCallback() {
        this.controller?.abort();
        this.observer?.disconnect();
        this.controller = null;
      }
    },
  );
}
