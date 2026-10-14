import { readFileSync } from 'node:fs';
import { compositions } from '../../../src/levels/compositions';
import type { DistrictLayout } from '../../../src/levels/districts/types';
import { expect, test } from 'vitest';
import { SimWorld } from '../../../src/sim/world/SimWorld';
import { cure } from '../../../src/levels/L10/district';
import { validCureCheckpoint } from '../../../src/sim/progression/cureSave';
import { levelTenMission } from '../../../src/levels/L10/mission';
import { cureReached } from '../../../src/sim/missions/CureFront';
import { applyCampaign } from '../../../src/sim/progression/apply';
import { preset } from '../../../src/sim/progression/Campaign';
import { decodeSave } from '../../../src/sim/progression/Save';
import { infectedDefinitions } from '../../../src/data/infected';
import { installMegaPursuit } from '../../../src/sim/ai/MegaPursuit';

async function ready(scenario = 'mega-course') {
  const world = new SimWorld(); await world.init();
  if (scenario === 'L10') world.loadComposition(compositions.L10, [JSON.parse(readFileSync('public/assets/layouts/D-CURE.layout.json', 'utf8')) as DistrictLayout], 32);
  else world.loadScenario(scenario);
  applyCampaign(world, preset('L10-default'));
  const at = scenario === 'L10' ? { x: cure.anchors['cure-console'][0], z: cure.anchors['cure-console'][1] } : { x: 0, z: 0 };
  const mission = world.loadMission(levelTenMission(() => ({ ...at, radius: 2 })));
  mission.begin(); mission.loadCheckpoint('cure-disperse-ready');
  Object.assign(world.entities.get(1)!.transform, at); world.physics.playerBody!.setTranslation(world.entities.get(1)!.transform, true);
  world.chunks?.update([at.x, at.z]);
  Object.assign(mission.state.states, { 'charge-active': true, 'charge-ready': true, 'mega-dead': true });
  mission.state.counters['charge-ticks'] = 3600;
  mission.state.steps.hold.status = 'completed'; mission.state.steps.release.status = 'active';
  if (world.megaPursuit) { const id = world.megaPursuit.introduce(at); world.entities.get(id)!.health.current = 0; world.entities.get(id)!.infected!.recoverAt = -1; world.megaPursuit.state.mode = 'dead'; }
  return { world, mission, release() { world.setInput({ interact: true }); world.update(); world.clearInput(); } };
}

test('T-E32-23-S8 @E32-AC23 explicit expanding front kills every infected species, downed and remaining Mega; no recovery or conversion', async () => {
  const { world: w, mission: m, release } = await ready();
  try {
    const ids = infectedDefinitions.map((d, i) => w.infected!.spawn(d.id, { x: 12 + i * 3, z: 12 }, { offNav: true }));
    const downed = w.entities.get(ids[0])!; downed.health.current = 0; downed.infected!.recoverAt = w.tick + 600;
    for (const id of ids) { const e = w.entities.get(id)!; e.infected!.scripted = { x: e.transform.x, z: e.transform.z }; }
    const cat = ids.map(id => w.entities.get(id)!).find(e => e.archetype === 'infected.cat')!;
    cat.transform.y = 2.2; cat.hidden = true;
    expect(m.state.cureFront).toBeUndefined();
    release(); expect(m.state.states['cure-released']).toBe(true);
    // A remaining coarse Mega record after explicit release must bypass its conventional HP floor.
    const mega = installMegaPursuit(w, { introduceTick: null, route: { nodes: [{ id: 'a', x: 0, z: 0 }, { id: 'b', x: 10, z: 0 }], links: [['a', 'b']] } });
    const boss = mega.introduce({ x: 15, z: -10 });
    expect(w.entities.get(ids[1])!.health.current).toBeGreaterThan(0);
    for (let i = 0; i < 600; i++) {
      w.update();
      for (const id of [...ids, boss]) { const e = w.entities.get(id)!; if (cureReached(m.state.cureFront!, e.transform)) expect(e.health.current).toBe(0); }
    }
    for (const id of [...ids, boss]) { const e = w.entities.get(id)!; expect(e.health.current).toBe(0); expect(e.infected!.recoverAt).toBe(-1); expect(e.infected!.state).toBe('dead'); }
    expect(cat.hidden).not.toBe(true); expect(w.entities.get(cat.id)!.transform.y).toBeCloseTo(.7);
    expect(mega.state.hp).toBe(0); expect(mega.state.mode).toBe('dead');
    expect(m.state.cureFront!.radius).toBeCloseTo(100);
    for (let i = 0; i < 720; i++) w.update();
    for (const id of ids) { expect(w.entities.get(id)!.corpse).toBe(true); expect(w.entities.get(id)!.faction).toBe('infected'); }
    expect(w.events.events().filter(e => e.type === 'combat.kill' && e.actionId === 'cure').length).toBe(ids.length + 1);
    expect(w.events.events().some(e => e.type === 'infected.recovered' || e.type === 'explosion')).toBe(false);
  } finally { w.dispose(); }
});

