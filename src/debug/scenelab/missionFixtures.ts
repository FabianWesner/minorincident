import { SimPhase } from '../../core/EventBus';
import type { SimWorld } from '../../sim/world/SimWorld';
import type { EntitySnapshot } from '../../sim/world/types';
import type { LabActor } from './SceneLab';
import type { SceneSpec } from './spec';
import { applyCampaign } from '../../sim/progression/apply';
import { preset } from '../../sim/progression/Campaign';
import { resolveCampaignMission } from '../../levels/missions';
import { l3, l3Anchors } from '../../data/l3';
import { l3BaseCollision } from '../../levels/L3/collision';
import { missionControls } from '../../sim/missions/controls';
import { LevelSevenEncounters } from '../../sim/missions/LevelSevenEncounters';
import { LevelSevenDeparture } from '../../sim/missions/LevelSevenDeparture';

interface FixtureHost {
  tier: 'high' | 'low';
  actors: Map<string, LabActor>;
  vehicles: Map<string, number>;
  teleport(entity: EntitySnapshot, position: { x: number; z: number }): void;
}
/** Mission fixtures advance the shipped controllers; their order within SceneLab setup stays explicit. */
export function setupL2Release(world: SimWorld, spec: SceneSpec, host: FixtureHost): void {
  if (spec.l2Release) {
      world.scenario = 'L2'; applyCampaign(world, preset('L2-default'));
      world.requireInfected().director.setTier(host.tier);
      const mission = world.loadMission(resolveCampaignMission('L2', world.districts!));
      mission.begin();
      if (!world.tick) world.update(); // The production release clock uses zero for "not opened".
      if (spec.l2Release !== 'start') mission.l2!.completed('doors');
      if (spec.l2Release === 'bridge' || spec.l2Release === 'checkpoint') {
        host.teleport(world.entities.get(1)!, { x: -46.5, z: -39 });
        for (let i = 0; i < 20 * 60; i++) world.update();
      }
      const at = spec.actors?.find(a => a.kind === 'courier')?.at;
      if (at) host.teleport(world.entities.get(1)!, { x: at[0], z: at[1] });
      if (spec.l2Release === 'checkpoint') {
        mission.l2!.advance();
        for (let i = 0; i < 60 && !mission.state.l2!.gateClosedAt; i++) world.update();
        if (!mission.state.l2!.gateClosedAt) throw new Error('L2 checkpoint fixture did not close its gates');
        // Hold the completed physical closure for inspection, before the normal
        // two-second handover ends this scene. Combat and contact keep running.
        mission.state.l2!.phase = 'done';
        // Reuse production pursuers: the rescue has already filled its cap.
        // Fixture placement must retain identities/counts rather than add extras.
        const probes = world.requireInfected().active.filter(e => e.health.current > 0 && !e.hidden).slice(0, 2);
        for (const [i, id] of ['jamb-probe', 'panel-probe'].entries()) {
          const e = probes[i]; if (!e) throw new Error('L2 checkpoint fixture needs two living pursuers');
          if (!world.solids.relocate(e, { x: i ? 81.9 : 83.107, y: .7, z: 37 }, 'scene.l2-gate-probe', 0, false)) throw new Error('L2 gate probe placement blocked');
          world.requireInfected().rush(e.id, world.entities.get(1)!.transform, world.tick + 600);
          host.actors.set(id, { id, kind: 'infected', entity: e.id, spec: { id, kind: 'infected', archetype: e.archetype }, plan: null, track: [], lod: {}, drawn: 0, inView: 0, missed: 0, farClose: 0 });
        }
      }
    }
}

export function setupL6Subway(world: SimWorld, spec: SceneSpec): void {
  const player = world.entities.get(1)!;
  const courier = spec.actors?.find(a => a.kind === 'courier');
  if (spec.l6Subway) {
      // The courier's look.model picks the survivor (as cureProgression does): the L6 preset alone always loaded the heroine.
      const l6 = preset('L6-default'), l6Model = spec.actors?.find(actor => actor.kind === 'courier')?.look?.model;
      if (l6Model === 'male' || l6Model === 'female') l6.character = l6Model;
      world.scenario = 'L6'; applyCampaign(world, l6);
      const mission = world.loadMission(resolveCampaignMission('L6', world.districts!)); mission.begin();
      if (spec.l6Subway !== 'pickup') {
        const lamp = world.entities.values().find(e => e.archetype === 'pickup.headlamp')!;
        lamp.interactable!.completed = true; Object.assign(player.transform, lamp.transform);
        world.physics.playerBody!.setTranslation(player.transform, true); world.update(); world.update();
      }
      // PO 10-20 #64/#65 fixtures: 'retreat' starts the group walking from the shelter; 'hatch' also closes the north hatch at x162 (door 6).
      if (spec.l6Subway === 'retreat' || spec.l6Subway === 'hatch') { mission.completeObjective('shelter'); mission.completeObjective('stop'); }
      if (spec.l6Subway === 'hatch') { const entry = mission.state.l6!.entries!.find(e => e.door === 6)!; world.entities.get(entry.switchId!)!.interactable!.completed = true; }
      if (spec.l6Subway === 'gate' || spec.l6Subway === 'entry') {
        mission.completeObjective('shelter'); mission.completeObjective('stop');
        for (const [index, r] of mission.state.l6!.survivors.entries()) {
          const e = world.entities.get(r.id)!;
          // Admit the fixture through the same solids authority as other scene
          // teleports. Direct transform writes are rejected on the next tick and
          // send part of the cast back behind the gate, correctly blocking it.
          if (!world.solids.relocate(e, { x: 99 + index * 1.1, y: 1.3, z: 15 }, 'scene.l6-gate', 1.5)) throw new Error(`Cannot stage L6 gate survivor ${r.key}`);
        }
        // Hold the column at the gate being demonstrated until the courier closes it.
        // A leader already at 105 guides to the next gate, hiding this gate's panel.
        mission.state.l6!.leaderX = spec.l6Subway === 'gate' ? 89 : 105; mission.state.l6!.leaderZ = 15;
      }
      if (courier?.at) {
        Object.assign(player.transform, { x: courier.at[0], y: 1.3, z: courier.at[1] });
        world.physics.playerBody!.setTranslation(player.transform, true); world.spatial.set(1, player.transform.x, player.transform.z);
      }
      // Frame zero must show guidance for the staged column, rather than the shelter state before relocation.
      if (spec.l6Subway === 'gate') world.update();
    }
}

