const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
const observed = new Set();
let observer;
export const reducedMotion = () => preference.matches;
export function animatePage(main) {
  if (!main || reducedMotion() || !main.animate) return;
  main.animate(
    [
      { opacity: 0, transform: "translateY(9px)" },
      { opacity: 1, transform: "translateY(0)" },
    ],
    { duration: 440, easing: "cubic-bezier(.22,1,.36,1)" },
  );
  main
    .querySelectorAll(
      ".intro .eyebrow,.intro h1>span,.intro-copy,.intro .search-form,.intro .profile-link,.portrait-label,.vertical-copy",
    )
    .forEach((element, index) => {
      element.animate(
        [
          { opacity: 0, transform: "translateY(12px)" },
          { opacity: 1, transform: "translateY(0)" },
        ],
        {
          duration: 850,
          delay: 100 + index * 65,
          easing: "cubic-bezier(.22,1,.36,1)",
          fill: "backwards",
        },
      );
    });
}
export function revealContent(root) {
  if (!root) return;
  // Release records removed by a route change or filter update.
  for (const element of observed)
    if (!element.isConnected) {
      observer?.unobserve(element);
      observed.delete(element);
    }
  observer ||=
    "IntersectionObserver" in window
      ? new IntersectionObserver(
          (entries) => {
            for (const entry of entries)
              if (entry.isIntersecting) {
                entry.target.classList.add("revealed");
                observer.unobserve(entry.target);
                observed.delete(entry.target);
              }
          },
          { threshold: 0.04, rootMargin: "0px 0px 35px 0px" },
        )
      : null;
  const elements = root.querySelectorAll(
    ".record, .directory > a, .entry-section, .related-tile, .story-paths > button, .year-section, .news-feature",
  );
  elements.forEach((element, index) => {
    if ("reveal" in element.dataset) return;
    element.dataset.reveal = "";
    element.style.setProperty("--reveal-delay", `${(index % 4) * 45}ms`);
    if (reducedMotion() || !observer) element.classList.add("revealed");
    else {
      observer.observe(element);
      observed.add(element);
    }
  });
}
preference.addEventListener("change", () => {
  if (!reducedMotion()) return;
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
    next.animate(
      [
        { opacity: 0, transform: "scale(1.018)" },
        { opacity: 1, transform: "scale(1)" },
      ],
      { duration: 520, easing: "cubic-bezier(.22,1,.36,1)" },
    );
    current
      .animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: 400,
        easing: "ease-out",
      })
      .finished.then(() => {
        current.hidden = true;
        current.classList.remove("is-leaving");
      })
      .catch(() => {});
  } else if (current) current.hidden = true;
  gallery
    .querySelectorAll("[data-variant]")
    .forEach((button) =>
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.variant === variant),
      ),
    );
}
