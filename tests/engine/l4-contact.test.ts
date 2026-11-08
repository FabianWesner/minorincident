import { expect, test, vi } from 'vitest';
import { emptyInput } from '../../src/input/InputFrame';
import { Box3, PerspectiveCamera, Vector3 } from 'three/webgpu';
import { ColliderDesc, Ray, ShapeType } from '@dimforge/rapier3d-compat';
import { l4, l4InfectedArchetypes, l4Route, l4RoutePose, l4ConvoyStations, l4ConvoyParkOffsetX } from '../../src/data/l4';
import physicsAssets from '../../src/data/physicsAssets';
import { l4PerimeterWalls } from '../../src/data/l4Perimeter';
import { infectedDef } from '../../src/data/infected';
import { barEligible, followerBarsAlwaysMax, followerPipSize, HealthBars } from '../../src/render/HealthBars';
import { pickBodies } from '../../src/render/characters/PickBodies';
import { updateAlly } from '../../src/sim/outbreak/Allies';
import { respawnAtCheckpoint } from '../../src/sim/missions/Respawn';
import { loadL4 } from '../../tools/sim-runner/l4Bots';
import { loadLevel } from '../../tools/sim-runner/levels';
import type { SimWorld } from '../../src/sim/world/SimWorld';
import type { EntitySnapshot } from '../../src/sim/world/types';
import type { Refuge } from '../../src/sim/outbreak/Outbreak';
import { obbHitsAabb } from '../qa/invariants/oracles';

type RefugeInternals = {
  refugeSpot: (person: EntitySnapshot, door: Refuge) => { x: number; z: number } | null;
  flee: (person: EntitySnapshot) => void;
};

function checkCompactFollowerOverlap(): void {
  const followers = Array.from({ length: 6 }, (_, i) => ({ id: 16 + i, faction: 'civilian', health: { current: 60, max: 60 }, transform: { x: 500, y: .7, z: 500 }, civilian: { state: 'calm', survivor: { mode: 'follow' } } }));
  const player = { id: 1, transform: { x: 500, y: .7, z: 500 } };
  const all = [player, ...followers];
  const world = { scenario: 'L6', entities: { iterate: () => all.values(), get: (id: number) => all.find(e => e.id === id) }, physics: { world: null } } as unknown as SimWorld;
  const camera = new PerspectiveCamera(25, 1280 / 720, .1, 600);
  camera.position.set(500, 4, 510); camera.lookAt(500, .8, 500); camera.updateMatrixWorld();
  const body = new Box3(new Vector3(499.7, 0, 499.7), new Vector3(500.3, 1, 500.3));
  const hero = new Box3(new Vector3(499.3, 0, 499.3), new Vector3(500.7, 2, 500.7));
  const bounds = vi.spyOn(pickBodies, 'bounds').mockImplementation((id, out) => id === 16 ? out.copy(body) : null);
  const top = vi.spyOn(pickBodies, 'top').mockImplementation(id => id === 16 ? new Vector3(500, 1, 500).project(camera).y : null);
  vi.stubGlobal('location', { search: '?test=1' });
  const bars = new HealthBars(world, out => { out.copy(hero); return true; });
  try {
    bars.update(camera, 1280, 720);
    expect(bars.count).toBe(1);
    const bar = bars.snapshot().bars[0];
    expect(bar).toMatchObject({ id: 16, width: 18, height: 3 });
    const heroTop = Math.min(...[hero.min.x, hero.max.x].flatMap(x => [hero.min.y, hero.max.y].flatMap(y => [hero.min.z, hero.max.z].map(z => (1 - new Vector3(x, y, z).project(camera).y) * 360))));
    expect(bar.y + bar.height / 2).toBeLessThan(heroTop);
  } finally { bars.dispose(); bounds.mockRestore(); top.mockRestore(); vi.unstubAllGlobals(); }
}

