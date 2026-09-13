// Each costume has four transparent poses. Only the small character moves;
// no canvas, document-wide animation loop, or off-page image preloading.
export function renderPetitIdol(petit, { base, t, esc }) {
  if (!petit?.poses?.length) return "";
  return `<yoshino-petit class="card-petit" data-running="false">
    <div class="petit-caption"><span class="entry-kicker">PETIT IDOL</span><h3>${t("ぷち芳乃", "Q 版芳乃")}</h3><p>${t("タップでポーズを変えて", "轻触，换个姿势")}</p><div class="petit-tools"><span data-petit-count aria-live="polite">1 / ${petit.poses.length}</span><button type="button" class="petit-pause" data-petit-pause aria-pressed="false" aria-label="${t("アニメーションを一時停止", "暂停人物动画")}" data-pause-label="${t("アニメーションを一時停止", "暂停人物动画")}" data-resume-label="${t("アニメーションを再開", "继续人物动画")}" disabled><svg viewBox="0 0 20 20" aria-hidden="true"><path class="petit-pause-mark" d="M7 5v10M13 5v10"/><path class="petit-play-mark" d="m7 4 8 6-8 6Z"/></svg></button></div></div>
    <button type="button" class="petit-stage" data-petit-next aria-label="${t("芳乃のポーズを変える", "切换芳乃的姿势")}" disabled><span class="petit-ground" aria-hidden="true"></span><span class="petit-idle"><span class="petit-pose">${petit.poses.map((pose, i) => `<img data-petit-src="${esc(base + pose.image)}" data-petit-pose="${i}" alt="" width="256" height="256" decoding="async" draggable="false" hidden>`).join("")}</span></span></button>
  </yoshino-petit>`;
}

if (
  typeof customElements !== "undefined" &&
  !customElements.get("yoshino-petit")
) {
  customElements.define(
    "yoshino-petit",
    class extends HTMLElement {
      connectedCallback() {
        // The outgoing route has an inert visual copy in a shadow tree. It must
        // remain a frozen picture, not create another interactive component.
        if (this.getRootNode() !== document || this.controller) return;
        this.controller = new AbortController();
        const { signal } = this.controller;
        queueMicrotask(() => {
          if (signal.aborted) return;
          this.nextButton = this.querySelector("[data-petit-next]");
          this.pauseButton = this.querySelector("[data-petit-pause]");
          this.pose = this.querySelector(".petit-pose");
          this.reduced = matchMedia("(prefers-reduced-motion: reduce)");
          this.index = 0;
          this.nextButton.addEventListener("click", () => this.nextPose(), {
            signal,
          });
          this.pauseButton.addEventListener(
            "click",
            () => {
              this.paused = !this.paused;
              this.pauseButton.setAttribute(
                "aria-pressed",
                String(this.paused),
              );
              this.pauseButton.setAttribute(
                "aria-label",
                this.pauseButton.dataset[
                  this.paused ? "resumeLabel" : "pauseLabel"
                ],
              );
              this.updateMotion();
            },
            { signal },
          );
          document.addEventListener(
            "visibilitychange",
            () => this.updateMotion(),
            { signal },
          );
          this.reduced.addEventListener("change", () => this.updateMotion(), {
            signal,
          });
          this.observer = new IntersectionObserver(([entry]) => {
            this.visible = entry.isIntersecting;
            if (this.visible && !this.loading) this.loadPoses(signal);
            this.updateMotion();
          });
          this.observer.observe(this);
        });
      }

      async loadPoses(signal) {
        this.loading = true;
        const images = [...this.querySelectorAll("[data-petit-src]")];
        const ready = await Promise.all(
          images.map(async (image) => {
            try {
              image.src = image.dataset.petitSrc;
              await image.decode();
              return image;
            } catch {
              return null;
            }
          }),
        );
        if (signal.aborted) return;
        this.images = ready.filter(Boolean);
        if (!this.images.length) {
          this.hidden = true;
          return;
        }
        this.showPose(0);
        this.dataset.ready = "true";
        this.nextButton.disabled = this.images.length < 2;
        this.pauseButton.disabled = false;
        this.updateMotion();
      }

      showPose(index) {
        this.index = index;
        this.images.forEach((image, i) => {
          image.hidden = i !== index;
        });
        this.querySelector("[data-petit-count]").textContent =
          `${index + 1} / ${this.images.length}`;
        this.dataset.pose = String(index);
      }

      updateMotion() {
        const running = !!(
          this.images?.length &&
          this.visible &&
          !document.hidden &&
          !this.paused &&
          !this.reduced.matches
        );
        this.dataset.running = String(running);
        if (!running) this.pose?.getAnimations().forEach((a) => a.cancel());
      }

      async nextPose() {
        if (this.busy || !this.images?.length) return;
        const next = (this.index + 1) % this.images.length;
        if (this.dataset.running !== "true") {
          this.showPose(next);
          return;
        }
        this.busy = true;
        try {
          await this.pose.animate(
            [
              { transform: "translateY(0) scale(1)" },
              { transform: "translateY(3px) scale(1.025, .97)" },
            ],
            { duration: 120, easing: "ease-in", fill: "forwards" },
          ).finished;
          if (!this.isConnected || this.dataset.running !== "true") return;
          // Every pose has decoded before it becomes selectable. Swap at the
          // start of the hop so changing the image never introduces a blank.
          this.showPose(next);
          this.pose.getAnimations().forEach((a) => a.cancel());
          const direction = next % 2 ? 1 : -1;
          await this.pose.animate(
            [
              { transform: "translateY(3px) scale(1.025, .97)", offset: 0 },
              {
                transform: `translateY(-13px) rotate(${direction * 4}deg) scale(.99, 1.015)`,
                offset: 0.38,
              },
              { transform: "translateY(1px) scale(1.015, .985)", offset: 0.78 },
              { transform: "translateY(0) scale(1)", offset: 1 },
            ],
            { duration: 480, easing: "cubic-bezier(.2,.65,.35,1)" },
          ).finished;
        } catch {
          // A route change, pause, or hidden tab cancels only this gesture.
        } finally {
          this.busy = false;
        }
      }

      disconnectedCallback() {
        this.controller?.abort();
        this.observer?.disconnect();
        this.pose?.getAnimations().forEach((a) => a.cancel());
        this.controller = null;
        this.loading = false;
        this.dataset.running = "false";
      }
    },
  );
}
