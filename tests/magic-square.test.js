import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_ORDER,
  MAX_STEP_ORDER,
  buildConstructionSteps,
  classifyOrder,
  formatSquare,
  generateMagicSquare,
  magicConstant,
  parseOrder,
  verifyMagicSquare,
} from '../src/lib/magic-square.js';

/** Independent check written separately from verifyMagicSquare. */
function assertIsNormalMagicSquare(square, order) {
  const expected = (order * (order * order + 1)) / 2;
  assert.equal(square.length, order);
  const values = square.flat();
  assert.equal(values.length, order * order);
  assert.deepEqual(
    [...values].sort((a, b) => a - b),
    Array.from({ length: order * order }, (_, index) => index + 1),
    `order ${order}: must contain 1..n² exactly once`,
  );
  for (let i = 0; i < order; i++) {
    const rowSum = square[i].reduce((sum, value) => sum + value, 0);
    const columnSum = square.reduce((sum, row) => sum + row[i], 0);
    assert.equal(rowSum, expected, `order ${order}: row ${i + 1}`);
    assert.equal(columnSum, expected, `order ${order}: column ${i + 1}`);
  }
  const main = square.reduce((sum, row, i) => sum + row[i], 0);
  const anti = square.reduce((sum, row, i) => sum + row[order - 1 - i], 0);
  assert.equal(main, expected, `order ${order}: main diagonal`);
  assert.equal(anti, expected, `order ${order}: anti-diagonal`);
}

test('magic constant matches n(n² + 1) / 2', () => {
  assert.equal(magicConstant(1), 1);
  assert.equal(magicConstant(3), 15);
  assert.equal(magicConstant(4), 34);
  assert.equal(magicConstant(5), 65);
  assert.equal(magicConstant(6), 111);
  assert.equal(magicConstant(8), 260);
});

test('order 1 is the single cell [1]', () => {
  assert.deepEqual(generateMagicSquare(1), [[1]]);
});

test('order 2 is rejected because no square exists', () => {
  assert.throws(() => generateMagicSquare(2), RangeError);
});

test('order 3 is the Lo Shu square produced by the Siamese method', () => {
  assert.deepEqual(generateMagicSquare(3), [
    [8, 1, 6],
    [3, 5, 7],
    [4, 9, 2],
  ]);
});

for (const order of [3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 18]) {
  test(`order ${order} (${classifyOrder(order)}) is a normal magic square`, () => {
    assertIsNormalMagicSquare(generateMagicSquare(order), order);
  });
}

test(`every supported order from 1 to ${MAX_ORDER} is valid`, () => {
  for (let order = 1; order <= MAX_ORDER; order++) {
    if (order === 2) continue;
    const square = generateMagicSquare(order);
    assertIsNormalMagicSquare(square, order);
    assert.equal(verifyMagicSquare(square).valid, true);
  }
});

test('invalid orders throw', () => {
  for (const bad of [0, -3, 2.5, NaN, Infinity, MAX_ORDER + 1, '3', null, undefined]) {
    assert.throws(() => generateMagicSquare(bad), RangeError, `order ${String(bad)}`);
  }
});

test('classifyOrder picks the right construction', () => {
  assert.equal(classifyOrder(1), 'trivial');
  assert.equal(classifyOrder(2), 'impossible');
  assert.equal(classifyOrder(7), 'odd');
  assert.equal(classifyOrder(8), 'doubly-even');
  assert.equal(classifyOrder(10), 'singly-even');
});

test('verifyMagicSquare detects broken squares', () => {
  const swapped = generateMagicSquare(4);
  [swapped[0][0], swapped[0][1]] = [swapped[0][1], swapped[0][0]];
  const result = verifyMagicSquare(swapped);
  assert.equal(result.valid, false);
  assert.ok(result.problems.length > 0);

  const duplicate = [
    [5, 5, 5],
    [5, 5, 5],
    [5, 5, 5],
  ];
  assert.equal(verifyMagicSquare(duplicate).valid, false, 'equal sums but repeated values');
  assert.equal(verifyMagicSquare([[1, 2], [3]]).valid, false, 'ragged grid');
  assert.equal(verifyMagicSquare([]).valid, false, 'empty grid');
});

test('verifyMagicSquare reports sums', () => {
  const result = verifyMagicSquare(generateMagicSquare(5));
  assert.equal(result.constant, 65);
  assert.deepEqual(result.rowSums, [65, 65, 65, 65, 65]);
  assert.deepEqual(result.columnSums, [65, 65, 65, 65, 65]);
  assert.deepEqual(result.diagonalSums, [65, 65]);
});

test('parseOrder validates user input', () => {
  assert.deepEqual(parseOrder('3'), { ok: true, order: 3 });
  assert.deepEqual(parseOrder(' 12 '), { ok: true, order: 12 });
  assert.deepEqual(parseOrder(1), { ok: true, order: 1 });
  assert.deepEqual(parseOrder(String(MAX_ORDER)), { ok: true, order: MAX_ORDER });
  for (const bad of ['', '   ', 'abc', '2', '0', '-4', '3.5', '1e2', String(MAX_ORDER + 1), null]) {
    const result = parseOrder(bad);
    assert.equal(result.ok, false, `input ${JSON.stringify(bad)}`);
    assert.ok(result.error.length > 0);
  }
  assert.match(parseOrder('2').error, /2×2/);
});

test('formatSquare serializes to csv, tsv and aligned text', () => {
  const square = generateMagicSquare(3);
  assert.equal(formatSquare(square, 'csv'), '8,1,6\n3,5,7\n4,9,2');
  assert.equal(formatSquare(square, 'tsv'), '8\t1\t6\n3\t5\t7\n4\t9\t2');
  assert.equal(formatSquare(generateMagicSquare(4), 'text').split('\n')[0], '16  2  3 13');
});

test('the largest order generates quickly', () => {
  const started = performance.now();
  generateMagicSquare(MAX_ORDER);
  assert.ok(performance.now() - started < 200);
});

test('replaying the construction steps reproduces the generated square', () => {
  for (let order = 1; order <= 30; order++) {
    if (order === 2) continue;
    const steps = buildConstructionSteps(order);
    const grid = Array.from({ length: order }, () => new Array(order).fill(0));
    for (const step of steps) {
      assert.ok(step.caption.length > 0);
      assert.ok(step.cells.length > 0);
      for (const { row, column, value } of step.cells) grid[row][column] = value;
    }
    assert.deepEqual(grid, generateMagicSquare(order), `order ${order}`);
  }
  assert.ok(MAX_STEP_ORDER >= 6);
});

test('construction steps: odd orders place one number per step, in order', () => {
  const steps = buildConstructionSteps(5);
  assert.equal(steps.length, 25);
  assert.deepEqual(steps.map((step) => step.cells[0].value), Array.from({ length: 25 }, (_, i) => i + 1));
  assert.deepEqual(steps[0].cells, [{ row: 0, column: 2, value: 1 }]);
  assert.match(steps[5].caption, /step down/);
});

test('construction steps reject orders with no square', () => {
  for (const bad of [2, 0, -1, 2.5, MAX_ORDER + 1]) {
    assert.throws(() => buildConstructionSteps(bad), RangeError);
  }
});
