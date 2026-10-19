import { mkdirSync } from 'node:fs';
import { expect, test, boot } from './fixtures';
import { tick } from './input-helpers';

test.use({ launchOptions: { args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu'] } });
for (const renderer of ['webgl', 'webgpu'] as const) for (const quality of ['high', 'low'] as const) for (const zoom of [1, .5]) {
  test(`@E03 @E05 @E03-AC05 @E05-AC11 walking north shoots north with zombies north and south (${renderer}/${quality}/z${zoom})`, async ({ page }) => {
    test.setTimeout(120_000);
    await boot(page, `/?test=1&scenelab=1&renderer=${renderer}&quality=${quality}&audio=muted&dpr=1`);
    await page.evaluate(async zoom => {
      await window.__SCENE__!.load({ ground: 'grass', actors: [{ id: 'courier', kind: 'courier', at: [0, 0], yaw: -45, god: true, loadout: ['weapon.handgun', 'weapon.handgun'] }], camera: { mode: 'game', target: [0, 0], zoom } });
      window.__SS__!.pause(); window.__SS__!.input.clear();
    }, zoom);
    const ids = await page.evaluate(() => {
      const a = window.__SS__!;
      return { north: a.spawn('infected.runner', { x: -2.1, z: -2.1 }, { hp: 1000 }), south: a.spawn('infected.runner', { x: 1.4, z: 1.4 }, { hp: 1000 }) };
    });
    await page.keyboard.down('w'); await page.keyboard.down('k'); await tick(page, 10);
    await page.keyboard.up('k'); await page.keyboard.up('w'); await tick(page, 12);
    const result = await page.evaluate(() => ({ backend: window.__SS__!.perf().backend, events: window.__SS__!.events() }));
    expect(result.backend).toBe(renderer);
    const shots = result.events.filter(e => e.type === 'combat.attack' && e.sourceId === 1);
    expect(shots.length).toBeGreaterThan(0);
    for (const shot of shots) if (shot.type === 'combat.attack') { expect(shot.direction.x).toBeLessThan(-.6); expect(shot.direction.z).toBeLessThan(-.6); }
    expect(result.events.some(e => e.type === 'combat.hit' && e.targetId === ids.north)).toBe(true);
    expect(result.events.some(e => e.type === 'combat.hit' && e.targetId === ids.south)).toBe(false);
    await page.evaluate(() => window.__SS__!.screenshotReady());
    mkdirSync('docs/reports/controls-content/captures', { recursive: true });
    await page.screenshot({ path: `docs/reports/controls-content/captures/north-${renderer}-${quality}-z${zoom}.png` });
  });
}
