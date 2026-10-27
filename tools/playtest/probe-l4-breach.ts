import { launchBrowser } from '../browser-pool/client';
import { mkdirSync, writeFileSync } from 'node:fs';

/**
 * PO 10-23 ("L4 is still no action") capture probe: the west wall breach at the PO settings (WebGPU, low, zoom 1.5).
 * The courier stands inside the camp near the west wall; frames: the pile at the wire, the Alpha battering (cracked/sagging wall,
 * "Alpha at the west wall"), the open breach ("Hold the west breach", ring at the gap) and the flood 8 s later.
 *   E2E_UNITS=1 sh tools/e2e-lock.sh npx tsx tools/playtest/probe-l4-breach.ts http://127.0.0.1:4431 test-results/playtest/l4-breach [webgpu|webgl] [low|high]
 */
const [origin, out, backend = 'webgpu', quality = 'low'] = process.argv.slice(2);
if (!origin || !out) throw new Error('Usage: probe-l4-breach.ts <origin> <outDir> [webgpu|webgl] [low|high]');
mkdirSync(out, { recursive: true });
const browser = await launchBrowser({ headless: true, args: ['--enable-unsafe-webgpu', '--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=metal'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(`${origin}/?test=1&testApi=1&renderer=${backend}&dpr=1&audio=muted&quality=${quality}`);
  await page.waitForFunction(() => !!window.__SS__);
  await page.evaluate(async () => {
    const a = window.__SS__!; await a.ready;
    await a.loadLevel('L4', { seed: 3, checkpoint: 'turn', progression: 'L4-default' });
    a.pause(); a.cheats.god(true); a.teleport('player', { x: -29, z: 4 }); a.camera.follow(); a.camera.zoom(1.5);
  });
  type State = { l4?: { turnAt: number; alphaIds: number[]; breaches?: Record<string, { announcedAt: number; openAt: number }> } };
  const state = () => page.evaluate(() => {
    const s = window.__SS__!.missions.state() as unknown as State;
    const alpha = s.l4?.alphaIds[0] ? window.__SS__!.getEntity(s.l4.alphaIds[0]) : null;
    return { tick: window.__SS__!.tick(), turnAt: s.l4?.turnAt ?? 0, west: s.l4?.breaches?.west ?? null,
      alpha: alpha ? { id: alpha.id, health: alpha.health, infected: { recoverAt: alpha.infected?.recoverAt }, transform: alpha.transform } : null };
  });
  const visibility: { beat: string; native: number; missing: number[] }[] = [];
  const verifyDrawn = async (beat: string) => {
    const proof = await page.evaluate(() => {
      const a = window.__SS__!, p = a.getEntity(1)!.transform;
      const drawn = new Set(a.crowdFigures().filter(f => f.drawn).map(f => f.id));
      const native = a.query({ within: { x: p.x, z: p.z, r: 12 } }).filter(e => {
        if (!e.infected || e.health.current <= 0 || e.hidden || e.infected.hidden || e.appearance) return false;
        const v = a.camera.project(e.transform.x, e.transform.y + .5, e.transform.z);
        return Math.abs(v[0]) < .9 && Math.abs(v[1]) < .9 && v[2] > -1 && v[2] < 1;
      });
      return { native: native.length, missing: native.filter(e => !drawn.has(e.id)).map(e => e.id) };
    });
    visibility.push({ beat, ...proof });
    writeFileSync(`${out}/visibility.json`, JSON.stringify(visibility, null, 2));
    if (proof.missing.length) throw new Error(`Invisible living infected at ${beat}: ${proof.missing.join(', ')}`);
  };
  const shot = async (name: string) => { await page.evaluate(async () => { const a = window.__SS__!; a.camera.follow(); a.camera.zoom(1.5); await a.screenshotReady(); }); await page.screenshot({ path: `${out}/${name}.png` }); console.log('shot', name, JSON.stringify(await state())); };
  let courier = { x: -29, z: 4 };
  const until = async (done: (s: Awaited<ReturnType<typeof state>>) => boolean, max: number) => { for (let i = 0; i < max; i += 30) { const s = await state(); if (done(s)) return; await page.evaluate(async courier => { const a = window.__SS__!; a.teleport('player', courier); await a.step(30); }, courier); } throw new Error('Capture beat did not occur within its deadline'); };
  await until(s => s.tick - s.turnAt > 25 * 60, 40 * 60); await shot('1-pile-at-the-wire');
  await until(s => !!s.west?.announcedAt && s.tick - s.west.announcedAt > 7 * 60, 40 * 60); await shot('2-alpha-battering');
  await until(s => !!s.west?.openAt, 40 * 60); await page.evaluate(() => window.__SS__!.step(40)); await shot('3-breach-open');
  await until(s => !!s.alpha && s.alpha.health.current <= 0, 30 * 60); await shot('4-soldier-approaches-downed-alpha');
  await until(s => !!s.alpha && s.alpha.health.current <= 0 && (s.alpha.infected?.recoverAt ?? 0) < 0, 45 * 60); await shot('5-soldier-finishes-alpha');
  await until(s => !!s.west?.openAt && s.tick - s.west.openAt > 8 * 60, 20 * 60); await shot('6-flood');
  // Matched before/after views use the timing probe's courier position.
  courier = { x: -22.85, z: .7 };
  await page.evaluate(async courier => { const a = window.__SS__!; await a.loadLevel('L4', { seed: 3, checkpoint: 'turn', progression: 'L4-default' }); a.pause(); a.cheats.god(true); a.teleport('player', courier); a.camera.follow(); a.camera.zoom(1.5); }, courier);
  await until(s => s.tick - s.turnAt >= 90 * 60, 100 * 60); await shot('after-90s'); await verifyDrawn('after-90s');
  await until(s => s.tick - s.turnAt >= 150 * 60, 70 * 60); await shot('after-150s'); await verifyDrawn('after-150s');
  if (!visibility.some(p => p.native > 0)) throw new Error('No nearby native infected sampled for visibility proof');
} finally { await browser.close(); }
