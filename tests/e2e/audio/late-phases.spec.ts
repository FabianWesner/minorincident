import { mkdirSync, writeFileSync } from 'node:fs';
import type { Game } from '../../../src/Game';
import { boot, expect, test } from '../fixtures';

test('T-E29-15-phase @E29-AC15 departure lowers combat music despite remaining threats, and retry restores combat', async ({ page }) => {
  test.setTimeout(240_000);
  await boot(page, '/?test=1&scenelab=1&renderer=webgl&quality=low&audio=muted&dpr=1');
  await page.mouse.click(200, 250);
  await page.evaluate(async () => {
    const a = window.__SS__!;
    await a.loadLevel('L7', { seed: 1, progression: 'L7-default' });
    a.pause(); await a.audio.unlock();
  });
  const phases = [];
  for (const phase of ['waiting', 'boarding', 'departing', 'waiting'] as const) {
    phases.push(await page.evaluate(async phase => {
      const a = window.__SS__!, w = (window.__SCENE__ as unknown as { game: Game }).game.world;
      // Isolate the presentation phase while retaining a hostile intensity floor.
      // The departure route and boarding mechanics have their own real-input test.
      w.l7Departure!.state.phase = phase;
      w.l7Departure!.state.startedAt = w.tick;
      a.audio.emit({ type: 'music.intensity', tick: a.tick(), alerted: 12, minimum: .5, damage: 0, phase: 'normal', vehicleSpeed: 0 });
      await a.step(6);
      return { phase, music: a.audio.snapshot().music };
    }, phase));
  }
  const out = 'test-results/epics/E29/audio'; mkdirSync(out, { recursive: true });
  writeFileSync(`${out}/departure-phases.json`, JSON.stringify(phases, null, 2));
  expect(phases.map(p => p.music.state)).toEqual(['combat', 'combat', 'aftermath', 'combat']);
  expect(phases[2].music.layers).toEqual(['base']);
  expect(phases[2].music.score).toBe(0);
});
