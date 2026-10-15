import { boot, test, expect } from '../fixtures';

/** PO 2026-10-12: "there should be sound when the bus is driving, maybe even music". Engines follow the convoy, the in-bus radio plays
 * until the outbreak alarm and the adaptive score is trimmed meanwhile. Real (unmuted, unlocked) audio graph, headless. */
test('T-E22-bus-audio @E22 the L4 convoy has engine loops, the bus radio plays during the ride and fades at the alarm', async ({ page }) => {
  test.setTimeout(300_000);
  await boot(page); await page.mouse.click(200, 250);
  await page.evaluate(async () => {
    const a = window.__SS__!;
    await a.loadLevel('L4', { seed: 1, progression: 'L4-default' }); a.missions.begin(); a.pause();
    await a.audio.unlock(); a.audio.clearLog(); a.resume();
  });
  await page.waitForTimeout(9800); // PO reproduction: L4 seed 1, tick 588 (9.8 s).
  const ride = await page.evaluate(() => {
    const a = window.__SS__!, ids = a.missions.state()!.l4!.convoyIds, cues = a.audio.snapshot().cues as { cue: string; sourceId?: number; lowpass?: number }[];
    const engines = new Set(cues.filter(c => c.cue === 'vehicle.engine-low' && c.sourceId !== undefined).map(c => c.sourceId!));
    return { convoy: ids.length, engines: ids.filter(id => engines.has(id)).length, tyres: cues.filter(c => c.cue.startsWith('footstep.tires')).length, radio: (a.audio.snapshot() as unknown as { music: { radio: { level: number; playing: boolean } } }).music.radio };
  });
  expect(ride.engines, 'every convoy vehicle has an engine loop').toBe(ride.convoy);
  expect(ride.tyres, 'road noise').toBeGreaterThan(0);
  expect(ride.radio.playing, 'radio streams').toBe(true);
  expect(ride.radio.level, 'convoy music is audible at score level').toBeGreaterThan(0.5);
  expect(ride.radio.level).toBeLessThan(0.65);
  // The outbreak alarm (first turn) ends the radio.
  await page.evaluate(() => { window.__SS__!.cheats.completeObjective('ride'); });
  expect(await page.evaluate(() => window.__SS__!.missions.state()!.l4!.phase)).toBe('plaza');
  await page.evaluate(async () => { const a = window.__SS__!; a.pause(); await a.step(60 * 101); a.resume(); }); // the latest first turn comes 100 s after the arrival
  expect(await page.evaluate(() => window.__SS__!.missions.state()!.l4!.phase)).not.toBe('plaza');
  await expect.poll(() => page.evaluate(() => (window.__SS__!.audio.snapshot() as unknown as { music: { radio: { level: number } } }).music.radio.level), { timeout: 15_000 }).toBeLessThan(0.01);
});
