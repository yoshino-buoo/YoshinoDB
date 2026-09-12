const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
const observed = new Set();
let observer,
  transition,
  transitionSerial = 0,
  pendingCover;
let indicatorObserver, gardenObserver;
let ambientPaused = false;
try {
  ambientPaused = localStorage.getItem("yoshino-ambient-paused") === "true";
} catch {}
export const reducedMotion = () => preference.matches;
const ease = "cubic-bezier(.16,1,.3,1)";

function animate(element, frames, options = {}) {
  if (!element || reducedMotion() || !element.animate) return;
  return element.animate(frames, {
    duration: 900,
    easing: ease,
    fill: "backwards",
    ...options,
  });
}
export function animatePage(main) {
  bindMotion(main);
  if (
    !main ||
    reducedMotion() ||
    document.documentElement.dataset.transitioning
  )
    return;
  const hero = main.querySelector(".intro-grid");
  if (hero) {
    animate(
      hero.querySelector(".intro .eyebrow"),
      [
        { opacity: 0, transform: "translateX(-16px)" },
        { opacity: 1, transform: "translateX(0)" },
      ],
      { delay: 80 },
    );
    hero.querySelectorAll("h1>span").forEach((line, index) =>
      animate(
        line,
        [
          {
            opacity: 0,
            clipPath: "inset(0 0 100% 0)",
            transform: "translateY(24px)",
          },
          {
            opacity: 1,
            clipPath: "inset(-12% -3% -12% -3%)",
            transform: "translateY(0)",
          },
        ],
        { duration: 1250, delay: 200 + index * 170 },
      ),
    );
    hero
      .querySelectorAll(".intro-copy,.search-form,.profile-link,.intro-bottom")
      .forEach((element, index) =>
        animate(
          element,
          [
            { opacity: 0, transform: "translateY(15px)" },
            { opacity: 1, transform: "translateY(0)" },
          ],
          { duration: 1050, delay: 480 + index * 90 },
        ),
      );
    animate(
      hero.querySelector(".portrait>img"),
      [
        {
          opacity: 0,
          translate: "0 15px",
          scale: "1.035",
          filter: "brightness(1.13)",
        },
        {
          opacity: 1,
          translate: "0 0",
          scale: "1",
          filter: "brightness(1)",
        },
      ],
      { duration: 1650, delay: 180 },
    );
    animate(
      hero.querySelector(".portrait-disc"),
      [
        { opacity: 0, scale: ".82" },
        { opacity: 0.7, scale: "1" },
      ],
      { duration: 1800 },
    );
    hero
      .querySelectorAll(".portrait-label,.vertical-copy")
      .forEach((element, index) =>
        animate(
          element,
          [
            { opacity: 0, transform: "translateY(12px)" },
            { opacity: 1, transform: "translateY(0)" },
          ],
          { duration: 1200, delay: 650 + index * 170 },
        ),
      );
  } else {
    animate(
      main.querySelector(".page-title,.entry-heading"),
      [
        { opacity: 0, transform: "translateY(14px)" },
        { opacity: 1, transform: "translateY(0)" },
      ],
      { duration: 750 },
    );
    main
      .querySelectorAll(
        ".card-gallery,.album-art,.story-art,.unit-art,.inline-player,.news-art,.profile-art",
      )
      .forEach((element) =>
        animate(
          element,
          [
            { opacity: 0, transform: "translateY(18px) scale(.982)" },
            { opacity: 1, transform: "translateY(0) scale(1)" },
          ],
          { duration: 1050, delay: 90 },
        ),
      );
    main
      .querySelectorAll(".entry-summary>*,.watch-info>*")
      .forEach((element, index) =>
        animate(
          element,
          [
            { opacity: 0, transform: "translateY(12px)" },
            { opacity: 1, transform: "translateY(0)" },
          ],
          { duration: 850, delay: 170 + Math.min(index, 6) * 65 },
        ),
      );
  }
}
export function revealContent(root) {
  if (!root) return;
  for (const element of observed)
    if (!element.isConnected) {
      observer?.unobserve(element);
      observed.delete(element);
    }
  observer ||=
    "IntersectionObserver" in window
      ? new IntersectionObserver(
          (entries) => {
            const entering = entries
              .filter((x) => x.isIntersecting)
              .sort(
                (a, b) =>
                  a.boundingClientRect.top - b.boundingClientRect.top ||
                  a.boundingClientRect.left - b.boundingClientRect.left,
              );
            entering.forEach((entry, index) => {
              entry.target.style.setProperty(
                "--reveal-delay",
                `${Math.min(index, 5) * 65}ms`,
              );
              entry.target.classList.add("revealed");
              observer.unobserve(entry.target);
              observed.delete(entry.target);
            });
          },
          { threshold: 0.04, rootMargin: "0px 0px 24px 0px" },
        )
      : null;
  root
    .querySelectorAll(
      ".record,.directory>a,.entry-section,.related-tile,.story-paths>button,.year-section,.news-feature",
    )
    .forEach((element) => {
      if ("reveal" in element.dataset) return;
      element.dataset.reveal = "";
      if (reducedMotion() || !observer) element.classList.add("revealed");
      else {
        observer.observe(element);
        observed.add(element);
      }
    });
  syncIndicators(document);
}

