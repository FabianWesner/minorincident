import { mkdirSync, writeFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { test, expect, boot } from '../fixtures';

/**
 * P0 10-20 (PO, PROD): "Seems like I cannot finsish L5. THe yellow circle isn't working and whe I go down the subway, I see the subway
 * shorty, but then the firgure walks back out...." Real keyboard input from the metro phase: the group of five follows the courier
 * to the yellow ring and down the stairs while the player keeps holding the movement keys, as the PO did. Browser runs only through
 * tools/e2e-lock.sh, headless.
 */
const output = 'test-results/p0-l5-finish';
test.use({ trace: 'off', ...(process.platform === 'darwin' ? { launchOptions: { args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] } } : {}) });

async function metroPhase(page: Page, quality: 'high' | 'low') {
  await boot(page, `/?test=1&renderer=webgl&dpr=1&quality=${quality}&audio=muted&seed=1&ui=1`);
  await page.evaluate(() => window.__SS__!.loadLevel('L5', { seed: 1, progression: 'L5-default' }));
  await page.evaluate(() => window.__SS__!.pause());
  await page.evaluate(() => {
    const button = [...document.querySelectorAll('button')].find(b => b.textContent === 'Begin mission')!;
    button.addEventListener('click', () => queueMicrotask(() => window.__SS__!.pause()), { once: true });
  });
  await page.getByRole('button', { name: 'Begin mission' }).click();
  await page.evaluate(() => window.__SS__!.pause());
  await page.evaluate(() => window.__SS__!.screenshotReady());
  // Skip the search: all five found and following, the street cleared, the group gathered south of the entrance.
  await page.evaluate(async () => {
    const a = window.__SS__!; a.cheats.god(true);
    a.cheats.completeObjective('emerge'); await a.step(11 * 60);
    a.cheats.completeObjective('look'); a.cheats.killAll(); await a.step(2);
    const m = a.missions.state()!;
    // The group as it arrives from the plaza in a real run (positions from the sim walk east along Harbor Street).
    a.teleport('player', { x: 33, z: -35.7 });
    m.l5!.survivors.forEach((r, i) => a.teleport(r.id, { x: 27 + (i % 3) * 1.2, z: -35.2 - Math.floor(i / 3) * 1.2 }));
    const dog = a.query({ kind: 'companion' })[0]; if (dog) a.teleport(dog.id, { x: 31, z: -35.5 });
    a.camera.follow();
    for (let i = 0; i < 6; i++) { a.cheats.killAll(); await a.step(30); }
  });
  const m = await page.evaluate(() => window.__SS__!.missions.state()!);
  expect(m.steps.metro.status).toBe('active');
  expect(m.l5!.survivors.filter(r => r.status === 'following')).toHaveLength(5);
}

for (const quality of ['high', 'low'] as const) test(`@E23 @E23-AC15 P0 L5 finishes from the metro phase with held keyboard input, ${quality}`, async ({ page }) => {
  test.setTimeout(300_000); page.setDefaultTimeout(120_000); mkdirSync(output, { recursive: true });
  await metroPhase(page, quality);
  const probe = () => page.evaluate(() => {
    const a = window.__SS__!, m = a.missions.state()!, s = m.l5!, p = a.getState().player!.transform;
    const distance = Number(document.querySelector('[data-objective]')?.getAttribute('data-distance') || NaN);
    return { tick: a.getState().tick, phase: m.phase, l5: s.phase, metroAt: s.metroAt, shutterAt: s.shutterAt, doneAt: s.doneAt, p: { x: p.x, z: p.z }, marker: m.marker,
      inRing: distance <= .8, distance,
      hud: (document.querySelector('[data-testid="objective-text"]')?.textContent ?? '') + (document.querySelector('[data-testid="survivors-found"]')?.textContent ?? '') };
  });
  const trace: Awaited<ReturnType<typeof probe>>[] = [];
  // A ground click to the street in front of the entrance (the follow camera frames it), then the keys.
  const click = await page.evaluate(() => window.__SS__!.input.project({ x: 37.8, z: -41.5 }));
  await page.mouse.click(click.x, click.y);
  for (let i = 0; i < 80; i++) { await page.evaluate(() => window.__SS__!.step(6)); const p = (await probe()).p; if (Math.hypot(p.x - 37.8, p.z + 41.5) < .8) break; }
  // Up+Right on the isometric follow camera is due north: straight into the Metro shaft.
  await page.keyboard.down('w'); await page.keyboard.down('d');
  let enteredRing = 0, firstInside = 0, resets = 0, last = await probe();
  for (let i = 0; i < 600 && last.phase === 'playing'; i++) {
    await page.evaluate(() => window.__SS__!.step(3));
    const now = await probe(); trace.push(now);
    if (!enteredRing && now.inRing) enteredRing = now.tick;
    if (!firstInside && now.metroAt) { firstInside = now.tick; await page.screenshot({ path: `${output}/${quality}-1-inside.png` }); }
    if (last.metroAt && !now.metroAt) resets++;
    // The PO kept the keys held for a few seconds after reaching the stairs; then lets go and waits.
    if (firstInside && now.tick - firstInside === 240 || firstInside && now.tick - firstInside > 240 && now.tick - firstInside < 244) { await page.keyboard.up('w'); await page.keyboard.up('d'); await page.screenshot({ path: `${output}/${quality}-2-released.png` }); }
    if (now.shutterAt && !last.shutterAt) await page.screenshot({ path: `${output}/${quality}-3-shutter.png` });
    last = now;
  }
  await page.keyboard.up('w'); await page.keyboard.up('d');
  await page.screenshot({ path: `${output}/${quality}-4-end.png` });
  const report = { quality, enteredRing, firstInside, resets, doneAt: last.doneAt, ringToDoneS: enteredRing && last.doneAt ? (last.doneAt - enteredRing) / 60 : null, phase: last.phase, trace: trace.filter((_, i) => i % 5 === 0) };
  writeFileSync(`${output}/${quality}-report.json`, JSON.stringify(report, null, 1));
  console.log(JSON.stringify({ ...report, trace: undefined }));
  expect(enteredRing, 'the courier walks through the yellow ring').toBeGreaterThan(0);
  expect(resets, 'the courier is never walked back out of the station').toBe(0);
  expect(trace.some(t => /Wait for the survivors · \d\/5 in|Everyone is in/.test(t.hud)), 'the HUD says what the shutter waits for').toBe(true);
  expect(last.phase, 'the level completes').toBe('progression');
  expect(report.ringToDoneS!, 'completion follows the ring promptly').toBeLessThan(15);
});
