/** r37-l4north: do the three street-north encounters spawn on the route and engage the courier? Native complete run, read-only observers. */
import { writeFileSync, mkdirSync } from 'node:fs';
import { l4CollapseGroups } from '../../src/data/l4';
import { preset } from '../../src/sim/progression/Campaign';
import { runLevel } from '../sim-runner/levels';
import { Walker } from '../../src/debug/bot/Walker';
import { emptyInput } from '../../src/input/InputFrame';
const SPRINT = process.argv.includes('--sprint');
const OUT = process.argv.find(a => a.startsWith('--out='))?.slice(6) ?? (SPRINT ? 'sprint.json' : 'probe.json');
/** Sprinting courier: from the collapse it runs the north street (Harbor St west) straight to the cellar door, never attacking. */
const DASH = [{ x: -39.2, z: -36.4 }, { x: -64, z: -39.5 }, { x: -79, z: -40 }, { x: -79.3, z: -45.28 }];
const first = l4CollapseGroups.findIndex(g => g[4]);
const out: unknown[] = [];
for (const tier of ['high', 'low'] as const) {
  const campaign = preset('L4-default'); campaign.settings.quality = tier;
  const seen = new Map<number, { group: number; archetype: string; spawnedTick: number; at: number[]; firstAttackOnPlayer?: number; dead?: number; minPlayerDist: number }>();
  let peak = 0;
  const sp = { attacks: 0, landed: 0, dmg: 0, hits: 0, startTick: -1, endTick: -1, minHp: 0, leg: 0, hp0: 0, c0: undefined as number | undefined, c0p: [0, 0] };
  const run = await runLevel('L4', 'complete', 1, undefined, 'auto', campaign, undefined, 0, { quality: tier, beforeBegin: world => {
    if (SPRINT) {
      const walker = new Walker(), apply = world.applyInput.bind(world);
      world.applyInput = (frame, scheme) => {
        const m = world.missions!.state, ph = m.l4?.phase, p = world.entities.get(1)!.transform;
        if (ph === 'collapse' && sp.c0 === undefined) { sp.c0 = world.tick; sp.c0p = [Math.round(p.x), Math.round(p.z)]; }
        if (ph === 'collapse' && world.entities.get(1)!.health.current > 0) {
          if (sp.startTick < 0 && (p.x < -30 || p.z < -34)) { sp.startTick = world.tick; sp.hp0 = world.entities.get(1)!.health.current; sp.minHp = sp.hp0; }
          const f = emptyInput(); const t = DASH[sp.leg] ?? DASH[DASH.length - 1];
          if (Math.hypot(p.x - t.x, p.z - t.z) < 2.5 && sp.leg < DASH.length - 1) sp.leg++;
          const dir = walker.step(world, DASH[sp.leg], .4, `dash-${sp.leg}`); if (dir) f.move = dir;
          return apply(f, scheme);
        }
        if (ph === 'cellar' && sp.endTick < 0 && sp.startTick >= 0) sp.endTick = world.tick;
        return apply(frame, scheme);
      };
      world.events.on('infected.attack', e => { if (e.type === 'infected.attack' && e.targetId === 1 && sp.startTick >= 0 && sp.endTick < 0) { sp.attacks++; if ((e as { amount?: number }).amount) { sp.landed++; sp.dmg += (e as { amount: number }).amount; } } });
      if (process.env.DBG) world.events.on('sim.tick', () => { const s = world.missions!.state.l4!, d = world.infected!.director; if (sp.c0 !== undefined && (world.tick - sp.c0) % 120 === 0 && world.tick - sp.c0 < 1800) { const p = world.entities.get(1)!.transform; console.log(' dbg', world.tick - sp.c0, Math.round(p.x), Math.round(p.z), 'count', d.count, 'cap', d.cap, 'res', d.reserved, 'pool', world.infected!.pool.length, 'pend', s.pendingDoor.filter(q => q.roster).map(q => q.id).join(',')); } }, 8);
      world.events.on('sim.tick', () => { if (sp.startTick >= 0 && sp.endTick < 0) { const hp = world.entities.get(1)!.health.current; if (hp < sp.minHp) { sp.hits++; sp.minHp = hp; } } }, 8);
    }
    world.events.on('infected.attack', e => { if (e.type === 'infected.attack' && e.targetId === 1) { const r = seen.get(e.sourceId); if (r && r.firstAttackOnPlayer === undefined) r.firstAttackOnPlayer = world.tick; } });
    world.events.on('sim.tick', () => {
      const s = world.missions!.state.l4!, p = world.entities.get(1)!;
      for (const q of s.pendingDoor ?? []) if (q.roster && q.id > 0) {
        const e = world.entities.get(q.id); if (!e) continue;
        const group = Number(q.door.split('-').pop()) - first;
        let r = seen.get(q.id);
        if (!r) { r = { group, archetype: e.archetype!, spawnedTick: world.tick, at: [Math.round(e.transform.x), Math.round(e.transform.z)], minPlayerDist: 999 }; seen.set(q.id, r); }
        r.minPlayerDist = Math.min(r.minPlayerDist, Math.round(Math.hypot(e.transform.x - p.transform.x, e.transform.z - p.transform.z)));
        if (e.health.current <= 0 && !r.dead) r.dead = world.tick;
      }
      if (world.tick % 60 === 0) peak = Math.max(peak, world.infected!.active.filter(a => a.health.current > 0 && !a.hidden).length);
    }, 8);
  } });
  const rows = [...seen.entries()].map(([id, r]) => ({ id, ...r }));
  console.log(tier, run.outcome, 'peak alive', peak);
  for (const r of rows) console.log(' ', JSON.stringify(r));
  if (SPRINT) console.log(' sprint', JSON.stringify({ ...sp, seconds: sp.endTick > 0 ? (sp.endTick - sp.startTick) / 60 : null, hpLost: sp.hp0 - sp.minHp }));
  out.push({ tier, outcome: run.outcome, peak, rows, ...(SPRINT ? { sprint: { ...sp, seconds: sp.endTick > 0 ? (sp.endTick - sp.startTick) / 60 : null, hpLost: sp.hp0 - sp.minHp } } : {}) });
}
const dir = 'docs/reports/r41-l4chase'; mkdirSync(dir, { recursive: true });
writeFileSync(`${dir}/${OUT}`, JSON.stringify(out, null, 1));
