import { validateListening } from "./lib/listening.js";

const playIcon =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 11 7-11 7z"/></svg>';
const pauseIcon =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3v14H7zm7 0h3v14h-3z"/></svg>';
const soundIcon =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 9 4 0 5-4v14l-5-4H4z"/><path fill="none" stroke="currentColor" stroke-width="1.5" d="M16 8q4 4 0 8m3-11q7 7 0 14"/></svg>';
const time = (seconds) =>
  Number.isFinite(seconds)
    ? `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`
    : "0:00";
const readStored = (key) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const storedVolume = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw !== null && Number.isFinite(Number(raw))
      ? Math.max(0, Math.min(1, Number(raw)))
      : fallback;
  } catch {
    return fallback;
  }
};
const savePreference = (key, value) => {
  try {
    localStorage.setItem(key, String(value));
  } catch {}
};

export function createListening({ base, t, esc, onAudioStart }) {
  let tracks = {},
    previewRoot = null,
    previewId = null,
    previewVersion = "";
  let fadeFrame = 0,
    videoActive = false,
    waitingForGesture = false,
    booted = false;
  let bgmEnabled = readStored("yoshino-bgm-enabled") !== "false";
  let lastSavedAt = 0;
  const root = document.createElement("aside");
  root.className = "listening-dock";
  document.body.append(root);
  const bgm = document.createElement("audio"),
    preview = document.createElement("audio");
  bgm.id = "bgm-audio";
  preview.id = "preview-audio";
  bgm.preload = preview.preload = "none";
  bgm.loop = true;
  bgm.volume = 0.22;
  preview.volume = storedVolume("yoshino-preview-volume", 0.65);
  bgm.src = `${base}audio/hibi-instrumental.m4a`;
  // Media nodes live outside the route renderer. Only the BGM continues on navigation.
  document.body.append(bgm, preview);
  const state = new Map([
    [bgm, { serial: 0, pending: false, error: false, timer: 0 }],
    [preview, { serial: 0, pending: false, error: false, timer: 0 }],
  ]);
  const bgmVolume = bgm.volume;

  function stop(audio) {
    const s = state.get(audio);
    ++s.serial;
    s.pending = false;
    clearTimeout(s.timer);
    if (audio === bgm) cancelAnimationFrame(fadeFrame);
    audio.pause();
    update();
  }
  function failed(audio) {
    stop(audio);
    state.get(audio).error = true;
    update();
    if (audio === preview) queueMicrotask(resumeBgm);
  }
  async function start(audio) {
    const s = state.get(audio),
      serial = ++s.serial;
    s.error = false;
    s.pending = true;
    if (audio === preview) stop(bgm);
    if (audio === preview) {
      videoActive = false;
      onAudioStart();
    }
    if (audio === bgm) {
      cancelAnimationFrame(fadeFrame);
      bgm.volume = 0;
    }
    if (audio.error) audio.load();
    if (audio.ended) audio.currentTime = 0;
    clearTimeout(s.timer);
    s.timer = setTimeout(() => {
      if (s.serial === serial) failed(audio);
    }, 15000);
    update();
    try {
      await audio.play();
      if (s.serial !== serial) return;
      clearTimeout(s.timer);
      s.pending = false;
      if (audio === bgm) {
        const began = performance.now();
        const fade = (now) => {
          if (s.serial !== serial || bgm.paused) return;
          const progress = Math.min(1, (now - began) / 650);
          bgm.volume = bgmVolume * (1 - (1 - progress) ** 2);
          if (progress < 1) fadeFrame = requestAnimationFrame(fade);
        };
        fadeFrame = requestAnimationFrame(fade);
      }
      update();
    } catch (error) {
      if (s.serial !== serial || error.name === "AbortError") return;
      if (audio === bgm && error.name === "NotAllowedError") {
        clearTimeout(s.timer);
        s.pending = false;
        waitingForGesture = true;
        update();
      } else failed(audio);
    }
  }
  function resumeBgm() {
    if (
      !booted ||
      !bgmEnabled ||
      videoActive ||
      waitingForGesture ||
      !preview.paused ||
      state.get(preview).pending ||
      !bgm.paused ||
      state.get(bgm).pending ||
      state.get(bgm).error
    )
      return;
    start(bgm);
  }
  function toggle(audio) {
    if (!audio.paused || state.get(audio).pending) {
      stop(audio);
      if (audio === preview) resumeBgm();
    } else start(audio);
  }
  for (const audio of [bgm, preview]) {
    for (const event of [
      "timeupdate",
      "durationchange",
      "loadedmetadata",
      "playing",
      "pause",
      "ended",
      "volumechange",
    ])
      audio.addEventListener(event, update);
    audio.addEventListener("error", () => failed(audio));
  }

  preview.addEventListener("pause", () => queueMicrotask(resumeBgm));
  preview.addEventListener("ended", () => queueMicrotask(resumeBgm));
  bgm.addEventListener(
    "loadedmetadata",
    () => {
      const position = Number(readStored("yoshino-bgm-position"));
      if (
        Number.isFinite(position) &&
        position > 0 &&
        position < bgm.duration - 1
      )
        bgm.currentTime = position;
    },
    { once: true },
  );
  const rememberPosition = () => {
    if (bgm.currentTime > 0)
      savePreference("yoshino-bgm-position", bgm.currentTime);
  };
  bgm.addEventListener("timeupdate", () => {
    if (performance.now() - lastSavedAt > 5000) {
      lastSavedAt = performance.now();
      rememberPosition();
    }
  });
  window.addEventListener("pagehide", rememberPosition);

  function detail(item) {
    const track = tracks[item.id];
    if (!track) return "";
    const version =
      track.version === "game"
        ? "GAME VERSION"
        : track.version === "master"
          ? "M@STER VERSION"
          : t("オリジナル音源", "原版音源");
    return `<section class="song-listening" data-preview="${esc(item.id)}" aria-label="${t("楽曲の試聴", "歌曲试听")}"><div class="preview-top"><button class="preview-toggle" data-preview-toggle aria-label="${t("試聴を再生", "播放试听")}">${playIcon}</button><div><strong>${t("この歌に、耳をすませて", "听一听，这首歌")}</strong><small>${esc(version)} · ${t("試聴", "试听片段")}</small></div><span class="audio-bars" aria-hidden="true"><i></i><i></i><i></i><i></i></span></div><div class="preview-progress"><output data-preview-time>0:00</output><input type="range" min="0" max="100" step="0.1" value="0" data-preview-seek aria-label="${t("試聴の再生位置", "试听进度")}" disabled><output data-preview-duration>—:—</output></div><div class="preview-bottom"><a class="itunes-badge" href="${esc(track.storeUrl)}" target="_blank" rel="noopener noreferrer"><img src="${base}assets/providers/itunes-${t("ja", "zh")}.svg" width="108" height="36" alt="${t("iTunes で購入", "在 iTunes 购买")}"></a><label class="preview-volume">${soundIcon}<input type="range" min="0" max="1" step="0.01" value="${preview.volume}" data-preview-volume aria-label="${t("試聴の音量", "试听音量")}"></label></div><small class="preview-credit">Preview provided courtesy of iTunes</small><p class="preview-status" role="status" aria-live="polite"></p></section>`;
  }
  function renderDock() {
    root.setAttribute("aria-label", t("背景音楽", "背景音乐"));
    root.innerHTML = `<button class="bgm-switch" data-bgm-toggle role="switch" aria-checked="${bgmEnabled}"><span class="audio-bars" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span>BGM</span><span class="bgm-switch-track" aria-hidden="true"><i></i></span></button>`;
    root.querySelector("[data-bgm-toggle]").onclick = () => {
      bgmEnabled = !bgmEnabled;
      savePreference("yoshino-bgm-enabled", bgmEnabled);
      state.get(bgm).error = false;
      waitingForGesture = false;
      if (bgmEnabled) resumeBgm();
      else {
        rememberPosition();
        stop(bgm);
      }
      update();
    };
  }
  function update() {
    if (!root.querySelector("[data-bgm-toggle]")) return;
    const bs = state.get(bgm),
      ps = state.get(preview);
    const active = !bgm.paused && !bs.pending;
    root.classList.toggle("is-playing", active);
    const button = root.querySelector("[data-bgm-toggle]");
    button.setAttribute("aria-checked", String(bgmEnabled));
    button.setAttribute("aria-label", t("背景音楽", "背景音乐"));
    button.title = bgmEnabled
      ? t("BGM をオフにする", "关闭背景音乐")
      : t("BGM をオンにする", "开启背景音乐");
    if (!previewRoot?.isConnected) return;
    previewRoot.classList.toggle("is-playing", !preview.paused && !ps.pending);
    previewRoot.classList.toggle("is-loading", ps.pending);
    const toggleButton = previewRoot.querySelector("[data-preview-toggle]");
    toggleButton.innerHTML =
      !preview.paused || ps.pending ? pauseIcon : playIcon;
    toggleButton.setAttribute(
      "aria-label",
      !preview.paused || ps.pending
        ? t("試聴を一時停止", "暂停试听")
        : t("試聴を再生", "播放试听"),
    );
    previewRoot.querySelector("[data-preview-time]").textContent = time(
      preview.currentTime,
    );
    previewRoot.querySelector("[data-preview-duration]").textContent =
      Number.isFinite(preview.duration) ? time(preview.duration) : "—:—";
    const seek = previewRoot.querySelector("[data-preview-seek]");
    seek.disabled = !Number.isFinite(preview.duration) || preview.duration <= 0;
    const progress = !seek.disabled
      ? (preview.currentTime / preview.duration) * 100
      : 0;
    seek.value = String(progress);
    seek.style.setProperty("--played", `${progress}%`);
    previewRoot.querySelector(".preview-status").textContent = ps.error
      ? t(
          "試聴を読み込めませんでした。iTunes でもお聴きいただけます。",
          "试听暂时无法载入，也可以前往 iTunes 收听。",
        )
      : ps.pending
        ? t("試聴を読み込み中…", "正在加载试听…")
        : "";
  }
  function bind(container) {
    const next = container.querySelector("[data-preview]");
    if ((next?.dataset.preview || null) !== previewId) {
      stop(preview);
      preview.removeAttribute("src");
      preview.load();
      state.get(preview).error = false;
      previewId = next?.dataset.preview || null;
      if (previewId) preview.src = tracks[previewId].previewUrl;
    }
    previewRoot = next;
    if (next) {
      next.querySelector("[data-preview-toggle]").onclick = () =>
        toggle(preview);
      next.querySelector("[data-preview-seek]").oninput = (event) => {
        if (Number.isFinite(preview.duration))
          preview.currentTime =
            (Number(event.target.value) / 100) * preview.duration;
      };
      next.querySelector("[data-preview-volume]").oninput = (event) => {
        preview.volume = Number(event.target.value);
        savePreference("yoshino-preview-volume", preview.volume);
      };
    }
    // Translate only the controls; the persistent audio nodes are untouched.
    const version = t("ja", "zh");
    if (version !== previewVersion) {
      renderDock();
      previewVersion = version;
    }
    if (!container.querySelector(".inline-player[data-video-id]"))
      videoActive = false;
    booted = true;
    update();
    resumeBgm();
  }
  // Browsers may block audible autoplay. A trusted first click/key unlocks it;
  // it must never override a visitor's saved OFF preference or another sound.
  const unlock = (event) => {
    if (
      !event.isTrusted ||
      (event.type === "keydown" && !["Enter", " "].includes(event.key))
    )
      return;
    waitingForGesture = false;
    resumeBgm();
  };
  document.addEventListener("click", unlock);
  document.addEventListener("keydown", unlock);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) resumeBgm();
  });
  renderDock();
  update();
  return {
    detail,
    bind,
    setData(data) {
      tracks = validateListening(data).tracks;
    },
    videoStarted() {
      videoActive = true;
      stop(bgm);
      stop(preview);
    },
    videoStopped() {
      videoActive = false;
      resumeBgm();
    },
  };
}
