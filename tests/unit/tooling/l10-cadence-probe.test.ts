import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { Clock } from '../../../src/core/Clock';

test('PO #98 steady rendering can run through the normal frame loop without advancing simulation', () => {
  const clock = new Clock(); let ticks = 0;
  clock.pause(); clock.setTimeScale(0); clock.resume();
  for (let frame = 0; frame < 600; frame++) clock.advance(1 / 60, () => ticks++);
  expect(clock.paused).toBe(false); expect(ticks).toBe(0);
});

test('PO #98 cadence compares the gameplay camera and world tick without the inspection UI', () => {
  const source = readFileSync('tools/qa/l10-real-play.ts', 'utf8');
  expect(source).not.toContain('a.inspect.enable(true');
  expect(source).toContain('g.clock.setTimeScale(0); g.clock.resume()');
  expect(source).toContain('assert.equal(sample.tickAfter, state.tick)');
  expect(source).toContain('cadence samples must retain the captured gameplay camera');
});
