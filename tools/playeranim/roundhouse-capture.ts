import { mkdirSync, writeFileSync } from 'node:fs';
import { clipAround, encodeWebm, openL1, prepareView } from './shared';

/** Bat roundhouse evidence (00 §6.2): the real L1 renderer at the game camera, the skinned courier surrounded by 5
 * infected on a sidewalk, real released Shift+LMB clicks at 8 Hz. Writes a <= 10 s WebM and 3 stills (coil, mid-spin,
 * follow-through). Run after `npm run build`, through tools/e2e-lock.sh, on a dedicated preview port (E2E_PORT). */
const out = process.argv[2] ?? 'test-results/bat-roundhouse';
mkdirSync(out, { recursive: true });
const { page, guard, close } = await openL1('1', { x: -45, z: -2.2 }, undefined, [['weapon.bat'], ['weapon.fists']]);
try {
  const ring = () => page.evaluate(() => {
    const a = window.__SS__!, p = a.getState().player!.transform;
    for (let i = 0; i < 5; i++) {
      const angle = i * Math.PI * 2 / 5 + .3, r = 1.45 + (i % 2) * .25, x = p.x + Math.cos(angle) * r, z = p.z + Math.sin(angle) * r;
      a.spawn('infected.runner', { x, z }, { state: 'chase', yaw: -Math.atan2(p.z - z, p.x - x) });
    }
  });
  await ring();
  // Real game camera (follow), zoomed to the close end the wheel allows.
  await prepareView(page, 20);
  const frames: Buffer[] = [], stills: { tick: number; name: string }[] = [];
  let sweeps = 0, still = 0;
  for (let tick = 0; tick < 540; tick++) {
    if (tick === 270) { await page.evaluate(() => window.__SS__!.cheats.killAll()); await ring(); }
    if (tick % 8 === 0) {
      const p = await page.evaluate(() => { const a = window.__SS__!, p = a.getState().player!.transform, e = a.query({ kind: 'infected', within: { x: p.x, z: p.z, r: 3 } }).filter(e => e.health.current > 0)[0]?.transform ?? { x: p.x + 1, z: p.z }; return a.input.project({ x: e.x, z: e.z }); });
      await page.keyboard.down('Shift'); await page.mouse.click(p.x, p.y); await page.keyboard.up('Shift');
    }
    const s = await page.evaluate(async () => {
      const a = window.__SS__!; a.vfx.stepRender(1 / 60); await a.step(1);
      const s = a.getState(), attack = s.player!.survivor?.attack;
      return { tick: s.tick, point: a.input.project(s.player!.transform), attack: attack ?? null };
    });
    const clip = clipAround(s.point, 960, 720, 400);
    if (s.attack?.style === 'roundhouse') {
      const u = s.tick - s.attack.started, a = s.attack.activeAt - s.attack.started, r = s.attack.recoveryAt - s.attack.started;
      if (u === 1) sweeps++;
      // First roundhouse: coil, mid-spin, follow-through.
      for (const [name, at] of [['1-coil', a - 1], ['2-spin', a + Math.round((r - a) * .55)], ['3-follow-through', r + 2]] as const) {
        if (sweeps === 1 && u === at && still < 3) { await page.screenshot({ path: `${out}/${name}.png`, clip }); stills.push({ tick: s.tick, name }); still++; }
      }
    }
    if (tick % 3 === 0) frames.push(await page.screenshot({ type: 'jpeg', quality: 82, clip }));
  }
  encodeWebm(frames, `${out}/bat-roundhouse.webm`, { bitrate: '700k', crf: 20 });
  const events = await page.evaluate(() => window.__SS__!.events().filter(e => e.type === 'combat.attack' || (e.type === 'combat.hit' && e.sourceId === 1)).map(e => ({ type: e.type, tick: e.tick, ...('style' in e ? { style: e.style } : {}), ...(e.type === 'combat.hit' ? { targetId: e.targetId, amount: e.amount } : {}) })));
  writeFileSync(`${out}/capture.json`, JSON.stringify({ frames: frames.length, seconds: frames.length / 20, stills, sweeps: events.filter(e => e.type === 'combat.attack' && 'style' in e).length, errors: guard.errors, events }, null, 1));
  console.log('frames', frames.length, 'sweeps', events.filter(e => e.type === 'combat.attack' && 'style' in e).length, 'stills', stills.map(s => s.name).join(','));
  if (guard.errors.length) throw new Error(guard.errors.join('\n'));
} finally { guard.dispose(); await close(); }
