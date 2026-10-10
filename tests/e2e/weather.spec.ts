import { preset } from '../../src/sim/progression/Campaign';
import { mkdirSync, writeFileSync } from 'node:fs';
import { boot, expect, test } from './fixtures';
import { SimWorld } from '../../src/sim/world/SimWorld';
import { pcm, rt60 } from '../../tools/audio/measure';
const dir = 'test-results/epics/E28';
test('T-E28-01b @E28 @E28-AC01 browser and Node weather stream agree', async ({ page }) => {
  const w = new SimWorld(); await w.init(); w.loadScenario('storm-street', 28);
  for (let i = 0; i < 360; i++) w.update();
  const node = w.weather!.snapshot(); w.dispose();
  await boot(page); const browser = await page.evaluate(async () => { const a = window.__SS__!; await a.loadScenario('storm-street', { seed: 28 }); a.pause(); await a.step(360); return a.getState().weather; });
  expect(browser).toEqual(node);
});
test('T-E28-04b @E28 @E28-AC04 lightning flash reduction caps the visible flash', async ({ page }) => {
  await boot(page); await page.evaluate(async () => { const a = window.__SS__!; await a.loadScenario('storm-street'); a.pause(); a.settings.set({ flashReduction: true }); a.weather.strike({ x: 4, y: 0, z: 0 }); await a.step(1); });
  const weather = await page.evaluate(() => window.__SS__!.getState().render.weather);
  expect(weather!.flash).toBeLessThanOrEqual(.025);
  expect(weather!.flash).toBeGreaterThan(0);
});
test('T-E28-08b @E28 @E28-AC08 menus do not expose weather selection and debug override remains available', async ({ page }) => {
  await boot(page, '/?test=1&ui=1&renderer=webgl&audio=muted&dpr=1');
  await page.getByTestId('start-game').click(); await page.getByTestId('character-female').click();
  await expect(page.locator('[data-testid="replay-weather"], [data-testid="photo-weather"]')).toHaveCount(0);
  await page.getByTestId('level-L1').click();
  await expect(page.getByRole('heading', { name: 'Mission briefing' })).toBeVisible({ timeout: 60_000 });
  expect(await page.evaluate(() => window.__SS__!.getState().weather!.kind)).toBe('clear'); // First play retains story weather.
  // PO 10-10: no player weather selector
  await page.evaluate(async () => { const a = window.__SS__!; a.pause(); a.weather.override('snow'); await a.step(1); });
  expect(await page.evaluate(() => window.__SS__!.getState().weather!.kind)).toBe('snow');
});
test('T-E28-08c @E28 @E28-AC08 campaign level select keeps story weather', async ({ page }) => {
  await boot(page); const save = preset('L2-default');
  await page.evaluate(save => { const a = window.__SS__!; a.campaign.restore(save); a.campaign.save(); a.campaign.menu(); }, save);
  await page.getByRole('button', { name: 'Level select', exact: true }).click();
  await expect(page.locator('[data-testid="campaign-replay-weather"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Level 1', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Mission briefing' })).toBeVisible({ timeout: 60_000 });
  expect(await page.evaluate(() => window.__SS__!.getState().weather!.kind)).toBe('clear');
});
test('T-E28-09 @E28 @E28-AC09 offline snow/fog reverb decay shorter than clear', async ({ page }) => {
  await boot(page); const rows = [];
  for (const weather of ['clear', 'fog', 'snow'] as const) {
    const result = await page.evaluate(weather => window.__SS__!.audio.render({ scenario: 'shot', zone: 'interior-large', weather }), weather);
    rows.push({ weather, rt60: rt60(pcm(Buffer.from(result.wav, 'base64'))) });
  }
  mkdirSync(dir, { recursive: true }); writeFileSync(`${dir}/audio-decay.json`, JSON.stringify(rows, null, 2));
  expect(rows[1].rt60).toBeLessThan(rows[0].rt60); expect(rows[2].rt60).toBeLessThan(rows[0].rt60);
});
test('T-E28-11 @E28 @E28-AC11 HUD labels current weather and precipitation dithers within 6m', async ({ page }) => {
  await boot(page, '/?test=1&ui=1&renderer=webgl&audio=muted&dpr=1');
  await page.getByTestId('start-game').click(); await page.getByTestId('character-female').click(); await page.getByTestId('level-L1').click();
  await expect(page.getByRole('heading', { name: 'Mission briefing' })).toBeVisible({ timeout: 60_000 });
  await page.evaluate(async () => { const a = window.__SS__!; a.pause(); a.missions.begin(); a.weather.override('snow'); await a.step(2); });
  await expect(page.getByTestId('weather-icon')).toHaveAttribute('data-weather', 'snow');
  expect(await page.evaluate(() => window.__SS__!.getState().render.weather!.rayDitherRadius)).toBe(6);
});

test('T-E28-09b @E28 @E28-AC09 rain bed gain follows intensity and gust/thunder events reach cue log', async ({ page }) => {
  await boot(page); await page.evaluate(async () => { const a = window.__SS__!; await a.loadScenario('storm-street', { seed: 28 }); a.pause(); await a.audio.unlock(); a.audio.clearLog(); a.weather.override('rain'); await a.step(1); });
  const heavy = await page.evaluate(() => window.__SS__!.audio.emitters().find(v => v.cue === 'weather.rain')!.gain);
  await page.evaluate(async () => { const a = window.__SS__!; a.weather.override('rain', .3); await a.step(1); });
  await expect.poll(async () => (await page.evaluate(() => window.__SS__!.audio.emitters().find(v => v.cue === 'weather.rain')!.gain)) / heavy).toBeCloseTo(.3, 2);
  const light = await page.evaluate(() => window.__SS__!.audio.emitters().find(v => v.cue === 'weather.rain')!.gain);
  expect(light / heavy).toBeCloseTo(.3, 2);
  await page.evaluate(async () => { const a = window.__SS__!; a.weather.override('thunderstorm'); a.weather.strike({ x: 4, y: 0, z: 0 }); await a.step(200); });
  const cues = await page.evaluate(() => window.__SS__!.audio.snapshot().cues);
  expect(cues.some(c => c.cue === 'weather.gust')).toBe(true); expect(cues.some(c => c.cue === 'weather.thunder')).toBe(true);
  await page.evaluate(async () => { const a = window.__SS__!; a.weather.override('snow'); a.audio.emit({ type: 'footstep', tick: a.tick(), sourceId: 1, position: { x: 0, y: 0, z: 0 }, actor: 'survivor' }); await a.step(1); });
  expect((await page.evaluate(() => window.__SS__!.audio.snapshot().cues)).some(c => c.cue === 'weather.footstep.snow')).toBe(true);
});
