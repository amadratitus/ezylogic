// Pure magic square logic. No DOM: everything here is unit-testable in Node.
//
// A normal magic square of order n holds the integers 1..n² exactly once, and
// every row, column and both main diagonals sum to M = n(n² + 1) / 2.

export const MIN_ORDER = 1;
/** Upper bound is a display limit (10,000 cells), not an algorithmic one. */
export const MAX_ORDER = 100;

/** M = n(n² + 1) / 2 */
export function magicConstant(order) {
  return (order * (order * order + 1)) / 2;
}

/**
 * Which construction applies to an order.
 * @returns {'trivial' | 'odd' | 'doubly-even' | 'singly-even' | 'impossible'}
 */
export function classifyOrder(order) {
  if (order === 1) return 'trivial';
  if (order === 2) return 'impossible';
  if (order % 2 === 1) return 'odd';
  return order % 4 === 0 ? 'doubly-even' : 'singly-even';
}

/**
 * Validate user input for the order.
 * @returns {{ok: true, order: number} | {ok: false, error: string}}
 */
export function parseOrder(rawValue) {
  const text = String(rawValue ?? '').trim();
  if (text === '') {
    return { ok: false, error: 'Enter the size of the square.' };
  }
  if (!/^[+-]?\d+(\.\d+)?$/.test(text)) {
    return { ok: false, error: 'The size must be a number.' };
  }
  const value = Number(text);
  if (!Number.isInteger(value)) {
    return { ok: false, error: 'The size must be a whole number.' };
  }
  if (value < MIN_ORDER) {
    return { ok: false, error: 'The size must be at least 1.' };
  }
  if (value === 2) {
    return {
      ok: false,
      error:
        'No 2×2 magic square exists: the numbers 1–4 cannot make equal rows, columns and diagonals. Try 3 or more.',
    };
  }
  if (value > MAX_ORDER) {
    return { ok: false, error: `The largest supported size is ${MAX_ORDER}.` };
  }
  return { ok: true, order: value };
}

function emptySquare(order) {
  return Array.from({ length: order }, () => new Array(order).fill(0));
}

/** Siamese (de la Loubère) method for odd orders. */
function buildOdd(order) {
  const square = emptySquare(order);
  let row = 0;
  let column = (order - 1) / 2;
  for (let value = 1; value <= order * order; value++) {
    square[row][column] = value;
    const nextRow = (row - 1 + order) % order;
    const nextColumn = (column + 1) % order;
    if (square[nextRow][nextColumn] !== 0) {
      // Up-right is taken: drop one cell down instead.
      row = (row + 1) % order;
    } else {
      row = nextRow;
      column = nextColumn;
    }
  }
  return square;
}

/**
 * Doubly even orders (n = 4k): write 1..n² in reading order, then replace
 * every cell on the diagonals of each 4×4 block with its complement n² + 1 − v.
 */
function buildDoublyEven(order) {
  const square = emptySquare(order);
  const complementBase = order * order + 1;
  for (let row = 0; row < order; row++) {
    for (let column = 0; column < order; column++) {
      const value = row * order + column + 1;
      const onBlockDiagonal = row % 4 === column % 4 || (row % 4) + (column % 4) === 3;
      square[row][column] = onBlockDiagonal ? complementBase - value : value;
    }
  }
  return square;
}

/**
 * Singly even orders (n = 4k + 2): Strachey's method. Four odd squares of
 * order n/2 fill the quadrants, then selected columns are swapped between the
 * top and bottom halves to balance the sums.
 */
function buildSinglyEven(order) {
  const half = order / 2;
  const quarterCells = half * half;
  const base = buildOdd(half);
  const square = emptySquare(order);
  for (let row = 0; row < half; row++) {
    for (let column = 0; column < half; column++) {
      const value = base[row][column];
      square[row][column] = value; // A: top-left
      square[row + half][column + half] = value + quarterCells; // B: bottom-right
      square[row][column + half] = value + 2 * quarterCells; // C: top-right
      square[row + half][column] = value + 3 * quarterCells; // D: bottom-left
    }
  }

  const k = (order - 2) / 4;
  const middleRow = (half - 1) / 2;
  const swap = (row, column) => {
    const upper = square[row][column];
    square[row][column] = square[row + half][column];
    square[row + half][column] = upper;
  };
  for (let row = 0; row < half; row++) {
    // Leftmost k columns, shifted one to the right on the middle row.
    const offset = row === middleRow ? 1 : 0;
    for (let column = 0; column < k; column++) swap(row, column + offset);
    // Rightmost k − 1 columns.
    for (let column = order - k + 1; column < order; column++) swap(row, column);
  }
  return square;
}

