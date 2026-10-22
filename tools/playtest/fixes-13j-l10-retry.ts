import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { cure } from '../../src/levels/L10/district';
import type { Game } from '../../src/Game';

/**
 * Q-120/Q-121 real-input regression probe. Run against the production preview under e2e-lock:
 *   tsx tools/playtest/fixes-13j-l10-retry.ts http://127.0.0.1:4181 test-results/playtest/fixes-13j-l10
 * The console interactions and post-respawn movement use physical keyboard input.
 * Setup advances the charge under god mode; live enemies cause the boss-step death on the real clock.
 */
const [origin, out] = process.argv.slice(2);
if (!origin || !out) throw new Error('Usage: fixes-13j-l10-retry.ts <origin> <outDir>');
mkdirSync(out, { recursive: true });
const args = process.platform === 'darwin'
  ? ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist']
  : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const browser = await chromium.launch({ headless: true, args });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(`${origin}/?testApi=1&scenelab=1&renderer=webgl&dpr=1&audio=muted&quality=low`);
  await page.waitForFunction(() => !!window.__SS__);
  await page.evaluate(async () => {
    const a = window.__SS__!;
    await a.ready;
    await a.loadLevel('L10', { seed: 327, checkpoint: 'cure-complex', progression: 'L10-default' });
    a.pause(); a.cheats.god(true); a.camera.follow();
  });
  const [ix, iz] = cure.anchors['cure-install'];
  const [cx, cz] = cure.anchors['cure-console'];
  await page.evaluate(({ x, z }) => window.__SS__!.teleport('player', { x, z }), { x: ix, z: iz });
  await page.keyboard.down('e'); await page.evaluate(() => window.__SS__!.step(1)); await page.keyboard.up('e');
  await page.evaluate(({ x, z }) => window.__SS__!.teleport('player', { x, z }), { x: cx, z: cz });
  await page.keyboard.down('e'); await page.evaluate(() => window.__SS__!.step(1)); await page.keyboard.up('e');
  await page.evaluate(() => window.__SS__!.step(3600));
  const before = await page.evaluate(() => {
    const a = window.__SS__!, m = a.missions.state()!, boss = a.query({ kind: 'infected' }).find(e => e.infected?.pursuit)!;
    return { tick: a.tick(), checkpoint: m.checkpoint, charge: m.counters['charge-ticks'], ready: m.states['charge-ready'], hp: boss.health.current, maxHp: boss.health.max, bar: a.getState().render.healthBars?.bars.find(b => b.id === boss.id)?.fraction ?? null };
  });
  if (before.checkpoint !== 'cure-disperse-ready' || before.charge !== 3600 || !before.ready) throw new Error(`Charge did not reach the retry point: ${JSON.stringify(before)}`);

  await page.evaluate(() => {
    const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game;
    const evidence = window as unknown as { __retryDeath?: number; __retryRespawn?: number };
    g.world.events.on('player.died', () => { evidence.__retryDeath = a.tick(); });
    g.world.events.on('player.respawned', () => { evidence.__retryRespawn = a.tick(); a.pause(); }, 6);
    a.cheats.god(false); a.resume();
  });
  await page.waitForFunction(() => (window as unknown as { __retryRespawn?: number }).__retryRespawn !== undefined, null, { timeout: 120_000 });
  const after = await page.evaluate(() => {
    const a = window.__SS__!, m = a.missions.state()!, boss = a.query({ kind: 'infected' }).find(e => e.infected?.pursuit)!;
    const evidence = window as unknown as { __retryDeath?: number; __retryRespawn?: number };
    return { tick: a.tick(), diedAt: evidence.__retryDeath, respawnedAt: evidence.__retryRespawn, checkpoint: m.checkpoint, charge: m.counters['charge-ticks'], ready: m.states['charge-ready'], hp: boss.health.current, maxHp: boss.health.max, player: a.getState().player!.transform };
  });
  await page.keyboard.down('w'); await page.evaluate(() => window.__SS__!.resume()); await page.waitForTimeout(500); await page.keyboard.up('w');
  await page.evaluate(() => window.__SS__!.pause());
  await page.evaluate(() => window.__SS__!.screenshotReady());
  await page.screenshot({ path: `${out}/boss-retry.png` });
  writeFileSync(`${out}/boss-retry.json`, JSON.stringify({ before, after, movedTick: await page.evaluate(() => window.__SS__!.tick()) }, null, 2));
  if (after.checkpoint !== 'cure-disperse-ready' || after.charge !== 3600 || !after.ready || after.hp !== after.maxHp) throw new Error(`Boss retry did not preserve the ready fight: ${JSON.stringify(after)}`);
} finally { await browser.close(); }
