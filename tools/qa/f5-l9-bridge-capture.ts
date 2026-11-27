import { launchBrowser } from '../browser-pool/client';
import { mkdirSync, writeFileSync } from 'node:fs';
import type { Game } from '../../src/Game';

const [origin, tier, out] = process.argv.slice(2);
if (!origin || !['high', 'low'].includes(tier) || !out) throw new Error('usage: f5-l9-bridge-capture.ts <origin> <high|low> <outDir>');
mkdirSync(out, { recursive: true });
const browser = await launchBrowser({ headless: true, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const errors: string[] = [];
page.on('pageerror', error => errors.push(error.message));
const state = () => page.evaluate(() => {
  const g = (window.__SCENE__ as unknown as { game: Game }).game, l9 = g.world.missions!.l9!, mega = g.world.entities.get(l9.driving.state.megaId)!;
  return { tick: g.world.tick, phase: l9.state.phase, megaLandedAt: l9.state.megaLandedAt,
    apc: { ...g.world.entities.get(l9.state.carId)!.transform }, mega: { ...mega.transform }, hidden: mega.hidden || mega.infected?.hidden };
});
const capture = async (name: string) => {
  const meta = await state();
  await page.screenshot({ path: `${out}/${name}.png`, animations: 'disabled' });
  writeFileSync(`${out}/${name}.json`, JSON.stringify(meta, null, 2));
  return meta;
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
  await page.waitForFunction(() => {
    const g = (window.__SCENE__ as unknown as { game: Game }).game;
    return g.world.missions!.l9!.state.megaLandedAt !== undefined;
  }, null, { timeout: 540000 });
  await page.evaluate(() => window.__SS__!.pause());
  const landing = await capture('01-mega-boards');
  await page.evaluate(() => window.__SS__!.resume());
  await page.waitForFunction(() => (window.__SCENE__ as unknown as { game: Game }).game.world.missions!.l9!.state.phase === 'fall', null, { timeout: 120000 });
  await page.evaluate(() => window.__SS__!.pause());
  const collapse = await capture('02-bridge-collapse');
  await page.evaluate(() => window.__SS__!.resume());
  await page.waitForFunction(tick => (window.__SCENE__ as unknown as { game: Game }).game.world.tick >= tick + 60, collapse.tick, { timeout: 120000 });
  await page.evaluate(() => window.__SS__!.pause());
  await capture('03-collapse-progress');
  writeFileSync(`${out}/meta.json`, JSON.stringify({ tier, landing, collapse, errors }, null, 2));
  if (landing.hidden || collapse.hidden || landing.tick >= collapse.tick || errors.length) throw new Error(`Invalid bridge evidence: ${JSON.stringify({ landing, collapse, errors })}`);
  console.log(JSON.stringify({ tier, landingTick: landing.tick, collapseTick: collapse.tick, visible: true, errors: errors.length }));
} finally { await browser.close(); }
