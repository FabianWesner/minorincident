import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { emptyInput } from '../../src/input/InputFrame';
import { preset } from '../../src/sim/progression/Campaign';
import { completeCampaignLevel } from '../../src/sim/progression/carryover';
import { loadLevel } from '../sim-runner/levels';
import { provenance } from './accept/probe';

/** Native state transitions cover the meaningful consequences, including save/retry and the controlled escape. */
async function crossingStorySequence(): Promise<void> {
  const w = await loadLevel('L9', 7, preset('L9-default'));
  let passed = false; let failure: string | null = null;
  try {
    const mission = w.missions!, l9 = mission.l9!, driving = l9.driving.state, player = w.entities.get(1)!;
    let car = w.vehicles!.cars.get(l9.state.carId)!;
    player.survivor!.invulnerableUntil = Number.MAX_SAFE_INTEGER;
    let shots = 0, explosions = 0;
    w.events.on('combat.attack', e => { if (e.type === 'combat.attack' && e.sourceId === 1) shots++; });
    w.events.on('vehicle.exploded', e => { if (e.type === 'vehicle.exploded' && e.sourceId === car.entity.id) explosions++; });
    const place = (x: number, z: number, speed = 0, yaw = 0) => {
      const pose = { x, y: car.physics.def.suspension + car.physics.def.wheelRadius + .15, z, yaw };
      Object.assign(car.entity.transform, pose); Object.assign(car.physics.previous, pose);
      car.physics.body.setTranslation(pose, true); car.physics.body.setRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) }, true);
      car.physics.body.setLinvel({ x: Math.cos(yaw) * speed, y: 0, z: -Math.sin(yaw) * speed }, true); car.physics.body.setAngvel({ x: 0, y: 0, z: 0 }, true); car.physics.postPhysics();
      Object.assign(player.transform, pose); w.physics.playerBody!.setTranslation(pose, true); w.spatial.set(1, x, z); w.spatial.set(car.entity.id, x, z);
    };
    const fire = emptyInput(); fire.selectedWeaponKey = 5; fire.aim = { x: -1, z: 0 }; fire.aimSource = 'keyboard'; fire.left = { down: true, held: true, up: false }; fire.activeAttack = true;
    const defend = () => {
      const targets = w.infected!.active.filter(e => !e.hidden && !e.infected?.hidden && e.health.current > 0);
      const humans = [player, ...driving.roster.map(id => w.entities.get(id)).filter(e => !!e && !e.hidden && !!e.civilian)];
      const risk = (e: typeof player) => Math.min(...humans.map(h => Math.hypot(e.transform.x - h!.transform.x, e.transform.z - h!.transform.z)));
      targets.sort((a, b) => risk(a) - risk(b)); const target = targets[0];
      if (!target) return fire;
      const dx = target.transform.x - player.transform.x, dz = target.transform.z - player.transform.z, length = Math.hypot(dx, dz) || 1;
      return { ...fire, brake: true, aim: { x: dx / length, z: dz / length } };
    };
    w.applyInput(fire, 'keyboard'); for (let i = 0; i < 90; i++) w.update();
    assert.equal(shots, 0, 'the closed driving cab suppresses personal weapons');
    place(380, 0); l9.update();
    assert.notEqual(driving.stallAt, null, 'the rail stop is checkpointed and exposed');
    assert.equal(mission.state.checkpoint, 'mid-crossing');
    for (let i = 0; i < 1800; i++) { w.applyInput(defend(), 'keyboard'); w.update(); player.health.current = player.health.max; }
    assert.ok((shots) > (0), 'the hatch admits the current carried gun');
    assert.equal(driving.restarted, true, 'Sam restarts after thirty simulation seconds');
    assert.notEqual(car.entity.vehicle!.damage, 'exploded');
    place(423, 18); car.entity.health.current = 500;
    let repairDamage = 0;
    w.events.on('vehicle.durability-hit', e => { if (e.type === 'vehicle.durability-hit' && e.sourceId === car.entity.id) repairDamage += e.before - e.after; });
    const repair = emptyInput(); repair.interactHeld = true; w.applyInput(repair, 'keyboard');
    for (let i = 0; i < 120; i++) w.update();
    assert.equal(driving.repairTicks, 120, 'two seconds of held repair');
    assert.ok(Math.abs((car.entity.health.current) - (530)) < 10 ** -(3));
    w.applyInput(emptyInput(), 'keyboard'); for (let i = 0; i < 60; i++) w.update();
    assert.equal(driving.repairTicks, 120, 'release pauses the crank');
    assert.ok((car.entity.health.current) <= (530));
    w.applyInput({ ...fire, interactHeld: true }, 'keyboard');
    for (let i = 0; i < 1320; i++) { w.applyInput({ ...defend(), interactHeld: true }, 'keyboard'); w.update(); player.health.current = player.health.max; }
    assert.equal(driving.repairTicks, 1200, 'the bay has a finite twenty-second repair budget');
    assert.ok(Math.abs((car.entity.health.current + repairDamage - 500) - (300)) < 10 ** -(3), 'exactly 300 durability is restored across hold, pause and resume');
    place(457, 0); w.applyInput(fire, 'keyboard');
    for (let i = 0; i < 3000 && !driving.evacuationDone; i++) { w.applyInput(defend(), 'keyboard'); w.update(); player.health.current = player.health.max; }
    assert.equal(driving.evacuationDone, true, `the living civilians actually reach the trucks: ${JSON.stringify({ evacuated: driving.evacuated, entering: driving.truckEntering, hugAt: driving.hugAt, hugDone: driving.hugDone, roster: driving.roster.map(id => { const e = w.entities.get(id); return { id, key: e?.civilian?.survivor?.key, p: e?.transform, health: e?.health.current, passengerOf: e?.passengerOf, state: e?.civilian?.state }; }), dog: [...w.entities.iterate()].find(e => e.companion) })}`);
    const safeCount = driving.evacuated.length;
    assert.ok(safeCount > 0, "at least one protected civilian reaches a truck");
    const lost = driving.roster.filter(id => id !== driving.samId && (!w.entities.get(id)?.civilian || w.entities.get(id)!.health.current <= 0 || !!w.entities.get(id)!.infection || !!w.entities.get(id)!.infected));
    assert.equal(safeCount + lost.length, 4, "all four civilians are either visibly evacuated or actually lost");
    assert.deepEqual(car.entity.vehicle!.passengers?.filter(p => w.entities.get(p.id)?.civilian).map(p => p.id), [driving.samId], 'Sam stays aboard');
    mission.restore('bridge');
    const restored = mission.l9!.driving.state;
    assert.equal(restored.evacuationDone, true); assert.equal((restored.evacuated).length, safeCount);
    car = w.vehicles!.cars.get(l9.state.carId)!;
    place(510, 0, 10); l9.update(); assert.equal(String(l9.state.phase), 'driving', 'the far bank is not a bridge trigger');
    place(483, 0, 10, Math.PI); l9.update(); assert.equal(String(l9.state.phase), 'driving', 'driving back off the deck does not trigger the finale');
    place(483, 0, 10, .1); const before = { ...car.entity.transform };
    l9.update();
    assert.deepEqual(l9.state.from, before, 'the crash starts at the actual hull transform');
    assert.ok(Math.abs((car.entity.transform.yaw) - (.1)) < 10 ** -(2), 'no yaw reset or sideways lerp');
    w.applyInput(emptyInput(), 'keyboard');
    for (let i = 0; i < 1200 && l9.state.phase !== 'crawl'; i++) w.update();
    assert.equal(String(l9.state.phase), 'crawl');
    assert.equal(explosions, 0, 'the wreck has not exploded while she is still inside');
    const start = { ...player.transform }; for (let i = 0; i < 60; i++) w.update();
    assert.deepEqual(player.transform, start, 'no movement input means no automatic crawl');
    const resume = l9.snapshot(); l9.restore(resume); l9.rebuild();
    assert.equal(w.storyLock, null, 'a restored crawl accepts movement input');
    for (let i = 0; i < 600 && !l9.state.finished; i++) {
      const end = mission.def.anchors['crawl-end'], dx = end.x - player.transform.x, dz = end.z - player.transform.z, length = Math.hypot(dx, dz) || 1;
      const frame = emptyInput(); frame.move = { x: dx / length, z: dz / length }; w.applyInput(frame, 'keyboard'); w.update();
    }
    assert.equal(l9.state.finished, true); assert.equal(explosions, 1);
    assert.deepEqual([...new Set([...player.weapons!.LEFT.rack, ...player.weapons!.RIGHT.rack].map(s => s.id))], ['weapon.fire-axe']);
    w.applyInput(emptyInput(), 'keyboard');
    for (let i = 0; i < 360 && mission.state.phase === 'playing'; i++) w.update();
    assert.notEqual(mission.state.result, null);
    completeCampaignLevel(w.progression!.campaign!, 9, mission.state.result!, w);
    assert.equal((w.progression!.campaign!.crossingHandover!.shelteredPassengers).length, safeCount);
    assert.equal(w.progression!.campaign!.crossingHandover!.researchCompanion?.civilian?.survivor?.key, 'sam');
    passed = true;
  } catch (error) { failure = String(error); throw error; }
  finally {
    const result = { ...provenance(), method: 'Explicit native phase fixtures with initial vehicle placements and courier HP refill; civilians retain ordinary mortality. Covers mechanics, not difficulty or route completion.', passed, failure, state: w.missions!.l9!.snapshot(), player: w.getEntity(1), handover: w.progression?.campaign?.crossingHandover };
    mkdirSync('test-results/eg-l9', { recursive: true }); writeFileSync('test-results/eg-l9/story.json', `${JSON.stringify(result, null, 2)}\n`);
    console.log(JSON.stringify({ output: 'test-results/eg-l9/story.json', passed, failure, phase: w.missions!.l9!.state.phase })); w.dispose();
  }
}

await crossingStorySequence();