async function scriptedPartyEngagement() {
  for (const level of ['L3', 'L4', 'L5', 'L6', 'L7'] as const) {
    const w = await loadLevel(level, 1);
    try {
      if (level === 'L4') w.missions!.loadCheckpoint('turn');
      if (level === 'L3') {
        const m = w.missions!, s = m.state.l3!, armory = m.def.anchors['l3-armory'];
        const sergeant = w.entities.get(s.squadIds[0])!;
        expect(Math.hypot(sergeant.transform.x - armory.x, sergeant.transform.z - armory.z), 'briefing leaves the armory approach clear').toBeGreaterThan(3.5);
        m.l3!.completed('defend');
        for (let wave = 0; wave < 3; wave++) {
          const cohort = s.waves.filter(q => q.wave === wave);
          expect(cohort.filter(q => q.dir === 'station').length, 'exactly one in five wave members comes from the station').toBe(cohort.length / 5);
          expect(new Set(cohort.map(q => q.dir)).size, 'every wave uses all five directions').toBe(5);
        }
        expect(s.squad).toHaveLength(4);
        expect(s.officerIds.filter(id => !!w.entities.get(id)?.civilian?.ally?.follow), 'six gate officers do not join the escort').toHaveLength(4);
        expect(new Set(s.squad.map(q => w.entities.get(q.id)!.civilian!.ally!.follow!.moveMs)).size, 'every squad slot has the same walking pace').toBe(1);
        for (const q of s.squad) expect(w.entities.get(q.id)!.civilian!.ally!.follow).toMatchObject({ minM: 3, maxM: 6 });
        const courier = w.entities.get(1)!, at = { ...sergeant.transform }, facing = courier.transform.yaw;
        const targetId = w.infected!.spawn('infected.runner', { x: courier.transform.x + 8, z: courier.transform.z });
        Object.assign(sergeant.transform, { x: courier.transform.x - 4, z: courier.transform.z });
        courier.survivor!.velocity.x = 4;
        courier.transform.yaw = Math.PI;
        sergeant.civilian!.ally!.targetId = targetId;
        sergeant.civilian!.ally!.nextAttack = w.tick + 120;
        sergeant.civilian!.ally!.follow!.breakoutUntil = w.tick - 1;
        const sight = vi.spyOn(w.combat!.query, 'shotVisible').mockReturnValue(true);
        const movement = vi.spyOn(w.npcs!, 'move').mockReturnValue(true);
        const clear = vi.spyOn(w.infected!.nav, 'clear').mockReturnValue(true);
        const visible = vi.spyOn(w.infected!.nav, 'visible').mockReturnValue(true);
        try {
          updateAlly(w, sergeant, () => true);
          expect(movement, 'firing inside the follow band must keep the formation walking at its follow pace').toHaveBeenCalledWith(sergeant, expect.any(Object), sergeant.civilian!.ally!.follow!.moveMs, sergeant.civilian, expect.any(Number));
          expect(movement.mock.calls[0][1].x, 'aiming backwards must not swing the moving formation ahead of the courier').toBeLessThan(courier.transform.x);
          movement.mockClear();
          Object.assign(sergeant.transform, { x: courier.transform.x - 2, z: courier.transform.z });
          updateAlly(w, sergeant, () => true);
          expect(movement, 'clearing the moving courier inside the band keeps the same squad pace').toHaveBeenCalledWith(sergeant, expect.any(Object), sergeant.civilian!.ally!.follow!.moveMs, sergeant.civilian, .15);
          Object.assign(sergeant.transform, { x: courier.transform.x - 7, z: courier.transform.z });
          Object.assign(w.entities.get(targetId)!.transform, { x: sergeant.transform.x + 1, z: sergeant.transform.z });
          const retreating = sergeant.civilian!.ally!;
          retreating.engaged = false; retreating.targetId = 0; retreating.strikeAt = 0;
          retreating.nextAttack = w.tick; retreating.step = undefined;
          updateAlly(w, sergeant, () => true);
          expect(retreating.baton, 'a straggler outside the follow band can shove a contact attacker while the courier runs').toBe(true);
          expect(retreating.strikeTarget).toBe(targetId);
          expect(retreating.strikeAt).toBeGreaterThan(w.tick);
          const retreat = m.l3! as unknown as { spill(at: { x: number; z: number }): void; emergePending(all?: boolean): void; emerge(): number };
          const saved = { phase: s.phase, pending: s.pending, spillIds: s.spillIds, spills: s.spills, courier: { ...courier.transform } };
          const hidden = vi.spyOn(w.infected!.director, 'offscreen').mockReturnValue(true);
          const admission = vi.spyOn(retreat, 'emerge').mockReturnValue(targetId);
          const pursuit = vi.spyOn(w.infected!, 'press').mockReturnValue(true);
          try {
            s.phase = 'corridor'; s.pending = []; s.spillIds = []; s.spills = {};
            Object.assign(courier.transform, { x: -55, z: 30 });
            Object.assign(sergeant.transform, { x: -15, z: 0 });
            retreat.spill({ x: -15, z: 0 });
            expect(s.pending.length, 'authored side-street cohort is planned').toBeGreaterThan(0);
            expect(s.pending.every(q => q.targetId === sergeant.id), 'spill keeps its officer identity').toBe(true);
            sergeant.transform.x += 12;
            retreat.emergePending(true);
            expect(pursuit, 'arrival pursues the officer who moved after the shot').toHaveBeenCalledWith(targetId, sergeant.id, w.tick + 90 * 60);
          } finally {
            hidden.mockRestore(); admission.mockRestore(); pursuit.mockRestore();
            s.phase = saved.phase; s.pending = saved.pending; s.spillIds = saved.spillIds; s.spills = saved.spills;
            Object.assign(courier.transform, saved.courier);
          }

        } finally { sight.mockRestore(); movement.mockRestore(); clear.mockRestore(); visible.mockRestore(); courier.transform.yaw = facing; courier.survivor!.velocity.x = 0; Object.assign(sergeant.transform, at); w.infected!.release(w.entities.get(targetId)!); }
        const biter = w.infected!.spawn('infected.runner', { x: sergeant.transform.x + 1, z: sergeant.transform.z });
        const wave = s.waves.find(q => q.dir === 'station')!;
        wave.id = biter;
        w.infected!.press(biter, courier.id, w.tick + 1800, 4);
        const brain = w.entities.get(biter)!.infected!.l1!;
        brain.search.completeApproach = true;
        expect(brain.focusId).toBe(courier.id);
        (m.l3! as unknown as { fallback(cause: 'time'): void }).fallback('time');
        expect(brain.focusId, 'fallback releases the scripted courier preference').toBeUndefined();
        expect(brain.focusUntil).toBeUndefined();
        expect(brain.focusBiasM).toBeUndefined();
        expect(brain.search.completeApproach, 'ordinary senses may interrupt the released approach').toBe(false);
        expect(brain.search.until).toBeLessThanOrEqual(w.tick);
        const beforeRefresh = w.tick;
        const focus = vi.spyOn(w.infected!, 'press');
        const exit = vi.spyOn(w.infected!, 'rush');
        const outside = vi.spyOn(w.infected!.director, 'offscreen').mockReturnValue(true);
        try {
          w.tick = Math.ceil((w.tick + 1) / 120) * 120;
          m.l3!.update();
          expect(focus, 'periodic fallback refresh and late arrivals never renew courier focus').not.toHaveBeenCalled();
          expect(exit, 'late arrivals retain an interruptible finite doorway exit').toHaveBeenCalled();
          for (const q of s.waves.filter(q => q.id)) {
            const arrival = w.entities.get(q.id)?.infected?.l1;
            if (arrival) {
              expect(arrival.focusId).toBeUndefined();
              expect(arrival.search.completeApproach).toBe(false);
            }
          }
        } finally { focus.mockRestore(); exit.mockRestore(); outside.mockRestore(); w.tick = beforeRefresh; }
        w.events.emit({ type: 'outbreak.bite', tick: w.tick, sourceId: biter, targetId: sergeant.id, position: { x: sergeant.transform.x, z: sergeant.transform.z }, turns: true });
        expect(s.squad).toHaveLength(3);
        expect(sergeant.civilian!.ally!.follow, 'a recorded bite loss immediately retires its escort role').toBeUndefined();
        expect(s.lost.at(-1)).toMatchObject({ id: sergeant.id, cause: 'bite' });
      }

      w.storyLock = null;
      const ai = w.infected!, p = w.entities.get(1)!;
      vi.spyOn(ai.director, 'update').mockImplementation(() => {});
      for (const e of [...ai.active]) ai.release(e);
      for (const e of w.entities.iterate()) if (e.civilian || e.companion) e.hidden = true;
      delete p.hidden; delete p.passengerOf; delete p.attachedTo;
      w.physics.playerCollider!.setEnabled(true);
      const nav = ai.nav;
      let cell = -1, best = Infinity;
      for (let i = 0; i < nav.blocked.length; i++) {
        const x = nav.x(i), z = nav.z(i), d = Math.hypot(x - p.transform.x, z - p.transform.z);
        if (d < best && [-1, 0, 1].every(dz => [0, 2, 4, 6, 8].every(dx => nav.clear(x + dx, z + dz, .5))) && nav.visible({ x, z }, { x: x + 8, z }, .4)) { cell = i; best = d; }
      }
      expect(cell, `${level} open approach lane`).toBeGreaterThanOrEqual(0);
      const start = { x: nav.x(cell), z: nav.z(cell) };
      for (const route of ['script', 'rush'] as const) {
        Object.assign(p.transform, { ...start, y: .7 + (w.districts?.pavingHeight(start.x, start.z) ?? 0) });
        w.physics.playerBody!.setTranslation(p.transform, true); w.physics.playerBody!.setNextKinematicTranslation(p.transform);
        p.health.current = p.health.max; w.player!.locomotion.reset();
        const group = [-1, 0, 1].map(z => {
          const e = w.entities.get(ai.spawn('infected.runner', { x: start.x + 5, z: start.z + z }, { yaw: Math.PI }))!;
          if (route === 'script') e.infected!.scripted = { x: start.x + 12, z: start.z + z };
          else ai.rush(e.id, { x: start.x + 12, z: start.z + z }, w.tick + 600, true);
          return e;
        });
        const seen = new Set<number>();
        for (let tick = 0; tick < 120 && seen.size < group.length; tick++) {
          w.applyInput({ ...emptyInput(), move: { x: .3, z: 0 }, strafe: true, aim: { x: 1, z: 0 }, aimPoint: { x: start.x + 8, z: start.z } }, 'mouse-keyboard');
          w.update();
          for (const e of group) if (!e.infected!.scripted && (e.infected!.heardTargetId === 1 || e.infected!.l1?.targetId === 1) && ['chase', 'attack'].includes(e.infected!.state)) seen.add(e.id);
        }
        expect(seen.size, `${level} ${route}: all three directed infected notice WASD courier within 2 s`).toBe(group.length);
        group.forEach(e => ai.release(e));
      }
      const noisy = w.entities.get(ai.spawn('infected.runner', { x: start.x + 5, z: start.z }, { yaw: 0 }))!;
      noisy.infected!.scripted = { x: start.x + 12, z: start.z };
      ai.noise(start, 10, false, 1);
      expect(noisy.infected!.scripted, `${level}: a heard courier shot interrupts travel`).toBeUndefined();
      ai.release(noisy);
      if (level === 'L3' || level === 'L4' || level === 'L6') {
        Object.assign(p.transform, start);
        const bystanderId = w.npcs!.escorts.spawn({ x: start.x + 2, z: start.z });
        const bystander = w.entities.get(bystanderId)!;
        bystander.escort!.order = bystander.escort!.state = 'wait';
        for (const archetype of level === 'L4' ? l4InfectedArchetypes : ['infected.runner']) {
          const arrival = w.entities.get(ai.spawn(archetype, { x: start.x + 3, z: start.z }, { yaw: Math.PI }))!;
          ai.press(arrival.id, 1, w.tick + 600, 1);
          if (arrival.infected!.l1) arrival.infected!.l1.search.completeApproach = true;
          w.combat!.damage.apply({ sourceId: bystanderId, targetId: arrival.id, attackId: 0, actionId: 'weapon.pistol', origin: bystander.transform, direction: { x: 1, z: 0 }, base: 1, multiplier: 1, type: 'bullet', stagger: 0, knockback: 0 });
          const attacks = new Set<number>();
          const stop = w.events.on('infected.attack', e => { if (e.type === 'infected.attack' && e.sourceId === arrival.id) attacks.add(e.targetId); });
          const grab = w.events.on('civilian.grabbed', e => { if (e.type === 'civilian.grabbed' && e.sourceId === arrival.id) attacks.add(e.targetId); });
          const windup = w.events.on('telegraph', e => { if (e.type === 'telegraph' && e.sourceId === arrival.id && e.target) attacks.add(e.target.id); });
          for (let tick = 0; tick < 180 && !attacks.has(bystanderId); tick++) { w.tick++; ai.update(); }
          stop(); grab(); windup();
          expect(attacks.has(bystanderId), `${level}/${archetype}: finite courier focus retains normal perception and attacks the closer follower (G-18)`).toBe(true);
          ai.release(arrival);
        }
        bystander.hidden = true;
        if (level === 'L4') {
          const routed = w.entities.get(ai.spawn('infected.firefighter', { x: start.x + 8, z: start.z }))!;
          ai.press(routed.id, 1, w.tick + 600);
          routed.infected!.scripted = { ...start }; routed.infected!.breachApproach = 'inside';
          const until = routed.infected!.pressureTarget!.until;
          ai.restoreSpecialTimers(routed.infected!, 60);
          expect(routed.infected!.pressureTarget!.until).toBe(until + 60);
          w.tick++; ai.update();
          expect(routed.infected!.scripted, 'remote hearing must retain the routed courtyard approach').toBeDefined();
          Object.assign(routed.transform, { x: start.x + 1, z: start.z });
          w.tick++; ai.update();
          expect(routed.infected!.scripted, 'close visible contact releases the routed leg').toBeUndefined();
          respawnAtCheckpoint(w, start);
          expect(routed.infected!.pressureTarget, 'respawn drops the finite courier assignment during grace').toBeUndefined();
          ai.release(routed);
        }

      }
      Object.assign(p.transform, { x: start.x - 30, z: start.z });
      const escortId = w.npcs!.escorts.spawn(start), escort = w.entities.get(escortId)!;
      escort.escort!.order = escort.escort!.state = 'wait';
      const pursuer = w.entities.get(ai.spawn('infected.runner', { x: start.x + 1, z: start.z }, { yaw: Math.PI }))!;
      pursuer.infected!.scripted = { x: start.x + 12, z: start.z };
      for (let t = 0; t < 120; t++) { w.tick++; ai.update(); }
      expect(pursuer.infected!.scripted, `${level}: escort contact interrupts travel`).toBeUndefined();
      expect(pursuer.infected!.heardTargetId || pursuer.infected!.l1?.targetId, `${level}: escort is a normal human target`).toBe(escortId);
    } finally { w.dispose(); vi.restoreAllMocks(); }
  }
}