test('T-E32-23-exclusions-S8 @E32-AC23 healthy people/animals, player and corgi excluded; particles/quality never decide death', async () => {
  for (const tier of ['high', 'low'] as const) {
    const { world: w, release } = await ready();
    try {
      w.infected!.director.setTier(tier);
      const corgi = w.npcs!.companion.spawn();
      const healthy = w.spawnDummy('healthy', { x: 0, z: 0 }, { faction: 'escort', hp: 100 });
      const animal = w.spawnDummy('healthy.animal', { x: 0, z: 0 }, { faction: 'escort', hp: 100 });
      const ids = [1, corgi, healthy, animal]; const hp = ids.map(id => w.entities.get(id)!.health.current);
      const dog = w.infected!.spawn('infected.dog', { x: 3, z: 0 }, { offNav: true });
      const flock = w.infected!.spawn('infected.crow', { x: 4, z: 0 }, { offNav: true, birds: 4 });
      release(); for (let i = 0; i < 30; i++) w.update();
      expect(w.entities.get(dog)!.health.current).toBe(0);
      expect(w.entities.get(flock)!.infected!.birdDeadMask).toBe(15); expect(w.entities.get(flock)!.infected!.birds).toBe(0);
      expect(ids.map(id => w.entities.get(id)!.health.current)).toEqual(hp);
      expect(ids.some(id => w.entities.get(id)!.corpse)).toBe(false);
    } finally { w.dispose(); }
  }
});

test('T-E32-24/25-once-S8 @E32-AC24 @E32-AC25 release/retry/load permanent, campaign cleared once, approaching attacks/spawners suppressed', async () => {
  const { world: w, mission: m, release } = await ready();
  try {
    const id = w.infected!.spawn('infected.runner', { x: 30, z: 0 }, { offNav: true });
    release(); const cleared = structuredClone(w.progression!.campaign!.world!.infectionCleared);
    expect(w.entities.get(id)!.health.current).toBeGreaterThan(0);
    const hit = { attackId: 3, actionId: 'infected.bite', sourceId: id, targetId: 1, origin: { x: 0, z: 0 }, direction: { x: 1, z: 0 }, base: 1000, multiplier: 1, type: 'melee' as const, knockback: 4, stagger: 3 };
    const hp = w.entities.get(1)!.health.current;
    expect(w.combat!.damage.apply(hit)).toBe(0); expect(w.entities.get(1)!.health.current).toBe(hp);
    w.infected!.director.request('infected.runner', { x: 40, z: 0 });
    w.setInput({ interact: true }); for (let i = 0; i < 60; i++) w.update(); w.clearInput();
    expect(w.infected!.director.queue).toHaveLength(0);
    const front = structuredClone(m.state.cureFront);
    m.restore('cure-disperse-ready'); expect(m.state.cureFront).toEqual(front);
    const campaign = structuredClone(w.progression!.campaign!); campaign.cureResume = m.saveResume();
    expect(validCureCheckpoint(campaign.cureResume.current), 'current resume validator').toBe(true);
    expect(validCureCheckpoint(campaign.cureResume.checkpoint), 'retry resume validator').toBe(true);
    const decoded = decodeSave(JSON.stringify(campaign)); expect(decoded.status).toBe('ok');
    if (decoded.status === 'ok') { m.loadResume(decoded.save.cureResume!); m.loadResume(decoded.save.cureResume!); }
    expect(m.state.cureFront).toEqual(front); expect(w.progression!.campaign!.world!.infectionCleared).toEqual(cleared);
    expect(w.events.events().filter(e => e.type === 'mission.signal' && e.name === 'cure-released')).toHaveLength(1);
    w.setInput({ move: { x: 1, z: 0 } }); const x = w.entities.get(1)!.transform.x; for (let i = 0; i < 60; i++) w.update();
    expect(w.entities.get(1)!.transform.x).toBeGreaterThan(x);
  } finally { w.dispose(); }
});