// Capture only the clicked artwork. It travels from its shelf into the detail page.
document.addEventListener("click", (event) => {
  const anchor = event.target.closest?.('a[href^="#entry/"]');
  if (
    !anchor ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  )
    return;
  pendingCover = {
    hash: anchor.getAttribute("href"),
    image:
      anchor.closest("[data-entry]")?.querySelector("img") ||
      anchor.querySelector("img"),
  };
});
export function transitionPage(update) {
  const serial = ++transitionSerial;
  transition?.skipTransition();
  document.querySelectorAll("[data-shared-art]").forEach((image) => {
    image.style.viewTransitionName = "";
    delete image.dataset.sharedArt;
  });
  const source =
    pendingCover?.hash === location.hash ? pendingCover.image : null;
  pendingCover = null;
  if (reducedMotion() || !document.startViewTransition) {
    delete document.documentElement.dataset.transitioning;
    update();
    return;
  }
  const sourceBounds = source?.getBoundingClientRect();
  const share =
    source?.complete &&
    source.naturalWidth > 0 &&
    sourceBounds.bottom > 0 &&
    sourceBounds.top < innerHeight;
  if (share) {
    source.style.viewTransitionName = "archive-art";
    source.dataset.sharedArt = "";
  }
  document.documentElement.dataset.transitioning = "true";
  const run = document.startViewTransition(async () => {
    update();
    const target = share
      ? document.querySelector(
          ".typed-entry .gallery-stage figure:not([hidden]) img,.typed-entry .album-art img,.typed-entry .video-poster img,.typed-entry .story-art,.typed-entry .unit-art,.typed-entry .news-art",
        )
      : null;
    if (target) {
      target.style.viewTransitionName = "archive-art";
      target.dataset.sharedArt = "";
      // A cached poster is usually ready immediately; never delay navigation for the network.
      if (!target.complete)
        await Promise.race([
          target.decode().catch(() => {}),
          new Promise((resolve) => setTimeout(resolve, 180)),
        ]);
    }
  });
  transition = run;
  run.ready.catch(() => {});
  run.finished
    .finally(() => {
      if (serial !== transitionSerial) return;
      document.querySelectorAll("[data-shared-art]").forEach((image) => {
        image.style.viewTransitionName = "";
        delete image.dataset.sharedArt;
      });
      delete document.documentElement.dataset.transitioning;
      transition = null;
    })
    .catch(() => {});
}

export function syncIndicators(root) {
  root.querySelectorAll(".category-tabs,.variant-tabs").forEach((group) => {
    const active = group.querySelector('button[aria-pressed="true"]');
    if (!active) return;
    let ink = group.querySelector(".selection-ink");
    if (!ink) {
      ink = document.createElement("span");
      ink.className = "selection-ink";
      ink.setAttribute("aria-hidden", "true");
      group.prepend(ink);
    }
    const rect = group.getBoundingClientRect(),
      button = active.getBoundingClientRect();
    ink.style.width = `${button.width}px`;
    ink.style.height = `${button.height}px`;
    ink.style.transform = `translate(${button.left - rect.left - group.clientLeft}px,${button.top - rect.top - group.clientTop}px)`;
    requestAnimationFrame(() => group.classList.add("ink-ready"));
  });
}
function gardenState() {
  const portrait = document.querySelector(".portrait");
  if (!portrait) return;
  const paused = ambientPaused || reducedMotion();
  portrait.classList.toggle("ambient-paused", paused);
  const button = portrait.querySelector("[data-motion-toggle]");
  if (button) {
    button.setAttribute("aria-pressed", String(paused));
    const zh = document.documentElement.lang === "zh-Hans";
    button.setAttribute(
      "aria-label",
      reducedMotion()
        ? zh
          ? "已跟随系统减少动态效果"
          : "システム設定で動きを停止中"
        : paused
          ? zh
            ? "开启庭院动效"
            : "庭の動きを再開"
          : zh
            ? "暂停庭院动效"
            : "庭の動きを止める",
    );
    button.title = button.getAttribute("aria-label");
    button.textContent = paused ? "▷" : "Ⅱ";
    button.disabled = reducedMotion();
  }
}
function bindMotion(main) {
  indicatorObserver?.disconnect();
  gardenObserver?.disconnect();
  syncIndicators(document);
  if ("ResizeObserver" in window) {
    indicatorObserver = new ResizeObserver(() => syncIndicators(document));
    main
      ?.querySelectorAll(".category-tabs,.variant-tabs")
      .forEach((group) => indicatorObserver.observe(group));
  }
  gardenState();
  const portrait = main?.querySelector(".portrait");
  if (portrait && "IntersectionObserver" in window) {
    gardenObserver = new IntersectionObserver(([entry]) =>
      portrait.classList.toggle("ambient-offscreen", !entry.isIntersecting),
    );
    gardenObserver.observe(portrait);
  }
}
document.addEventListener("visibilitychange", () =>
  document.documentElement.classList.toggle("motion-idle", document.hidden),
);
document.addEventListener("click", (event) => {
  if (!event.target.closest?.("[data-motion-toggle]")) return;
  ambientPaused = !ambientPaused;
  try {
    localStorage.setItem("yoshino-ambient-paused", String(ambientPaused));
  } catch {}
  gardenState();
});
// Pointer light uses CSS variables; there is no continuous JavaScript animation loop.
let pointerFrame = 0,
  pointerSurface;
