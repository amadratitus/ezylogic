// Tiny DOM helpers shared by every view. User-supplied text is only ever
// inserted as text nodes, never as HTML.

/**
 * Create an element.
 * @param {string} tag
 * @param {Record<string, unknown>} [props] `class`, `dataset`, `on<Event>` handlers, or attributes
 * @param {...(Node | string | number | null | undefined | false)} children
 */
export function h(tag, props = {}, ...children) {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') element.className = String(value);
    else if (key === 'dataset') Object.assign(element.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') {
      element.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (value === true) element.setAttribute(key, '');
    else element.setAttribute(key, String(value));
  }
  append(element, children);
  return element;
}

function append(parent, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    parent.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

/** Replace all children of `parent`. */
export function setChildren(parent, ...children) {
  parent.replaceChildren();
  append(parent, children);
}

export function formatNumber(value) {
  return new Intl.NumberFormat('en-US').format(value);
}

export function plural(count, singular, pluralForm = `${singular}s`) {
  return `${formatNumber(count)} ${count === 1 ? singular : pluralForm}`;
}
