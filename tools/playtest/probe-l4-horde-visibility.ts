import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

// Audit real authored births on either PROD or the lane, without changing their look or renderer.
const [origin, out] = process.argv.slice(2);
if (!origin || !out) throw new Error('Usage: probe-l4-horde-visibility.ts <origin> <out>');
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-webgpu', '--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=metal'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  await page.goto(`${origin}/?test=1&renderer=webgpu&quality=low&dpr=1&audio=muted&seed=3&preload=0`);
  await page.waitForFunction(() => !!window.__SS__);
  const initial = await page.evaluate(async () => {
    const a = window.__SS__!; await a.ready;
    await a.loadLevel('L4', { seed: 3, checkpoint: 'turn', progression: 'L4-default' });
    a.pause(); a.cheats.god(true); a.teleport('player', { x: -22.85, z: .7 }); a.camera.follow(); a.camera.zoom(1.5);
    return a.query({}).map(e => e.id);
  });
  const samples = [];
  for (const seconds of [60, 90, 120, 150, 180]) {
    await page.evaluate(async seconds => {
      const a = window.__SS__!, target = a.missions.state()!.l4!.turnAt + seconds * 60;
      while (a.tick() < target) await a.step(Math.min(60, target - a.tick()));
      await a.screenshotReady();
    }, seconds);
    const sample = await page.evaluate(initial => {
      const a = window.__SS__!, drawn = new Set(a.crowdFigures().filter(f => f.drawn).map(f => f.id));
      const born = a.query({}).filter(e => {
        if (initial.includes(e.id) || !e.infected || e.health.current <= 0 || e.hidden || e.infected.hidden) return false;
        const p = a.camera.project(e.transform.x, e.transform.y + .6, e.transform.z);
        return Math.abs(p[0]) < .9 && Math.abs(p[1]) < .9 && p[2] > -1 && p[2] < 1;
      });
      return { tick: a.tick(), born: born.map(e => ({ id: e.id, asset: e.appearance?.asset, drawn: drawn.has(e.id), archetype: e.archetype })) };
    }, initial);
    samples.push({ seconds, ...sample });
    await page.screenshot({ path: `${out}/${seconds}s.png` });
    console.log(JSON.stringify(samples.at(-1)));
  }
  const metadata = await page.evaluate(() => ({ scripts: [...document.scripts].map(s => s.src).filter(Boolean), text: document.body.innerText, backend: window.__SS__!.perf().backend }));
  writeFileSync(`${out}/visibility.json`, JSON.stringify({ origin, metadata, samples }, null, 2));
  if (!samples.some(s => s.born.length)) throw new Error('No on-screen authored births sampled');
  if (samples.some(s => s.born.some(e => !e.drawn))) throw new Error('A living on-screen born infected has no rendered figure');
} finally { await browser.close(); }
