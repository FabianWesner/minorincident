// Mission interactions across all ten levels: the ground ring (render), the `E` press (input) and the view
// read one mission interaction descriptor. Split from missions.test.ts so this ~140 s all-level sweep runs
// in parallel with the rest of `npm test` (4-min budget); behaviour and assertions are unchanged.
import { expect, test } from 'vitest';
import { emptyInput } from '../../src/input/InputFrame';
import { missionControls } from '../../src/sim/missions/controls';
import type { EntitySnapshot } from '../../src/sim/world/types';
import { isMissionInteraction } from '../../src/render/InteractionView';
import { activeInteractions, isRingedInteraction } from '../../src/sim/missions/interaction';
import { loadLevel, runnerLevels } from '../../tools/sim-runner/levels';
import { objectiveText } from '../../src/sim/missions/objectiveText';
import { markerAnchor } from '../../src/sim/missions/markerAnchor';
import { l8BossArenas } from '../../src/data/l8Bosses';
import { l10MegaResumeCheck } from '../helpers/l10MegaResume';
import { l10MegaFightCheck } from '../helpers/l10MegaFight';
import { checkL8Story } from '../helpers/l8Story';
import { checkL8Route } from '../helpers/l8Route';
import { checkL8RouteMarkers, checkL9BridgeMarker, checkL9ApcPocket, checkL9EvacFailForward } from '../helpers/r39Markers';
import { doorExit, emergeResident, emergeSpeedMs, layoutHouseDoors, walkResidents, type HouseEmergence } from '../../src/sim/outbreak/HouseEmergence';
import { validateSave } from '../../src/sim/progression/Save';
import { corpseDetour } from '../../src/sim/missions/missionHelpers';

