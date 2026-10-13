import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { attachErrorGuard } from '../../tests/e2e/fixtures';

/** Fresh-build L4 arrival evidence. Run through tools/e2e-lock.sh against an isolated preview server.
 * Only the courier is repositioned to observe the refuge; civilians and infected keep their natural positions and AI.
 * Example: L4_CAPTURE_ORIGIN=http://127.0.0.1:3419 sh tools/e2e-lock.sh npx tsx tools/l4/arrival-capture.ts webgl low
 */
const renderer = process.argv[2] === 'webgpu' ? 'webgpu' : 'webgl';
const quality: 'high' | 'low' = process.argv[3] === 'high' ? 'high' : 'low';
const output = 'docs/reports/l4-civilians-stay/finish';
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu', ...(renderer === 'webgpu' ? ['--enable-unsafe-webgpu'] : [])] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const guard = attachErrorGuard(page);
try {
  await page.goto(`${process.env.L4_CAPTURE_ORIGIN ?? 'http://127.0.0.1:3419'}/?test=1&renderer=${renderer}&quality=${quality}&audio=muted&ui=1&dpr=1`);
  await page.waitForFunction(() => !!window.__SS__);
  await page.evaluate<void, 'high' | 'low'>(async q => {
    const a = window.__SS__!; await a.ready; a.pause(); a.settings.set({ quality: q });
    await a.loadLevel('L4', { seed: 2, progression: 'L4-default' }); a.pause();
  }, quality);
  await page.getByRole('button', { name: 'Begin mission' }).click();
  await page.evaluate(async () => {
    const a = window.__SS__!; a.pause(); a.cheats.god(true); a.cheats.completeObjective('ride'); await a.step(700);
    a.teleport(1, { x: -21.5, z: 3 }); a.cheats.completeObjective('quartermaster');
  });
  for (let i = 0; i < 12; i++) { await page.mouse.wheel(0, 120); await page.evaluate(() => window.__SS__!.step(2)); }
  await page.evaluate(async () => {
    const a = window.__SS__!;
    while (!a.missions.state()!.l4!.turnAt) await a.step(3);
    await a.step(18 * 60);
    // Standard follow rig, maximum ordinary player zoom: the refuge and northern incoming street share the frame.
    a.teleport(1, { x: -37, z: -8 }); a.camera.follow(); await a.step(30);
    document.body.classList.add('ui-hidden'); await a.screenshotReady();
  });
  const proof = await page.evaluate(() => {
    const a = window.__SS__!, s = a.missions.state()!.l4!;
    const actors = a.getState().entities.filter(e => !e.hidden && e.health.current > 0 && (e.kind === 'infected' || e.civilian && !e.civilian.pet && !s.soldierIds.includes(e.id)))
      .map(e => ({ id: e.id, kind: e.kind, state: e.civilian?.state ?? e.infected?.state, position: e.transform, health: e.health.current, origin: s.origin[e.id], projection: a.camera.project(e.transform.x, e.transform.y, e.transform.z) }))
      .filter(e => e.projection.every(v => Math.abs(v) < 1));
    return { backend: a.perf().backend, quality: a.perf().quality.tier, alarmSeconds: (a.tick() - s.turnAt) / 60, camera: a.getState().render.camera, player: a.getState().player!.transform, actors };
  });
  if (proof.backend !== renderer || proof.quality !== quality || proof.alarmSeconds < 15 || proof.alarmSeconds > 20) throw new Error(`Invalid capture: ${JSON.stringify(proof)}`);
  if (!proof.actors.some(e => e.kind === 'infected') || !proof.actors.some(e => e.kind === 'civilian' && e.state === 'flee')) throw new Error('The capture must include living infected and a fleeing human');
  await page.screenshot({ path: `${output}/${renderer}-${quality}-arrival-18s.png` });
  guard.dispose();
  writeFileSync(`${output}/${renderer}-${quality}-arrival-18s.json`, JSON.stringify({ ...proof, errors: guard.errors }, null, 2) + '\n');
  if (guard.errors.length) throw new Error(guard.errors.join('\n'));
  console.log(JSON.stringify({ backend: proof.backend, quality: proof.quality, alarmSeconds: proof.alarmSeconds, infected: proof.actors.filter(e => e.kind === 'infected').length, fleeing: proof.actors.filter(e => e.kind === 'civilian' && e.state === 'flee').length }));
} finally { await browser.close(); }
