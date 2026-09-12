// Opt-in, device-local diagnostics. Nothing is collected on ordinary visits,
// stored, or transmitted; the reader explicitly copies the report when needed.
const enabled =
  new URLSearchParams(location.search).get("scroll-debug") === "1";
let began = performance.now();
const events = [];

export function recordScroll(stage) {
  if (!enabled) return;
  events.push({
    stage,
    ms: Math.round(performance.now() - began),
    route: location.hash,
    y: scrollY,
    visualY: visualViewport?.pageTop,
    translate: document.querySelector("#app")?.style.translate || "",
    minHeight: document.documentElement.style.minHeight,
  });
  if (events.length > 100) events.splice(1, 1);
}

if (enabled) {
  document.addEventListener(
    "click",
    (event) => {
      if (!event.target.closest?.('a[href^="#entry/"]')) return;
      events.length = 0;
      began = performance.now();
      recordScroll("click");
    },
    true,
  );
  addEventListener("scroll", () => recordScroll("scroll"), { passive: true });
  addEventListener("hashchange", () => recordScroll("hashchange"));
  visualViewport?.addEventListener("scroll", () =>
    recordScroll("visual-scroll"),
  );
  addEventListener("unhandledrejection", (event) => {
    recordScroll(`error: ${String(event.reason)}`);
  });
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "复制滚动诊断";
  button.style.cssText =
    "position:fixed;left:12px;bottom:18px;z-index:9999;padding:10px 15px;border:1px solid #b69d79;border-radius:20px;background:#faf8f2;color:#723a40;font:13px sans-serif;box-shadow:0 2px 12px #413d3820";
  button.addEventListener("click", async () => {
    const report = JSON.stringify({
      tool: "YoshinoDB scroll diagnostic 1",
      browser: navigator.userAgent,
      viewport: {
        width: innerWidth,
        height: innerHeight,
        scale: visualViewport?.scale,
      },
      final: {
        y: scrollY,
        maxY: document.documentElement.scrollHeight - innerHeight,
        appTop: document.querySelector("#app")?.getBoundingClientRect().top,
      },
      events,
    });
    try {
      await navigator.clipboard.writeText(report);
      button.textContent = "已复制，可粘贴到对话";
    } catch {
      window.prompt("复制以下诊断记录", report);
    }
  });
  document.body.append(button);
}