/**
 * Generate a normal magic square of the given order.
 * Runs in O(n²) time. Every result is verified before it is returned.
 *
 * @param {number} order
 * @returns {number[][]} rows of the square
 * @throws {RangeError} if no square exists or the order is out of range
 */
export function generateMagicSquare(order) {
  if (!Number.isInteger(order) || order < MIN_ORDER) {
    throw new RangeError('Order must be a positive whole number.');
  }
  if (order > MAX_ORDER) {
    throw new RangeError(`Order must be at most ${MAX_ORDER}.`);
  }
  let square;
  switch (classifyOrder(order)) {
    case 'impossible':
      throw new RangeError('No normal magic square of order 2 exists.');
    case 'trivial':
      square = [[1]];
      break;
    case 'odd':
      square = buildOdd(order);
      break;
    case 'doubly-even':
      square = buildDoublyEven(order);
      break;
    default:
      square = buildSinglyEven(order);
  }
  const check = verifyMagicSquare(square);
  if (!check.valid) {
    throw new Error(`Generated square failed verification: ${check.problems[0]}`);
  }
  return square;
}

/**
 * Independently check that a grid is a normal magic square.
 * @param {number[][]} square
 */
export function verifyMagicSquare(square) {
  const order = Array.isArray(square) ? square.length : 0;
  const problems = [];
  if (order === 0 || square.some((row) => !Array.isArray(row) || row.length !== order)) {
    return {
      valid: false,
      order,
      constant: NaN,
      rowSums: [],
      columnSums: [],
      diagonalSums: [],
      problems: ['The grid is not square.'],
    };
  }
  const constant = magicConstant(order);
  const seen = new Uint8Array(order * order + 1);
  const rowSums = new Array(order).fill(0);
  const columnSums = new Array(order).fill(0);
  let mainDiagonal = 0;
  let antiDiagonal = 0;

  for (let row = 0; row < order; row++) {
    for (let column = 0; column < order; column++) {
      const value = square[row][column];
      if (!Number.isInteger(value) || value < 1 || value > order * order) {
        problems.push(`Value ${value} at row ${row + 1}, column ${column + 1} is outside 1–${order * order}.`);
      } else if (seen[value]) {
        problems.push(`Value ${value} appears more than once.`);
      } else {
        seen[value] = 1;
      }
      rowSums[row] += value;
      columnSums[column] += value;
      if (row === column) mainDiagonal += value;
      if (row + column === order - 1) antiDiagonal += value;
    }
  }
  rowSums.forEach((sum, index) => {
    if (sum !== constant) problems.push(`Row ${index + 1} sums to ${sum}, expected ${constant}.`);
  });
  columnSums.forEach((sum, index) => {
    if (sum !== constant) problems.push(`Column ${index + 1} sums to ${sum}, expected ${constant}.`);
  });
  if (mainDiagonal !== constant) problems.push(`Main diagonal sums to ${mainDiagonal}, expected ${constant}.`);
  if (antiDiagonal !== constant) problems.push(`Anti-diagonal sums to ${antiDiagonal}, expected ${constant}.`);

  return {
    valid: problems.length === 0,
    order,
    constant,
    rowSums,
    columnSums,
    diagonalSums: [mainDiagonal, antiDiagonal],
    problems,
  };
}

/**
 * Serialize a square for copying or download.
 * @param {number[][]} square
 * @param {'csv' | 'tsv' | 'text'} format
 */
export function formatSquare(square, format = 'text') {
  if (format === 'csv') return square.map((row) => row.join(',')).join('\n');
  if (format === 'tsv') return square.map((row) => row.join('\t')).join('\n');
  const width = String(square.length * square.length).length;
  return square
    .map((row) => row.map((value) => String(value).padStart(width, ' ')).join(' '))
    .join('\n');
}
