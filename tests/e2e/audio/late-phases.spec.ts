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
    await page.evaluate(async phase => {
      const a = window.__SS__!, w = (window.__SCENE__ as unknown as { game: Game }).game.world;
      // Isolate the presentation phase while retaining a hostile intensity floor.
      // The departure route and boarding mechanics have their own real-input test.
      w.l7Departure!.state.phase = phase;
      w.l7Departure!.state.startedAt = w.tick;
      a.audio.emit({ type: 'music.intensity', tick: a.tick(), alerted: 12, minimum: .5, damage: 0, phase: 'normal', vehicleSpeed: 0 });
      await a.step(6);
    }, phase);
    const expected = phase === 'departing' ? 'aftermath' : 'combat';
    await expect.poll(() => page.evaluate(() => window.__SS__!.audio.snapshot().music.streamed.state), { timeout: 5000 }).toBe(expected);
    const music = await page.evaluate(() => window.__SS__!.audio.snapshot().music);
    expect(music.streamed.decks.some(d => d.state === expected && d.file === expected && !d.paused)).toBe(true);
    phases.push({ phase, music });
  }
  const out = 'test-results/epics/E29/audio'; mkdirSync(out, { recursive: true });
  writeFileSync(`${out}/departure-phases.json`, JSON.stringify(phases, null, 2));
  expect(phases.map(p => p.music.state)).toEqual(['combat', 'combat', 'aftermath', 'combat']);
  expect(phases[2].music.layers).toEqual(['base']);
  expect(phases[2].music.score).toBe(0);
});

for (const quality of ['high', 'low'] as const) test(`T-E30-16-phase @E30-AC16 sanctuary, breach, battle and cab audio trace ${quality}`, async ({ page }) => {
  test.setTimeout(240_000);
  await boot(page, `/?test=1&scenelab=1&renderer=webgl&quality=${quality}&audio=muted&dpr=1`);
  await page.mouse.click(200, 250);
  await page.evaluate(async quality => {
    const a = window.__SS__!; await a.loadLevel('L8', { seed: 1, progression: 'L8-default' }); a.missions.begin(); a.pause();
    a.settings.set({ quality, captions: true, muted: false }); await a.audio.unlock(); a.audio.clearLog();
  }, quality);
  const phases = [];
  for (const [phase, expected] of [['sanctuary', 'calm'], ['breach', 'tension'], ['battle', 'combat']] as const) {
    const input = await page.evaluate(async phase => {
      const a = window.__SS__!, w = (window.__SCENE__ as unknown as { game: Game }).game.world;
      // Probe the saved story/audio adapter. The real-input zoo route separately
      // owns the actual breach, infection and APC boarding mechanics.
      w.missions!.state.states.breached = phase !== 'sanctuary';
      a.audio.emit({ type: 'music.intensity', tick: a.tick(), alerted: phase === 'battle' ? 12 : 0, minimum: phase === 'battle' ? .5 : 0, damage: 0, phase: 'normal', vehicleSpeed: 0 });
      await a.step(6);
      return { infected: a.query({ kind: 'infected' }).filter(e => e.health.current > 0).length, cues: a.audio.snapshot().cues };
    }, phase);
    if (phase === 'sanctuary') {
      expect(input.infected).toBe(0);
      expect(input.cues.filter(c => /telegraph\.(lion|gorilla|elephant|zebra|flamingo)/.test(c.cue))).toEqual([]);
    }
    await expect.poll(() => page.evaluate(() => window.__SS__!.audio.snapshot().music.streamed.state), { timeout: 8000 }).toBe(expected);
    phases.push({ phase, input, audio: await page.evaluate(() => window.__SS__!.audio.snapshot()) });
  }
  const engine = await page.evaluate(() => {
    const a = window.__SS__!, p = a.getEntity(1)!.transform;
    a.audio.emit({ type: 'vehicle.sound', tick: a.tick(), sourceId: 777, phase: 'engine', position: { x: p.x + 2, z: p.z }, velocity: { x: 8, z: 0 }, rpm: 3500, speed: 8, health: 1, inCar: true });
    return a.audio.snapshot();
  });
  expect(engine.cues.some(c => c.cue === 'vehicle.engine-low' && c.sourceId === 777 && c.lowpass === 700)).toBe(true);
  const peak = await page.evaluate(() => {
    const a = window.__SS__!, p = a.getEntity(1)!.transform;
    for (let i = 0; i < 48; i++) a.audio.play('telegraph.lion.pounce', { position: { x: p.x + 3, z: p.z }, offscreen: false }, 800 + i);
    return a.audio.snapshot();
  });
  expect(peak.voiceLimit).toBe(quality === 'high' ? 32 : 16); expect(peak.voices).toBeLessThanOrEqual(peak.voiceLimit);
  expect(peak.captions.some(c => c.includes('Lion pounce'))).toBe(true); expect(peak.errors).toEqual([]);
  const out = 'test-results/epics/E30/audio'; mkdirSync(out, { recursive: true });
  writeFileSync(`${out}/phases-${quality}.json`, JSON.stringify({ phases, engine, peak }, null, 2));
});
