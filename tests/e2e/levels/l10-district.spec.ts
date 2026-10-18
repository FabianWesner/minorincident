import { mkdirSync } from 'node:fs';
import { test, expect, boot } from '../fixtures';
for (const quality of ['high', 'low'] as const) test(`T-E32-05-D2-browser @E32-AC05 @E32-AC29 @E32-AC27 @E32-AC28 ${quality} shotgun and MG checkpoint input retains arsenal on retry`, async ({ page }) => {
  test.setTimeout(180_000);
  const requests: string[] = [];
  page.on('request', r => { if (r.url().includes('D-CURE')) requests.push(r.url()); });
  await boot(page, `/?test=1&renderer=webgl&quality=${quality}&audio=muted&dpr=1`);
  await page.evaluate(async () => { await window.__SS__!.loadLevel('L10', { checkpoint: 'cure-residential', seed: 32 }); window.__SS__!.pause(); });
  for (const at of [{ checkpoint: 'cure-industrial', x: 1257, z: 25, weapon: 'weapon.shotgun' }, { checkpoint: 'cure-military', x: 1857, z: 25, weapon: 'weapon.army-mg' }]) {
    await page.evaluate(async at => { window.__SS__!.teleport('player', { x: at.x, z: at.z }); window.__SS__!.camera.follow(); await window.__SS__!.screenshotReady(); }, at);
    await page.keyboard.down('KeyE'); await page.evaluate(() => window.__SS__!.step(1)); await page.keyboard.up('KeyE');
    expect(await page.evaluate(() => window.__SS__!.missions.state()!.checkpoint)).toBe(at.checkpoint);
    expect(await page.evaluate(() => window.__SS__!.getState().player!.weapons!.RIGHT.rack.map(s => s.id))).toContain(at.weapon);
    await page.evaluate(async () => { window.__SS__!.camera.follow(); await window.__SS__!.step(60); await window.__SS__!.screenshotReady(); });
    const out = 'test-results/epics/E32/D2/game'; mkdirSync(out, { recursive: true });
    await page.screenshot({ path: `${out}/${at.checkpoint}-${quality}-z1.png` });
    await page.evaluate(id => window.__SS__!.missions.restore(id), at.checkpoint);
    const state = await page.evaluate(() => ({ p: window.__SS__!.getState().player!, terrain: window.__SS__!.perf().terrain! }));
    expect(state.p.transform.x).toBeCloseTo(at.x, 0);
    expect(state.p.weapons!.RIGHT.rack.map(s => s.id)).toContain(at.weapon);
    expect(state.terrain.resident).toBeLessThanOrEqual(quality === 'high' ? 25 : 9);
  }
  await page.evaluate(async () => { window.__SS__!.teleport('player', { x: 2467, z: -5 }); await window.__SS__!.step(2); await window.__SS__!.screenshotReady(); });
  expect(await page.evaluate(() => window.__SS__!.missions.state()!.checkpoint)).toBe('cure-research-entry');
  expect(requests.some(url => url.includes('D-CURE.base.glb'))).toBe(false);
});
