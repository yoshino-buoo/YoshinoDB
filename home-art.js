// Small line drawings share the archive's ink and paper palette. Their moving
// parts are separate from the entrance transforms on the containing links.
export function homeBlossoms() {
  const petal =
    '<path d="M0-3C-3-7-5.2-13-4-19L0-16.1L4-19C5.2-13 3-7 0-3Z"/>';
  const flower = [0, 72, 144, 216, 288]
    .map((angle) => `<g transform="rotate(${angle})">${petal}</g>`)
    .join("");
  return `<div class="home-blossoms" aria-hidden="true">${Array.from({ length: 6 }, (_, i) => `<span class="blossom-course blossom-course-${i + 1}" data-ambient><span class="blossom-fall"><span class="blossom-sway"><svg class="blossom-drawing" viewBox="-20 -20 40 40" focusable="false">${flower}</svg></span></span></span>`).join("")}</div>`;
}

export function directoryArt(kind) {
  const drawings = {
    cards: `<g class="icon-card-back"><rect x="12" y="9" width="29" height="39" rx="3"/></g><g class="icon-card-front"><rect x="22" y="16" width="29" height="39" rx="3"/><path d="M27 43l7-9 6 5 6-9M28 49h17"/><circle cx="32" cy="27" r="3"/></g>`,
    songs: `<path class="icon-staff" d="M9 24h46M9 33h46M9 42h46"/><g class="icon-note"><path d="M25 43V18l24-5v25M25 23l24-5"/><ellipse cx="20" cy="43" rx="5" ry="3.5"/><ellipse cx="44" cy="38" rx="5" ry="3.5"/></g>`,
    stories: `<path d="M32 18C23 12 13 13 7 15v34c9-3 18-1 25 4 7-5 16-7 25-4V15c-6-2-16-3-25 3v35M13 23l12 3M13 32l12 3M13 41l12 3"/><path class="icon-page" d="M32 18c6-7 12-9 20-10v34c-8 1-14 4-20 11z"/>`,
    units: `<g class="icon-member icon-member-left"><circle cx="15" cy="23" r="5"/><path d="M5 49V39c0-8 20-8 20 0v10M10 41v8"/></g><g class="icon-member icon-member-right"><circle cx="49" cy="23" r="5"/><path d="M39 49V39c0-8 20-8 20 0v10M54 41v8"/></g><g class="icon-member-center"><circle cx="32" cy="15" r="6"/><path d="M20 50V36c0-11 24-11 24 0v14ZM26 38v12m12-12v12"/></g>`,
    videos: `<rect x="8" y="13" width="48" height="38" rx="4"/><path d="M8 21h48M8 43h48M17 13v8M29 13v8M41 13v8M17 43v8M29 43v8M41 43v8"/><path class="icon-play" d="m27 26 13 6-13 6z"/>`,
    timeline: `<circle cx="32" cy="32" r="23"/><path d="M32 13v3M51 32h-3M32 51v-3M13 32h3"/><path class="icon-clock" d="M32 20v12l9 6"/><circle cx="32" cy="32" r="2"/>`,
  };
  return `<svg class="directory-drawing drawing-${kind}" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${drawings[kind] || ""}</svg>`;
}
