import { mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { launchBrowser } from '../browser-pool/client';
import { loadFixtureInPage } from './load-fixture';
import { readFixture } from './fixture-io';

type BrowserWorld = {
  tick: number; scenario: string;
  entities: { get(id: number): { hidden?: boolean; passengerOf?: number; survivor?: { scriptedClip?: string; animation?: string }; transform: { x: number; y: number; z: number }; health: { current: number } } | undefined };
  vehicles: { active: number | null; exit(): boolean };
  missions?: { l9?: { driving?: { state: { stallAt: number | null; restarted: boolean; hatchOpen: boolean }; poseHatch(): void } } };
  player?: { damage(amount: number, tick: number, ignoreInvulnerability?: boolean): void };
};
const port = Number(process.env.E2E_PORT ?? 4917);
if (port < 4900 || port > 4999) throw new Error('E2E_PORT must be a unique 49xx port');
const origin = `http://127.0.0.1:${port}`;
const out = resolve('test-results/s84-l9hatchstuck/pose-exits');
await mkdir(out, { recursive: true });
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort', '--configLoader', 'runner'], { stdio: 'ignore' });
const browser = await launchBrowser({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
try {
  for (let i = 0; i < 120; i++) { try { if ((await fetch(origin)).ok) break; } catch { /* vite startup */ } await new Promise(done => setTimeout(done, 250)); }
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${origin}/?test=1&testApi=1&scenelab=1&renderer=webgl&dpr=1&audio=muted&quality=high`);
  await page.waitForFunction(() => !!window.__SS__, null, { timeout: 120_000 });
  await page.evaluate(async () => { await window.__SS__!.ready; await window.__SS__!.loadScenario('drive-course'); window.__SS__!.pause(); await window.__SS__!.step(40); window.__SS__!.camera.follow(); window.__SS__!.camera.zoom(1.5); });
  const shoot = async (name: string) => {
    await page.evaluate(async () => { window.__SS__!.camera.follow(); window.__SS__!.camera.zoom(1.5); await window.__SS__!.step(90); await window.__SS__!.screenshotReady(); });
    await page.screenshot({ path: `${out}/${name}.png` });
    const detail = await page.evaluate(() => {
      const a = window.__SS__!, w = (window as unknown as { __SCENE__: { game: { world: BrowserWorld } } }).__SCENE__.game.world;
      const player = w.entities.get(1)!;
      const render = a.getState().render as { quality: string; camera: { zoom: number; targetZoom: number } };
      return { level: w.scenario, tick: w.tick, player: { ...player.transform, hidden: !!player.hidden, passengerOf: player.passengerOf ?? null, scriptedClip: player.survivor?.scriptedClip ?? null, animation: player.survivor?.animation }, activeVehicle: w.vehicles?.active ?? null, quality: render.quality, cameraZoom: render.camera.zoom, targetZoom: render.camera.targetZoom };
    });
    console.log(JSON.stringify({ capture: `${name}.png`, ...detail }));
  };

  // Actual ordinary vehicle exit path; drive-course is the same Vehicles controller exercised in unit coverage.
  const directExit = await page.evaluate(() => {
    const w = (window as unknown as { __SCENE__: { game: { world: BrowserWorld } } }).__SCENE__.game.world;
    w.entities.get(1)!.survivor!.scriptedClip = 'crawl';
    return { active: w.vehicles.active, exited: w.vehicles.exit(), scriptedClip: w.entities.get(1)!.survivor!.scriptedClip ?? null };
  });
  if (!directExit.exited || directExit.scriptedClip !== null) throw new Error(`vehicle exit did not clear the scripted pose: ${JSON.stringify(directExit)}`);
  await shoot('01-vehicle-exit-high-z1.5');

  const fixture = readFixture('tests/fixtures/saves/qa/l9-before-rail-stall.json.gz');
  await loadFixtureInPage(page, fixture);
  const retry = await page.evaluate(async () => {
    const a = window.__SS__!, w = (window as unknown as { __SCENE__: { game: { world: BrowserWorld } } }).__SCENE__.game.world;
    a.camera.follow(); a.camera.zoom(1.5);
    w.entities.get(1)!.survivor!.scriptedClip = 'crawl';
    let restored = false; w.player!.damage(1000, w.tick, true);
    for (let i = 0; i < 600; i++) { await a.step(1); if (w.entities.get(1)!.health.current > 0) { restored = true; break; } }
    const restoredPlayer = w.entities.get(1)!;
    const hatch = w.missions?.l9?.driving;
    if (hatch) { hatch.state.stallAt = w.tick; hatch.state.restarted = false; hatch.state.hatchOpen = true; hatch.poseHatch(); }
    return { restored, active: w.vehicles.active, passengerOf: restoredPlayer.passengerOf ?? null, hidden: !!restoredPlayer.hidden, scriptedClip: restoredPlayer.survivor!.scriptedClip ?? null };
  });
  if (!retry.restored || retry.scriptedClip !== null || retry.active === null || retry.passengerOf !== retry.active || retry.hidden) throw new Error(`checkpoint restore left hatch and driver state split: ${JSON.stringify(retry)}`);
  await shoot('02-checkpoint-restore-high-z1.5');

  // A completed L9 handover starts L10 on foot; capture the authored new-level locomotion pose.
  await page.evaluate(async () => { const a = window.__SS__!; await a.loadLevel('L10', { seed: 1, progression: 'L10-default' }); a.pause(); a.camera.follow(); a.camera.zoom(1.5); });
  const handover = await page.evaluate(() => {
    const w = (window as unknown as { __SCENE__: { game: { world: BrowserWorld } } }).__SCENE__.game.world;
    const player = w.entities.get(1)!;
    return { hidden: !!player.hidden, passengerOf: player.passengerOf ?? null, scriptedClip: player.survivor?.scriptedClip ?? null, animation: player.survivor?.animation };
  });
  if (handover.hidden || handover.passengerOf !== null || handover.scriptedClip !== null) throw new Error(`L10 starts outside plain on-foot locomotion: ${JSON.stringify(handover)}`);
  await shoot('03-l9-to-l10-handover-high-z1.5');
  if (errors.length) throw new Error(`page errors: ${errors.join('; ')}`);
} finally { await browser.close(); server.kill('SIGTERM'); }
