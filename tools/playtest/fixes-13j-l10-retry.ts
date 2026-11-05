import { launchBrowser } from '../browser-pool/client';
import { mkdirSync, writeFileSync } from 'node:fs';
import type { Game } from '../../src/Game';
import { chargeL10Console, l10LaunchArgs } from './l10-charge';

/**
 * Q-120/Q-121 real-input regression probe. Run against the production preview under e2e-lock:
 *   tsx tools/playtest/fixes-13j-l10-retry.ts http://127.0.0.1:4181 test-results/playtest/fixes-13j-l10
 * The console interactions and post-respawn movement use physical keyboard input.
 * Setup advances the charge under god mode; live enemies cause the boss-step death on the real clock.
 */
const [origin, out] = process.argv.slice(2);
if (!origin || !out) throw new Error('Usage: fixes-13j-l10-retry.ts <origin> <outDir>');
mkdirSync(out, { recursive: true });
const browser = await launchBrowser({ headless: true, args: l10LaunchArgs });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await chargeL10Console(origin, page, 'low', 3600);
  const before = await page.evaluate(() => {
    const a = window.__SS__!, m = a.missions.state()!, boss = a.query({ kind: 'infected' }).find(e => e.infected?.pursuit)!;
    return { tick: a.tick(), checkpoint: m.checkpoint, charge: m.counters['charge-ticks'], ready: m.states['charge-ready'], megaStep: m.steps.mega.status, hp: boss.health.current, maxHp: boss.health.max, bar: a.getState().render.healthBars?.bars.find(b => b.id === boss.id)?.fraction ?? null };
  });
  if (before.checkpoint !== 'cure-disperse-ready' || before.charge !== 3600 || !before.ready || before.megaStep !== 'active' || before.hp !== before.maxHp) throw new Error(`Charge did not reach the ready boss fight: ${JSON.stringify(before)}`);

  await page.evaluate(() => {
    const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game;
    const evidence = window as unknown as { __retryDeath?: number; __retryRespawn?: number };
    g.world.events.on('player.died', () => { evidence.__retryDeath = a.tick(); });
    g.world.events.on('player.respawned', () => { evidence.__retryRespawn = a.tick(); a.pause(); }, 6);
    a.cheats.god(false); a.resume();
  });
  const firstVisible = await page.waitForFunction(() => {
    const a = window.__SS__!, boss = a.query({ kind: 'infected' }).find(e => e.infected?.pursuit)!;
    const bar = a.getState().render.healthBars?.bars.find(b => b.id === boss.id);
    return bar ? { tick: a.tick(), hp: boss.health.current, maxHp: boss.health.max, fraction: bar.fraction } : false;
  }, null, { polling: 250, timeout: 60_000 });
  const firstSight = await firstVisible.jsonValue();
  await page.screenshot({ path: `${out}/boss-first-sight.png` });
  await page.waitForFunction(() => (window as unknown as { __retryRespawn?: number }).__retryRespawn !== undefined, null, { timeout: 120_000 });
  const after = await page.evaluate(() => {
    const a = window.__SS__!, m = a.missions.state()!, boss = a.query({ kind: 'infected' }).find(e => e.infected?.pursuit)!;
    const evidence = window as unknown as { __retryDeath?: number; __retryRespawn?: number };
    return { tick: a.tick(), diedAt: evidence.__retryDeath, respawnedAt: evidence.__retryRespawn, checkpoint: m.checkpoint, charge: m.counters['charge-ticks'], ready: m.states['charge-ready'], hp: boss.health.current, maxHp: boss.health.max, player: a.getState().player!.transform };
  });
  await page.evaluate(() => window.__SS__!.resume());
  // Let the first alive tick release input carried from the death before sending a fresh command.
  await page.waitForFunction(tick => window.__SS__!.tick() > tick + 1, after.tick);
  await page.keyboard.down('w'); await page.waitForTimeout(500); await page.keyboard.up('w');
  await page.evaluate(() => window.__SS__!.pause());
  const moved = await page.evaluate(() => ({ tick: window.__SS__!.tick(), position: window.__SS__!.getEntity(1)!.transform }));
  await page.evaluate(() => window.__SS__!.screenshotReady());
  await page.screenshot({ path: `${out}/boss-retry.png` });
  writeFileSync(`${out}/boss-retry.json`, JSON.stringify({ before, firstSight, after, moved }, null, 2));
  if (after.checkpoint !== 'cure-disperse-ready' || after.charge !== 3600 || !after.ready || after.hp !== after.maxHp) throw new Error(`Boss retry did not preserve the ready fight: ${JSON.stringify(after)}`);
  if (!firstSight || firstSight.fraction !== 1) throw new Error(`Boss bar was not full at first sight: ${JSON.stringify(firstSight)}`);
  if (Math.hypot(moved.position.x - after.player.x, moved.position.z - after.player.z) <= .1) throw new Error('Physical W input did not move the courier after the boss retry');
} finally { await browser.close(); }
