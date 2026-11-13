import {
  MAX_ORDER,
  MAX_STEP_ORDER,
  buildConstructionSteps,
  classifyOrder,
  formatSquare,
  generateMagicSquare,
  parseOrder,
  verifyMagicSquare,
} from '../../lib/magic-square.js';
import { downloadTextFile } from '../../services/clipboard.js';
import { createPatternView, createSquareGrid } from '../components/square-grid.js';
import { formatNumber, h, setChildren } from '../dom.js';
import { icon } from '../icons.js';
import { replaceRouteQuery, routeQuery } from '../route.js';
import { announce, copyWithToast, showToast } from '../toast.js';

const EXAMPLE_ORDERS = [3, 4, 5, 6, 8, 10];
/** Above this size the colour pattern is shown first; numbers stay one tap away. */
const PATTERN_FIRST_ORDER = 20;
/** Sums are written out in full ("4 + 9 + 2") up to this size. */
const EXPRESSION_ORDER = 8;

const METHODS = {
  trivial: { name: 'Single cell', text: 'A 1×1 square holds just the number 1, which is its own row, column and diagonal.' },
  odd: {
    name: 'Siamese method',
    text: 'Start with 1 in the middle of the top row, then keep moving up and to the right, wrapping around the edges. When that cell is already filled, step down one cell instead.',
  },
  'doubly-even': {
    name: 'Diagonal complement',
    text: 'Write the numbers in order, then replace every number on the diagonals of each 4×4 block with n² + 1 minus that number.',
  },
  'singly-even': {
    name: 'Strachey method',
    text: 'Four odd squares fill the quarters, then a few columns are swapped between the top and bottom halves to balance the sums.',
  },
};

