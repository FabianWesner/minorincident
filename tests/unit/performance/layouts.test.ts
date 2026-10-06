import { readFileSync } from 'node:fs';
import { expect, test, vi } from 'vitest';
import { loadLayouts } from '../../../src/levels/layouts';

test('E18 @E18-AC05 level layouts retain shared districts and release documents outside the active level', async () => {
  const read = vi.fn(async (url: string) => JSON.parse(readFileSync(`public${url}`, 'utf8')) as unknown);
  await loadLayouts('L1', undefined, read);
  expect(read).toHaveBeenCalledTimes(3);
  await loadLayouts('L6', undefined, read);
  expect(read).toHaveBeenCalledTimes(8);
  await loadLayouts('L1', undefined, read);
  expect(read).toHaveBeenCalledTimes(8);
  await loadLayouts('L6', undefined, read);
  expect(read).toHaveBeenCalledTimes(13);
});
