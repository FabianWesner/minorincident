import { expect, test, vi } from 'vitest';
import { Group } from 'three';
import { strideScale } from '../../src/render/characters/clips';

test('@transition stride bone references avoid repeated searches while transforms stay live', () => {
  const root = new Group(), frame = new Group(), hip = new Group(), shin = new Group(), foot = new Group();
  hip.name = 'hip'; shin.name = 'shinL'; foot.name = 'footL';
  shin.position.y = -.2; foot.position.y = -.1;
  root.add(frame); frame.add(hip); hip.add(shin); shin.add(foot); frame.scale.setScalar(2);
  const find = vi.spyOn(root, 'getObjectByName');
  expect(strideScale(root)).toBeCloseTo(2 * .3 / .516);
  const calls = find.mock.calls.length;
  frame.scale.setScalar(3); foot.position.y = -.15;
  expect(strideScale(root)).toBeCloseTo(3 * .35 / .516);
  expect(find).toHaveBeenCalledTimes(calls);
  root.add(hip); root.scale.setScalar(4);
  expect(strideScale(root)).toBeCloseTo(4 * .35 / .516);
  expect(find).toHaveBeenCalledTimes(calls);
});

test('@transition animal and missing stride bones retain the authored stride', () => {
  const animal = new Group(), leg = new Group(), shin = new Group(), foot = new Group();
  leg.name = 'legFL'; shin.name = 'shinL'; foot.name = 'footL';
  shin.position.y = -.2; foot.position.y = -.1; animal.add(leg, shin, foot); animal.scale.setScalar(2);
  expect(strideScale(animal)).toBe(2);
  const missing = new Group(); missing.scale.setScalar(3);
  expect(strideScale(missing)).toBe(3);
});
