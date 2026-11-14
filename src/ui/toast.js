// Brief confirmation messages, announced politely to screen readers.
import { copyText } from '../services/clipboard.js';
import { h, setChildren } from './dom.js';
import { icon } from './icons.js';

let hideTimer = null;

export function showToast(message, kind = 'success') {
  const region = document.getElementById('toast-region');
  if (!region) return;
  clearTimeout(hideTimer);
  setChildren(
    region,
    h('div', { class: `toast toast--${kind}` }, icon(kind === 'error' ? 'alert' : 'check'), h('span', {}, message)),
  );
  hideTimer = setTimeout(() => region.replaceChildren(), 2000);
}

/** Copy text and confirm (or report failure) with a toast. */
export async function copyWithToast(text, successMessage) {
  const copied = await copyText(text);
  showToast(copied ? successMessage : 'Could not copy. Select the text and copy it manually.', copied ? 'success' : 'error');
  return copied;
}

/**
 * Tell screen reader users about a change that is only visible on screen,
 * such as new results appearing. Nothing is shown visually.
 */
export function announce(message) {
  const region = document.getElementById('announcer');
  if (!region) return;
  // Clear first so repeating the same message is announced again.
  region.textContent = '';
  setTimeout(() => { region.textContent = message; }, 50);
}
