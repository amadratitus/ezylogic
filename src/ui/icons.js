// One consistent icon set: 24×24 grid, 1.75px round strokes, currentColor.
// The markup below is static and trusted; no user input reaches it.

const PATHS = {
  letters: '<path d="M3 17 7.5 6 12 17M4.6 13h5.8"/><path d="M15 7h6M15 12h6M15 17h6"/>',
  grid: '<rect x="3" y="3" width="18" height="18" rx="2.5"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/>',
  arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h8"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  download: '<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  reset: '<path d="M4 12a8 8 0 1 0 2.6-5.9"/><path d="M4 4.5V9h4.5"/>',
  alert: '<path d="M12 4 2.8 19.5h18.4L12 4Z"/><path d="M12 10v4.5M12 17v.2"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.5v.2"/>',
  sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  play: '<path d="M8 5.5v13l10.5-6.5L8 5.5Z" fill="currentColor"/>',
  pause: '<path d="M8 5.5v13M16 5.5v13" stroke-width="2.5"/>',
  stepBack: '<path d="M15.5 6 9 12l6.5 6"/>',
  stepForward: '<path d="M8.5 6 15 12l-6.5 6"/>',
  restart: '<path d="M6 5v14"/><path d="M19 6 10 12l9 6V6Z" fill="currentColor"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.8"/>',
  sigma: '<path d="M18 6V4H6l7 8-7 8h12v-2"/>',
};

/**
 * @param {keyof typeof PATHS} name
 * @param {number} [size]
 * @returns {SVGSVGElement}
 */
export function icon(name, size = 16) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.75');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.classList.add('icon');
  svg.innerHTML = PATHS[name] ?? '';
  return svg;
}

/**
 * The Anagram Magic brand mark: a tilted letter tile with a spark.
 * Colours come from CSS custom properties so it follows the theme.
 */
export function brandMark(size = 28) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 32 32');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.innerHTML =
    '<g transform="rotate(-8 15 17)">' +
    '<rect x="3.5" y="6" width="22" height="22" rx="6" fill="var(--accent)"/>' +
    '<path d="M9.6 22.6 14.5 11l4.9 11.6M11.6 18.6h5.8" fill="none" stroke="var(--accent-contrast)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>' +
    '</g>' +
    '<path d="M25.5 2c.55 2.9 1.6 3.95 4.5 4.5-2.9.55-3.95 1.6-4.5 4.5-.55-2.9-1.6-3.95-4.5-4.5 2.9-.55 3.95-1.6 4.5-4.5Z" fill="var(--amber)"/>';
  return svg;
}
