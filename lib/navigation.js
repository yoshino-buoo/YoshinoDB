// A visit owns its scroll and filters. Two visits to the same URL can therefore
// have different positions, just as they do in the browser's Back/Forward stack.
export function createNavigation({ captureView, render, transition }) {
  const stateKey = "yoshinoVisit";
  const visits = new Map();
  const hash = () => location.hash || "#home";
  const makeVisit = (route, parent = null) => ({
    id: crypto.randomUUID(),
    hash: route,
    y: 0,
    view: null,
    parent,
  });
  const savedVisit = () => {
    const saved = history.state?.[stateKey];
    return saved?.id && saved.hash === hash() ? saved : null;
  };
  let current = savedVisit() || makeVisit(hash());
  let changing = true;
  let sequence = 0;
  let saveTimer;

  // The application restores after rebuilding the destination DOM. Letting the
  // browser restore first would scroll the outgoing page instead.
  history.scrollRestoration = "manual";
  function persist() {
    if (current.hash !== hash()) return;
    try {
      history.replaceState({ ...history.state, [stateKey]: current }, "");
    } catch {
      // In-memory visits still work when a browser limits History API writes.
    }
  }
  function remember(write = true) {
    clearTimeout(saveTimer);
    if (changing) return;
    current = { ...current, y: Math.max(0, scrollY), view: captureView() };
    visits.set(current.id, current);
    if (write) persist();
  }
  persist();
  visits.set(current.id, current);

  function show(visit) {
    const serial = ++sequence;
    current = visit;
    visits.set(current.id, current);
    changing = true;
    persist();
    return transition(() => render(visit.view), {
      scrollPosition: visit.y,
    }).finally(() => {
      if (serial !== sequence) return;
      changing = false;
      remember();
    });
  }
  function go(route) {
    const target = route || "#home";
    if (target === current.hash) return;
    remember();
    const next = makeVisit(target, { id: current.id, hash: current.hash });
    history.pushState({ [stateKey]: next }, "", target);
    return show(next);
  }
  function followHistory() {
    const saved = savedVisit();
    // A traversal emits popstate and hashchange; render it only once.
    if (saved?.id === current.id && saved.hash === current.hash) return;
    remember(false);
    const next = saved
      ? visits.get(saved.id) || saved
      : makeVisit(hash(), { id: current.id, hash: current.hash });
    show(next);
  }
  addEventListener("popstate", followHistory);
  addEventListener("hashchange", followHistory);
  addEventListener("pagehide", () => remember());
  addEventListener(
    "scroll",
    () => {
      if (changing) return;
      // Debounce disk-backed history writes; Safari limits frequent replaceState.
      clearTimeout(saveTimer);
      saveTimer = setTimeout(remember, 200);
    },
    { passive: true },
  );
  document.addEventListener("click", (event) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    const anchor = event.target.closest?.('a[href^="#"]');
    if (
      !anchor ||
      anchor.target ||
      anchor.hasAttribute("download") ||
      anchor.classList.contains("skip")
    )
      return;
    event.preventDefault();
    if (anchor.hasAttribute("data-detail-back") && current.parent) {
      remember();
      history.back();
    } else {
      go(anchor.getAttribute("href"));
    }
  });
  return {
    go,
    get initialView() {
      return current.view;
    },
    get backHash() {
      return current.parent?.hash;
    },
    ready() {
      window.scrollTo({ top: current.y, behavior: "instant" });
      changing = false;
      remember();
    },
  };
}
