/** Controlled projectile/cadence proof; full moving L10 route is checked by qa:accept. */
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { SimWorld } from '../../src/sim/world/SimWorld';
import { emptyInput } from '../../src/input/InputFrame';
const w = new SimWorld(); await w.init();
try {
  w.loadScenario('horde-arena', 1);
  w.combat!.setLoadout(['weapon.rocket-launcher'], ['weapon.kick']);
  const target = w.entities.get(w.infected!.spawn('infected.alpha', { x: 8, z: 0 }))!;
  target.infected!.pursuit = true; target.health.current = target.health.max = 3000;
  const shots: number[] = [], hits: { tick: number; hp: number }[] = [];
  w.events.on('combat.attack', e => { if (e.type === 'combat.attack' && e.sourceId === 1) shots.push(e.tick); });
  w.events.on('combat.hit', e => { if (e.type === 'combat.hit' && e.targetId === target.id && e.amount > 0) hits.push({ tick: e.tick, hp: target.health.current }); });
  const f = { ...emptyInput(), aim: { x: 1, z: 0 }, aimPoint: { x: 8, z: 0 }, left: { down: false, held: true, up: false } };
  // Freeze only target locomotion for the stationary timing fixture; run the
  // production raise, discharge, swept flight, arming, blast and damage path.
  while (w.tick < 1200 && target.health.current > 0) { target.transform.x = 8; target.transform.z = 0; w.spatial.set(target.id, 8, 0); w.tick++; w.combat!.intent(f); w.combat!.update(f); }
  assert.equal(hits.length, 10); assert.ok(hits.slice(0, 9).every(h => h.hp > 0)); assert.equal(target.health.current, 0);
  const row = { method: 'Stationary 8m Mega, production projectile pipeline; target movement frozen. Full fight separately covered by native acceptance.', shots: shots.length, shotTicks: shots, hits, hitSpanSeconds: (hits[9].tick - hits[0].tick) / 60, triggerToKillSeconds: hits[9].tick / 60, firstShotToKillSeconds: (hits[9].tick - shots[0]) / 60 };
  writeFileSync(`docs/reports/r12-l7/mega-${process.argv[2] ?? 'after'}.json`, JSON.stringify(row, null, 2) + '\n'); console.log(JSON.stringify(row));
} finally { w.dispose(); }
