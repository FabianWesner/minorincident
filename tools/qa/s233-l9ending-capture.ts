import { launchBrowser } from '../browser-pool/client';
import { mkdirSync, writeFileSync } from 'node:fs';
import type { Game } from '../../src/Game';

/** Native high/low zoom-1 frame sequence for the scripted L9 ending. Run under e2e-lock. */
const [origin, tier, out] = process.argv.slice(2);
if (!origin || !['high', 'low'].includes(tier) || !out) throw new Error('usage: s233-l9ending-capture.ts <origin> <high|low> <outDir>');
mkdirSync(out, { recursive: true });
const browser = await launchBrowser({ headless: true, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const errors: string[] = [];
page.on('pageerror', error => errors.push(error.message));
const phase = () => page.evaluate(() => (window.__SCENE__ as unknown as { game: Game }).game.world.missions!.l9!.state.phase);
const step = async (ticks: number) => page.evaluate(async n => { const a = window.__SS__!; await a.step(n); a.vfx.stepRender(n / 60); await a.screenshotReady(); }, ticks);
const capture = async (name: string) => {
  const info = await page.evaluate(() => {
    const g = (window.__SCENE__ as unknown as { game: Game }).game, view = g.view.view;
    view.zoom(Math.log(1 / view.getState().targetZoom), true);
    return { tick: g.world.tick, phase: g.world.missions!.l9!.state.phase, missionPhase: g.world.missions!.state.phase,
      player: { ...g.world.entities.get(1)!.transform }, mega: g.world.entities.get(g.world.missions!.l9!.driving.state.megaId)?.transform,
      megaHidden: g.world.entities.get(g.world.missions!.l9!.driving.state.megaId)?.hidden,
      megaInfectedHidden: g.world.entities.get(g.world.missions!.l9!.driving.state.megaId)?.infected?.hidden,
      megaNdc: g.world.entities.get(g.world.missions!.l9!.driving.state.megaId)?.transform
        ? window.__SS__!.camera.project(g.world.entities.get(g.world.missions!.l9!.driving.state.megaId)!.transform.x,
          g.world.entities.get(g.world.missions!.l9!.driving.state.megaId)!.transform.y,
          g.world.entities.get(g.world.missions!.l9!.driving.state.megaId)!.transform.z) : null,
      zoom: view.getState().targetZoom };
  });
  if (Math.abs(info.zoom - 1) > .001) throw new Error(`${name}: zoom is ${info.zoom}, expected 1`);
  await page.screenshot({ path: `${out}/${name}.png`, animations: 'disabled' });
  writeFileSync(`${out}/${name}.json`, JSON.stringify(info, null, 2));
  return info;
};
try {
  await page.goto(`${origin}/?test=1&scenelab=1&renderer=webgl&quality=${tier}&audio=muted&dpr=1`);
  await page.waitForFunction(() => !!window.__SS__ && !!window.__SCENE__);
  await page.evaluate(async q => {
    const a = window.__SS__!; await a.ready; a.pause(); a.settings.set({ quality: q });
    await a.loadLevel('L9', { seed: 31 }); a.pause();
  }, tier as 'high' | 'low');
  const begin = page.getByRole('button', { name: 'Begin mission' });
  if (await begin.isVisible().catch(() => false)) { await begin.click(); await page.evaluate(() => window.__SS__!.pause()); }
  await page.evaluate(() => { const a = window.__SS__!; a.pause(); a.bot.start('complete'); a.resume(); });
  await page.waitForFunction(() => (window.__SCENE__ as unknown as { game: Game }).game.world.missions!.l9!.state.phase === 'impact', null, { timeout: 540000 });
  await page.evaluate(() => window.__SS__!.pause());
  if (await phase() !== 'impact') throw new Error(`Crash did not reach impact: ${await phase()}`);
  await capture('01-impact');
  const waitFor = async (wanted: string) => {
    for (let i = 0; i < 300 && await phase() !== wanted; i++) await step(1);
    if (await phase() !== wanted) throw new Error(`Expected ${wanted}, got ${await phase()}`);
  };
  await waitFor('dazed'); await step(60); const dazed = await capture('02-dazed');
  await waitFor('rise'); await step(30); await capture('03-rise');
  await waitFor('mega-exit'); await step(45); const exit = await capture('04-mega-exit');
  await waitFor('mega-roar'); await step(45); await capture('05-mega-roar');
  await waitFor('mega-leap'); await step(45); await capture('06-mega-leap');
  await step(45); const departure = await capture('07-mega-left-frame');
  await waitFor('done'); await step(1); const result = await capture('08-result');
  const perf = await page.evaluate(() => window.__SS__!.perf());
  const meta = { tier, backend: perf.backend, quality: perf.quality.tier, errors, dazed, exit, departure, result };
  writeFileSync(`${out}/meta.json`, JSON.stringify(meta, null, 2));
  if (perf.backend !== 'webgl' || perf.quality.tier !== tier || errors.length) throw new Error(`Invalid capture setup/errors: ${JSON.stringify(meta)}`);
  console.log(JSON.stringify({ tier, backend: perf.backend, quality: perf.quality.tier, frames: 8, errors: errors.length }));
} finally { await browser.close(); }
