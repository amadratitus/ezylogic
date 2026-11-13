import {
  MAX_ORDER,
  classifyOrder,
  formatSquare,
  generateMagicSquare,
  parseOrder,
  verifyMagicSquare,
} from '../../lib/magic-square.js';
import { downloadTextFile } from '../../services/clipboard.js';
import { formatNumber, h, setChildren } from '../dom.js';
import { icon } from '../icons.js';
import { copyWithToast, showToast } from '../toast.js';

const EXAMPLE_ORDERS = [3, 4, 5, 6, 8, 10];

const METHODS = {
  trivial: { name: 'Single cell', text: 'A 1×1 square holds just the number 1, which is its own row, column and diagonal.' },
  odd: {
    name: 'Siamese method',
    text: 'Odd size: start with 1 in the middle of the top row, then keep moving up and to the right, wrapping around the edges. When that cell is already filled, step down one cell instead.',
  },
  'doubly-even': {
    name: 'Diagonal complement',
    text: 'Size divisible by 4: write the numbers in order, then replace every number on the diagonals of each 4×4 block with n² + 1 minus that number.',
  },
  'singly-even': {
    name: 'Strachey method',
    text: 'Even size not divisible by 4: four odd squares fill the quarters, then a few columns are swapped between the top and bottom halves to balance the sums.',
  },
};