document.addEventListener(
  "pointermove",
  (event) => {
    if (reducedMotion() || !finePointer.matches) return;
    const surface = event.target.closest?.(
      ".record-cover,.album-art,.gallery-stage,.portrait",
    );
    if (surface !== pointerSurface) {
      pointerSurface?.classList.remove("pointer-lit");
      pointerSurface = surface;
    }
    cancelAnimationFrame(pointerFrame);
    if (!surface) return;
    const x = event.clientX,
      y = event.clientY;
    pointerFrame = requestAnimationFrame(() => {
      const bounds = surface.getBoundingClientRect();
      const px = Math.max(0, Math.min(1, (x - bounds.left) / bounds.width)),
        py = Math.max(0, Math.min(1, (y - bounds.top) / bounds.height));
      surface.style.setProperty("--light-x", `${px * 100}%`);
      surface.style.setProperty("--light-y", `${py * 100}%`);
      surface.style.setProperty("--tilt-x", `${(py - 0.5) * -3}deg`);
      surface.style.setProperty("--tilt-y", `${(px - 0.5) * 3}deg`);
      surface.classList.add("pointer-lit");
    });
  },
  { passive: true },
);
document.addEventListener("pointerleave", () =>
  pointerSurface?.classList.remove("pointer-lit"),
);
preference.addEventListener("change", () => {
  gardenState();
  if (!reducedMotion()) return;
  transition?.skipTransition();
  document.getAnimations?.().forEach((animation) => {
    try {
      animation.finish();
    } catch {
      animation.cancel();
    }
  });
  for (const element of observed) element.classList.add("revealed");
  observer?.disconnect();
  observed.clear();
  pointerSurface?.classList.remove("pointer-lit");
});
export function switchArtwork(gallery, variant) {
  const panels = [...gallery.querySelectorAll("[data-variant-panel]")];
  const next = panels.find((panel) => panel.dataset.variantPanel === variant);
  const current = panels.find(
    (panel) => !panel.hidden && !panel.classList.contains("is-leaving"),
  );
  if (!next || current === next) return;
  panels.forEach((panel) => {
    panel.getAnimations().forEach((a) => a.cancel());
    panel.classList.remove("is-leaving");
    panel.hidden = panel !== current && panel !== next;
    panel.setAttribute("aria-hidden", String(panel !== next));
  });
  if (current && !reducedMotion() && next.animate) {
    current.classList.add("is-leaving");
    animate(
      next,
      [
        {
          opacity: 0,
          transform: "translateX(12px) scale(1.055)",
          filter: "brightness(1.1)",
        },
        {
          opacity: 1,
          transform: "translateX(0) scale(1)",
          filter: "brightness(1)",
        },
      ],
      { duration: 950, fill: "none" },
    );
    current
      .animate(
        [
          { opacity: 1, transform: "translateX(0) scale(1)" },
          { opacity: 0, transform: "translateX(-9px) scale(1.015)" },
        ],
        { duration: 700, easing: ease },
      )
      .finished.then(() => {
        current.hidden = true;
        current.classList.remove("is-leaving");
      })
      .catch(() => {});
    const stage = gallery.querySelector(".gallery-stage");
    let sheen = stage.querySelector(".art-sheen");
    if (!sheen) {
      sheen = document.createElement("span");
      sheen.className = "art-sheen";
      sheen.setAttribute("aria-hidden", "true");
      stage.append(sheen);
    }
    sheen.getAnimations().forEach((a) => a.cancel());
    animate(
      sheen,
      [
        { opacity: 0, transform: "translateX(-130%) skewX(-18deg)" },
        { opacity: 0.65, offset: 0.35 },
        { opacity: 0, transform: "translateX(150%) skewX(-18deg)" },
      ],
      { duration: 1150, fill: "none" },
    );
  } else if (current) current.hidden = true;
  gallery
    .querySelectorAll("[data-variant]")
    .forEach((button) =>
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.variant === variant),
      ),
    );
  syncIndicators(gallery);
}
