// localStorage wrappers that never throw (private mode, blocked storage, bad JSON).

export function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable: the app works without it.
  }
}

/** A small most-recent-first list of unique strings. */
export function createRecentList(key, capacity = 6) {
  const read = () => {
    const stored = readJson(key, []);
    return Array.isArray(stored) ? stored.filter((item) => typeof item === 'string').slice(0, capacity) : [];
  };
  return {
    read,
    add(value) {
      const next = [value, ...read().filter((item) => item !== value)].slice(0, capacity);
      writeJson(key, next);
      return next;
    },
    clear() {
      writeJson(key, []);
    },
  };
}
