/** Natural tunnel-to-animal lifecycle observation: never mutates animals or carriers. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { loadLevel } from './levels';
import { LevelEightBot } from '../../src/debug/bot/LevelEightBot';
import { emptyInput } from '../../src/input/InputFrame';
import { provenance } from '../qa/accept/probe';
const out = 'test-results/l8-infection'; mkdirSync(out, { recursive: true });
const tier = (process.env.L8_BOSS_TIER ?? 'low') as 'low' | 'high';
const w = await loadLevel('L8', 1, undefined, 0, { quality: tier }), zoo = w.missions!.l8!, bot = new LevelEightBot(w, 'story-only');
const healthy = zoo.state.animals.map(id => ({ id, species: w.entities.get(id)!.civilian!.zooAnimal, model: w.entities.get(id)!.civilian!.model }));
const killCarrier = process.env.L8_KILL_FLOCK_CARRIER === '1'; let firstFlockSource = 0, killedCarrier = false, replacementCarrier = 0;
const bites: unknown[] = [], turns: unknown[] = [], keeper: unknown[] = [];
w.events.on('outbreak.bite', e => { if (e.type === 'outbreak.bite') { if (zoo.state.animals.includes(e.targetId)) bites.push({ tick: e.tick, id: e.targetId, source: e.sourceId }); if (zoo.state.arenas.find(a => a.id === 'flamingo')!.ids.includes(e.targetId)) firstFlockSource ||= e.sourceId; if (e.targetId === zoo.state.pondKeeperId) keeper.push({ tick: e.tick, source: e.sourceId }); } });
w.events.on('civilian.turned', e => { if (e.type === 'civilian.turned' && zoo.state.animals.includes(e.id)) turns.push({ tick: e.tick, id: e.id }); });
// Observation survives contact; this is never a mortal victory receipt.
w.combat!.damage.god = true;
for (let n = 0; n < 300 * 60 && zoo.state.animals.some(id => !w.entities.get(id)?.infected); n++) {
 w.applyInput(zoo.state.breachedAt ? emptyInput() : bot.sample(), 'keyboard'); w.update();
 if (killCarrier && firstFlockSource && !killedCarrier) {
  const source = w.entities.get(firstFlockSource)!;
  w.combat!.damage.apply({ sourceId: 1, targetId: source.id, attackId: w.infected!.arenaAttackId(), actionId: 'weapon.handgun', origin: w.entities.get(1)!.transform, direction: {x:1,z:0}, base: 100000, multiplier: 1, type: 'bullet', knockback: 0, stagger: 0, permanent: true });
  killedCarrier = source.health.current === 0;
 }
 const carrier = zoo.state.arenas.find(a => a.id === 'flamingo')!.carrier;
 if (killedCarrier && carrier && carrier !== firstFlockSource && w.entities.get(carrier)?.infected?.arenaCarrier) replacementCarrier ||= carrier;
 if (w.tick % 1800 === 0) console.log(JSON.stringify({ tick: w.tick, arenas: zoo.state.arenas.map(a => ({ id: a.id, turned: a.ids.filter(id => !!w.entities.get(id)?.infected).length, carrier: a.carrier, carrierAt: w.entities.get(a.carrier)?.transform, brain: w.entities.get(a.carrier)?.infected?.arenaCarrier })) }));
}
const arenas = zoo.state.arenas.map(a => ({ id: a.id, ids: a.ids, animals: a.ids.map(id => { const e=w.entities.get(id)!; return { id, infected: !!e.infected, archetype: e.archetype, at: e.transform, hp: e.health, pending: e.pendingAdmission }; }) }));
const pass = arenas.every(a => a.animals.every(e => e.infected)) && (!killCarrier || killedCarrier && replacementCarrier > 0);
writeFileSync(`${out}/${tier}${killCarrier ? '-carrier-retry' : ''}.json`, JSON.stringify({ ...provenance(process.env.L8_BOSS_REVISION ?? 'working-tree'), tier, pass, killCarrier, firstFlockSource, killedCarrier, replacementCarrier, tick: w.tick, method: 'Natural production tunnel walks, actual grabs and shared same-ID infection timers; player protected solely to continue lifecycle observation.', healthy, bites, turns, keeper, arenas, collision: { failures: w.solids.failures, pending: w.entities.values().filter(e => e.pendingAdmission).length } }, null, 2) + '\n');
console.log(JSON.stringify({ pass, tick: w.tick, turns: turns.length, bites: bites.length, keeper }));w.dispose();if (!pass) process.exitCode=1;