export function setupL3Rendezvous(world: SimWorld, spec: SceneSpec): void {
  if (spec.l3Rendezvous) {
      world.scenario = 'L3';
      world.requireInfected().excludeInfected(l3BaseCollision);
      applyCampaign(world, preset('L3-default'));
      const mission = world.loadMission(resolveCampaignMission('L3', world.districts!));
      mission.begin(); mission.completeObjective('armory'); mission.completeObjective('defend');
      const state = mission.state.l3!, api = missionControls(world);
      state.pending = []; state.waves = []; state.populated = [true, true, true];
      state.finalePacks = l3.finale.packs.map(p => p[1]);
      // Distinct clear road positions: stacking ten capsules at one point can reject a teleport
      // and strand an officer back at the station, correctly preventing the boom from closing.
      for (const [i, id] of state.officerIds.entries()) api.teleport(id, { x: l3.map.zoneX + 5 + Math.floor(i / 3) * 1.4, z: (i % 3 - 1) * 1.4 });
      for (const e of world.entities.iterate()) if (e.companion) api.teleport(e.id, { x: l3.map.zoneX + 3, z: 2 });
      api.teleport('player', { x: l3Anchors['l3-zone'][0], z: 0 });
      const ai = world.infected!, cap = ai.director.cap;
      for (let x = l3.finale.barrierX - .8; x > l3.finale.barrierX - 30 && ai.director.count < cap; x -= .8) {
        for (let z = -9; z <= 9 && ai.director.count < cap; z += .8) {
          if (!ai.infectedNav.clear(x, z, .35)) continue;
          const id = ai.spawn('infected.runner', { x, z });
          ai.rush(id, { x: l3.finale.barrierX + 2, z: 0 }, world.tick + 121 * 60);
        }
      }
    }
}

export function setupL4Convoy(world: SimWorld, spec: SceneSpec, host: FixtureHost): void {
  if (spec.l4Convoy) {
      applyCampaign(world, preset('L4-default'));
      world.requireInfected().director.setTier(host.tier);
      const mission = world.loadMission(resolveCampaignMission('L4', world.districts!));
      mission.begin();
      if (spec.l4Convoy === 'parked' || spec.l4Convoy === 'hold' || spec.l4Convoy === 'pickup' || spec.l4Convoy === 'tank' || spec.l4Convoy === 'first-line') {
        for (let t = 0; t < 60 * 60 && mission.state.l4!.phase === 'convoy'; t++) world.update();
        if (mission.state.l4!.phase === 'convoy') throw new Error('L4 convoy did not arrive for parked fixture');
      }
      if (spec.l4Convoy === 'hold' || spec.l4Convoy === 'pickup' || spec.l4Convoy === 'tank' || spec.l4Convoy === 'first-line') {
        if (spec.l4Convoy === 'pickup' || spec.l4Convoy === 'first-line') { const q = mission.def.anchors['l4-quartermaster']; host.teleport(world.entities.get(1)!, { x: q.x, z: q.z + 1 }); }
        mission.completeObjective('quartermaster');
        while (!mission.state.l4!.turnAt) world.update();
      }
      if (spec.l4Convoy === 'tank') {
        for (let t = 0; t < 120 * 60 && mission.state.l4!.tankPhase !== 'hold'; t++) world.update();
        if (mission.state.l4!.tankPhase !== 'hold') throw new Error('L4 tank did not reach its firing post');
      }
      if (spec.l4Convoy === 'first-line') {
        while (world.tick < mission.state.l4!.turnAt + 33 * 60) world.update();
      }
      for (const [i, id] of mission.state.l4!.convoyIds.entries()) host.vehicles.set(`convoy-${i}`, id);
    }
}

export function setupL7Group(world: SimWorld, spec: SceneSpec, host: FixtureHost): void {
  if (spec.l7Group) {
      world.scenario = 'L7';
      world.l7Encounters = new LevelSevenEncounters(world);
      world.l7Encounters.prepare(spec.l7Group === 'start' ? undefined : []);
      for (const e of world.entities.iterate()) if (spec.l7Group !== 'start' && e.civilian?.survivor) world.l7Encounters.state.roster.push({ id: e.id, key: e.civilian.survivor.key, injured: false, status: 'following', passed: false });
      if (spec.l7Departure) {
        world.l7Departure = new LevelSevenDeparture(world); world.l7Departure.install();
        if (spec.l7Departure === 'follow') world.l7Departure.cameraPose = () => null;
        host.vehicles.set('departure-bus', world.l7Departure.state.busId);
        world.events.on('sim.tick', () => world.l7Departure?.update(), SimPhase.missions);
      }
    }
}

