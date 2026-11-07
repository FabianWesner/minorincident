/**
 * r6-l3 (PO 2026-11-07, "I walk and shoot backwards, so no Zombie can attack me"): native L3 kiting probe.
 * The ordinary `complete` bot plays until the corridor fallback; from then on a kiting policy walks the connected army
 * route at full input and holds the handgun on the nearest visible infected (aim behind/side while moving forward).
 * Counts infected windups that target the courier and strikes that reach her, per minute, by segment.
 *
 * Usage: node --import tsx/esm tools/qa/r6-l3-kite.ts [--tier low|high] [--seeds 1,2,3] [--seconds 120] [--mortal] [--policy kite|complete]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { loadL3, runL3, followFrustum } from '../sim-runner/l3Bots';
import { l3RouteDirection } from '../../src/levels/L3/navigation';
import { l3Segment } from '../../src/data/l3';
import { emptyInput } from '../../src/input/InputFrame';
import { visibleThreats } from '../../src/debug/bot/helpers';
import { LevelThreeBot } from '../../src/debug/bot/LevelThreeBot';

const arg = (name: string, fallback: string) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const tier = arg('tier', 'low') as 'low' | 'high', seeds = arg('seeds', '1,2,3').split(',').map(Number), seconds = Number(arg('seconds', '120'));
const mortal = process.argv.includes('--mortal'), policy = arg('policy', 'kite') as 'kite' | 'complete';
const out = arg('out', `test-results/r6-l3/kite-${policy}-${tier}${mortal ? '-mortal' : ''}.json`);

const rows = [];
for (const seed of seeds) {
  const { world, mission } = await loadL3(seed, tier);
  // Ordinary play to the fallback, then a short way into the corridor.
  runL3(world, mission, 'complete', { seed, maxSeconds: 400, stopWhen: m => !!m.state.l3?.fallbackAt && world.entities.get(1)!.transform.x > -118, god: true });
  const s = mission.state.l3!;
  if (!s.fallbackAt) { rows.push({ seed, valid: false }); world.dispose(); continue; }
  world.combat!.damage.god = !mortal;
  const route = { path: [] as number[], goal: -1, pathIndex: 0 }, wp = { x: 0, z: 0 };
  const bot = policy === 'complete' ? new LevelThreeBot(world, 'complete') : null;
  const seg = [0, 1, 2, 3].map(() => ({ ticks: 0, windups: 0, strikes: 0, damage: 0, near6: 0, near15: 0, speed: 0, backTicks: 0 }));
  let current = 0;
  const offs = [
    world.events.on('telegraph', e => { if (e.type === 'telegraph' && e.sourceId !== undefined && e.target?.id === 1) seg[current].windups++; }),
    world.events.on('infected.attack', e => { if (e.type === 'infected.attack' && e.targetId === 1) seg[current].strikes++; }),
    world.events.on('player.damaged', e => { if (e.type === 'player.damaged') seg[current].damage += e.amount; }),
  ];
  const start = world.tick, startSquad = s.squad.length;
  let prev = { ...world.entities.get(1)!.transform };
  for (let t = 0; t < seconds * 60; t++) {
    const m = world.missions!;
    if (m.state.phase === 'result' || m.state.phase === 'progression' || s.crossedAt) break;
    if (m.state.phase === 'retry') m.restore();
    const p = world.entities.get(1)!.transform;
    current = Math.max(0, Math.min(3, l3Segment(p.x)));
    let frame = emptyInput();
    if (bot) frame = bot.sample();
    else if (l3RouteDirection(world, route, wp)) {
      const dx = wp.x - p.x, dz = wp.z - p.z, d = Math.hypot(dx, dz) || 1;
      frame.move = { x: dx / d, z: dz / d };
      const target = visibleThreats(world, p, 15).find(e => world.combat!.query.shotVisible(p, e.transform, e.id));
      if (target) {
        const ax = target.transform.x - p.x, az = target.transform.z - p.z, ad = Math.hypot(ax, az) || 1;
        frame.aim = { x: ax / ad, z: az / ad }; frame.aimPoint = { x: target.transform.x, z: target.transform.z };
        frame.aimSource = 'pointer'; frame.strafe = true; frame.right.held = true;
        if ((ax * dx + az * dz) / ad / d < -.5) seg[current].backTicks++;
      }
    }
    followFrustum(world); world.applyInput(frame, 'keyboard'); world.update();
    const q = world.entities.get(1)!.transform, row = seg[current];
    row.ticks++; row.speed += Math.hypot(q.x - prev.x, q.z - prev.z) * 60; prev = { ...q };
    for (const e of world.infected!.active) if (e.health.current > 0 && !e.hidden) { const d = Math.hypot(e.transform.x - q.x, e.transform.z - q.z); if (d <= 6) row.near6++; if (d <= 15) row.near15++; }
  }
  offs.forEach(off => off());
  const segments = seg.map((r, i) => ({ segment: i, seconds: +(r.ticks / 60).toFixed(1), windupsPerMin: r.ticks ? +(r.windups / r.ticks * 3600).toFixed(2) : null, strikesPerMin: r.ticks ? +(r.strikes / r.ticks * 3600).toFixed(2) : null, damage: +r.damage.toFixed(1), meanNear6: r.ticks ? +(r.near6 / r.ticks).toFixed(2) : null, meanNear15: r.ticks ? +(r.near15 / r.ticks).toFixed(2) : null, meanSpeed: r.ticks ? +(r.speed / r.ticks).toFixed(2) : null, backShare: r.ticks ? +(r.backTicks / r.ticks).toFixed(2) : null })).filter(r => r.seconds > 0);
  const total = seg.reduce((a, r) => ({ ticks: a.ticks + r.ticks, windups: a.windups + r.windups, strikes: a.strikes + r.strikes }), { ticks: 0, windups: 0, strikes: 0 });
  const row = { seed, valid: true, policy, tier, mortal, kiteSeconds: +((world.tick - start) / 60).toFixed(1), x: +world.entities.get(1)!.transform.x.toFixed(1), crossed: !!s.crossedAt, deaths: mission.state.stats.deaths, squadAtStart: startSquad, squadNow: s.squad.length,
    windupsPerMin: +(total.windups / Math.max(1, total.ticks) * 3600).toFixed(2), strikesPerMin: +(total.strikes / Math.max(1, total.ticks) * 3600).toFixed(2), segments };
  rows.push(row); console.log(JSON.stringify(row));
  world.dispose();
}
mkdirSync('test-results/r6-l3', { recursive: true }); writeFileSync(out, JSON.stringify(rows, null, 2) + '\n');
