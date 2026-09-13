import { validateListening } from "./lib/listening.js";
import { isWikiAudio } from "./lib/voice-guide.js";

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
    voiceRoot = null,
    previewId = null,
    previewVersion = "";
  let fadeFrame = 0,
    videoActive = false,
    waitingForGesture = false,
    booted = false;
  let bgmEnabled = readStored("yoshino-bgm-enabled") !== "false";
  const root = document.createElement("aside");
  root.className = "listening-dock";
  document.body.append(root);
  const bgm = document.createElement("audio"),
    preview = document.createElement("audio"),
    voice = document.createElement("audio");
  bgm.id = "bgm-audio";
  preview.id = "preview-audio";
  voice.id = "voice-audio";
  bgm.preload = "auto";
  preview.preload = "none";
  voice.preload = "none";
  voice.volume = 0.85;
  bgm.loop = true;
  bgm.volume = 0.22;
  preview.volume = storedVolume("yoshino-preview-volume", 0.65);
  bgm.src = `${base}audio/hibi-instrumental.m4a`;
  // Media nodes live outside the route renderer. Only the BGM continues on navigation.
  document.body.append(bgm, preview, voice);
  const state = new Map([
    [bgm, { serial: 0, pending: false, error: false, timer: 0 }],
    [preview, { serial: 0, pending: false, error: false, timer: 0 }],
    [voice, { serial: 0, pending: false, error: false, timer: 0 }],
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
    if (audio !== bgm) queueMicrotask(resumeBgm);
  }
  async function start(audio) {
    const s = state.get(audio),
      serial = ++s.serial;
    s.error = false;
    s.pending = true;
    if (audio !== bgm) {
      stop(bgm);
      stop(audio === voice ? preview : voice);
      videoActive = false;
      onAudioStart();
    }
    if (audio === bgm) {
      cancelAnimationFrame(fadeFrame);
      // Start audibly so the browser can correctly allow or reject autoplay.
      // A zero-volume start may resolve play(), then get paused on unmuting.
      bgm.volume = 0.005;
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
          const progress = Math.max(0, Math.min(1, (now - began) / 650));
          bgm.volume = 0.005 + (bgmVolume - 0.005) * (1 - (1 - progress) ** 2);
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
      !voice.paused ||
      state.get(voice).pending ||
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
      if (audio !== bgm) resumeBgm();
    } else start(audio);
  }
  for (const audio of [bgm, preview, voice]) {
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

  for (const audio of [preview, voice]) {
    audio.addEventListener("pause", () => queueMicrotask(resumeBgm));
    audio.addEventListener("ended", () => queueMicrotask(resumeBgm));
  }
  // A new visit starts at the beginning; only the ON/OFF preference persists.

  function detail(item) {
    const track = tracks[item.id];
    if (!track) return "";
    const version =
      track.version === "game"
        ? "GAME VERSION"
        : track.version === "master"
          ? "M@STER VERSION"
          : t("オリジナル音源", "原版音源");
    return `<section class="song-listening" data-preview="${esc(item.id)}" aria-label="${t("楽曲の試聴", "歌曲试听")}"><div class="preview-top"><button class="preview-toggle" data-preview-toggle aria-label="${t("試聴を再生", "播放试听")}">${playIcon}${pauseIcon}</button><div><strong>${t("この歌に、耳をすませて", "听一听，这首歌")}</strong><small>${esc(version)} · ${t("試聴", "试听片段")}</small></div><span class="audio-bars" aria-hidden="true"><i></i><i></i><i></i><i></i></span></div><div class="preview-progress"><output data-preview-time>0:00</output><input type="range" min="0" max="100" step="0.1" value="0" data-preview-seek aria-label="${t("試聴の再生位置", "试听进度")}" disabled><output data-preview-duration>—:—</output></div><div class="preview-bottom"><a class="itunes-badge" href="${esc(track.storeUrl)}" target="_blank" rel="noopener noreferrer"><img src="${base}assets/providers/itunes-${t("ja", "zh")}.svg" width="108" height="36" alt="${t("iTunes で購入", "在 iTunes 购买")}"></a><label class="preview-volume">${soundIcon}<input type="range" min="0" max="1" step="0.01" value="${preview.volume}" data-preview-volume aria-label="${t("試聴の音量", "试听音量")}"></label></div><small class="preview-credit">Preview provided courtesy of iTunes</small><p class="preview-status" role="status" aria-live="polite"></p></section>`;
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
    if (voiceRoot?.isConnected) {
      const vs = state.get(voice);
      const playing = !voice.paused || vs.pending;
      const voiceButton = voiceRoot.querySelector("[data-voice-src]");
      voiceButton.setAttribute("aria-pressed", String(playing));
      voiceButton.setAttribute(
        "aria-label",
        `${playing ? t("一時停止", "暂停") : t("再生", "播放")} · ${voiceButton.textContent.trim()}`,
      );
      voiceRoot.classList.toggle("is-loading", vs.pending);
      voiceRoot.querySelector(".voice-time").textContent = Number.isFinite(
        voice.duration,
      )
        ? `${time(voice.currentTime)} / ${time(voice.duration)}`
        : "";
      voiceRoot.querySelector(".voice-status").textContent = vs.error
        ? t(
            "音声を読み込めませんでした。Wiki でもお聴きいただけます。",
            "语音暂时无法载入，也可以打开 Wiki 收听。",
          )
        : vs.pending
          ? t("読み込み中…", "正在加载…")
          : "";
    }
    if (!previewRoot?.isConnected) return;
    previewRoot.classList.toggle("is-playing", !preview.paused && !ps.pending);
    previewRoot.classList.toggle("is-loading", ps.pending);
    const toggleButton = previewRoot.querySelector("[data-preview-toggle]");
    // Keep the pointer target stable across progress events and BGM fades.
    // Replacing the SVG between pointerdown and pointerup cancels the click.
    toggleButton.dataset.playing = String(!preview.paused || ps.pending);
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
    // A route/language render retires the previous clip, never the BGM node.
    stop(voice);
    voiceRoot = null;
    voice.removeAttribute("src");
    voice.load();
    state.get(voice).error = false;
    container.querySelectorAll("[data-voice-src]").forEach((button) => {
      button.onclick = () => {
        const src = button.dataset.voiceSrc;
        if (!isWikiAudio(src)) return;
        const nextRoot = button.closest(".voice-clip");
        if (voiceRoot !== nextRoot || voice.getAttribute("src") !== src) {
          stop(voice);
          voiceRoot = nextRoot;
          voice.src = src;
          state.get(voice).error = false;
        }
        toggle(voice);
      };
    });
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
      stop(voice);
    },
    videoStopped() {
      videoActive = false;
      resumeBgm();
    },
  };
}
