const screen = document.querySelector("#boot-screen");
const began = performance.now();
let chinese = false;
try {
  chinese = localStorage.getItem("yoshino-lang") === "zh";
} catch {}
if (screen) {
  document.documentElement.lang = chinese ? "zh-Hans" : "ja";
  screen.querySelector("[data-boot-label]").textContent = chinese
    ? "正在翻开手帖"
    : "手帖を開いています";
  screen.querySelector("[data-boot-detail]").textContent = chinese
    ? "愿美好的缘分，与你相伴。"
    : "よきご縁が、ありますように。";
}
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export async function openFirstPage(reveal) {
  if (!screen) {
    reveal();
    return;
  }
  // Only resources visible on the opening page gate its entrance. Offscreen
  // artwork, video embeds and audio never hold up the archive.
  const visible = [...document.querySelectorAll("main img")]
    .filter((img) => {
      const rect = img.getBoundingClientRect();
      return rect.top < innerHeight && rect.bottom >= 0;
    })
    .slice(0, 8);
  const tasks = [
    document.fonts.ready,
    ...visible.map((img) => {
      img.loading = "eager";
      return img.decode().catch(() => {});
    }),
  ];
  let completed = 1;
  const progress = () =>
    screen.style.setProperty(
      "--boot-progress",
      String(completed / (tasks.length + 1)),
    );
  progress();
  await Promise.all(
    tasks.map(async (task) => {
      await Promise.race([task.catch(() => {}), wait(8000)]);
      completed++;
      progress();
    }),
  );
  await wait(Math.max(0, 1800 - (performance.now() - began)));
  const app = document.querySelector("#app");
  app.inert = false;
  app.removeAttribute("aria-busy");
  reveal();
  screen.classList.add("is-leaving");
  await wait(
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 150 : 1450,
  );
  screen.remove();
}
export function failFirstPage() {
  screen?.remove();
  const app = document.querySelector("#app");
  app.inert = false;
  app.removeAttribute("aria-busy");
}
