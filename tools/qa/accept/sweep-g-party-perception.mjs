/** Close the companion notice and finite authored-focus gaps without changing AI. */
import { writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { loadLevel } from '../../sim-runner/levels.ts';
import { humanInfected } from '../../../src/data/infected.ts';
import { observeAttackStarts } from '../threat/attackStarts.ts';
import { provenance } from './probe.ts';
const result = { ...provenance(), method: 'Controlled actual production worlds/nav; director paused and ambient actors hidden. Production companion/escort constructors and rush/press APIs. Read-only perception/attack samples. No AI, path, clock or population target edits.', cells: [], errors: [] };
for (const tier of ['low', 'high']) for (let n = 1; n <= 10; n++) {
 const level = `L${n}`; let w;
 try {
  w = await loadLevel(level, 1, undefined, 0, { quality: tier });
  w.missions.begin(); w.storyLock = null;
  const ai = w.infected, player = w.entities.get(1); ai.director.update = () => {};
  for (const e of [...ai.active]) ai.release(e);
  for (const e of w.entities.iterate()) if (e.id !== 1 && (e.civilian || e.companion || e.escort)) e.hidden = true;
  const nav = ai.nav; let start = null, best = Infinity;
  for (let i = 0; i < nav.blocked.length; i++) {
   const x = nav.x(i), z = nav.z(i), d = Math.hypot(x - player.transform.x, z - player.transform.z);
   if (d < best && [-1, 0, 1].every(dz => [0, 2, 4, 6, 8].every(dx => nav.clear(x + dx, z + dz, .6))) && nav.visible({ x, z }, { x: x + 8, z }, .4)) { start = { x, z }; best = d; }
  }
  if (!start) throw Error('No open8m fixture lane');
  const dog = w.entities.get(w.npcs.companion.spawn()), escort = w.entities.get(w.npcs.escorts.spawn(start));
  escort.escort.order = escort.escort.state = 'wait';
  player.health.current = player.health.max = escort.health.current = escort.health.max = 100000;
  let active = null;
  observeAttackStarts(w, (sourceId, targetId) => { if (active?.id === sourceId) active.attacks.push({ tick: w.tick, targetId }); });
  const cases = [...humanInfected.map(def => ({ archetype: def.id, target: 'companion-notice', mode: 'script' })),
   { archetype: 'infected.runner', target: 'escort', mode: 'rush-complete' },
   ...humanInfected.map(def => ({ archetype: def.id, target: 'escort', mode: 'focus-complete' }))];
  for (const test of cases) {
   Object.assign(player.transform, { x: start.x + 30, z: start.z }); player.hidden = false;
   Object.assign(dog.transform, start); dog.hidden = test.target !== 'companion-notice';
   Object.assign(escort.transform, start); escort.hidden = test.target !== 'escort';
   const id = ai.spawn(test.archetype, { x: start.x + 2, z: start.z }, { yaw: Math.PI, ...(level === 'L10' && test.archetype === 'infected.alpha' ? { cureRegion: 'industrial-area' } : {}) });
   const enemy = w.entities.get(id), b = enemy.infected;
   if (test.mode === 'script') b.scripted = { x: start.x + 8, z: start.z };
   else if (test.mode === 'rush-complete') ai.rush(id, { x: start.x + 8, z: start.z }, w.tick + 600, true);
   else { ai.press(id, player.id, w.tick + 600); if (b.l1) b.l1.search.completeApproach = true; }
   const began = w.tick, samples = []; active = { id, attacks: [] };
   for (let t = 0; t < 120; t++) {
    w.tick++; ai.update();
    samples.push({ tick: w.tick, enemy: { x: enemy.transform.x, z: enemy.transform.z }, script: b.scripted ?? null, state: b.state, heardTargetId: b.heardTargetId, targetId: b.l1?.targetId ?? b.targetId, brainMode: b.l1?.mode ?? null, focusId: b.l1?.focusId ?? null, focusUntil: b.l1?.focusUntil ?? null, completeApproach: b.l1?.search.completeApproach ?? false, escortDistance: Math.hypot(enemy.transform.x - escort.transform.x, enemy.transform.z - escort.transform.z) });
   }
   result.cells.push({ tier, level, ...test, began, enemyId: id, playerId: player.id, dogId: dog.id, escortId: escort.id, courierAt: { ...player.transform }, dogAt: { ...dog.transform }, escortAt: { ...escort.transform }, dogHp: dog.health.current, attacks: active.attacks, samples });
   active = null; ai.release(enemy);
  }
 } catch (error) { result.errors.push({ level, tier, error: String(error) }); }
 finally { w?.dispose(); }
 console.log(level, tier, result.cells.filter(c => c.level === level && c.tier === tier).length);
}
writeFileSync(process.env.SWEEP_G_PARTY_OUT ?? 'docs/reports/sweep-g/G-18-party-perception.json.gz', gzipSync(JSON.stringify(result)));
console.log('cells', result.cells.length, 'errors', result.errors);
process.exitCode = result.errors.length ? 1 : 0;
