// App shell: hash-based routing, navigation state and theme switching.
import { h } from './ui/dom.js';
import { icon } from './ui/icons.js';
import { readJson, writeJson } from './services/storage.js';
import { renderHomeView } from './ui/views/home.js';
import { renderAnagramView } from './ui/views/anagram.js';
import { renderMagicSquareView } from './ui/views/magic-square.js';
import { renderAboutView } from './ui/views/about.js';
import { renderNotFoundView } from './ui/views/not-found.js';

const APP_NAME = 'Anagram Magic';
const THEME_KEY = 'anagram-magic:theme';

const ROUTES = {
  '/': { title: null, render: renderHomeView },
  '/anagram': { title: 'Anagram Solver', render: renderAnagramView },
  '/magic-square': { title: 'Magic Square Generator', render: renderMagicSquareView },
  '/about': { title: 'About', render: renderAboutView },
};

const main = document.getElementById('main');
const nav = document.getElementById('site-nav');
const menuButton = document.getElementById('menu-button');
const themeButton = document.getElementById('theme-button');

let cleanupView = null;
let isFirstRender = true;

function currentPath() {
  const path = location.hash.replace(/^#/, '').split('?')[0];
  return path === '' ? '/' : path.replace(/\/+$/, '') || '/';
}

function renderRoute() {
  const path = currentPath();
  const route = ROUTES[path] ?? { title: 'Page not found', render: renderNotFoundView };

  cleanupView?.();
  main.replaceChildren();
  const view = h('div', { class: 'view' });
  main.append(view);
  cleanupView = route.render(view) ?? null;

  document.title = route.title ? `${route.title} · ${APP_NAME}` : `${APP_NAME} · Anagram solver and magic square generator`;
  for (const link of nav.querySelectorAll('a')) {
    if (link.getAttribute('href') === `#${path}`) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  setMenuOpen(false);

  // Move focus to the new page heading so keyboard and screen reader users
  // land on the content after navigating (but not on the initial load).
  if (!isFirstRender) {
    window.scrollTo(0, 0);
    view.querySelector('h1')?.focus({ preventScroll: true });
  }
  isFirstRender = false;
}

function setMenuOpen(open) {
  nav.classList.toggle('is-open', open);
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.replaceChildren(icon(open ? 'close' : 'menu', 18));
}

function activeTheme() {
  const stored = readJson(THEME_KEY, null);
  if (stored === 'light' || stored === 'dark') return stored;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const next = theme === 'dark' ? 'light' : 'dark';
  themeButton.replaceChildren(icon(theme === 'dark' ? 'sun' : 'moon', 18));
  themeButton.setAttribute('aria-label', `Switch to ${next} theme`);
  themeButton.title = `Switch to ${next} theme`;
}

document.getElementById('brand-mark').replaceChildren(icon('logo', 22));
menuButton.addEventListener('click', () => setMenuOpen(!nav.classList.contains('is-open')));
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && nav.classList.contains('is-open')) {
    setMenuOpen(false);
    menuButton.focus();
  }
});
themeButton.addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  writeJson(THEME_KEY, next);
  applyTheme(next);
});
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme(activeTheme()));
window.addEventListener('hashchange', renderRoute);

applyTheme(activeTheme());
renderRoute();
