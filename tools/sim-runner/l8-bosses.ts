/** Native arena fixture: production composition, real animal bites/turns, ordinary input during every measured fight. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { l8BossArenas, type L8BossId } from '../../src/data/l8Bosses';
import { L8ArenaBot } from '../../src/debug/bot/L8ArenaBot';
import { emptyInput } from '../../src/input/InputFrame';
import { loadLevel } from './levels';
const out = process.env.L8_BOSS_OUT ?? 'test-results/l8-bosses'; mkdirSync(out, { recursive: true });
const selected = process.argv[2] === 'all' ? undefined : process.argv[2], policy = (process.argv[3] ?? 'skilled') as 'skilled' | 'passive' | 'standing' | 'kite';
const files = [...new Set(execFileSync('git', ['ls-files', '-c', '-o', '--exclude-standard', '-z', '--', 'src', 'public/assets/layouts', 'tools/sim-runner/l8-bosses.ts'], { encoding: 'utf8' }).split('\0').filter(Boolean))].sort();
const hash = createHash('sha256'); for (const path of files) hash.update(path).update(readFileSync(path));
const identity = { revision: process.env.L8_BOSS_REVISION ?? 'fb617dcd+working-tree', sourceHash: hash.digest('hex'), observerHash: createHash('sha256').update(readFileSync('tools/sim-runner/l8-bosses.ts')).digest('hex') };
const rows: { id: L8BossId; policy: string; error?: string; complete?: boolean; seconds?: number; [key: string]: unknown }[] = [];
const save = () => writeFileSync(`${out}/${selected ?? 'all'}-${process.env.L8_BOSS_TIER ?? 'low'}-${policy}.json`, JSON.stringify({ ...identity, policy, rows }, null, 2) + '\n');
for (const def of l8BossArenas.filter(a => !selected || a.id === selected)) {
  const w = await loadLevel('L8', 1808, undefined, 0, { quality: (process.env.L8_BOSS_TIER ?? 'low') as 'low' | 'high' });
  const m = w.missions!, zoo = m.l8!, p = w.entities.get(1)!, arena = zoo.state.arenas.find(a => a.id === def.id)!;
  // Disposable fixture pre-roll: entry placement and carrier contact are outside the measured mortal fight.
  // Same-ID transforms still run the real shared 2.5–3.5 s timer; no boss is substituted for a healthy animal.
  w.solids.relocate(p, { ...def.entry, y: .7 }, 'qa.arena.entry', 2); m.state.states.breached = true; zoo.state.breachedAt = w.tick || 1; zoo.state.nextWave = Number.MAX_SAFE_INTEGER;
  for (const other of zoo.state.arenas) if (other.id !== def.id) other.phase = 3;
  const tells: { tick: number; source: number; attack: number; move: string; duration: number; area: unknown }[] = [], throws: { tick: number; source: number; prop: number }[] = [], signals: { tick: number; name: string }[] = [];
  const bites: number[] = [], turns: number[] = [], stages: { tick: number; source: number; move: string; stage: string }[] = [];
  w.events.on('telegraph', e => { if (e.type === 'telegraph' && e.sourceId !== undefined && arena.ids.includes(e.sourceId)) tells.push({ tick: e.tick, source: e.sourceId, attack: e.attackId, move: e.special, duration: e.duration, area: e.area }); });
  w.events.on('infected.prop-thrown', e => { if (e.type === 'infected.prop-thrown' && arena.ids.includes(e.sourceId)) throws.push({ tick: e.tick, source: e.sourceId, prop: e.propId }); });
  w.events.on('mission.signal', e => { if (e.type === 'mission.signal' && e.name.startsWith(`l8.arena.${def.id}`)) signals.push({ tick: e.tick, name: e.name }); });
  w.events.on('outbreak.bite', e => { if (e.type === 'outbreak.bite' && arena.ids.includes(e.targetId)) bites.push(e.targetId); });
  w.events.on('civilian.turned', e => { if (e.type === 'civilian.turned' && arena.ids.includes(e.id)) turns.push(e.id); });
  w.events.on('infected.special', e => { if (e.type === 'infected.special' && arena.ids.includes(e.sourceId)) stages.push({ tick: e.tick, source: e.sourceId, move: e.move, stage: e.stage }); });
  // A real nearby infected grabs each animal during the controlled infection fixture.
  for (const id of arena.ids) {
    const animal = w.entities.get(id)!;
    const at = w.solids.find({ ...animal.transform, x: animal.transform.x + 1.1 }, .35, undefined, 3)!;
    const carrierId = w.infected!.spawn('infected.runner', at, { state: 'chase' }), carrier = w.entities.get(carrierId)!;
    w.npcs!.civilians.outbreak!.grab(animal, carrier);
  }
  w.combat!.damage.god = true;
  for (let n = 0; n < 1200 && arena.ids.some(id => !w.entities.get(id)?.infected); n++) { w.applyInput(emptyInput(), 'keyboard'); w.update(); }
  w.combat!.damage.god = false;
  if (arena.ids.some(id => !w.entities.get(id)?.infected)) {
    const row = { id: def.id, policy, error: 'fixture animal failed to turn', ids: arena.ids.map(id => ({ id, c: w.entities.get(id)?.civilian?.state, infected: !!w.entities.get(id)?.infected })), bites, turns }; rows.push(row); save(); console.log(JSON.stringify(row)); w.dispose(); continue;
  }
  // Remove fixture carriers after their bites; the measured arena has its intended animal cast and production cover.
  for (const e of [...w.infected!.active]) if (!arena.ids.includes(e.id)) w.infected!.release(e);
  const entryDistance = Math.hypot(def.centre.x - def.entry.x, def.centre.z - def.entry.z) || 1;
  const measurementEntry = { x: def.entry.x + (def.centre.x - def.entry.x) * Math.min(1, 8 / entryDistance), z: def.entry.z + (def.centre.z - def.entry.z) * Math.min(1, 8 / entryDistance), y: .7 };
  w.solids.relocate(p, measurementEntry, 'qa.arena.measurement-entry', 2); p.health.current = p.health.max;
  arena.phase = 1; arena.startedAt = w.tick; arena.nextAt = w.tick + 90; arena.cycle = 0; arena.wallHits = 0;
  for (const id of arena.ids) { const e = w.entities.get(id)!; e.health.current = e.health.max; e.infected!.grabUntil = 0; delete e.infected!.specialAttack; e.infected!.arenaBoss!.readyAt = 0; }
  m.checkpoint(`arena-${def.id}`, def.entry);
  const bot = new L8ArenaBot(w), start = w.tick, startDeaths = m.state.stats.deaths; let damage = 0, attacks = 0;
  w.events.on('infected.attack', e => { if (e.type === 'infected.attack' && arena.ids.includes(e.sourceId) && e.targetId === 1) { attacks++; damage += e.amount; } });
  for (let n = 0; n < 180 * 60 && zoo.state.arenas.find(a => a.id === def.id)!.phase !== 3 && (policy === 'skilled' ? m.state.stats.deaths - startDeaths < 4 : p.health.current > 0); n++) { w.applyInput(p.health.current > 0 ? bot.sample(def.id as L8BossId, policy) : emptyInput(), 'keyboard'); w.update();
    if (process.env.L8_BOSS_TRACE && def.id === 'gorilla' && n % 300 === 0) {
      const actor = w.entities.get(arena.ids[0])!, boss = actor.infected!.arenaBoss!;
      const prop = w.props?.items.find(p => p.entityId === boss.scavengeId);
      console.log(JSON.stringify({ trace: def.id, tick: w.tick, actor: actor.transform, hp: actor.health.current, boss, move: actor.infected!.specialAttack?.move, target: prop ? { id: prop.entityId, pose: prop.body.translation(), radius: prop.radius, role: prop.assetId } : undefined, path: actor.infected!.path, waypoint: actor.infected!.pathIndex }));
    }
  }
  const current = zoo.state.arenas.find(a => a.id === def.id)!;
  const row = { id: def.id, tier: w.infected!.director.tier, policy, measurementEntry, complete: current.phase === 3, seconds: current.phase === 3 ? (current.endedAt - current.startedAt) / 60 : (w.tick - start) / 60, totalSeconds: (w.tick - start) / 60, hp: p.health.current, deaths: m.state.stats.deaths - startDeaths, damage, attacks, phases: current.phase, counters: current.counters, wallHits: current.wallHits, wallContacts: current.wallContacts, bites, turns, tells, throws, signals, stages, destruction: w.destruction?.objects.filter(o => o.id.includes('l8-gorilla-pillar')).map(o => ({ id: o.id, hp: o.state.hp, collapsed: o.state.collapsed })), bosses: arena.ids.map(id => ({ id, hp: w.entities.get(id)?.health.current, at: w.entities.get(id)?.transform, state: w.entities.get(id)?.infected?.state, boss: w.entities.get(id)?.infected?.arenaBoss, attack: w.entities.get(id)?.infected?.specialAttack, pending: w.entities.get(id)?.pendingAdmission, held: w.npcs!.civilians.holds(id) })) };
  rows.push(row); save(); console.log(JSON.stringify({ id: row.id, tier: row.tier, policy: row.policy, complete: row.complete, seconds: row.seconds, totalSeconds: row.totalSeconds, hp: row.hp, deaths: row.deaths, damage: row.damage, attacks: row.attacks, phases: row.phases, counters: row.counters, wallHits: row.wallHits, tells: row.tells.length, throws: row.throws.length })); w.dispose();
}
if (rows.some(r => 'error' in r || (policy === 'skilled' ? !r.complete || r.seconds! < 45 || r.seconds! > 120 : r.complete))) process.exitCode = 1;