test('T-E32-24-unloaded-S8 @E32-AC24 sleeping infected die in snapshots and survive five revisits without loading regions', async () => {
  const { world: w, mission: m, release } = await ready('L10');
  try {
    // The custom console is at the origin; put a compact record in a known nonresident L10 chunk.
    const chunk = w.chunks!.chunks.find(c => !w.chunks!.resident(c.origin[0] + 50, c.origin[1] + 50))!;
    const at = { x: chunk.origin[0] + 50, z: chunk.origin[1] + 50 };
    const id = w.infected!.spawn('infected.dog', at, { offNav: true });
    w.chunks!.update([w.entities.get(1)!.transform.x, w.entities.get(1)!.transform.z]); expect(w.entities.get(id)).toBeUndefined();
    release(); const resident = w.chunks!.stats().resident;
    const f = m.state.cureFront!; f.elapsed = Math.ceil(Math.hypot(at.x - f.fronts[0].x, at.z - f.fronts[0].z) * 6) + 1; f.radius = f.elapsed / 6;
    m.l10!.cure.apply();
    const saved = [...w.chunks!.inactiveEntities()].find(e => e.id === id)!;
    expect(saved.health.current).toBe(0); expect(saved.corpse).toBe(true); expect(saved.infected!.recoverAt).toBe(-1);
    expect(w.chunks!.stats().resident).toBe(resident); expect(f.affectedIds).toContain(id);
    for (let i = 0; i < 5; i++) {
      w.chunks!.update([at.x, at.z]); expect(w.entities.get(id)!.health.current).toBe(0);
      w.chunks!.update([f.fronts[0].x, f.fronts[0].z]); expect([...w.chunks!.inactiveEntities()].find(e => e.id === id)!.corpse).toBe(true);
      const savedResume = m.saveResume(); m.loadResume(savedResume);
    }
    expect(f.affectedIds.filter(x => x === id)).toHaveLength(1);
  } finally { w.dispose(); }
});

test('T-E32-24-zoo-S8 @E32-AC24 cleared campaign kills subsequently visited zoo infected without harming healthy animals', async () => {
  const { world: w, release } = await ready();
  try {
    release(); const campaign = structuredClone(w.progression!.campaign!);
    w.loadScenario('mega-course'); applyCampaign(w, campaign);
    const id = w.infected!.spawn('infected.elephant', { x: 5, z: 0 }, { offNav: true });
    w.update(); expect(w.entities.get(id)!.health.current).toBe(0); expect(w.entities.get(id)!.infected!.recoverAt).toBe(-1);
  } finally { w.dispose(); }
});

test('T-E32-23-front-S8 @E32-AC23 route branch delay and boundary use authoritative metre distance', () => {
  const front = { releasedAt: 0, elapsed: 60, radius: 10, affectedIds: [], fronts: [{ x: 0, z: 0, distance: 0 }, { x: 100, z: 0, distance: 20 }] };
  expect(cureReached(front, { x: 10, z: 0 })).toBe(true);
  expect(cureReached(front, { x: 10.01, z: 0 })).toBe(false);
  expect(cureReached(front, { x: 100, z: 0 })).toBe(false);
  front.radius = 20; expect(cureReached(front, { x: 100, z: 0 })).toBe(true);
});


