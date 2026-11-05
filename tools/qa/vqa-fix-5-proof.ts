/** Focused native mechanics proof. Browser captures independently qualify presentation. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { SimWorld } from '../../src/sim/world/SimWorld';
import { preset } from '../../src/sim/progression/Campaign';
import { loadLevel } from '../sim-runner/levels';
import { storyProtected } from '../../src/sim/npc/storyProtection';
import { provenance } from './accept/probe';

const cases: unknown[] = [];
for (const tier of ['low', 'high'] as const) {
  const save = preset('L5-default'); save.settings.quality = tier;
  const world = await loadLevel('L5', 1, save);
  try {
    const dog = [...world.entities.iterate()].find(e => e.companion)!;
    const hero = world.entities.get(1)!;
    const dogPose = { ...dog.transform }, dogState = dog.companion!.state;
    Object.assign(dog.transform, hero.transform);
    world.spatial.set(dog.id, dog.transform.x, dog.transform.z);
    dog.companion!.state = 'follow';
    assert(!world.solids.clear(hero.transform, .3, hero.id), 'visible pet remains a collision body');
    dog.companion!.state = 'hide';
    assert(world.solids.clear(hero.transform, .3, hero.id), 'courage-hidden pet must not trap or obstruct actors');
    Object.assign(dog.transform, dogPose); dog.companion!.state = dogState;
    world.spatial.set(dog.id, dog.transform.x, dog.transform.z);
    cases.push({ tier, case: 'L5 hiding contact contract', visiblePetBlocks: true, courageHiddenPetBlocks: false, controlledOverlap: true });
    const row = world.missions!.state.l5!.survivors.find(r => r.key === 'mia')!;
    const e = world.entities.get(row.id)!;
    world.missions!.state.l5!.phase = 'search';
    row.status = 'following'; row.foundAt = world.tick;
    e.hidden = false; e.civilian!.survivor!.mode = 'follow';
    const at = world.tick;
    for (const elapsed of [0, 300, 599]) {
      world.tick = at + elapsed;
      assert(storyProtected(world, e));
      world.events.emit({ type: 'outbreak.bite', tick: world.tick, sourceId: 999, targetId: e.id, position: e.transform, turns: false });
      assert(e.health.current > 0 && !e.infection && e.civilian!.state !== 'finished');
    }
    world.tick = at + 600;
    assert(!storyProtected(world, e));
    world.events.emit({ type: 'civilian.grabbed', tick: world.tick, sourceId: 999, targetId: e.id, variant: '', rescueUntil: world.tick + 60 });
    assert.equal(world.missions!.state.l5!.alarm?.kind, 'attack');
    world.events.emit({ type: 'outbreak.bite', tick: world.tick, sourceId: 999, targetId: e.id, position: e.transform, turns: false });
    assert.equal(e.health.current, 0, 'expired grace control must remain mortal');
    world.missions!.l5!.update();
    assert.equal(world.missions!.state.l5!.alarm?.kind, 'lost');
    cases.push({ tier, case: 'L5 rescue grace', protectedThroughTicks: 599, mortalAtTicks: 600, attackAlarm: true, lossAlarm: true, expiredControlKilled: true });
  } finally { world.dispose(); }


  const subwaySave = preset('L6-default'); subwaySave.settings.quality = tier;
  const subway = await loadLevel('L6', 1, subwaySave);
  try {
    const state = subway.missions!.state.l6!, row = state.survivors[1], e = subway.entities.get(row.id)!;
    row.status = 'following';
    subway.events.emit({ type: 'civilian.grabbed', tick: subway.tick, sourceId: 999, targetId: e.id, variant: '', rescueUntil: subway.tick + 60 });
    assert.equal(state.alarm?.kind, 'attack');
    e.health.current = 0;
    subway.missions!.l6!.update();
    assert.equal(row.status, 'dead'); assert.equal(state.alarm?.kind, 'lost');
    cases.push({ tier, case: 'L6 escort alarms', attackAlarm: true, lossAlarm: true });
  } finally { subway.dispose(); }

  for (const distance of [1, 6]) {
    const w = new SimWorld(); await w.init();
    try {
      w.loadScenario('horde-arena', 1); w.scenario = 'L6'; w.infected!.director.setTier(tier);
      const id = w.infected!.spawn('infected.riot', { x: distance, z: 0 }, { state: 'idle', yaw: Math.PI });
      const enemy = w.entities.get(id)!, hero = w.entities.get(1)!;
      w.infected!.update = () => {};
      w.combat!.setLoadout(['weapon.army-mg'], ['weapon.kick']);
      for (let t = 0; t < 360 && enemy.health.current > 0; t++) {
        const dx = enemy.transform.x - hero.transform.x, dz = enemy.transform.z - hero.transform.z, length = Math.hypot(dx, dz) || 1;
        w.setInput({ move: { x: 0, z: 0 }, aimSource: 'keyboard', aim: { x: dx / length, z: dz / length }, aimPoint: enemy.transform, left: { down: false, held: true, up: false } });
        w.update();
      }
      assert.equal(enemy.health.current, 0, `L6 frontal MG must defeat a riot at ${distance}m`);
      cases.push({ tier, case: 'L6 frontal shield', distance, seconds: w.tick / 60, hp: enemy.health.current,
        brokenAt: enemy.combat!.shieldBrokenAt ?? null, isolatedAI: true });
    } finally { w.dispose(); }
  }
}
mkdirSync('docs/reports/vqa-fix-5', { recursive: true });
writeFileSync('docs/reports/vqa-fix-5/mechanics-proof.json', JSON.stringify({ ...provenance(), cases }, null, 2));
console.log(JSON.stringify(cases));
