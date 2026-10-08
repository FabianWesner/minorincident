import { expect, test } from './fixtures';
import { menuUrl } from './ui-helpers';

/** Pause-bar "Restart level": fresh world from the level's very start, with an in-page confirmation. */
type Probe = { tick: number; objective: string[]; player: { x: number; z: number }; entities: number; owned: string[]; left: string[] };
const probe = () => window.__SS__!.getState() && (() => {
  const api = window.__SS__!, m = api.missions.state()!, state = api.getState() as unknown as { entities?: unknown[] };
  const p = api.getEntity(1)!.transform;
  const camp = api.campaign.state();
  return { tick: api.tick(), objective: Object.entries(m.steps).filter(([, s]) => (s as { status: string }).status === 'active').map(([id]) => id), player: { x: p.x, z: p.z }, entities: api.query({}).length, owned: camp?.ownedActions ?? [], left: camp?.racks.LEFT ?? [], _s: state.entities?.length ?? 0 };
})() as Probe;

async function openPause(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(() => window.__SS__!.resume());
  await page.keyboard.press('KeyP');
  await expect(page.getByTestId('menu-pause')).toBeVisible();
}
async function restart(page: import('@playwright/test').Page, how: 'click' | 'key' = 'click'): Promise<void> {
  await openPause(page);
  if (how === 'key') await page.keyboard.press('KeyR'); else await page.getByTestId('pause-restart').click();
  await expect(page.getByTestId('restart-confirm')).toBeVisible();
  await page.getByTestId('restart-confirm-yes').click();
  await expect(page.getByTestId('menu-pause')).toBeHidden();
  await page.waitForFunction(() => window.__SS__!.missions.state() !== null && !document.querySelector('[data-testid=menu-loading]:not([hidden])'));
  await page.evaluate(() => { const api = window.__SS__!; api.missions.begin(); api.pause(); });
}
async function start(page: import('@playwright/test').Page, level: 'L1' | 'L2'): Promise<void> {
  await page.goto(menuUrl.replace('&seed=1', '&seed=1'));
  await page.waitForFunction(() => Boolean(window.__SS__));
  await page.evaluate(async level => { const api = window.__SS__!; await api.ready; await api.loadLevel(level, level === 'L2' ? { progression: 'L2-default' } : {}); api.missions.begin(); api.pause(); }, level);
}

for (const level of ['L1', 'L2'] as const) test(`restart ${level} returns to the level start behind an in-page confirmation @restart`, async ({ page }) => {
  test.setTimeout(180_000);
  await start(page, level);
  const fresh = await page.evaluate(probe);
  // Cancel keeps playing state; Esc inside the confirmation only cancels it.
  await openPause(page); await page.getByTestId('pause-restart').click();
  await expect(page.getByTestId('restart-confirm-text')).toHaveText(`Restart Level ${level.slice(1)}? Progress since the level start is lost.`);
  await page.keyboard.press('Escape'); await expect(page.getByTestId('restart-confirm')).toBeHidden(); await expect(page.getByTestId('menu-pause')).toBeVisible();
  await page.getByTestId('pause-restart').click(); await page.getByTestId('restart-confirm-cancel').click();
  await expect(page.getByTestId('restart-confirm')).toBeHidden();
  await page.getByTestId('resume-game').click();
  // Play on: move the player away, progress the mission.
  await page.evaluate(() => { const api = window.__SS__!; api.pause(); api.teleport('player', { x: api.getEntity(1)!.transform.x + 60, z: api.getEntity(1)!.transform.z + 60 }); api.cheats.completeObjective(); });
  await page.evaluate(async () => { await window.__SS__!.step(120); });
  const played = await page.evaluate(probe);
  expect(played.objective).not.toEqual(fresh.objective);
  await restart(page, level === 'L1' ? 'click' : 'key');
  const after = await page.evaluate(probe);
  expect(after.objective).toEqual(fresh.objective);
  expect(Math.hypot(after.player.x - fresh.player.x, after.player.z - fresh.player.z)).toBeLessThan(1);
  expect(after.entities).toBe(fresh.entities);
  expect(after.tick).toBeLessThan(fresh.tick + 30);
  expect(after.owned).toEqual(fresh.owned); expect(after.left).toEqual(fresh.left);
  if (level === 'L2') expect(JSON.stringify([...after.owned, ...after.left])).toContain('bat');
  await page.evaluate(() => window.__SS__!.resume());
  await expect.poll(() => page.evaluate(() => window.__SS__!.tick())).toBeGreaterThan(after.tick);
});

test('five restarts keep entities, audio voices and heap stable @restart', async ({ page }) => {
  test.setTimeout(300_000);
  await start(page, 'L1');
  const sample = () => page.evaluate(async () => {
    const api = window.__SS__!, audio = api.audio.snapshot();
    const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? 0;
    return { entities: api.query({}).length, voices: audio.voices, music: audio.music.state, heap: mem, crowd: api.crowdFigures().length, panels: document.querySelectorAll('[data-testid=menu-pause]').length, hud: document.querySelectorAll('[data-testid=hud]').length };
  });
  const first = await sample();
  for (let i = 0; i < 5; i++) await restart(page);
  const last = await sample();
  expect(last.entities).toBe(first.entities); expect(last.crowd).toBe(first.crowd);
  expect(last.panels).toBe(1); expect(last.hud).toBe(first.hud);
  expect(last.voices).toBeLessThanOrEqual(first.voices + 2);
  expect(last.music).toBe(first.music);
  if (first.heap) expect(last.heap).toBeLessThan(first.heap * 1.6 + 60e6);
});
