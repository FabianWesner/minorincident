import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';

/**
 * PO 10-23 ("L4 is still no action") capture probe: the west wall breach at the PO settings (WebGPU, low, zoom 1.5).
 * The courier stands inside the camp near the west wall; frames: the pile at the wire, the Alpha battering (cracked/sagging wall,
 * "Alpha at the west wall"), the open breach ("Hold the west breach", ring at the gap) and the flood 8 s later.
 *   E2E_UNITS=1 sh tools/e2e-lock.sh npx tsx tools/playtest/probe-l4-breach.ts http://127.0.0.1:4431 test-results/playtest/l4-breach [webgpu|webgl] [low|high]
 */
const [origin, out, backend = 'webgpu', quality = 'low'] = process.argv.slice(2);
if (!origin || !out) throw new Error('Usage: probe-l4-breach.ts <origin> <outDir> [webgpu|webgl] [low|high]');
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-webgpu', '--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=metal'] });
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
  const shot = async (name: string) => { await page.evaluate(async () => { const a = window.__SS__!; a.camera.follow(); a.camera.zoom(1.5); await a.screenshotReady(); }); await page.screenshot({ path: `${out}/${name}.png` }); console.log('shot', name, JSON.stringify(await state())); };
  const until = async (done: (s: Awaited<ReturnType<typeof state>>) => boolean, max: number) => { for (let i = 0; i < max; i += 30) { const s = await state(); if (done(s)) return; await page.evaluate(async () => { const a = window.__SS__!; a.teleport('player', { x: -29, z: 4 }); await a.step(30); }); } throw new Error('Capture beat did not occur within its deadline'); };
  await until(s => s.tick - s.turnAt > 25 * 60, 40 * 60); await shot('1-pile-at-the-wire');
  await until(s => !!s.west?.announcedAt && s.tick - s.west.announcedAt > 7 * 60, 40 * 60); await shot('2-alpha-battering');
  await until(s => !!s.west?.openAt, 40 * 60); await page.evaluate(() => window.__SS__!.step(40)); await shot('3-breach-open');
  await until(s => !!s.alpha && s.alpha.health.current <= 0, 30 * 60); await shot('4-soldier-approaches-downed-alpha');
  await until(s => !!s.alpha && s.alpha.health.current <= 0 && (s.alpha.infected?.recoverAt ?? 0) < 0, 15 * 60); await shot('5-soldier-finishes-alpha');
  await until(s => !!s.west?.openAt && s.tick - s.west.openAt > 8 * 60, 20 * 60); await shot('6-flood');
} finally { await browser.close(); }
