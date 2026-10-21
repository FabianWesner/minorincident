import { expect, test } from 'vitest';
import { keepMovingWithFists } from '../../tools/playtest/combat';

test('#99 one or two close infected must not plant the fists courier during the moving retreat', () => {
  expect(keepMovingWithFists('L6', 'retreat', true, 1)).toBe(true);
  expect(keepMovingWithFists('L6', 'exit', true, 2)).toBe(true);
});

test('#99 shelter defence and carried weapons retain their combat decisions', () => {
  expect(keepMovingWithFists('L6', 'shelter', true, 1)).toBe(false);
  expect(keepMovingWithFists('L6', 'stop', true, 3)).toBe(true);
  expect(keepMovingWithFists('L6', 'retreat', false, 3)).toBe(false);
  expect(keepMovingWithFists('L7', 'corridor', true, 3)).toBe(false);
});