test('T-E32-23-flag-S8 @E32-AC23 infected flag governs future types and retained civilian appearances', async () => {
  const { world: w, mission: m, release } = await ready();
  try {
    const template = w.infected!.spawn('infected.runner', { x: 12, z: 0 }, { offNav: true });
    const future = w.spawnDummy('infected.future-type', { x: 3, z: 0 }, { armor: 1 });
    const civilian = w.npcs!.civilians.spawn('adult', { x: -3, z: 0 });
    for (const id of [future, civilian]) w.entities.get(id)!.infected = structuredClone(w.entities.get(template)!.infected!);
    release(); for (let i = 0; i < 60; i++) w.update();
    for (const id of [future, civilian]) {
      expect(w.entities.get(id)!.health.current).toBe(0); expect(w.entities.get(id)!.infected!.recoverAt).toBe(-1);
      expect(m.state.cureFront!.affectedIds).toContain(id);
    }
    expect(w.entities.get(civilian)!.civilian!.state).toBe('finished');
  } finally { w.dispose(); }
});


test('T-E32-24-fresh-clock-S8 @E32-AC24 early fall resumes on a fresh clock without replaying death/release', async () => {
  const first = await ready(), second = await ready();
  try {
    first.world.tick = 600;
    const id = first.world.infected!.spawn('infected.runner', { x: 1, z: 0 }, { offNav: true });
    first.release(); for (let i = 0; i < 10; i++) first.world.update();
    const body = first.world.entities.get(id)!;
    expect(body.health.current).toBe(0); expect(body.corpse).not.toBe(true);
    const age = first.world.tick - body.infected!.deadAt;
    const saved = first.mission.saveResume(); second.mission.loadResume(saved);
    expect(second.world.tick - second.world.entities.get(id)!.infected!.deadAt).toBe(age);
    expect(second.mission.state.cureFront).toEqual(saved.current.state.cureFront);
    for (let i = 0; i < 130; i++) second.world.update();
    expect(second.world.entities.get(id)!.corpse).toBe(true);
    expect(second.world.events.events().some(e => e.type === 'combat.kill' && e.actionId === 'cure' || e.type === 'mission.signal' && e.name === 'cure-released')).toBe(false);
  } finally { first.world.dispose(); second.world.dispose(); }
});


test('T-E32-25-pending-S8 @E32-AC25 pending lion pins and civilian grabs cannot continue beyond release before mist contact', async () => {
  const { world: w, release } = await ready();
  try {
    const lion = w.infected!.spawn('infected.lion', { x: 30, z: 0 }, { offNav: true });
    const grabber = w.infected!.spawn('infected.runner', { x: 32, z: 0 }, { offNav: true });
    const civilian = w.npcs!.civilians.spawn('adult', { x: 32.5, z: 0 });
    expect(w.npcs!.civilians.grab(civilian, grabber, true)).toBe(true);
    release();
    // A resumed/in-flight attack can retain these legacy fields while its attacker is still outside the front.
    const pin = w.entities.get(lion)!.infected!; pin.grabUntil = w.tick + 300; pin.heardTargetId = 1;
    w.entities.get(1)!.combat!.staggerUntil = pin.grabUntil;
    expect(w.npcs!.civilians.grab(civilian, grabber, true)).toBe(false);
    w.update();
    expect(w.entities.get(lion)!.health.current).toBeGreaterThan(0); expect(pin.grabUntil).toBe(0);
    expect(w.entities.get(1)!.combat!.staggerUntil).toBeLessThanOrEqual(w.tick);
    expect(w.entities.get(civilian)!.civilian!.state).not.toBe('grabbed');
    expect(w.npcs!.civilians.holds(grabber)).toBe(false);
    for (let i = 0; i < 60; i++) w.update();
    expect(w.entities.get(civilian)!.health.current).toBeGreaterThan(0);
    expect(w.entities.get(civilian)!.infected).toBeUndefined();
  } finally { w.dispose(); }
});
