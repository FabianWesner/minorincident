import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const out = resolve('docs/reports/r12-l8/captures');
mkdirSync(out, { recursive: true });
const probe = createServer();
await new Promise<void>((ready, reject) => { probe.once('error', reject); probe.listen(0, '127.0.0.1', ready); });
const address = probe.address(); assert(address && typeof address !== 'string');
const port = address.port;
await new Promise<void>(ready => probe.close(() => ready()));
const server = spawn(process.execPath, [resolve('node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort', '--configLoader', 'runner'], { stdio: 'ignore' });
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
const manifest: Record<string, unknown>[] = [];
try {
  const origin = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let i = 0; i < 200; i++) {
    try { if ((await fetch(origin)).ok) { ready = true; break; } } catch { /* owned preview is starting */ }
    await new Promise(resolveDelay => setTimeout(resolveDelay, 100));
  }
  assert(ready, 'QA preview did not start');
  browser = await chromium.launch({ headless: true, args: process.platform === 'darwin' ? ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  await page.addInitScript(() => localStorage.clear());
  for (const quality of ['low', 'high'] as const) for (const progressed of [false, true]) for (const zoom of [1, 1.5]) {
    await page.goto(`${origin}/?test=1&renderer=webgl&dpr=1&quality=${quality}&audio=muted&ui=1`);
    await page.waitForFunction(() => Boolean(window.__SS__));
    await page.evaluate(async ({ progressed, quality, zoom }) => {
      const game = window.__SS__!; await game.ready;
      await game.loadLevel('L8', { seed: 1, ...(progressed ? { progression: 'L8-default' as const } : {}) });
      game.settings.set({ quality }); if (progressed) game.campaign.save();
      game.camera.follow(); game.camera.zoom(zoom);
    }, { progressed, quality, zoom });
    await page.getByTestId('mission-button').click({ timeout: 120_000 });
    await page.waitForFunction(() => window.__SS__!.missions.state()?.steps.sanctuary.status === 'active');
    const before = await page.evaluate(() => window.__SS__!.getEntity(1)!.transform);
    await page.keyboard.down('KeyW'); await page.waitForTimeout(500); await page.keyboard.up('KeyW');
    await page.waitForTimeout(200);
    await page.evaluate(() => window.__SS__!.pause());
    const state = await page.evaluate(() => {
      const game = window.__SS__!, mission = game.missions.state()!;
      return { tick: game.tick(), objective: document.querySelector('[data-testid=objective-text]')?.textContent?.trim() ?? '', marker: mission.marker, active: Object.entries(mission.steps).filter(([, step]) => step.status === 'active').map(([id]) => id), player: game.getEntity(1)?.transform, campaign: !!game.campaign.state() };
    });
    const name = `${progressed ? 'progressed' : 'fresh'}-${quality}-zoom-${String(zoom).replace('.', '-')}.png`;
    assert(state.objective.includes('zoo gate'), `${quality}/${progressed ? 'progressed' : 'fresh'}/${zoom}: missing gate objective: ${state.objective}`);
    assert.equal(state.marker, 'zoo-gate'); assert(state.active.includes('sanctuary'));
    assert.equal(state.campaign, progressed, `${name}: save provenance should match the requested start`);
    const moved = Math.hypot(state.player!.x - before.x, state.player!.z - before.z);
    assert(state.tick > 0 && state.tick < 120 && moved > 0.1, `${name}: physical opening input should move the courier briefly (tick ${state.tick}, ${moved.toFixed(2)} m)`);
    const path = `${out}/${name}`;
    await page.screenshot({ path, fullPage: false });
    manifest.push({ file: path, quality, progressed, zoom, movedMetres: moved, ...state });
  }
  writeFileSync(`${out}/manifest.json`, JSON.stringify({ backend: 'webgl2', input: 'physical WASD W key for 500 ms', captures: manifest }, null, 2));
  console.log(JSON.stringify({ captures: manifest.length, directory: out }));
} finally {
  await browser?.close(); server.kill('SIGTERM');
}
