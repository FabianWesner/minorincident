import { mkdirSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { test, expect, boot, testUrl } from '../fixtures';
import { highwayPoint } from '../../../src/levels/L3/highway';

/** PO 10-12: "When the group goes up the highway bridge the figure is out of the view port (just see the shoes on top)". */
test.use({ trace: 'off' });
const shots = process.env.RAMP_SHOTS; // e.g. docs/reports/fix-camera-ramp/after: keeps the desktop captures of this run
const MARGIN = .9; // NDC: the whole figure stays inside 90 % of the half-viewport
const ramps = [{ id: 'a', position: [155.5, 0, 0] as [number, number, number], yaw: Math.PI }, { id: 'b', position: [191.5, 0, 0] as [number, number, number], yaw: 0 }];

/** Heading toward `to` pressed as WASD on the isometric camera (forward is -x/-z, right is +x/-z). */
async function steer(page: Page, to: { x: number; z: number }, from: { x: number; z: number }, held: Set<string>) {
  const dx = to.x - from.x, dz = to.z - from.z, len = Math.hypot(dx, dz) || 1, fwd = (-dx - dz) / (len * Math.SQRT2), right = (dx - dz) / (len * Math.SQRT2);
  const want = new Set<string>();
  if (fwd > .38) want.add('w'); if (fwd < -.38) want.add('s'); if (right > .38) want.add('d'); if (right < -.38) want.add('a');
  for (const k of held) if (!want.has(k)) { await page.keyboard.up(k); held.delete(k); }
  for (const k of want) if (!held.has(k)) { await page.keyboard.down(k); held.add(k); }
}

for (const [name, size] of [['desktop', { width: 1600, height: 900 }], ['phone', { width: 390, height: 844 }]] as const) {
  test(`@L3 ramp camera ${name}: walking up and over the highway keeps the courier and companion fully in the viewport`, async ({ page }) => {
    test.setTimeout(240000);
    await page.setViewportSize(size);
    await boot(page, `${testUrl}&ui=1`);
    await page.evaluate(() => window.__SS__!.loadLevel('L3', { seed: 1, progression: 'L3-default' }));
    await page.evaluate(() => window.__SS__!.pause());
    await page.getByRole('button', { name: 'Begin mission' }).click();
    await page.evaluate(() => window.__SS__!.pause());
    // Clear the street, put the group at the foot of the first ramp and let the camera settle.
    await page.evaluate(() => { const a = window.__SS__!; for (const e of a.query({ kind: 'infected' })) e.health.current = 0; a.teleport('player', { x: 139, z: 0 }); });
    await page.evaluate(() => window.__SS__!.step(90));
    const path = [...Array.from({ length: 41 }, (_, i) => highwayPoint(ramps[0] as never, 1 - i / 40)), ...Array.from({ length: 41 }, (_, i) => highwayPoint(ramps[1] as never, i / 40))].map(p => ({ x: p[0], z: p[2] }));
    const held = new Set<string>(); let next = 0, maxHeight = 0, worst = 0, captured = 0;
    const out: string[] = [];
    for (let frame = 0; frame < 2600 && next < path.length; frame++) {
      const state = await page.evaluate(() => {
        const a = window.__SS__!, p = a.getState().player!.transform, feet = p.y - .72, project = (x: number, y: number, z: number) => a.camera.project(x, y, z);
        const box = [project(p.x, feet, p.z), project(p.x, feet + 1.8, p.z)];
        const dog = a.query({ within: { x: p.x, z: p.z, r: 8 } }).find(e => e.companion);
        if (dog) box.push(project(dog.transform.x, dog.transform.y - .3, dog.transform.z), project(dog.transform.x, dog.transform.y + .4, dog.transform.z));
        return { x: p.x, z: p.z, feet, box, companion: !!dog };
      });
      maxHeight = Math.max(maxHeight, state.feet);
      for (const [x, y] of state.box) worst = Math.max(worst, Math.abs(x), Math.abs(y));
      if (frame % 25 === 0) out.push(`${state.x.toFixed(1)},${state.z.toFixed(1)} h${state.feet.toFixed(2)} ndc<=${Math.max(...state.box.flatMap(b => [Math.abs(b[0]), Math.abs(b[1])])).toFixed(2)}`);
      for (const [x, y] of state.box) { const where = `at ${state.x.toFixed(1)},${state.z.toFixed(1)} h${state.feet.toFixed(2)}`; expect(Math.abs(x), `x out of frame ${where}`).toBeLessThan(MARGIN); expect(Math.abs(y), `y out of frame ${where}`).toBeLessThan(MARGIN); }
      while (next < path.length && Math.hypot(path[next].x - state.x, path[next].z - state.z) < 1.4) next++;
      if (next >= path.length) break;
      await steer(page, path[next], state, held);
      await page.evaluate(() => window.__SS__!.step(6));
      if (shots && name === 'desktop' && state.feet > 1 && captured < 3 && frame % 120 === 60) { mkdirSync(shots, { recursive: true }); await page.screenshot({ path: `${shots}/ramp-${++captured}.png` }); }
    }
    for (const k of held) await page.keyboard.up(k);
    console.log(`${name}: max height ${maxHeight.toFixed(2)} worst ndc ${worst.toFixed(2)}\n${out.join('\n')}`);
    expect(maxHeight, 'the courier reached the elevated span').toBeGreaterThan(5);
    expect(next, 'followed the whole bridge centreline').toBeGreaterThanOrEqual(path.length);
  });
}
