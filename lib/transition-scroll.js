import { recordScroll } from "./scroll-diagnostics.js";

// WebKit can scroll its last painted page while a View Transition's update
// callback is still suppressing rendering. Stage the new page at the current
// scroll offset, then reset the real scroll only after the snapshots are ready.
export function stageTransitionScroll(destination = 0) {
  const app = document.querySelector("#app");
  const root = document.documentElement;
  if (!app || scrollY === destination) return () => {};
  const offset = scrollY;
  const translate = app.style.translate;
  const minHeight = root.style.minHeight;
  // A shorter detail must not clamp scroll while replacing the list either.
  root.style.minHeight = `${root.scrollHeight}px`;
  app.style.translate = `0 ${offset - destination}px`;
  recordScroll("staged");
  let staged = true;
  return () => {
    if (!staged) return;
    staged = false;
    // These changes leave the incoming page at exactly the same viewport
    // coordinates; the browser's transition layers now cover the scroll.
    recordScroll("before-reset");
    window.scrollTo({ top: destination, behavior: "instant" });
    recordScroll("after-reset");
    app.style.translate = translate;
    root.style.minHeight = minHeight;
    recordScroll("released");
  };
}
