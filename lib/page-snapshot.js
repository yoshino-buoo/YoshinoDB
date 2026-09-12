// Keep the outgoing viewport painted while the new page starts its live entrance.
// A closed shadow tree isolates this inert visual copy from application selectors,
// duplicate IDs, event binding and assistive technology.
export function capturePage(previous) {
  const app = document.querySelector("#app");
  if (!app) return null;
  const bounds = app.getBoundingClientRect();
  const host = document.createElement("div");
  host.dataset.routeRetiring = "";
  host.inert = true;
  host.setAttribute("aria-hidden", "true");
  host.style.cssText =
    "position:fixed;inset:0;overflow:hidden;pointer-events:none;z-index:30";
  const shadow = host.attachShadow({ mode: "closed" });
  const style = document.createElement("style");
  style.textContent =
    [...document.styleSheets]
      .flatMap((sheet) => {
        // Fonts are already registered in the document; copying their relative
        // URLs into an inline stylesheet would give them a different base URL.
        try {
          return [...sheet.cssRules]
            .filter((rule) => rule.type !== CSSRule.FONT_FACE_RULE)
            .map((rule) => rule.cssText);
        } catch {
          return [];
        }
      })
      .join("\n")
      .replaceAll(":root", "[data-retiring-root]") +
    "\n*,*::before,*::after{animation:none!important;transition:none!important;view-transition-name:none!important}";
  const root = document.createElement("div");
  for (const attribute of document.documentElement.attributes)
    root.setAttribute(attribute.name, attribute.value);
  root.dataset.retiringRoot = "";
  const bodyStyle = getComputedStyle(document.body);
  Object.assign(root.style, {
    position: "absolute",
    inset: "0",
    overflow: "hidden",
    font: bodyStyle.font,
    color: bodyStyle.color,
    // The site's body uses a unitless line height. A computed font shorthand
    // would turn it into fixed pixels and make every smaller text row taller.
    lineHeight: String(
      parseFloat(bodyStyle.lineHeight) / parseFloat(bodyStyle.fontSize),
    ),
    backgroundImage: bodyStyle.backgroundImage,
  });
  const copy = app.cloneNode(true);
  Object.assign(copy.style, {
    position: "absolute",
    left: `${bounds.left}px`,
    top: `${bounds.top}px`,
    width: `${bounds.width}px`,
    margin: "0",
  });
  const originals = app.querySelectorAll("*"),
    copies = copy.querySelectorAll("*");
  originals.forEach((element, index) => {
    const clone = copies[index];
    const computed = getComputedStyle(element);
    // CSSOM serialization can drop a variable-based font shorthand when one
    // of its longhands is overridden. Preserve typography above the viewport
    // too: a changed row height there would shift the visible rows below it.
    for (const property of [
      "font-family",
      "font-size",
      "font-style",
      "font-weight",
      "font-stretch",
    ])
      clone.style.setProperty(property, computed.getPropertyValue(property));
    // Retain ratios instead of rounded computed pixels (WebKit may report
    // 19.799999px for 11px × 1.8, accumulating a subpixel shift over many rows).
    clone.style.lineHeight =
      computed.lineHeight === "normal"
        ? "normal"
        : String(
            Math.round(
              (parseFloat(computed.lineHeight) /
                parseFloat(computed.fontSize)) *
                1e6,
            ) / 1e6,
          );
    const rect = element.getBoundingClientRect();
    if (rect.bottom > 0 && rect.top < innerHeight) {
      for (const property of [
        "opacity",
        "transform",
        "translate",
        "rotate",
        "scale",
        "filter",
        "clip-path",
        "color",
        "background-color",
        "box-shadow",
      ])
        clone.style.setProperty(property, computed.getPropertyValue(property));
    }
    if ("value" in element && element.type !== "file")
      clone.value = element.value;
    if ("checked" in element) clone.checked = element.checked;
  });
  // Never start another media player when connecting the visual copy.
  copy
    .querySelectorAll("iframe,video,audio,script")
    .forEach((element) => element.remove());
  root.append(copy);
  shadow.append(style, root);
  // A second click retains the currently composited view, including a fading
  // predecessor, rather than abruptly discarding that predecessor.
  if (previous) {
    previous.style.position = "absolute";
    shadow.append(previous);
  }
  document.body.append(host);
  return host;
}
