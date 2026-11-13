// Reading and writing the hash route, e.g. "#/anagram?q=listen".

export function currentPath() {
  const path = location.hash.replace(/^#/, '').split('?')[0];
  return path === '' ? '/' : path.replace(/\/+$/, '') || '/';
}

/** Query parameters of the current hash route. */
export function routeQuery() {
  const query = location.hash.split('?')[1] ?? '';
  return new URLSearchParams(query);
}

/**
 * Record view state in the address bar so it can be shared or reloaded,
 * without triggering a re-render of the current view.
 */
export function replaceRouteQuery(params) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== '') query.set(key, String(value));
  }
  const text = query.toString();
  const hash = `#${currentPath()}${text ? `?${text}` : ''}`;
  if (hash !== location.hash) history.replaceState(null, '', hash);
}

export function routeHref(path, params = {}) {
  const query = new URLSearchParams(params).toString();
  return `#${path}${query ? `?${query}` : ''}`;
}
