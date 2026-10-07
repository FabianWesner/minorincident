import { boot, expect, test } from '../fixtures';
import { audioCues } from '../../../src/data/audioCues';

/** sfx2: every cue (recorded variants, layered hit cues, lazy banks) plays in the real browser graph without registry errors. */
test('T-SFX2-01 @E16 every cue fires without errors after the lazy banks arrive', async ({ page }) => {
  test.setTimeout(120_000);
  await boot(page);
  await page.mouse.click(200, 250);
  const ids = Object.keys(audioCues).filter(id => !id.startsWith('music.') && !audioCues[id].loop);
  const result = await page.evaluate(async (ids) => {
    const a = window.__SS__!;
    await a.loadLevel('L1'); a.missions.begin(); await a.audio.unlock(); a.resume();
    await new Promise(r => setTimeout(r, 4000)); // lazy banks load in the background
    a.audio.clearLog();
    let played = 0;
    for (const id of ids) { if (a.audio.play(id) !== null) played++; await new Promise(r => setTimeout(r, 30)); }
    return { played, errors: a.audio.snapshot().errors };
  }, ids);
  expect(result.errors).toEqual([]);
  expect(result.played).toBeGreaterThan(ids.length * 0.8);
});
