import { mkdirSync, writeFileSync } from 'node:fs';
import { launchBrowser } from '../browser-pool/client';
import { chargeL10Console, l10LaunchArgs } from './l10-charge';
import { cure } from '../../src/levels/L10/district';
import type { Game } from '../../src/Game';

/**
 * PO #101 / Q-200 probe: a far living Mega Alpha joins the full-charge fight without a visible jump.
 *   tsx tools/playtest/l10-boss-rally.ts http://127.0.0.1:4741 test-results/playtest/l10-boss-rally
 * The boss is introduced at its crash-site default (km behind the console); the charge runs under god mode with real E presses.
 * Every tick records the boss position and whether it is inside the game camera's frame; shots follow it walking in.
 */
const [origin, out] = process.argv.slice(2);
if (!origin || !out) throw new Error('Usage: l10-boss-rally.ts <origin> <outDir>');
mkdirSync(out, { recursive: true });
const quality = process.env.QUALITY ?? 'low';
const browser = await launchBrowser({ headless: true, args: l10LaunchArgs });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await chargeL10Console(origin, page, quality, 3590);
  const [cx, cz] = cure.anchors['cure-console'];
  const shots: { tick: number; file: string; distance: number; inFrame: boolean }[] = [];
  const rows: { tick: number; x: number; z: number; d: number; seen: boolean; hidden: boolean; mode: string; hp: number; maxHp: number }[] = [];
  const sample = () => page.evaluate(() => {
    const g = (window.__SCENE__ as unknown as { game: Game }).game, w = g.world, boss = w.megaPursuit!, e = boss.entity()!, p = w.entities.get(1)!.transform;
    const ground = w.districts?.groundHeight(e.transform.x, e.transform.z) ?? 0;
    return { tick: w.tick, x: e.transform.x, z: e.transform.z, d: Math.hypot(e.transform.x - p.x, e.transform.z - p.z), seen: !e.infected!.hidden && !w.infected!.director.offscreen(e.transform, ground), hidden: !!e.infected!.hidden, mode: boss.state.mode, hp: e.health.current, maxHp: e.health.max };
  });
  let joinedAt = -1, firstSeen = -1, readyAt = -1;
  for (let i = 0; i < 30 * 60 && joinedAt < 0; i++) {
    await page.evaluate(() => window.__SS__!.step(1));
    const r = await sample(); rows.push(r);
    if (readyAt < 0 && await page.evaluate(() => window.__SS__!.missions.state()!.states['charge-ready'])) readyAt = r.tick;
    if (r.seen && firstSeen < 0) firstSeen = r.tick;
    if (r.seen && (shots.length === 0 || r.tick - shots[shots.length - 1].tick >= 60 || r.d <= 12)) {
      await page.evaluate(() => window.__SS__!.screenshotReady());
      const file = `${out}/arrival-${String(shots.length).padStart(2, '0')}-${Math.round(r.d)}m.png`;
      await page.screenshot({ path: file }); shots.push({ tick: r.tick, file, distance: r.d, inFrame: r.seen });
    }
    if (r.d <= 12) joinedAt = r.tick;
  }
  let maxSeenStep = 0; const jumps: { tick: number; m: number; fromSeen: boolean; toSeen: boolean; toD: number }[] = [];
  for (let i = 1; i < rows.length; i++) {
    const m = Math.hypot(rows[i].x - rows[i - 1].x, rows[i].z - rows[i - 1].z);
    if (rows[i - 1].seen || rows[i].seen) maxSeenStep = Math.max(maxSeenStep, m);
    if (m > .5) jumps.push({ tick: rows[i].tick, m, fromSeen: rows[i - 1].seen, toSeen: rows[i].seen, toD: rows[i].d });
  }
  // Completion: ten direct rockets, then the explicit console release by physical E.
  await page.evaluate(() => {
    const w = (window.__SCENE__ as unknown as { game: Game }).game.world, id = w.megaPursuit!.state.id;
    for (let i = 0; i < 10; i++) w.combat!.damage.apply({ sourceId: 1, targetId: id, attackId: 900 + i, actionId: 'weapon.rocket-launcher', direct: true, origin: { x: 0, z: 0 }, direction: { x: -1, z: 0 }, base: 1, multiplier: 1, type: 'explosive', stagger: 0, knockback: 0 });
  });
  await page.evaluate(() => window.__SS__!.step(30));
  await page.evaluate(({ x, z }) => window.__SS__!.teleport('player', { x, z }), { x: cx, z: cz });
  await page.keyboard.down('e'); await page.evaluate(() => window.__SS__!.step(2)); await page.keyboard.up('e');
  await page.evaluate(() => window.__SS__!.step(2));
  const end = await page.evaluate(() => { const m = window.__SS__!.missions.state()!; return { released: m.states['cure-released'], megaDead: m.states['mega-dead'] }; });
  const result = { quality, readyAt, firstSeen, joinedAt, joinSeconds: joinedAt >= 0 && readyAt >= 0 ? (joinedAt - readyAt) / 60 : null, firstSeenDistance: rows.find(r => r.tick === firstSeen)?.d ?? null, maxSeenStep, jumps, fullHpAtJoin: rows.at(-1) ? rows.at(-1)!.hp === rows.at(-1)!.maxHp : false, shots, end };
  writeFileSync(`${out}/result-${quality}.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ ...result, shots: shots.length }));
  if (joinedAt < 0 || jumps.some(j => j.fromSeen || j.toSeen) || maxSeenStep > .25 || !result.fullHpAtJoin || !end.released) process.exitCode = 1;
} finally { await browser.close(); }