// P09: the ground ring (render), the `E` press (input) and the view read one mission interaction descriptor in every level.
test('interactions: ring, input and view predicates agree for every interact step of every level', async () => {
  for (const level of runnerLevels) {
    const levelWorld = await loadLevel(level, 1);
    try {
      const mission = levelWorld.missions!, player = levelWorld.entities.get(1)!;
      if (level === 'L7') {
        levelWorld.l7Encounters!.prepare();
        const terrace = levelWorld.infected!.active.filter(e => e.transform.x > 200);
        expect(terrace.length, 'Northgate street residents are present on their authored terrace').toBeGreaterThan(0);
        for (const e of terrace) {
          expect(e.transform.y, 'street residents cannot spawn beneath the raised road').toBeGreaterThan(2);
          expect(e.transform.y).toBeCloseTo(.7 + levelWorld.districts!.pavingHeight(e.transform.x, e.transform.z));
        }
      }
      if (level === 'L1') {
        // A walker on an authored house route turns toward the courier at the
        // common 9 m notice range, even outside the L10 finale route.
        const district = levelWorld.districts!.districts[0], door = layoutHouseDoors(district.layout, district.origin)[0]!;
        const exit = doorExit(levelWorld, door, player.transform)!;
        const house: HouseEmergence = { ...door, ...exit, route: [[exit.ox + 20, exit.oz]], finishRoute: true, next: 0, ids: [], walking: [], speedMs: 5 };
        const scripted = emergeResident(levelWorld, house, levelWorld.tick);
        for (let tick = 0; tick < 30; tick++) levelWorld.update();
        house.walking![0]!.leg = 0;
        const walker = levelWorld.entities.get(scripted)!;
        Object.assign(player.transform, { x: walker.transform.x + 8.5, z: walker.transform.z });
        levelWorld.spatial.set(player.id, player.transform.x, player.transform.z);
        expect(walkResidents(levelWorld, house, levelWorld.tick), 'L1 house walker hands over inside the 9 m courier notice').toContain(scripted);
        mission.begin();
        missionControls(levelWorld).teleport(1, mission.def.anchors['parcel-counter']);
        mission.completeObjective('pickup');
        expect(levelWorld.openDoors.has('l1-depot-clerk'), 'clerk holds the depot open while crossing').toBe(true);
        for (let tick = 0; tick < 720 && mission.state.l1!.clerkId; tick++) levelWorld.update();
        expect(mission.state.l1!.clerkId).toBe(0);
        expect(levelWorld.openDoors.has('l1-depot-clerk'), 'depot closes after the clerk returns').toBe(false);
        missionControls(levelWorld).teleport(1, mission.def.anchors['lab-door']);
        levelWorld.setInput({ interact: true }); levelWorld.update(); levelWorld.setInput({ interact: false });
        let transfer = false;
        for (let tick = 0; tick < 1080 && !mission.state.l1!.delivered; tick++) {
          levelWorld.update();
          const l1 = mission.state.l1!, tech = levelWorld.entities.get(l1.techId)!;
          if (l1.phase !== 'handover') continue;
          const courierParcel = !!player.survivor!.carrying, technicianParcel = tech.civilian!.story?.prop === 'parcel';
          expect(Number(courierParcel) + Number(technicianParcel), `one visible parcel at tick ${levelWorld.tick}`).toBe(1);
          if (technicianParcel) transfer = true;
        }
        expect(transfer).toBe(true); expect(mission.state.l1!.delivered).toBe(true);
      }
      if (level === 'L9') {
        const crash = mission.l9!, car = levelWorld.vehicles!.cars.get(crash.state.carId)!;
        const corgi = [...levelWorld.entities.iterate()].find(e => e.companion)!;
        const entry = levelWorld.vehicles!.passengerDoor(crash.state.carId);
        expect(corgi.passengerOf, 'direct L9 start boards through the passenger entry').toBe(crash.state.carId);
        expect(corgi.hidden).toBe(true);
        expect(car.entity.vehicle!.passengers?.find(p => p.id === corgi.id)?.phase).toBe('seated');
        expect(Math.hypot(corgi.transform.x - entry.x, corgi.transform.z - entry.z)).toBeLessThanOrEqual(.7);
        const guards = crash.driving.state.soldiers.map(id => levelWorld.entities.get(id)!);
        expect(guards.every(guard => guard.hidden && crash.driving.state.trucks.includes(guard.passengerOf!)), 'L9 guards stay hidden aboard their trucks until deployment');
        const visibleGuardsNearStart = () => [...levelWorld.entities.iterate()].filter(e => e.civilian?.model === 'npc.national-guard' && !e.hidden && Math.hypot(e.transform.x + 550, e.transform.z) <= 30);
        expect(visibleGuardsNearStart(), 'no visible soldier at the L9 start').toHaveLength(0);
        for (let tick = 0; tick < 300; tick++) { levelWorld.applyInput({ ...emptyInput(), drive: { throttle: 1, steer: 0 } }, 'keyboard'); levelWorld.update(); }
        expect(guards.every(guard => guard.hidden && crash.driving.state.trucks.includes(guard.passengerOf!)), 'L9 civilian routines cannot reveal truck passengers during the opening drive');
        expect(visibleGuardsNearStart(), 'no visible soldier within 30 m of the L9 start after 5 s of driving').toHaveLength(0);
        expect(levelWorld.entities.get(crash.driving.state.samId)?.civilian?.survivor?.key).toMatch(/^(sam|reyes)$/); // The later guard-line handoff retains its survivor identity.
      }
      if (level === 'L2') {
        mission.begin();
        for (let tick = 0; tick < 31 * 60; tick++) levelWorld.update();
        expect(mission.state.l2!.axe, 'ignoring the optional rack never grants an axe').toBe(false);
        expect(mission.state.l2!.alarmAt / 60).toBeGreaterThanOrEqual(20);
        expect(mission.state.l2!.alarmAt / 60).toBeLessThanOrEqual(30);
        expect(mission.state.steps.board.status, 'dispatch enables boarding without an axe').toBe('active');
        expect(mission.state.marker).toBe('l2-board');
        expect(activeInteractions(mission).find(i => i.step.id === 'axe')?.ring, 'optional rack keeps its ground ring').toBe(true);
        missionControls(levelWorld).teleport(1, mission.def.anchors['l2-board']);
        levelWorld.setInput({ ...emptyInput(), interact: true });
        for (let tick = 0; tick < 40 && !mission.state.states.boarded; tick++) levelWorld.update();
        levelWorld.setInput(emptyInput());
        expect(mission.state.states.boarded, 'the authored l2-board interaction starts boarding').toBe(true);
        expect(player.hidden, 'courier remains visible through the enter-car pose').toBe(false);
        levelWorld.update();
        expect(player.survivor!.scriptedClip).toBe('enter-car');
        for (let tick = 0; tick < 59; tick++) levelWorld.update();
        const l2Crew = mission.state.l2!.crewIds.map(id => levelWorld.entities.get(id)!);
        expect(l2Crew.filter(e => e.hidden).length, 'firefighters board in a visible seat-order stagger').toBeGreaterThan(0);
        expect(l2Crew.filter(e => e.hidden).length).toBeLessThan(l2Crew.length);
        expect(mission.state.l2!.phase, 'Engine 3 waits for the boarding sequence').toBe('alarm');
        for (let tick = 0; tick < 120; tick++) levelWorld.update();
        expect(mission.state.l2!.phase).toBe('ride');
      }
      if (level === 'L8') {
        mission.begin();
        expect(mission.state.steps.sanctuary.status).toBe('active');
        expect(mission.state.steps.escape.status).toBe('pending');
        expect(mission.state.steps.depart.status).toBe('pending');
        // The existing outlet scene exposed queued residents first becoming
        // visible on the apron. Exercise its native six-person door queue here,
        // without adding another registered case or relaxing the scene gate.
        expect(mission.state.marker).toBe('l8-route');
        expect(objectiveText(mission, mission.def.steps[0].text)).toBe('Follow Nadia');
        const flock = mission.l8!.bosses.state.find(arena => arena.id === 'flamingo')!;
        const savedPhase = flock.phase, savedPlayer = { ...player.transform };
        const flockCentre = l8BossArenas.find(d => d.id === 'flamingo')!.centre;
        flock.phase = 2; player.transform.x = flockCentre.x; player.transform.z = flockCentre.z;
        const flockBodies = flock.ids.map(id => levelWorld.entities.get(id)!);
        const savedHealth = flockBodies.map(body => body.health.current);
        flockBodies.forEach((body, index) => { body.health.current = index < 3 ? 0 : body.health.max; });
        expect(objectiveText(mission, mission.def.steps[0].text)).toBe('Follow Nadia · 5 left');
        flockBodies.forEach((body, index) => { body.health.current = savedHealth[index]; });
        flock.phase = savedPhase; Object.assign(player.transform, savedPlayer);
        await checkL8Story();
        await checkL8Route();
        mission.completeObjective('sanctuary');
        expect(mission.state.states.breached, 'debug graph advancement still reconstructs the real breach checkpoint').toBe(true);
        mission.restore('sanctuary');
        expect(mission.state.states.breached).toBe(false);
        const interceptor = levelWorld.infected!.spawn('infected.runner', { x: 12, z: 68 });
        levelWorld.infected!.pursueTarget(interceptor, 1);
        levelWorld.infected!.press(interceptor, 1, levelWorld.tick + 600, 30);
        levelWorld.update();
        expect(levelWorld.entities.get(interceptor)!.infected!.l1!.focusId, 'an authored courier press survives noticing a nearer follower').toBe(1);
        mission.restore('sanctuary');
        // Exercise the shared emergence code against the retained tunnel scenery.
        // L8 waves now use the perimeter gates and do not populate state.outlets.
        const district = levelWorld.districts!.districts[0];
        const tunnelDoor = layoutHouseDoors(district.layout, district.origin, undefined, asset => asset === 'kit.zoo-tunnel-mouth')[2];
        const exit = doorExit(levelWorld, tunnelDoor, player.transform);
        if (!exit) throw new Error('Zoo tunnel fixture has no connected exit');
        const source: HouseEmergence = { ...tunnelDoor, ...exit, route: [...exit.route, [-24, -64], [0, -64], [0, -56]], finishRoute: true, next: 0, ids: [], speedMs: 5.6 };
        const house = { ...source, ids: [] as number[], walking: [], route: [], ox: source.sx, oz: source.sz, speedMs: emergeSpeedMs };
        const first = new Map<number, number>();
        for (let frame = 0; frame < 420; frame++) {
          if (frame >= 30 && frame < 30 + 6 * 24 && (frame - 30) % 24 === 0) emergeResident(levelWorld, house, levelWorld.tick);
          for (const id of walkResidents(levelWorld, house, levelWorld.tick)) levelWorld.infected!.rush(id, player.transform, levelWorld.tick + 600);
          for (const id of house.ids) {
            const e = levelWorld.entities.get(id)!;
            if (!e.hidden && !e.pendingAdmission && !first.has(id)) first.set(id, (e.transform.x - house.x) * house.nx + (e.transform.z - house.z) * house.nz);
          }
          levelWorld.update();
        }
        expect(house.ids).toHaveLength(6);
        expect(first.size).toBe(6);
        for (const [id, out] of first) expect(out, `resident ${id} first admitted behind door`).toBeLessThanOrEqual(.05);
        // r26-l8follow: a body pinned on its authored service route (a fallen pen panel at the pond) used to keep `emerging`
        // for the whole fight (the zebra carrier sat at (-11, -27) for 74 s). It now hands over to the AI after ~1.5 s.
        levelWorld.solids.setBarrier('test.fallen-panel', { x: -11.4, y: .3, z: -25.4, halfX: 1.4, halfY: .35, halfZ: 1.2 });
        const pinned = { ...source, ids: [] as number[], walking: [] };
        const stuck = emergeResident(levelWorld, pinned, levelWorld.tick);
        const released: number[] = [];
        for (let frame = 0; frame < 60 * 40 && !released.includes(stuck); frame++) { released.push(...walkResidents(levelWorld, pinned, levelWorld.tick)); levelWorld.update(); }
        levelWorld.solids.setBarrier('test.fallen-panel', null);
        expect(released, 'a resident pinned on the service route is handed to the AI').toContain(stuck);
        expect(levelWorld.entities.get(stuck)!.emerging).toBeUndefined();
        expect(levelWorld.entities.get(stuck)!.transform.z, 'it stopped at the panel, not past it').toBeLessThan(-26);
        // The same threshold applies to an L8 tunnel outlet while it is still
        // following its authored service route.
        const noticeRoute: HouseEmergence = { ...source, ids: [] as number[], walking: [], route: [[source.ox + 20, source.oz]], finishRoute: true };
        const noticed = emergeResident(levelWorld, noticeRoute, levelWorld.tick);
        for (let tick = 0; tick < 30; tick++) levelWorld.update();
        noticeRoute.walking![0]!.leg = 0;
        const noticedWalker = levelWorld.entities.get(noticed)!;
        Object.assign(player.transform, { x: noticedWalker.transform.x + 8.5, z: noticedWalker.transform.z });
        levelWorld.spatial.set(player.id, player.transform.x, player.transform.z);
        expect(walkResidents(levelWorld, noticeRoute, levelWorld.tick), 'L8 tunnel walker hands over inside the 9 m courier notice').toContain(noticed);
        // r27-l8board: the corgi pressed into a fallen elephant's footprint (queue head, seed 1) got no corpse detour,
        // and a boarding member that cannot move for 1.5 s is moved along its route instead of idling for 30 s.
        // Boarding happens after the elephant pen exit opens.
        const boardingPhases = mission.l8!.state.arenas.map(arena => arena.phase);
        for (const arena of mission.l8!.state.arenas) arena.phase = 3;
        mission.l8!.bosses.updateGates();
        const elephant = levelWorld.infected!.spawn('infected.elephant', { x: 103.6, z: 57.7 }, { state: 'idle' }), body = levelWorld.entities.get(elephant)!;
        body.health.current = 0; Object.assign(body.infected!, { state: 'dead', deadAt: levelWorld.tick - 120, recoverAt: -1 }); levelWorld.infected!.settle(body);
        const dog = levelWorld.entities.get(levelWorld.npcs!.companion.spawn())!;
        Object.assign(dog.transform, { x: 102.7, y: .3, z: 56.2 }); levelWorld.spatial.set(dog.id, 102.7, 56.2);
        expect(corpseDetour(levelWorld, dog, { x: 96, y: 0, z: 70.65 } as never), 'queue head beside the elephant finds a way out').toBeDefined();
        const jam = mission.l8! as unknown as { unjamBoarding(e: EntitySnapshot, target: { x: number; z: number }): void }, before = { ...dog.transform }, away = { x: before.x - 6, z: before.z + 6 };
        for (let frame = 0; frame < 100; frame++) { jam.unjamBoarding(dog, away); levelWorld.tick++; }
        expect(Math.hypot(dog.transform.x - before.x, dog.transform.z - before.z), 'a stalled boarding member is moved along its route after 1.5 s').toBeGreaterThan(.5);
        levelWorld.entities.delete(elephant); levelWorld.entities.delete(dog.id);
        mission.l8!.state.arenas.forEach((arena, i) => { arena.phase = boardingPhases[i]; });
        mission.l8!.bosses.updateGates();
        // Settling before the alarm chooses the real boarding destination;
        // later hull nudges must not drag a fixed objective around the map.
        const zoo = mission.l8!, car = levelWorld.entities.get(zoo.state.carId)!;
        const parked = { ...car.transform };
        car.transform.x += 2;
        zoo.state.startedAt = levelWorld.tick - 3600; zoo.state.guideDone = 1;
        zoo.update();
        const boarding = { ...mission.def.anchors.exit }, door = zoo.door();
        expect(Math.hypot(boarding.x - door.x, boarding.z - door.z)).toBeCloseTo(.25, 6);
        car.transform.x += .4;
        zoo.update();
        expect(mission.def.anchors.exit).toEqual(boarding);
        Object.assign(car.transform, parked);
        // The handover event is emitted after the result delay. A held E during
        // that delay must not eject the driver and invalidate the transport.
        const vehicle = levelWorld.vehicles!, carId = mission.l8!.state.carId;
        vehicle.active = carId; vehicle.cars.get(carId)!.entity.vehicle!.driver = 1; player.hidden = true;
        mission.state.phase = 'result';
        vehicle.prePhysics({ ...emptyInput(), interact: true }, 'keyboard');
        expect(vehicle.active, 'completed zoo keeps its departing driver').toBe(carId);
        expect(vehicle.cars.get(carId)!.entity.vehicle!.driver).toBe(1);
        mission.state.phase = 'playing';
        mission.state.runOutUntil = levelWorld.tick + 300;
        vehicle.cars.get(carId)!.entity.health.current = 19;
        vehicle.damage(carId, 1000);
        expect(vehicle.cars.get(carId)!.entity.health.current, 'run-out protects the departing APC like its courier').toBe(19);
        vehicle.prePhysics({ ...emptyInput(), interact: true }, 'keyboard');
        expect(vehicle.active, 'run-out cannot eject the departing driver').toBe(carId);
        delete mission.state.runOutUntil;
        vehicle.damage(carId, 1);
        expect(vehicle.cars.get(carId)!.entity.health.current, 'live boarding still takes damage').toBe(18);
        vehicle.prePhysics({ ...emptyInput(), interact: true }, 'keyboard');
        expect(vehicle.active, 'ordinary in-level exit remains available').toBeNull();
      }
      mission.state.phase = 'playing';
      let checked = 0;
      for (const step of mission.def.steps) {
        for (const other of mission.def.steps) mission.state.steps[other.id].status = other.id === step.id ? 'active' : 'pending';
        if (level === 'L10') mission.state.states['charge-active'] = false;
        const [interaction] = activeInteractions(mission).filter(i => i.step.id === step.id);
        if (!interaction) continue;
        const anchor = mission.def.anchors[interaction.trigger.anchor];
        Object.assign(player.transform, { x: anchor.x, z: anchor.z });
        expect(mission.interactStepInRange()?.id, `${level} ${step.id} input`).toBe(step.id);
        const entity = { archetype: 'prop', transform: { x: anchor.x, z: anchor.z } } as EntitySnapshot;
        expect(isRingedInteraction(mission, entity.transform), `${level} ${step.id} ring`).toBe(interaction.ring);
        expect(isMissionInteraction(levelWorld, entity), `${level} ${step.id} view`).toBe(interaction.ring);
        if (level === 'L2' && step.id === 'board') {
          Object.assign(player.transform, { x: -70.2, z: 39.2 });
          expect(mission.interactStepInRange()?.id, 'QA station-side pin is within boarding reach').toBe('board');
        }
        Object.assign(player.transform, { x: anchor.x + 500, z: anchor.z + 500 });
        expect(mission.interactStepInRange()?.id === step.id, `${level} ${step.id} far input`).toBe(false);
        expect(isRingedInteraction(mission, { x: anchor.x + 500, z: anchor.z + 500 })).toBe(false);
        checked++;
      }
      if (['L2', 'L3', 'L4', 'L5'].includes(level)) expect(checked, level).toBeGreaterThan(0);
      if (level === 'L10') {
        // A retained farm find must enter campaign ownership before the next
        // checkpoint captures its arsenal, matching the live held rack.
        Object.assign(player.transform, { x: 547, y: .71, z: 0 });
        levelWorld.combat!.pickups.spawn('weapon.hunting-rifle', player.transform, false, { retain: true });
        levelWorld.combat!.pickups.update();
        const campaign = levelWorld.progression!.campaign!;
        expect(campaign.ownedActions).toContain('weapon.hunting-rifle');
        expect(campaign.racks.RIGHT).toContain('weapon.hunting-rifle');
        mission.checkpoint('cure-residential');
        campaign.cureResume = mission.saveResume(true);
        expect(validateSave(campaign), 'farm find and checkpoint remain a loadable save').toBe(true);
        expect(mission.def.steps.find(s => s.id === 'mega')!.waypoint).toBe(false);
        // A legacy resume's combat-target marker resolves to the fixed arena destination.
        mission.def.anchors['cure-mega'] = { x: -150, z: 80, radius: 2 };
        mission.state.marker = 'cure-mega';
        expect(markerAnchor(mission)).toBe(mission.def.anchors['cure-console']);
        mission.state.marker = 'cure-console';
        expect(markerAnchor(mission)).toBe(mission.def.anchors['cure-console']);
      }
    } finally { levelWorld.dispose(); }
  }
  await l10MegaResumeCheck();
  // r31-megafight: the Mega stays in the arena for a 110 s fight, the HUD never says "back to the arena" in melee, the arena tools work.
  const fight = await l10MegaFightCheck();
  expect(fight.maxCourierM).toBeGreaterThan(50);
  expect(fight.maxMegaM, 'Mega stays within the leash').toBeLessThan(34);
  expect(fight.backInMelee).toBe(0);
  expect(fight.switchDone).toBe(true);
  expect(fight.tankDamage, 'a fuel tank hurts the Mega').toBeGreaterThan(50);
  expect(fight.gateSpent && fight.gateDamage >= 900).toBe(true);
  // r39-markers: L8 route legs end inside their arena zones; the L9 bridge marker sits on the deck and the deck starts the collapse.
  await checkL8RouteMarkers(); await checkL9BridgeMarker(); await checkL9ApcPocket(); await checkL9EvacFailForward();
}, 660_000);
