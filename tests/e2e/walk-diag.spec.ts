import { boot, expect, test, testUrl } from './fixtures';

const cases: [string, { x: number; z: number }, { x: number; z: number }][] = [
  ['Bn', { x: 44.1, z: 9.5 }, { x: 44.2, z: 3 }],
  ['Bs', { x: 44.1, z: 9.5 }, { x: 44.2, z: 16 }],
  ['Bt', { x: 44.1, z: 9.5 }, { x: 40.03, z: -40.65 }],
  ['Bt2', { x: 44.1, z: 9.5 }, { x: 55, z: -20 }],
];
test('walk diag', async ({ page }) => {
  test.setTimeout(300_000);
  await boot(page, testUrl);
  const out = await page.evaluate(async cases => {
    const a = window.__SS__!;
    await a.loadLevel('L1', { seed: 1, checkpoint: 'bat' });
    a.pause(); a.cheats.god(true); a.camera.follow(); a.setLoadout(['weapon.bat'], ['weapon.fists']);
    const res: string[] = [];
    for (const [name, from, to] of cases as [string, { x: number; z: number }, { x: number; z: number }][]) {
      a.teleport(1, from);
      a.input.set({ moveTarget: to });
      const trace: string[] = [];
      for (let k = 0; k < 2; k++) {
        const began = performance.now(); a.resume(); while (performance.now() - began < 3000) await new Promise(requestAnimationFrame); a.pause();
        const p = a.getEntity(1)!.transform;
        trace.push(`${a.tick()}:${p.x.toFixed(1)},${p.z.toFixed(1)}`);
      }
      a.input.clear();
      res.push(`${name} ${trace.join(' ')}`);
    }
    return res;
  }, cases);
  console.log('WALKDIAG\n' + out.join('\n'));
  expect(true).toBe(true);
});
