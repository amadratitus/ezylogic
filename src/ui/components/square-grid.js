// Interactive magic square grid: adaptive cell size, tap/keyboard tracing of
// rows, columns and diagonals, and partial states for the step-by-step build.
import { h } from '../dom.js';

const MAX_CELL = 88;

/** Gap between cells shrinks as the square grows. */
function gapFor(order) {
  if (order <= 12) return 4;
  return order <= 30 ? 2 : 1;
}

/**
 * @param {object} options
 * @param {number} options.order
 * @param {string} options.label accessible name of the grid
 * @param {(selection: {row: number, column: number} | null) => void} [options.onSelect]
 * @param {number} [options.maxCell] largest cell size in px
 */
export function createSquareGrid({ order, label, onSelect = () => {}, maxCell = MAX_CELL }) {
  const digits = String(order * order).length;
  const cells = [];
  const body = h('tbody');
  for (let row = 0; row < order; row++) {
    const rowCells = [];
    for (let column = 0; column < order; column++) {
      const cell = h('td', {
        class: 'cell',
        role: 'gridcell',
        tabindex: row === 0 && column === 0 ? '0' : '-1',
        dataset: { row, column },
      });
      rowCells.push(cell);
    }
    cells.push(rowCells);
    body.append(h('tr', { role: 'row' }, rowCells));
  }
  const table = h('table', { class: 'square', role: 'grid', 'aria-label': label }, body);
  const element = h('div', { class: 'square-scroll' }, table);

  let selection = null;
  let traced = [];
  let changed = [];
  let focusPosition = { row: 0, column: 0 };

  /** Pick the largest cell size that fits the container, within limits. */
  function fit() {
    const styles = getComputedStyle(element);
    const available = element.clientWidth - parseFloat(styles.paddingLeft) - parseFloat(styles.paddingRight);
    if (!(available > 0)) return;
    const gap = gapFor(order);
    const minCell = Math.max(24, Math.ceil(digits * 6.7 + 5));
    const ideal = Math.floor((available - gap * (order + 1)) / order);
    const size = Math.max(minCell, Math.min(maxCell, ideal));
    const fontSize = size >= 72 ? 24 : size >= 52 ? 19 : size >= 40 ? 15 : size >= 30 ? 12.5 : 11;
    table.style.setProperty('--cell-size', `${size}px`);
    table.style.setProperty('--cell-gap', `${gap}px`);
    table.style.setProperty('--cell-font', `${fontSize}px`);
    table.style.setProperty('--cell-radius', size >= 72 ? '12px' : size >= 40 ? '8px' : size >= 30 ? '5px' : '3px');
    element.classList.toggle('square-scroll--overflow', (size + gap) * order + gap > available);
  }

  function setValues(matrix) {
    for (let row = 0; row < order; row++) {
      for (let column = 0; column < order; column++) {
        const value = matrix[row][column];
        const cell = cells[row][column];
        cell.textContent = value ? String(value) : '';
        cell.classList.toggle('cell--empty', !value);
      }
    }
  }

  /** Flag the cells written by the current construction step. */
  function markChanged(stepCells, kind = 'place') {
    changed.forEach((cell) => cell.classList.remove('cell--placed', 'cell--swapped'));
    changed = stepCells.map(({ row, column }) => cells[row][column]);
    changed.forEach((cell) => cell.classList.add(kind === 'swap' ? 'cell--swapped' : 'cell--placed'));
  }

  function clearTrace() {
    traced.forEach((cell) => cell.classList.remove('cell--row', 'cell--column', 'cell--diagonal', 'cell--selected'));
    traced = [];
  }

  /** Highlight the row, column and any main diagonal through a cell. */
  function select(next, { notify = true } = {}) {
    clearTrace();
    selection = next;
    if (next) {
      const { row, column } = next;
      const add = (cell, name) => { cell.classList.add(name); traced.push(cell); };
      for (let i = 0; i < order; i++) {
        add(cells[row][i], 'cell--row');
        add(cells[i][column], 'cell--column');
        if (row === column) add(cells[i][i], 'cell--diagonal');
        if (row + column === order - 1) add(cells[i][order - 1 - i], 'cell--diagonal');
      }
      add(cells[row][column], 'cell--selected');
    }
    if (notify) onSelect(selection);
  }

  /** Highlight one whole line: a row, a column or a main diagonal. */
  function traceLine(type, index = 0) {
    clearTrace();
    selection = null;
    const className = type === 'row' ? 'cell--row' : type === 'column' ? 'cell--column' : 'cell--diagonal';
    for (let i = 0; i < order; i++) {
      const cell =
        type === 'row' ? cells[index][i]
        : type === 'column' ? cells[i][index]
        : type === 'main' ? cells[i][i]
        : cells[i][order - 1 - i];
      cell.classList.add(className);
      traced.push(cell);
    }
  }

  function setInteractive(interactive) {
    table.inert = !interactive;
  }

  function moveFocus(row, column) {
    const clampedRow = Math.max(0, Math.min(order - 1, row));
    const clampedColumn = Math.max(0, Math.min(order - 1, column));
    cells[focusPosition.row][focusPosition.column].tabIndex = -1;
    focusPosition = { row: clampedRow, column: clampedColumn };
    const cell = cells[clampedRow][clampedColumn];
    cell.tabIndex = 0;
    cell.focus();
    select(focusPosition);
  }

  table.addEventListener('click', (event) => {
    const cell = event.target.closest?.('td[data-row]');
    if (!cell) return;
    const row = Number(cell.dataset.row);
    const column = Number(cell.dataset.column);
    const same = selection && selection.row === row && selection.column === column;
    cells[focusPosition.row][focusPosition.column].tabIndex = -1;
    focusPosition = { row, column };
    cell.tabIndex = 0;
    select(same ? null : { row, column });
  });

  table.addEventListener('keydown', (event) => {
    const { row, column } = focusPosition;
    const moves = {
      ArrowUp: [row - 1, column],
      ArrowDown: [row + 1, column],
      ArrowLeft: [row, column - 1],
      ArrowRight: [row, column + 1],
      Home: [row, 0],
      End: [row, order - 1],
    };
    if (moves[event.key]) {
      event.preventDefault();
      moveFocus(...moves[event.key]);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      select(selection && selection.row === row && selection.column === column ? null : { row, column });
    } else if (event.key === 'Escape' && selection) {
      select(null);
    }
  });

  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(fit) : null;
  observer?.observe(element);

  return {
    element,
    fit,
    setValues,
    markChanged,
    select,
    traceLine,
    setInteractive,
    get selection() { return selection; },
    destroy() { observer?.disconnect(); },
  };
}