export function renderMagicSquareView(root) {
  const input = h('input', {
    id: 'square-order', class: 'input input--hero input--order', type: 'number', inputmode: 'numeric',
    min: '1', max: String(MAX_ORDER), step: '1', placeholder: '5',
    'aria-describedby': 'square-hint square-error',
  });
  const errorMessage = h('p', { id: 'square-error', class: 'field__error', role: 'alert' });
  const results = h('section', { class: 'results', 'aria-label': 'Result' });
  const resetButton = h('button', { class: 'link-button', type: 'button', hidden: true, onClick: reset }, 'Reset');

  /** Everything tied to the square currently on screen. */
  let current = null;
  let cleanupResult = () => {};

  const form = h(
    'form',
    { class: 'composer', novalidate: true, onSubmit: (event) => { event.preventDefault(); generate(); } },
    h('label', { class: 'field__label', for: 'square-order' }, 'Size of the square'),
    h(
      'div',
      { class: 'composer__row' },
      h('div', { class: 'order-field' }, input),
      h('button', { class: 'button button--primary button--hero', type: 'submit' }, 'Generate'),
    ),
    errorMessage,
    h(
      'div',
      { class: 'composer__meta' },
      h('p', { id: 'square-hint', class: 'field__hint' }, `Any whole number from 1 to ${MAX_ORDER}, except 2. No 2×2 magic square exists.`),
      resetButton,
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
      h('h1', { tabindex: '-1' }, 'Magic Square'),
      h('p', { class: 'page-header__lead' }, 'Pick a size and get a square where every row, column and diagonal adds up to the same number.'),
    ),
    form,
    results,
  );

  const initial = routeQuery().get('n');
  if (initial) {
    input.value = initial;
    generate();
  } else {
    renderIdle();
  }

  function setError(message) {
    errorMessage.textContent = message;
    if (message) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
  }

  function reset() {
    cleanupResult();
    current = null;
    input.value = '';
    resetButton.hidden = true;
    setError('');
    replaceRouteQuery({});
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
    cleanupResult();
    try {
      const square = generateMagicSquare(parsed.order);
      current = { square, order: parsed.order, check: verifyMagicSquare(square) };
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
      return;
    }
    resetButton.hidden = false;
    replaceRouteQuery({ n: parsed.order });
    renderResult();
    announce(`${parsed.order} by ${parsed.order} magic square generated. Every row, column and diagonal adds up to ${formatNumber(current.check.constant)}.`);
  }

  function renderIdle() {
    setChildren(
      results,
      h(
        'div',
        { class: 'state' },
        h('span', { class: 'state__icon' }, icon('grid', 20)),
        h('p', { class: 'state__title' }, 'Your square will appear here'),
        h('p', { class: 'state__text' }, 'Enter a size and press Enter, or pick one of the examples.'),
      ),
    );
  }

  function renderResult() {
    const { square, order, check } = current;
    const method = METHODS[classifyOrder(order)];
    const fileBase = `magic-square-${order}x${order}`;
    const canStep = order <= MAX_STEP_ORDER;
    const steps = canStep ? buildConstructionSteps(order) : [];

    let view = order > PATTERN_FIRST_ORDER ? 'pattern' : 'numbers';
    let grid = null;
    let pattern = null;
    let building = false;
    let stepIndex = 0; // number of steps applied
    let timer = null;

    const stage = h('div', { class: 'stage' });
    const tracePanel = h('div', { class: 'trace', 'aria-live': 'polite' });
    const player = h('div', { class: 'player', hidden: true });
    const numbersTab = h('button', { class: 'segment', type: 'button', onClick: () => setView('numbers') }, 'Numbers');
    const patternTab = h('button', { class: 'segment', type: 'button', onClick: () => setView('pattern') }, 'Pattern');
    const buildButton = h(
      'button',
      { class: 'button', type: 'button', disabled: !canStep, onClick: () => (building ? stopBuilding() : startBuilding()) },
      icon('play', 14),
      h('span', {}, 'Watch it being built'),
    );

    // ---- Tracing --------------------------------------------------------
    const lineValues = {
      row: (index) => square[index],
      column: (index) => square.map((row) => row[index]),
      main: () => square.map((row, i) => row[i]),
      anti: () => square.map((row, i) => row[order - 1 - i]),
    };
    const lineNames = {
      row: (index) => `Row ${index + 1}`,
      column: (index) => `Column ${index + 1}`,
      main: () => 'Main diagonal',
      anti: () => 'Anti-diagonal',
    };
    const lineSwatch = { row: 'row', column: 'column', main: 'diagonal', anti: 'diagonal' };

    function traceLineItem(type, index) {
      const values = lineValues[type](index);
      const sum = values.reduce((total, value) => total + value, 0);
      return h(
        'li',
        { class: 'trace__line' },
        h('span', { class: `swatch swatch--${lineSwatch[type]}` }),
        h(
          'span',
          { class: 'trace__text' },
          h('span', { class: 'trace__name' }, lineNames[type](index)),
          h(
            'span',
            { class: 'trace__sum' },
            order <= EXPRESSION_ORDER ? `${values.join(' + ')} = ` : `${formatNumber(order)} numbers add up to `,
            h('strong', {}, formatNumber(sum)),
          ),
        ),
      );
    }

    function renderTrace(lines) {
      const diagonalButtons = order > 1 && h(
        'div',
        { class: 'trace__actions' },
        h('button', { class: 'chip', type: 'button', onClick: () => traceWholeLine('main') }, 'Main diagonal'),
        h('button', { class: 'chip', type: 'button', onClick: () => traceWholeLine('anti') }, 'Anti-diagonal'),
      );
      if (view === 'pattern') {
        setChildren(
          tracePanel,
          h('h2', { class: 'card__title' }, 'Pattern view'),
          h('p', { class: 'card__text' }, 'Each block is one number: pale for small, deep for large. Switch to Numbers to read values and trace lines.'),
        );
        return;
      }
      setChildren(
        tracePanel,
        h('h2', { class: 'card__title' }, 'Trace a line'),
        lines
          ? h('ul', { class: 'trace__list' }, lines.map(([type, index]) => traceLineItem(type, index)))
          : h('p', { class: 'card__text' }, 'Select any cell to see its row and column add up. Arrow keys move between cells.'),
        diagonalButtons,
      );
    }

    function onSelect(selection) {
      if (building) return;
      if (!selection) return renderTrace(null);
      const { row, column } = selection;
      const lines = [['row', row], ['column', column]];
      if (row === column) lines.push(['main', 0]);
      if (row + column === order - 1) lines.push(['anti', 0]);
      renderTrace(lines);
    }

    function traceWholeLine(type) {
      ensureGrid().traceLine(type);
      renderTrace([[type, 0]]);
    }

    // ---- Views ----------------------------------------------------------
    function ensureGrid() {
      if (!grid) {
        grid = createSquareGrid({
          order,
          label: `Magic square of size ${order}. Every row, column and diagonal sums to ${check.constant}.`,
          onSelect,
        });
        grid.setValues(square);
      }
      return grid;
    }

    function setView(next) {
      if (building && next === 'pattern') stopBuilding();
      view = next;
      numbersTab.setAttribute('aria-pressed', String(view === 'numbers'));
      patternTab.setAttribute('aria-pressed', String(view === 'pattern'));
      if (view === 'numbers') {
        setChildren(stage, ensureGrid().element);
        grid.fit();
        onSelect(grid.selection);
      } else {
        if (!pattern) pattern = createPatternView(square, `Colour pattern of the ${order} by ${order} magic square: pale blocks are small numbers, deep blocks are large numbers.`);
        setChildren(stage, h('div', { class: 'pattern-wrap' }, pattern.element));
        pattern.mount();
        renderTrace(null);
      }
    }

    // ---- Step-by-step build --------------------------------------------
    function partialSquare(count) {
      const partial = Array.from({ length: order }, () => new Array(order).fill(0));
      for (let i = 0; i < count; i++) {
        for (const { row, column, value } of steps[i].cells) partial[row][column] = value;
      }
      return partial;
    }

    function showStep(count) {
      stepIndex = Math.max(0, Math.min(steps.length, count));
      const step = steps[stepIndex - 1];
      grid.setValues(partialSquare(stepIndex));
      grid.markChanged(step ? step.cells : [], step?.kind);
      renderPlayer();
    }

    function stopTimer() {
      clearInterval(timer);
      timer = null;
    }

    function play() {
      if (stepIndex >= steps.length) showStep(0);
      const delay = Math.max(140, Math.min(1100, Math.round(9000 / steps.length)));
      timer = setInterval(() => {
        if (stepIndex >= steps.length) { stopTimer(); renderPlayer(); return; }
        showStep(stepIndex + 1);
      }, delay);
      renderPlayer();
    }

    // The player is built once and updated in place, so keyboard focus stays
    // on the control being used while stepping.
    const control = (label, iconName, onClick) =>
      h('button', { class: 'icon-button icon-button--outlined', type: 'button', 'aria-label': label, title: label, onClick }, icon(iconName, 16));
    const restartControl = control('Back to the start', 'restart', () => { stopTimer(); showStep(0); });
    const previousControl = control('Previous step', 'stepBack', () => { stopTimer(); showStep(stepIndex - 1); });
    const nextControl = control('Next step', 'stepForward', () => { stopTimer(); showStep(stepIndex + 1); });
    const playControl = h('button', {
      class: 'button button--primary player__play', type: 'button',
      onClick: () => { if (timer) { stopTimer(); renderPlayer(); } else play(); },
    });
    const slider = h('input', {
      class: 'player__slider', type: 'range', min: '0', max: String(steps.length), step: '1', value: '0',
      'aria-label': 'Construction step',
      onInput: (event) => { stopTimer(); showStep(Number(event.target.value)); },
    });
    const stepCount = h('span', { class: 'player__count' });
    const stepCaption = h('p', { class: 'player__caption' });
    player.append(
      h('div', { class: 'player__controls' }, restartControl, previousControl, playControl, nextControl, slider, stepCount),
      stepCaption,
    );

    function renderPlayer() {
      const step = steps[stepIndex - 1];
      const caption = step ? step.caption : 'An empty grid. Press play, or step forward one move at a time.';
      const done = stepIndex >= steps.length;
      // aria-disabled keeps focus on a control when it reaches its limit.
      for (const [button, off] of [[restartControl, stepIndex === 0], [previousControl, stepIndex === 0], [nextControl, done]]) {
        button.setAttribute('aria-disabled', String(off));
      }
      setChildren(playControl, icon(timer ? 'pause' : 'play', 14), timer ? 'Pause' : done ? 'Replay' : 'Play');
      slider.value = String(stepIndex);
      slider.setAttribute('aria-valuetext', `Step ${stepIndex} of ${steps.length}`);
      stepCount.textContent = `${stepIndex} / ${steps.length}`;
      // Announce captions only when stepping by hand; autoplay would flood a screen reader.
      stepCaption.setAttribute('aria-live', timer ? 'off' : 'polite');
      stepCaption.textContent = done ? `${caption} The square is complete.` : caption;
    }

    function startBuilding() {
      if (view !== 'numbers') setView('numbers');
      building = true;
      grid.select(null, { notify: false });
      grid.setInteractive(false);
      player.hidden = false;
      setChildren(buildButton, icon('eye', 14), h('span', {}, 'Show finished square'));
      setChildren(
        tracePanel,
        h('h2', { class: 'card__title' }, 'Building'),
        h('p', { class: 'card__text' }, 'Amber cells were just placed. Violet cells were just swapped or replaced. Tracing returns when you show the finished square.'),
      );
      showStep(0);
      play();
    }

    function stopBuilding() {
      stopTimer();
      building = false;
      player.hidden = true;
      grid.setValues(square);
      grid.markChanged([]);
      grid.setInteractive(true);
      setChildren(buildButton, icon('play', 14), h('span', {}, 'Watch it being built'));
      renderTrace(null);
    }

    // ---- Assemble -------------------------------------------------------
    setChildren(
      results,
      h(
        'div',
        { class: 'square-layout' },
        h(
          'div',
          { class: 'square-main' },
          h(
            'div',
            { class: 'toolbar' },
            h('div', { class: 'segmented', role: 'group', 'aria-label': 'View' }, numbersTab, patternTab),
            h(
              'div',
              { class: 'toolbar__actions' },
              h('button', { class: 'button button--quiet', type: 'button', onClick: () => copyWithToast(formatSquare(square, 'tsv'), 'Copied square') }, icon('copy', 15), 'Copy'),
              h('button', {
                class: 'button button--quiet', type: 'button',
                onClick: () => { downloadTextFile(`${fileBase}.csv`, `${formatSquare(square, 'csv')}\n`, 'text/csv'); showToast(`Downloaded ${fileBase}.csv`); },
              }, icon('download', 15), 'CSV'),
              h('button', {
                class: 'button button--quiet', type: 'button',
                onClick: () => { downloadTextFile(`${fileBase}.txt`, `${formatSquare(square, 'text')}\n`); showToast(`Downloaded ${fileBase}.txt`); },
              }, icon('download', 15), 'Text'),
            ),
          ),
          stage,
          player,
          h(
            'div',
            { class: 'card how' },
            h(
              'div',
              { class: 'how__text' },
              h('h2', { class: 'card__title' }, `How it is made: ${method.name}`),
              h('p', { class: 'card__text' }, canStep ? method.text : `${method.text} The step-by-step view is available up to ${MAX_STEP_ORDER} × ${MAX_STEP_ORDER}.`),
            ),
            buildButton,
          ),
        ),
        h(
          'aside',
          { class: 'square-side' },
          h(
            'div',
            { class: 'card constant' },
            h('p', { class: 'constant__label' }, 'Every line adds up to'),
            h('p', { class: 'constant__value' }, formatNumber(check.constant)),
            h('p', { class: 'constant__formula' }, h('span', { class: 'math' }, 'M = n(n² + 1) / 2'), ` with n = ${order}`),
            h(
              'ul',
              { class: 'constant__facts' },
              h('li', {}, `${order} × ${order}, using 1 to ${formatNumber(order * order)}`),
              h('li', {}, method.name),
              h('li', { class: 'constant__verified' }, icon('check', 14), order === 1 ? 'Verified' : `Verified: all ${formatNumber(order * 2 + 2)} lines`),
            ),
          ),
          h('div', { class: 'card' }, tracePanel),
        ),
      ),
    );
    setView(view);

    cleanupResult = () => {
      stopTimer();
      grid?.destroy();
      pattern?.destroy();
      cleanupResult = () => {};
    };
  }

  return () => cleanupResult();
}