test('L4: every contact archetype interrupts approach/lure and attacks within 3 s; soldiers remain biteable and corgi protected', async () => {
  const cameraCheck = await loadLevel('L4', 1);
  try {
    expect(Object.keys(cameraCheck.missions!.def.cinematics).filter(id => id.startsWith('l4-'))).toEqual([]);
    expect(cameraCheck.missions!.def.anchors['l4-breach-west']).toBeDefined();
  } finally { cameraCheck.dispose(); }
  const route = l4Route(), stations = l4ConvoyStations(route.length), violations: string[] = [];
  for (const [index, vehicle] of l4.convoy.vehicles.entries()) {
    if (vehicle.asset !== 'veh.military-truck') continue;
    const pose = l4RoutePose(route, stations.end[index]); pose.x += l4ConvoyParkOffsetX;
    for (const [boxIndex, box] of physicsAssets['veh.military-truck'].boxes.entries()) for (const wall of l4PerimeterWalls) {
      const aabb = { min: [wall.x - wall.halfX, wall.y - wall.halfY, wall.z - wall.halfZ], max: [wall.x + wall.halfX, wall.y + wall.halfY, wall.z + wall.halfZ] };
      if (obbHitsAabb(pose.x, pose.z, pose.yaw, (box.max[0] - box.min[0]) / 2, (box.max[2] - box.min[2]) / 2, box.min[1] + .7, box.max[1] + .7, aabb)) violations.push(`${vehicle.id} collider ${boxIndex} overlaps ${wall.id}`);
    }
  }
  expect(violations, 'PO 2026-11-08: parked army cargo trucks do not cross the perimeter').toEqual([]);
  checkCompactFollowerOverlap();
  expect(followerBarsAlwaysMax, 'five-person groups retain full bars').toBe(5);
  expect(followerPipSize, 'larger groups use thin, short pips').toEqual({ width: 18, height: 3 });
  await scriptedPartyEngagement();
  const { world, mission } = await loadL4(1, 'low');
  try {
    mission.loadCheckpoint('turn');
    const ai = world.infected!, courier = world.entities.get(1)!;
    vi.spyOn(ai.director, 'update').mockImplementation(() => {});
    for (const e of [...ai.active]) ai.release(e);
    const rail = [...world.entities.iterate()].find(e => e.barricade?.slot.id === 'l4-wall-7')!;
    expect(rail?.barricade?.intact).toBe(true);
    const railAt = rail.transform;
    for (const archetype of l4InfectedArchetypes.filter(a => a !== 'infected.crawler')) {
      const climber = world.entities.get(ai.spawn(archetype, { x: railAt.x, z: railAt.z - 1.1 }))!;
      const occupiedLanding = { x: railAt.x, z: railAt.z + .9, y: 1, halfY: 1, halfX: 1, halfZ: .6 };
      ai.infectedNav.setBlocker(990_401, occupiedLanding, true);
      expect(world.barricades!.vault(climber, rail), `${archetype}: occupied landing cannot start a vault`).toBe(false);
      expect(climber.infected!.vault).toBeUndefined();
      ai.infectedNav.setBlocker(990_401, occupiedLanding, false);
      expect(world.barricades!.vault(climber, rail), `${archetype}: enters the authored wire vault`).toBe(true);
      const vault = climber.infected!.vault!;
      world.tick = vault.started + 18;
      world.barricades!.vault(climber);
      expect(climber.transform.z, 'lift before crossing the full-height wire').toBeCloseTo(vault.from.z);
      expect(climber.transform.y).toBeGreaterThan(1.12 + .35);
      world.tick = vault.started + 60;
      world.barricades!.vault(climber);
      expect(climber.transform.z).toBeGreaterThan(railAt.z);
      expect(climber.infected!.vault).toBeUndefined();
      ai.release(climber);
    }
    Object.assign(courier.transform, { x: -17, z: 3 });
    const distraction = world.spawnDummy('test.noise-source', { x: -27, z: 3 }, { faction: 'environment' });
    // Bite/script conversion keeps the person's identity but must receive the
    // same health/bar/damage contract as pooled, scripted and director spawns.
    const outbreak = world.npcs!.civilians.outbreak!;
    for (const model of ['npc.national-guard', 'npc.firefighter-alive', 'npc.civilian-man-a']) {
      const e = world.entities.get(outbreak.spawnPedestrian({ x: -16, z: 3 }, { model }))!;
      outbreak.turnNow(e); e.transform.yaw = Math.PI;
      expect(barEligible(e, courier.transform, infectedDef(e.archetype).bar === true), `converted ${model} has a bar`).toBe(true);
      expect(world.combat!.damage.apply({ attackId: e.id, actionId: 'weapon.army-mg', sourceId: 1, targetId: e.id,
        origin: { x: e.transform.x + 3, z: e.transform.z }, direction: { x: -1, z: 0 }, base: 1, multiplier: 1, type: 'bullet', knockback: 0, stagger: 0 }), `converted ${model} takes flank damage`).toBeGreaterThan(0);
      ai.release(e);
    }
    const soldier = world.entities.get(mission.state.l4!.soldierIds[1])!;
    Object.assign(soldier.transform, { x: -15, z: 5 });
    // A healthy shielded threat stays eligible beyond the ordinary 15 m
    // healthy-infected cutoff; this is the normal-zoom L4 riot-bar control.
    const distantRiot = world.entities.get(ai.spawn('infected.riot', { x: courier.transform.x + 16, z: courier.transform.z }))!;
    expect(distantRiot.health.current).toBe(distantRiot.health.max);
    expect(distantRiot.combat?.shield, 'riot actor carries its authored shield').toBeTruthy();
    expect(barEligible(distantRiot, courier.transform, infectedDef(distantRiot.archetype).bar === true), 'healthy riot at 16 m keeps its health bar').toBe(true);
    ai.release(distantRiot);
    for (const archetype of [...l4InfectedArchetypes, 'infected.alpha']) for (const state of ['attracted', 'attack', 'stagger'] as const) {
      courier.health.current = courier.health.max;
      const e = world.entities.get(ai.spawn(archetype, { x: -17, z: 3.8 }, { yaw: Math.PI }))!;
      expect(barEligible(e, courier.transform, infectedDef(archetype).bar === true), `${archetype}: hostile live L4 spawn has a bar`).toBe(true);
      expect(e.health.max, `${archetype}: positive health`).toBeGreaterThan(0);
      const flankDamage = world.combat!.damage.apply({ attackId: world.tick + e.id, actionId: 'weapon.army-mg', sourceId: 1, targetId: e.id,
        origin: { x: e.transform.x + 3, z: e.transform.z }, shotOrigin: { x: e.transform.x + 3, z: e.transform.z }, direction: { x: -1, z: 0 },
        base: 1, multiplier: 1, type: 'bullet', knockback: 0, stagger: 0 });
      expect(flankDamage, `${archetype}: a flank shot always moves its health bar`).toBeGreaterThan(0);
      e.infected!.state = state; e.infected!.scripted = { x: -27, z: 3 };
      e.noiseTarget = { id: distraction, until: world.tick + 600 };
      if (e.infected!.l1) { e.infected!.l1.mode = 'attracted'; e.infected!.l1.search.completeApproach = true; }
      if (state === 'attack') { e.infected!.until = world.tick + 21; e.infected!.heardTargetId = soldier.id; e.combat!.attacking = true; }
      const before = world.tick;
      // Keep the loaded campaign and its D-FAIR collision/target registries;
      // isolate the enemy brain from unrelated army gunfire during this probe.
      for (let tick = 0; tick < 180; tick++) { world.tick++; ai.update(); }
      const hit = world.events.events(before).find(event => event.type === 'infected.attack' && event.sourceId === e.id && event.targetId === 1 && event.amount > 0);
      expect(hit, `${archetype} ${state}: contact must land through its telegraph within 3 s`).toBeDefined();
      expect(hit!.tick - before).toBeLessThanOrEqual(180);
      expect(courier.health.current).toBeLessThan(courier.health.max);
      ai.release(e);
    }
    for (const actor of world.entities.iterate()) if (actor.companion) actor.hidden = true;
    Object.assign(courier.transform, { x: -25, z: 3 });
    Object.assign(soldier.transform, { x: -17, z: 3 });
    for (const human of world.entities.iterate()) if (human.civilian && human.id !== soldier.id) human.hidden = true;
    // Nearby camp troops must not steal a street arrival from its authored
    // approach. Q-279 contact acquisition is for the courier; native civilian
    // bites remain handled by the regular contact path below.
    const arrival = world.entities.get(ai.spawn(l4InfectedArchetypes[0], { x: -17, z: 3.8 }))!;
    mission.state.l4!.origin[arrival.id] = 3;
    arrival.infected!.scripted = { x: -27, z: 3 };
    world.tick++;
    ai.update();
    expect(arrival.infected!.scripted, 'an army soldier at the arrival mouth must not cancel its route').toEqual({ x: -27, z: 3 });
    ai.release(arrival);
    soldier.hidden = false; soldier.civilian!.state = 'calm'; soldier.civilian!.l1!.graceUntil = 0;
    const riot = world.entities.get(ai.spawn('infected.riot', { x: -17, z: 3.8 }))!;
    const before = world.tick;
    for (let tick = 0; tick < 90; tick++) { world.tick++; ai.update(); }
    expect(world.events.events(before).some(event => event.type === 'civilian.grabbed' && event.sourceId === riot.id && event.targetId === soldier.id)).toBe(true);
    const corgi = [...world.entities.iterate()].find(e => e.companion)!;
    expect(world.events.events().some(event => event.type === 'infected.attack' && event.targetId === corgi.id)).toBe(false);
    // Native arrivals can be penned against the cellar-yard sheds by their
    // authored endpoint. A courier in their normal sight range must interrupt
    // that route and draw a response within the same three-second bound.
    for (const e of world.entities.iterate()) if (e.civilian) e.hidden = true;
    Object.assign(courier.transform, { x: -17, z: 3, yaw: 0 });
    for (const archetype of l4InfectedArchetypes) {
      courier.health.current = courier.health.max;
      const at = Array.from({ length: 32 }, (_, k) => ({ x: courier.transform.x + Math.cos(k * Math.PI / 16) * 5, z: courier.transform.z + Math.sin(k * Math.PI / 16) * 5 }))
        .find(p => ai.nav.clear(p.x, p.z, .6) && ai.hearing.lineOfSight({ ...p, y: .7 } as typeof courier.transform, courier.transform))!;
      expect(at, `${archetype}: visible approach fixture`).toBeDefined();
      const e = world.entities.get(ai.spawn(archetype, at, { yaw: -Math.atan2(courier.transform.z - at.z, courier.transform.x - at.x) }))!;
      expect(ai.hearing.notices(e, courier.transform, 1), `${archetype}: normal senses see the courier`).toBe(true);
      e.infected!.state = 'attracted'; e.infected!.scripted = { x: -27, z: 3 };
      if (e.infected!.l1) { e.infected!.l1.mode = 'attracted'; e.infected!.l1.search.completeApproach = true; }
      const start = { ...e.transform }, before = world.tick;
      for (let tick = 0; tick < 180; tick++) { world.tick++; ai.update(); }
      expect(e.infected!.scripted, `${archetype}: visible player interrupts authored arrival`).toBeUndefined();
      expect(Math.hypot(e.transform.x - courier.transform.x, e.transform.z - courier.transform.z), `${archetype}: route resumes toward player`).toBeLessThan(Math.hypot(start.x - courier.transform.x, start.z - courier.transform.z));
      expect(world.tick - before).toBe(180);
      ai.release(e);
    }
    // Normal perception retains the route behind real cover, outside hearing.
    // The former L4 shortcut detected the courier through this shed at 6 m.
    courier.health.current = courier.health.max; Object.assign(courier.transform, { x: -35, z: -3 });
    for (const archetype of l4InfectedArchetypes) {
      const e = world.entities.get(ai.spawn(archetype, { x: -33, z: -8.5 }, { yaw: Math.PI }))!;
      delete e.emerging; delete e.infectionRise;
      expect(e.pendingAdmission, `${archetype}: shed-side probe is admitted`).toBeUndefined();
      const corgi = [...world.entities.iterate()].find(actor => actor.companion)!; corgi.hidden = true;
      expect(world.combat!.query.visible(e.transform, courier.transform), `${archetype}: shed-side probe is occluded`).toBe(false);
      e.infected!.state = 'attracted'; e.infected!.scripted = { x: -27, z: -8.5 };
      if (e.infected!.l1) { e.infected!.l1.mode = 'attracted'; e.infected!.l1.targetId = 0; e.infected!.l1.hasGoal = false; e.infected!.l1.search.completeApproach = true; }
      const distance = Math.hypot(e.transform.x - courier.transform.x, e.transform.z - courier.transform.z);
      expect(distance).toBeLessThanOrEqual(6);
      world.tick++; ai.update();
      expect(e.infected!.heardTargetId, `${archetype}: no through-cover target acquisition`).not.toBe(courier.id);
      expect(e.infected!.scripted, `${archetype}: unheard, occluded courier does not cancel travel`).toBeDefined();
      ai.release(e);
    }
    // The same roles still attack in the adjacent levels. Their ordinary
    // perception remains unchanged: only L4 assigns these approach scripts.
    for (const level of ['L3', 'L5'] as const) {
      const other = await loadLevel(level, 1);
      try {
        const ai = other.infected!, p = other.entities.get(1)!;
        vi.spyOn(ai.director, 'update').mockImplementation(() => {});
        for (const e of [...ai.active]) ai.release(e);
        for (const e of other.entities.iterate()) if (e.civilian) e.hidden = true;
        delete p.hidden; delete p.passengerOf; delete p.attachedTo;
        const nav = ai.nav;
        let cell = -1, nearest = Infinity;
        for (let i = 0; i < nav.blocked.length; i++) {
          const x = nav.x(i), z = nav.z(i), distance = Math.hypot(x - p.transform.x, z - p.transform.z);
          if (distance < nearest && nav.clear(x, z, .6) && nav.clear(x + .8, z, .4)) { cell = i; nearest = distance; }
        }
        expect(cell).toBeGreaterThanOrEqual(0);
        Object.assign(p.transform, { x: nav.x(cell), z: nav.z(cell), y: .7 + (other.districts?.pavingHeight(nav.x(cell), nav.z(cell)) ?? 0) });
        for (const archetype of l4InfectedArchetypes) {
          p.health.current = p.health.max;
          const e = other.entities.get(ai.spawn(archetype, { x: p.transform.x + .8, z: p.transform.z }))!;
          const before = other.tick;
          for (let tick = 0; tick < 180; tick++) { other.tick++; ai.update(); }
          expect(other.events.events(before).some(event => event.type === 'infected.attack' && event.sourceId === e.id && event.targetId === 1), `${level} ${archetype}`).toBe(true);
          ai.release(e);
        }
      } finally { other.dispose(); }
    }
    // Refuge groups at a full door must spread to distinct spots or choose another door.
    const refugeOutbreak = world.npcs!.civilians.outbreak!, door = refugeOutbreak.refuges.find(r => r.id === 'refuge-door-22')!;
    const ids = mission.state.l4!.residentIds.slice(0, 10), people = ids.map(id => world.entities.get(id)!);
    for (const person of world.entities.iterate()) if (person.civilian) person.hidden = !ids.includes(person.id);
    people.forEach(person => {
      person.transform.x = door.x - 8; person.transform.z = door.z;
      person.civilian!.l1!.target = null;
    });
    const assigned: { x: number; z: number }[] = [], refugeInternals = refugeOutbreak as unknown as RefugeInternals;
    for (const person of people.slice(0, 9)) {
      const spot = refugeInternals.refugeSpot(person, door);
      if (spot) {
        expect(assigned.every(other => Math.hypot(other.x - spot.x, other.z - spot.z) >= .85), 'shelter spots keep a body-width gap').toBe(true);
        person.civilian!.l1!.target = spot; assigned.push(spot);
      }
    }
    expect(assigned.length).toBeGreaterThanOrEqual(8);
    const last = people[9];
    last.civilian!.state = 'flee'; last.civilian!.threat.x = door.x + 5; last.civilian!.threat.z = door.z;
    last.civilian!.l1!.target = null; last.civilian!.l1!.refuge = null; last.civilian!.l1!.repickAt = 0;
    refugeInternals.flee(last);
    expect(last.civilian!.l1!.target, 'a full refuge must route elsewhere instead of overlapping a settled person').not.toEqual(assigned[0]);
    expect(last.civilian!.l1!.refuge).not.toBe(door.id);
    for (const [i, spot] of assigned.entries()) {
      const person = people[i], c = person.civilian!, d = Math.hypot(spot.x - door.x, spot.z - door.z);
      delete c.ally; c.state = 'flee'; c.story = null;
      Object.assign(person.transform, { x: spot.x + (spot.x - door.x) / d, z: spot.z + (spot.z - door.z) / d });
      c.l1!.target = spot; c.l1!.refuge = door.id; c.l1!.repickAt = world.tick + 100_000; delete c.l1!.doorAt;
      c.path.length = 0; c.goal = -1;
    }
    const queued = people.slice(0, assigned.length);
    for (let tick = 0; tick < 1200 && queued.some(e => !e.hidden); tick++) {
      world.tick++; world.npcs!.update();
      const idle = queued.filter(e => !e.hidden && e.civilian!.state === 'calm' && e.civilian!.schedule?.[e.civilian!.scheduleStep ?? 0]?.anchor === 'refuge/shelter');
      for (let i = 0; i < idle.length; i++) for (const other of idle.slice(i + 1)) expect(Math.hypot(idle[i].transform.x - other.transform.x, idle[i].transform.z - other.transform.z), 'idle shelter figures retain both body radii').toBeGreaterThanOrEqual(.7);
    }
    expect(queued.every(e => e.hidden), 'the spaced refuge queue walks to the doorway and enters shelter').toBe(true);
    // A progressed, close-range tier-2 MP duel remains survivable after the
    // riot contact fix. Reuse this test case to stay inside the repository test budget.
    const duel = await loadL4(1, 'low');
    try {
      duel.mission.loadCheckpoint('turn');
      const dAI = duel.world.infected!, player = duel.world.entities.get(1)!;
      expect(player.survivor!.gearTier).toBeGreaterThanOrEqual(2);
      expect(player.weapons?.RIGHT?.rack.some(slot => slot.id === 'weapon.army-mg')).toBe(true);
      vi.spyOn(dAI.director, 'update').mockImplementation(() => {});
      for (const e of [...dAI.active]) dAI.release(e);
      for (const e of duel.world.entities.iterate()) if (e.civilian?.ally) {
        e.civilian.ally.nextAttack = duel.world.tick + 100_000; e.civilian.ally.strikeAt = 0;
      }
      const dog = [...duel.world.entities.iterate()].find(e => e.companion)!;
      Object.assign(player.transform, { x: -17, z: 3 }); Object.assign(dog.transform, { x: -17, z: 5 });
      duel.world.physics.playerBody!.setTranslation(player.transform, true); duel.world.physics.playerBody!.setNextKinematicTranslation(player.transform);
      const id = dAI.spawn('infected.riot', { x: -16.1, z: 3 }, { yaw: Math.PI, state: 'chase' });
      const riot = duel.world.entities.get(id)!; riot.infected!.scripted = { ...riot.transform };
      const start = duel.world.tick, healthAtStart = player.health.current;
      duel.world.setInput({ aim: { x: 1, z: 0 }, right: { down: false, held: true, up: false } });
      while (duel.world.tick - start < 360 && riot.health.current > 0 && player.health.current > 0) {
        const dx = riot.transform.x - player.transform.x, dz = riot.transform.z - player.transform.z, d = Math.hypot(dx, dz) || 1;
        duel.world.setInput({ aim: { x: dx / d, z: dz / d }, aimPoint: { x: riot.transform.x, z: riot.transform.z } });
        duel.world.update();
      }
      duel.world.clearInput();
      const elapsed = (duel.world.tick - start) / 60;
      const duelAttacks = duel.world.events.events(start).filter(event => event.type === 'infected.attack' && event.sourceId === id && event.targetId === player.id && event.amount > 0);
      expect(riot.health.current).toBe(0);
      expect(player.health.current / player.health.max).toBeGreaterThanOrEqual(.4);
      expect(healthAtStart).toBe(player.health.max);
      expect(elapsed).toBeLessThan(3);
      expect(duelAttacks.length).toBeGreaterThan(0);
    } finally { duel.world.dispose(); }
    // Q-285 real-L4 reproduction: this lamp blocks the torso ray, while the
    // cop's drawn head is visible. Test the actual bar updater and collision world.
    const occlusion = await loadL4(1, 'low');
    try {
      occlusion.mission.loadCheckpoint('line-break');
      const w = occlusion.world;
      for (const e of [...w.infected!.active]) w.infected!.release(e);
      // Alarm, street-edge waves, collapse/perimeter pressure and street/door
      // groups all use LevelFourWar.emerge -> this pool. Alpha has its own
      // mission caller; re-routed stragglers retain the same entity and health.
      // Check every role in both ordinary and scripted arrival states exactly
      // at the café/hydrant street; conversion paths are exercised above.
      const player = w.entities.get(1)!;
      Object.assign(player.transform, { x: -60.6, z: 51.5 });
      for (const archetype of [...l4InfectedArchetypes, 'infected.alpha']) for (const scripted of [false, true]) {
        const e = w.entities.get(w.infected!.spawn(archetype, { x: -61.5, z: 51.5 }, { yaw: 0 }))!;
        if (scripted) e.infected!.scripted = { x: -62, z: 52 };
        expect(e.health.current, `${archetype} street arrival: positive HP`).toBeGreaterThan(0);
        expect(barEligible(e, player.transform, infectedDef(archetype).bar === true), `${archetype} street arrival: bar eligible`).toBe(true);
        expect(w.combat!.damage.apply({ attackId: e.id + w.tick, actionId: 'weapon.army-mg', sourceId: 1, targetId: e.id,
          origin: { x: -64.5, z: 51.5 }, shotOrigin: { x: -64.5, z: 51.5 }, direction: { x: 1, z: 0 },
          base: 1, multiplier: 1, type: 'bullet', knockback: 0, stagger: 0 }), `${archetype} street arrival: flank damage`).toBeGreaterThan(0);
        w.infected!.release(e);
      }
      const id = w.infected!.spawn('infected.riot', { x: -61.5, z: 51.5 });
      for (const e of w.entities.iterate()) if (e.id !== id && e.id !== 1) e.hidden = true;
      Object.assign(w.entities.get(1)!.transform, { x: -58.5, z: 51.5 });
      const box = new Box3(new Vector3(-61.765522, .130002, 50.727024), new Vector3(-60.728104, 1.425033, 52.141804));
      const camera = new PerspectiveCamera(25, 1280 / 720, .1, 600);
      camera.position.set(-47.630833, 11.277920, 62.369167); camera.lookAt(-58.5, .11, 51.5); camera.updateMatrixWorld();
      const top = new Vector3(-61.25, box.max.y, 51.43).project(camera).y;
      const boundsProbe = vi.spyOn(pickBodies, 'bounds').mockImplementation((actorId, out) => actorId === id ? out.copy(box) : null);
      const topProbe = vi.spyOn(pickBodies, 'top').mockImplementation(actorId => actorId === id ? top : null);
      const bars = new HealthBars(w);
      try {
        const cast = (target: Vector3) => {
          const direction = target.clone().sub(camera.position), distance = direction.length(); direction.normalize();
          return w.physics.world!.castRay(new Ray(camera.position, direction), distance - .01, true, undefined, undefined, undefined, undefined,
            collider => !collider.isSensor() && collider.shapeType() === ShapeType.Cuboid);
        };
        const center = box.getCenter(new Vector3()), head = center.clone(); head.y = box.max.y - .05;
        expect(cast(center), 'the former body-center visibility ray hits the existing lamp').not.toBeNull();
        expect(cast(head), 'the drawn head is clear above that obstruction').toBeNull();
        bars.update(camera, 1280, 720);
        expect(bars.count, 'a real lamp covering the torso must not erase a visible head bar').toBe(1);
        w.physics.world!.createCollider(ColliderDesc.cuboid(.7, 2, .7).setTranslation(-60.7, 2, 52.3));
        w.physics.world!.step();
        bars.update(camera, 1280, 720);
        expect(bars.count, 'full-height solid cover still hides the bar').toBe(0);
      } finally { bars.dispose(); boundsProbe.mockRestore(); topProbe.mockRestore(); }
    } finally { occlusion.world.dispose(); }
  } finally { world.dispose(); }
});
