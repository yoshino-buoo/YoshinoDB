import { capturePage } from "./lib/page-snapshot.js";
import { stageTransitionScroll } from "./lib/transition-scroll.js";
import { recordScroll } from "./lib/scroll-diagnostics.js";

const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
const observed = new Set();
let observer,
  transition,
  transitionSerial = 0,
  pendingCover;
let indicatorObserver, gardenObserver, routeExit, retiringPage;
let settleScroll;
let snapshotActive = false;
const resultTransitions = new WeakMap();
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
            transform: "translateY(48px) rotate(2deg)",
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
            { opacity: 0, transform: "translateY(28px)" },
            { opacity: 1, transform: "translateY(0)" },
          ],
          { duration: 1050, delay: 480 + index * 90 },
        ),
      );
    animate(
      hero.querySelector(".portrait-figure>img"),
      [
        {
          opacity: 0,
          translate: "35px 42px",
          scale: "1.09",
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
        { opacity: 0, translate: "-28px 16px", filter: "blur(5px)" },
        { opacity: 1, translate: "0 0", filter: "blur(0px)" },
      ],
      { duration: 850 },
    );
    main
      .querySelectorAll(
        ".collection-page>.music-shelf-intro,.collection-page>.collection-stats,.collection-page>.story-paths,.collection-page>.video-intro,.collection-page>.category-tabs,.collection-page>.list-controls,.collection-page>.result-count",
      )
      .forEach((element, index) => {
        animate(
          element,
          [
            { opacity: 0, translate: "0 30px", filter: "blur(3px)" },
            { opacity: 1, translate: "0 0", filter: "blur(0px)" },
          ],
          { duration: 800, delay: 70 + index * 65 },
        );
      });
    main
      .querySelectorAll(
        ".card-gallery,.album-art,.story-art,.unit-art,.inline-player,.news-art,.profile-art,.milestone>img",
      )
      .forEach((element) =>
        animate(
          element,
          [
            { opacity: 0, translate: "0 32px", scale: ".96" },
            { opacity: 1, translate: "0 0", scale: "1" },
          ],
          { duration: 1050, delay: 90 },
        ),
      );
    main
      .querySelectorAll(
        ".entry-summary>*,.watch-info>*,.milestone>time,.milestone>div,.milestone-nav",
      )
      .forEach((element, index) =>
        animate(
          element,
          [
            { opacity: 0, translate: "0 24px" },
            { opacity: 1, translate: "0 0" },
          ],
          { duration: 850, delay: 170 + Math.min(index, 6) * 65 },
        ),
      );
  }
}
function revealElement(element, index = 0, instant = false) {
  observer?.unobserve(element);
  observed.delete(element);
  element.classList.remove("reveal-pending");
  element.classList.add("revealed");
  if (instant || reducedMotion()) {
    element.classList.add("reveal-still");
    return;
  }
  const tile = element.matches(
    ".cards,.videos,.units,.directory>a,.related-tile",
  );
  const horizontal = element.matches(".stories,.news,.timeline");
  animate(
    element,
    [
      {
        opacity: 0,
        translate: horizontal ? "32px 12px" : "0 54px",
        scale: tile ? ".955" : "1",
        rotate: tile ? "1 0 0 7deg" : "0deg",
      },
      { opacity: 1, translate: "0 0", scale: "1", rotate: "0deg" },
    ],
    { duration: tile ? 1000 : 850, delay: Math.min(index, 6) * 75 },
  );
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
            if (snapshotActive) return;
            entries
              .filter((x) => x.isIntersecting)
              .sort(
                (a, b) =>
                  a.boundingClientRect.top - b.boundingClientRect.top ||
                  a.boundingClientRect.left - b.boundingClientRect.left,
              )
              .forEach((entry, index) => revealElement(entry.target, index));
          },
          { threshold: 0.015, rootMargin: "0px 0px 45px 0px" },
        )
      : null;
  root
    .querySelectorAll(
      ".record,.directory>a,.entry-section,.related-tile,.story-paths>button,.year-section,.news-feature",
    )
    .forEach((element) => {
      if ("reveal" in element.dataset) return;
      element.dataset.reveal = "";
      if (reducedMotion() || !observer) return revealElement(element, 0, true);
      element.classList.add("reveal-pending");
      observed.add(element);
      if (!snapshotActive) observer.observe(element);
    });
  syncIndicators(document);
}
function prepareSnapshot() {
  // Native view transitions capture a still image. Its visible content must already
  // match the live page that will be uncovered at the end of the transition.
  for (const element of observed) {
    const rect = element.getBoundingClientRect();
    if (rect.bottom > -60 && rect.top < innerHeight + 100)
      revealElement(element, 0, true);
  }
}
function resumeReveals() {
  for (const element of observed) {
    if (element.isConnected) observer?.observe(element);
    else observed.delete(element);
  }
}
export function transitionResults(container, update) {
  const previousHeight = container.getBoundingClientRect().height;
  resultTransitions.get(container)?.cancel();
  container.style.overflow = "";
  update();
  if (reducedMotion() || !previousHeight) return;
  const nextHeight = container.getBoundingClientRect().height;
  if (Math.abs(previousHeight - nextHeight) < 1) return;
  container.style.overflow = "clip";
  const run = animate(
    container,
    [{ height: `${previousHeight}px` }, { height: `${nextHeight}px` }],
    { duration: 650, fill: "none" },
  );
  if (!run) return;
  resultTransitions.set(container, run);
  run.finished
    .finally(() => {
      if (resultTransitions.get(container) === run) {
        container.style.overflow = "";
        resultTransitions.delete(container);
      }
    })
    .catch(() => {});
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
  const hash = anchor.getAttribute("href");
  const record = anchor.closest("[data-entry]");
  // Only lift artwork belonging to the destination record. Text-only next/prev
  // links inside a detail page must not capture their parent record's artwork.
  const image =
    anchor.querySelector("img") ||
    (record?.dataset.entry === hash.slice(7)
      ? record.querySelector("img")
      : null);
  pendingCover = {
    hash,
    image,
    surface:
      image?.closest(
        ".record-cover,.related-art,.music-shelf-intro>a,.news-feature>a",
      ) || image,
  };
});
function clearSharedArtwork() {
  document.documentElement.removeAttribute("data-scroll-transition");
  document.querySelectorAll("[data-shared-art]").forEach((image) => {
    image.style.viewTransitionName = "";
    delete image.dataset.sharedArt;
  });
}
export async function transitionPage(update, { resetScroll = false } = {}) {
  const serial = ++transitionSerial;
  recordScroll("route-start");
  transition?.skipTransition();
  settleScroll?.();
  settleScroll = null;
  const outgoing = document.querySelector("main");
  if (retiringPage) {
    retiringPage.style.opacity = getComputedStyle(retiringPage).opacity;
    routeExit?.cancel();
  }
  clearSharedArtwork();
  const cover = pendingCover?.hash === location.hash ? pendingCover : null;
  const source = cover?.surface;
  pendingCover = null;
  const sourceBounds = source?.getBoundingClientRect();
  const share =
    cover?.image?.complete &&
    cover.image.naturalWidth > 0 &&
    sourceBounds.bottom > 0 &&
    sourceBounds.top < innerHeight;
  if (reducedMotion()) {
    recordScroll("reduced-motion");
    retiringPage?.remove();
    retiringPage = routeExit = null;
    snapshotActive = false;
    delete document.documentElement.dataset.transitioning;
    update();
    if (resetScroll) window.scrollTo({ top: 0, behavior: "instant" });
    recordScroll("finished-reduced");
    return;
  }
  // Crossfade the retained viewport over the incoming live entrance. Waiting for
  // a full fade-out before rendering leaves a paper-only gap on every browser.
  if (retiringPage || !share || !document.startViewTransition) {
    recordScroll("crossfade");
    snapshotActive = false;
    delete document.documentElement.dataset.transitioning;
    const retained = capturePage(retiringPage);
    retiringPage = retained;
    update();
    if (resetScroll) window.scrollTo({ top: 0, behavior: "instant" });
    recordScroll("crossfade-reset");
    routeExit = animate(retained, [{ opacity: 1 }, { opacity: 0 }], {
      duration: 480,
      delay: 100,
      easing: "ease-in-out",
      fill: "forwards",
    });
    await routeExit?.finished.catch(() => {});
    if (serial !== transitionSerial) return;
    retained?.remove();
    retiringPage = routeExit = null;
    recordScroll("finished-crossfade");
    return;
  }
  // Capture the visible cover, including its crop and current hover pose.
  // Freezing (not finishing) outgoing motion prevents a mid-entrance click from
  // jumping to a different frame before the browser takes its snapshot.
  cancelAnimationFrame(pointerFrame);
  const frozen = outgoing?.getAnimations({ subtree: true }) || [];
  frozen.forEach((animation) => animation.pause());
  snapshotActive = true;
  document.documentElement.dataset.transitioning = "true";
  document.documentElement.toggleAttribute(
    "data-scroll-transition",
    scrollY > 1,
  );
  source.style.viewTransitionName = "archive-art";
  source.dataset.sharedArt = "";
  let releaseScroll;
  const run = document.startViewTransition(async () => {
    recordScroll("native-update");
    if (serial !== transitionSerial) return;
    if (resetScroll) {
      releaseScroll = stageTransitionScroll();
      settleScroll = releaseScroll;
    }
    update();
    const target = document.querySelector(
      ".typed-entry .gallery-stage,.typed-entry .album-art,.typed-entry .inline-player,.typed-entry .story-art,.typed-entry .unit-art,.typed-entry .news-art,.typed-entry .milestone>img",
    );
    if (target) {
      target.style.viewTransitionName = "archive-art";
      target.dataset.sharedArt = "";
      const image = target.matches("img")
        ? target
        : target.querySelector("img");
      if (image && !image.complete)
        await Promise.race([
          image.decode().catch(() => {}),
          new Promise((resolve) => setTimeout(resolve, 180)),
        ]);
    }
    prepareSnapshot();
    recordScroll("native-updated");
  });
  transition = run;
  const finishScroll = () => {
    recordScroll("settle");
    releaseScroll?.();
    if (settleScroll === releaseScroll) settleScroll = null;
  };
  run.ready.then(finishScroll, finishScroll);
  run.finished
    .finally(() => {
      finishScroll();
      recordScroll("finished");
      if (outgoing?.isConnected)
        frozen.forEach((animation) => animation.play());
      if (serial !== transitionSerial) return;
      clearSharedArtwork();
      delete document.documentElement.dataset.transitioning;
      snapshotActive = false;
      transition = null;
      resumeReveals();
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
  document
    .querySelector(".home-page")
    ?.classList.toggle("ambient-paused", paused);
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
            ? "开启首页动效"
            : "ホームの動きを再開"
          : zh
            ? "暂停首页动效"
            : "ホームの動きを止める",
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
  if ("IntersectionObserver" in window) {
    gardenObserver = new IntersectionObserver((entries) => {
      for (const entry of entries)
        entry.target.classList.toggle(
          "ambient-offscreen",
          !entry.isIntersecting,
        );
    });
    main
      ?.querySelectorAll(".portrait,[data-ambient]")
      .forEach((zone) => gardenObserver.observe(zone));
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
function clearPointer() {
  cancelAnimationFrame(pointerFrame);
  pointerSurface?.classList.remove("pointer-lit");
  pointerSurface?.style.setProperty("--garden-x", "0px");
  pointerSurface?.style.setProperty("--garden-y", "0px");
}
document.addEventListener(
  "pointermove",
  (event) => {
    if (reducedMotion() || snapshotActive || !finePointer.matches) return;
    const surface = event.target.closest?.(
      ".record-cover,.album-art,.gallery-stage,.intro-grid",
    );
    if (surface !== pointerSurface) {
      clearPointer();
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
      surface.style.setProperty("--garden-x", `${(px - 0.5) * 32}px`);
      surface.style.setProperty("--garden-y", `${(py - 0.5) * 22}px`);
      surface.style.setProperty("--light-x", `${px * 100}%`);
      surface.style.setProperty("--light-y", `${py * 100}%`);
      surface.style.setProperty("--tilt-x", `${(py - 0.5) * -3}deg`);
      surface.style.setProperty("--tilt-y", `${(px - 0.5) * 3}deg`);
      surface.classList.add("pointer-lit");
    });
  },
  { passive: true },
);
document.addEventListener("pointerleave", clearPointer);
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
  for (const element of observed) revealElement(element, 0, true);
  observer?.disconnect();
  observed.clear();
  clearPointer();
});
export function switchArtwork(gallery, variant) {
  const panels = [...gallery.querySelectorAll("[data-variant-panel]")];
  const next = panels.find((panel) => panel.dataset.variantPanel === variant);
  const current = panels.find(
    (panel) => !panel.hidden && !panel.classList.contains("is-leaving"),
  );
  if (!next || current === next) return;
  const appearance = (panel) => ({
    opacity: getComputedStyle(panel).opacity,
    transform: getComputedStyle(panel).transform,
    filter: getComputedStyle(panel).filter,
  });
  const currentAppearance = current ? appearance(current) : null;
  const nextAppearance = next.hidden ? null : appearance(next);
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
        nextAppearance || {
          opacity: 0,
          transform:
            "perspective(1200px) translateX(28px) rotateY(-9deg) scale(1.075)",
          filter: "brightness(1.16)",
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
          currentAppearance,
          {
            opacity: 0,
            transform:
              "perspective(1200px) translateX(-25px) rotateY(7deg) scale(.985)",
          },
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