export function renderMagicSquareView(root) {
  const input = h('input', {
    id: 'square-order',
    class: 'input input--large input--order',
    type: 'number',
    inputmode: 'numeric',
    min: '1',
    max: String(MAX_ORDER),
    step: '1',
    placeholder: 'e.g. 5',
    'aria-describedby': 'square-hint square-error',
  });
  const errorMessage = h('p', { id: 'square-error', class: 'field__error', role: 'alert' });
  const results = h('section', { class: 'results', 'aria-label': 'Result', 'aria-live': 'polite' });
  let showSums = false;
  let current = null; // { square, check, order }

  const form = h(
    'form',
    { class: 'panel', novalidate: true, onSubmit: (event) => { event.preventDefault(); generate(); } },
    h(
      'div',
      { class: 'field' },
      h('label', { class: 'field__label', for: 'square-order' }, 'Size (n × n)'),
      h(
        'div',
        { class: 'input-row' },
        input,
        h('button', { class: 'button button--primary button--large', type: 'submit' }, icon('grid'), 'Generate'),
        h('button', { class: 'button button--large', type: 'button', onClick: reset }, icon('reset'), 'Reset'),
      ),
      h('p', { id: 'square-hint', class: 'field__hint' }, `Whole numbers from 1 to ${MAX_ORDER}, except 2. No 2×2 magic square exists.`),
      errorMessage,
    ),
    h(
      'div',
      { class: 'chip-row' },
      h('span', { class: 'chip-row__label' }, 'Try'),
      EXAMPLE_ORDERS.map((order) =>
        h('button', { class: 'chip', type: 'button', onClick: () => { input.value = String(order); generate(); } }, `${order} × ${order}`),
      ),
    ),
  );
  input.addEventListener('input', () => setError(''));

  root.append(
    h(
      'header',
      { class: 'page-header' },
      h('h1', { tabindex: '-1' }, 'Magic Square Generator'),
      h('p', { class: 'page-header__lead' }, 'Choose a size to build a square where every row, column and diagonal adds up to the same number.'),
    ),
    form,
    results,
  );
  renderIdle();

  function setError(message) {
    errorMessage.textContent = message;
    if (message) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
  }

  function reset() {
    input.value = '';
    current = null;
    showSums = false;
    setError('');
    renderIdle();
    input.focus();
  }

  function generate() {
    // A number input reports '' for unparseable text such as "abc" or "1e".
    const raw = input.value === '' && input.validity?.badInput ? 'invalid' : input.value;
    const parsed = parseOrder(raw);
    if (!parsed.ok) {
      setError(parsed.error);
      input.focus();
      return;
    }
    setError('');
    try {
      const square = generateMagicSquare(parsed.order);
      current = { square, order: parsed.order, check: verifyMagicSquare(square) };
      renderResult();
    } catch (error) {
      current = null;
      setChildren(
        results,
        h(
          'div',
          { class: 'state' },
          h('span', { class: 'state__icon' }, icon('alert', 20)),
          h('p', { class: 'state__title' }, 'The square could not be generated'),
          h('p', { class: 'state__text' }, error instanceof Error ? error.message : 'Unexpected error.'),
        ),
      );
    }
  }

  function renderIdle() {
    setChildren(
      results,
      h(
        'div',
        { class: 'state' },
        h('span', { class: 'state__icon' }, icon('grid', 20)),
        h('p', { class: 'state__title' }, 'Your square will appear here'),
        h('p', { class: 'state__text' }, 'Enter a size above and press Enter, or pick an example.'),
      ),
    );
  }

  function stat(label, value, detail) {
    return h(
      'div',
      { class: 'stat' },
      h('p', { class: 'stat__label' }, label),
      h('p', { class: 'stat__value' }, value),
      detail && h('p', { class: 'stat__detail' }, detail),
    );
  }

  function buildTable({ square, order, check }) {
    const cells = [];
    const body = h('tbody');
    square.forEach((row, rowIndex) => {
      const rowCells = row.map((value, columnIndex) => {
        const onDiagonal = rowIndex === columnIndex || rowIndex + columnIndex === order - 1;
        return h('td', { class: onDiagonal ? 'cell cell--diagonal' : 'cell', dataset: { row: rowIndex, column: columnIndex } }, value);
      });
      cells.push(rowCells);
      body.append(
        h('tr', {}, rowCells, showSums && h('td', { class: 'cell cell--sum', 'aria-label': `Row ${rowIndex + 1} sum` }, check.rowSums[rowIndex])),
      );
    });
    if (showSums) {
      body.append(
        h(
          'tr',
          {},
          check.columnSums.map((sum, index) => h('td', { class: 'cell cell--sum', 'aria-label': `Column ${index + 1} sum` }, sum)),
          h('td', { class: 'cell cell--sum cell--corner', 'aria-label': 'Diagonal sum', title: 'Both diagonals' }, check.diagonalSums[0]),
        ),
      );
    }

    const digits = String(order * order).length;
    const table = h(
      'table',
      { class: order > 12 ? 'square square--dense' : 'square', style: `--cell-size: ${Math.max(digits * 9 + 18, order > 12 ? 34 : 48)}px` },
      h('caption', { class: 'sr-only' }, `Magic square of size ${order}. Every row, column and diagonal sums to ${check.constant}.`),
      body,
    );

    // Highlight the row and column under the pointer.
    let active = [];
    const clear = () => { active.forEach((cell) => cell.classList.remove('cell--active')); active = []; };
    table.addEventListener('mouseover', (event) => {
      const cell = event.target.closest?.('td[data-row]');
      if (!cell) return;
      clear();
      const row = Number(cell.dataset.row);
      const column = Number(cell.dataset.column);
      active = [...cells[row], ...cells.map((rowCells) => rowCells[column])];
      active.forEach((item) => item.classList.add('cell--active'));
    });
    table.addEventListener('mouseleave', clear);
    return table;
  }

  function renderResult() {
    const { square, order, check } = current;
    const method = METHODS[classifyOrder(order)];
    const lineCount = order * 2 + 2;
    const fileBase = `magic-square-${order}x${order}`;

    setChildren(
      results,
      h(
        'div',
        { class: 'stat-row' },
        stat('Magic constant', formatNumber(check.constant), `${order}(${order}² + 1) / 2`),
        stat('Size', `${order} × ${order}`, `Numbers 1 to ${formatNumber(order * order)}`),
        stat('Method', method.name),
        stat(
          'Verification',
          h('span', { class: 'badge badge--success' }, icon('check', 14), 'Verified'),
          order === 1 ? 'Single cell' : `${formatNumber(lineCount)} lines checked`,
        ),
      ),
      h(
        'div',
        { class: 'toolbar' },
        h(
          'label',
          { class: 'option option--check', for: 'square-sums' },
          h('input', {
            id: 'square-sums', type: 'checkbox', class: 'checkbox', checked: showSums,
            onChange: (event) => { showSums = event.target.checked; renderResult(); },
          }),
          'Show row and column sums',
        ),
        h(
          'div',
          { class: 'toolbar__actions' },
          h('button', {
            class: 'button button--small', type: 'button',
            onClick: () => copyWithToast(formatSquare(square, 'tsv'), 'Copied square'),
          }, icon('copy', 14), 'Copy'),
          h('button', {
            class: 'button button--small', type: 'button',
            onClick: () => { downloadTextFile(`${fileBase}.csv`, `${formatSquare(square, 'csv')}\n`, 'text/csv'); showToast(`Downloaded ${fileBase}.csv`); },
          }, icon('download', 14), 'CSV'),
          h('button', {
            class: 'button button--small', type: 'button',
            onClick: () => { downloadTextFile(`${fileBase}.txt`, `${formatSquare(square, 'text')}\n`); showToast(`Downloaded ${fileBase}.txt`); },
          }, icon('download', 14), 'Text'),
        ),
      ),
      h('div', { class: 'square-scroll', tabindex: '0', role: 'group', 'aria-label': 'Magic square grid' }, buildTable(current)),
      h('p', { class: 'legend' }, h('span', { class: 'legend__swatch' }), 'Shaded cells are the two main diagonals. Hover a cell to trace its row and column.'),
      h(
        'div',
        { class: 'note' },
        icon('info', 16),
        h('div', {}, h('p', { class: 'note__title' }, `How it was built: ${method.name}`), h('p', { class: 'note__text' }, method.text)),
      ),
    );
  }
}