/**
 * Compact overview for large squares: every cell is a coloured block, pale
 * for small numbers and deep for large ones, which reveals the structure of
 * the construction without printing thousands of numbers.
 */
export function createPatternView(square, label) {
  const order = square.length;
  const canvas = h('canvas', { class: 'pattern', role: 'img', 'aria-label': label });

  function parseColor(value) {
    const match = value.trim().match(/^#([0-9a-f]{6})$/i);
    if (!match) return [120, 110, 220];
    const number = parseInt(match[1], 16);
    return [(number >> 16) & 255, (number >> 8) & 255, number & 255];
  }

  function draw() {
    const width = canvas.parentElement?.clientWidth ?? 0;
    if (width <= 0) return;
    const side = Math.min(width, 560);
    const scale = window.devicePixelRatio || 1;
    const cell = Math.max(1, Math.floor((side * scale) / order));
    canvas.width = cell * order;
    canvas.height = cell * order;
    canvas.style.width = `${(cell * order) / scale}px`;
    canvas.style.height = `${(cell * order) / scale}px`;
    const styles = getComputedStyle(document.documentElement);
    const low = parseColor(styles.getPropertyValue('--pattern-low'));
    const high = parseColor(styles.getPropertyValue('--pattern-high'));
    const context = canvas.getContext('2d');
    const max = order * order - 1;
    const inset = cell >= 6 ? 1 : 0;
    context.clearRect(0, 0, canvas.width, canvas.height);
    for (let row = 0; row < order; row++) {
      for (let column = 0; column < order; column++) {
        const t = max === 0 ? 1 : (square[row][column] - 1) / max;
        const mix = (index) => Math.round(low[index] + (high[index] - low[index]) * t);
        context.fillStyle = `rgb(${mix(0)}, ${mix(1)}, ${mix(2)})`;
        context.fillRect(column * cell, row * cell, cell - inset, cell - inset);
      }
    }
  }

  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(draw) : null;
  const onTheme = () => draw();
  document.addEventListener('themechange', onTheme);
  return {
    element: canvas,
    draw,
    mount() { observer?.observe(canvas.parentElement); draw(); },
    destroy() { observer?.disconnect(); document.removeEventListener('themechange', onTheme); },
  };
}
