// Build the contents from the rendered profile so optional sections, translations,
// and live editor drafts all share the same navigation.
if (
  typeof customElements !== "undefined" &&
  !customElements.get("yoshino-profile-nav")
) {
  customElements.define(
    "yoshino-profile-nav",
    class extends HTMLElement {
      connectedCallback() {
        if (this.getRootNode() !== document || this.controller) return;
        this.controller = new AbortController();
        const { signal } = this.controller;
        queueMicrotask(() => {
          if (signal.aborted) return;
          this.mount(signal);
        });
      }

      mount(signal) {
        const profile = this.closest(".profile-page");
        this.sections = [
          profile.querySelector(".profile-grid"),
          ...profile.querySelectorAll(".profile-reading > .entry-section"),
        ].filter((section) => section?.querySelector("h2"));
        if (!this.sections.length) return;
        this.innerHTML = `<nav class="profile-toc">
          <div class="profile-toc-heading"><span class="profile-toc-label"></span><small>ON THIS PAGE</small></div>
          <button type="button" class="profile-toc-toggle" aria-expanded="false" aria-controls="profile-contents">
            <span class="profile-toc-label"></span><span class="profile-toc-current"></span><span class="profile-toc-count" aria-hidden="true"></span><span class="profile-toc-chevron" aria-hidden="true"></span>
          </button>
          <ol id="profile-contents" class="profile-toc-list"></ol>
        </nav>`;
        this.nav = this.querySelector("nav");
        this.nav.setAttribute("aria-label", this.dataset.title);
        this.querySelectorAll(".profile-toc-label").forEach((label) => {
          label.textContent = this.dataset.title;
        });
        this.toggle = this.querySelector(".profile-toc-toggle");
        this.list = this.querySelector("ol");
        this.buttons = this.sections.map((section, index) => {
          const heading = section.querySelector("h2");
          section.id = `profile-section-${index}`;
          section.classList.add("profile-jump-target");
          heading.tabIndex = -1;
          const li = document.createElement("li");
          const button = document.createElement("button");
          button.type = "button";
          button.dataset.profileJump = index;
          button.setAttribute("aria-controls", section.id);
          const number = document.createElement("span");
          number.className = "profile-toc-number";
          number.setAttribute("aria-hidden", "true");
          number.textContent = String(index + 1).padStart(2, "0");
          const label = document.createElement("span");
          label.textContent = index === 0 ? this.dataset.overview : heading.textContent;
          button.append(number, label);
          li.append(button);
          this.list.append(li);
          button.addEventListener("click", () => {
            this.close();
            heading.focus({ preventScroll: true });
            section.scrollIntoView({
              block: "start",
              behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
                ? "instant"
                : "smooth",
            });
          }, { signal });
          return button;
        });
        this.toggle.addEventListener("click", () => {
          const opening = this.toggle.getAttribute("aria-expanded") !== "true";
          this.style.setProperty("--profile-menu-space", `${Math.max(120, innerHeight - this.toggle.getBoundingClientRect().bottom - 24)}px`);
          this.toggle.setAttribute("aria-expanded", String(opening));
          this.toggleAttribute("data-open", opening);
          if (opening) this.keepCurrentVisible();
        }, { signal });
        document.addEventListener("click", (event) => {
          if (!this.contains(event.target)) this.close();
        }, { signal });
        document.addEventListener("keydown", (event) => {
          if (event.key === "Escape" && this.hasAttribute("data-open")) {
            event.preventDefault();
            this.close();
            this.toggle.focus({ preventScroll: true });
          }
        }, { signal });
        this.addEventListener("focusout", (event) => {
          if (event.relatedTarget && !this.contains(event.relatedTarget)) this.close();
        }, { signal });
        this.wide = matchMedia("(min-width: 1280px)");
        const schedule = () => {
          if (this.frame) return;
          this.frame = requestAnimationFrame(() => {
            this.frame = null;
            this.update();
          });
        };
        this.wide.addEventListener("change", () => {
          this.close();
          schedule();
        }, { signal });
        window.addEventListener("scroll", schedule, { passive: true, signal });
        window.addEventListener("resize", schedule, { passive: true, signal });
        this.observer = new ResizeObserver(schedule);
        this.observer.observe(profile);
        this.update();
      }

      close() {
        this.removeAttribute("data-open");
        this.toggle?.setAttribute("aria-expanded", "false");
      }

      update() {
        const threshold = this.wide.matches ? 64 : this.toggle.offsetHeight + 40;
        let current = 0;
        this.sections.forEach((section, index) => {
          if (section.getBoundingClientRect().top <= threshold) current = index;
        });
        if (scrollY + innerHeight >= document.documentElement.scrollHeight - 2)
          current = this.sections.length - 1;
        if (current === this.current) return;
        this.current = current;
        this.buttons.forEach((button, index) => {
          if (index === current) button.setAttribute("aria-current", "location");
          else button.removeAttribute("aria-current");
        });
        this.querySelector(".profile-toc-current").textContent =
          this.buttons[current].lastElementChild.textContent;
        this.querySelector(".profile-toc-count").textContent =
          `${String(current + 1).padStart(2, "0")} / ${this.sections.length}`;
        this.style.setProperty("--profile-progress", `${((current + 1) / this.sections.length) * 100}%`);
        this.keepCurrentVisible();
      }

      keepCurrentVisible() {
        const button = this.buttons[this.current];
        if (!button || !this.list.clientHeight) return;
        const top = button.getBoundingClientRect().top - this.list.getBoundingClientRect().top;
        if (top < 0) this.list.scrollTop += top;
        else if (top + button.offsetHeight > this.list.clientHeight)
          this.list.scrollTop += top + button.offsetHeight - this.list.clientHeight;
      }

      disconnectedCallback() {
        this.controller?.abort();
        this.observer?.disconnect();
        cancelAnimationFrame(this.frame);
        this.frame = null;
        this.controller = null;
        this.current = null;
      }
    },
  );
}
