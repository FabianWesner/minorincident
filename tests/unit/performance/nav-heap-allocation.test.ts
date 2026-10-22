import { expect, test } from 'vitest';
import { NavGrid } from '../../../src/sim/ai/NavGrid';

type Queue = { heap: unknown[]; push(cell: number, score: number): void; pop(): number };
const queue = () => Object.assign(Object.create(NavGrid.prototype), { heap: [] }) as Queue;

test('T-E22-20-heap @E22-AC20 alarm path searches store numeric heap entries without allocating an object per insertion', () => {
  const q = queue();
  for (let i = 0; i < 1000; i++) q.push(i, i % 17);
  expect(q.heap.every(value => typeof value === 'number'), 'crowd path searches must not allocate one object per queue entry').toBe(true);
});

test('numeric path queue retains the original heap ordering, including ties and interleaved pushes', () => {
  const q = queue(), original: { cell: number; score: number }[] = [];
  const push = (cell: number, score: number) => {
    q.push(cell, score);
    const item = { cell, score }; let index = original.length; original.push(item);
    while (index > 0) { const parent = (index - 1) >> 1; if (original[parent].score <= score) break; original[index] = original[parent]; index = parent; }
    original[index] = item;
  };
  const pop = () => {
    const cell = original[0].cell, item = original.pop()!;
    if (original.length) { let index = 0;
      while (index * 2 + 1 < original.length) { let next = index * 2 + 1; if (next + 1 < original.length && original[next + 1].score < original[next].score) next++; if (original[next].score >= item.score) break; original[index] = original[next]; index = next; }
      original[index] = item;
    }
    expect(q.pop()).toBe(cell);
  };
  for (let i = 0; i < 2048; i++) { push(i, (i * 31) % 53); if (i % 3 === 0) pop(); }
  while (original.length) pop();
  expect(q.heap).toHaveLength(0);
});
