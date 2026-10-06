import { mkdirSync, writeFileSync } from 'node:fs';
import { stateHash } from '../../src/sim/world/stateHash';
import { Recorder } from '../../src/input/Recorder';
import { boot, expect, test } from './fixtures';
import { tick } from './input-helpers';

test('T-E03-recorder-browser @E03 @E03-AC10 @E09 real device frames replay through the browser input phase', async ({ page }) => {
  await boot(page);
  await page.evaluate(async () => { const api = window.__SS__!; await api.loadScenario('empty', { seed: 42 }); api.pause(); api.input.record(); });
  await page.keyboard.down('w'); await tick(page, 30);
  await page.keyboard.down('j'); await tick(page, 30); await page.keyboard.up('j');
  await page.keyboard.up('w'); await tick(page, 20);
  const first = await page.evaluate(() => ({ state: window.__SS__!.getState(), recording: window.__SS__!.input.stopRecording() }));
  expect(first.recording.frames).toHaveLength(80);
  const copy = Recorder.parse(Recorder.serialize(first.recording));
  await page.evaluate(async (data) => { await window.__SS__!.input.replay(data); await window.__SS__!.step(data.frames.length); }, copy);
  const replay = await page.evaluate(() => window.__SS__!.getState());
  expect(stateHash(replay)).toBe(stateHash(first.state)); expect(replay.input.frame).toEqual(first.state.input.frame);
  await tick(page); expect((await tick(page)).move).toEqual({ x: 0, z: 0 });
  mkdirSync('test-results/epics/E03', { recursive: true });
  writeFileSync('test-results/epics/E03/keyboard.ssrec', Recorder.serialize(first.recording));
});
