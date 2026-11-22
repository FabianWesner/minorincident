import { expect, test } from 'vitest';
import { loadLevel } from './world';
import { obbHitsAabb } from './oracles';
import physicsAssets from '../../../src/data/physicsAssets';
import { vehicleDef } from '../../../src/data/vehicles';
import type { EntitySnapshot } from '../../../src/sim/world/types';
import type { SimWorld } from '../../../src/sim/world/SimWorld';

function structuralSolids(w: SimWorld) {
  return w.districts!.districts.flatMap(d => d.decay.colliders.filter(c => !c.walkable && /bld\.|wall|fence|barrier/.test(c.id) && !/hedge/.test(c.id)).map(c => ({
    id: `${d.id}/${c.id}`,
    aabb: { min: [c.aabb.min[0] + d.origin[0], c.aabb.min[1], c.aabb.min[2] + d.origin[1]], max: [c.aabb.max[0] + d.origin[0], c.aabb.max[1], c.aabb.max[2] + d.origin[1]] },
  })));
}

test('4 vehicles: all level start poses, L8 evacuation vehicles and L9 scripted crash clear structural solids', async () => {
  const conflicts = new Set<string>(), poses: Record<string, number> = {};
  for (const level of ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8', 'L9', 'L10'] as const) {
    const w = await loadLevel(level, 1);
    try {
      const solids = structuralSolids(w);
      const check = (e: EntitySnapshot, label: string) => {
        const asset = e.archetype.startsWith('vehicle.') ? vehicleDef(e.archetype).asset : e.archetype.startsWith('veh.') ? e.archetype : e.appearance?.asset;
        const authored = asset ? physicsAssets[asset as keyof typeof physicsAssets] : undefined;
        const def = e.archetype.startsWith('vehicle.') ? vehicleDef(e.archetype) : null;
        const prop = w.props?.items.find(item => item.entityId === e.id);
        // Decorative vehicles have authored scale; validate the installed hull rather than an unscaled catalogue box.
        const installed = prop && [{ min: prop.center.map((v, i) => v - prop.half[i]), max: prop.center.map((v, i) => v + prop.half[i]) }];
        const boxes = installed ?? authored?.boxes ?? (def ? [{ min: [-def.length / 2, -.3, -def.width / 2], max: [def.length / 2, .3, def.width / 2] }] : []);
        expect(boxes.length, `${level}/${label}: vehicle hull must be available`).toBeGreaterThan(0);
        poses[level] = (poses[level] ?? 0) + 1;
        for (const b of boxes) {
          const p = e.transform, c = Math.cos(p.yaw), s = Math.sin(p.yaw), x = (b.min[0] + b.max[0]) / 2, z = (b.min[2] + b.max[2]) / 2;
          for (const solid of solids) if (obbHitsAabb(p.x + c * x + s * z, p.z - s * x + c * z, p.yaw, (b.max[0] - b.min[0]) / 2, (b.max[2] - b.min[2]) / 2, p.y + b.min[1], p.y + b.max[1], solid.aabb)) conflicts.add(`${level}/${label} overlaps ${solid.id}`);
        }
      };
      for (const e of w.entities.iterate()) if (e.vehicle || e.archetype.startsWith('veh.') || e.appearance?.asset?.startsWith('veh.')) check(e, `start-${e.id}`);
      if (level === 'L8') {
        const s = w.missions!.l8!.state;
        check(w.entities.get(s.busId)!, 'parked-bus'); check(w.entities.get(s.carId)!, 'parked-apc');
      }
      if (level === 'L9') {
        const m = w.missions!, c = m.l9!, car = w.entities.get(c.state.carId)!, start = m.def.anchors['crash-approach'];
        Object.assign(car.transform, start); w.vehicles!.scriptPose(car.id, car.transform);
        // PO's forced crash begins after the convoy reaches the outskirts bridge; seed that phase directly here
        // so this geometry fixture exercises its fall/impact poses without replaying the full drive.
        c.state.phase = 'approach'; c.state.startedAt = w.tick; c.state.from = { ...car.transform };
        c.state.approachTicks = 90; c.state.impactSpeed = 14; c.state.heading = { x: 1, z: 0 };
        for (let i = 0; i <= 320 && String(c.state.phase) !== 'impact'; i++) { w.tick++; c.update(); check(car, `${c.state.phase}-${i}`); }
        expect(c.state.phase).toBe('impact');
        const player = w.entities.get(1)!; player.health.current = 1;
        const courierAt = { ...player.transform }, endingPhases = new Set<string>(), endingSignals: string[] = [];
        w.events.on('mission.signal', event => { if (event.type === 'mission.signal' && event.name.startsWith('l9.')) endingSignals.push(event.name); });
        for (let i = 0; i < 800 && !c.state.finished; i++) {
          w.inputFrame.move = { x: 1, z: 0 }; w.tick++; c.update(); endingPhases.add(c.state.phase);
          if (['impact', 'dazed', 'rise', 'mega-exit', 'mega-roar', 'mega-leap'].includes(c.state.phase)) expect(w.player!.damage(2, w.tick), 'crash protection lasts through the scripted ending').toBe(0);
        }
        expect(c.state.finished).toBe(true); expect(player.health.current).toBe(1);
        expect([...endingPhases]).toEqual(expect.arrayContaining(['dazed', 'rise', 'mega-exit', 'mega-roar', 'mega-leap', 'done']));
        expect(endingSignals.filter(name => name === 'l9.ending-finished')).toHaveLength(1);
        expect(w.events.events().filter(event => event.type === 'mega.cue' && event.kind === 'roar' && event.sourceId === c.driving.state.megaId)).toHaveLength(1);
        expect(player.transform.x).toBeCloseTo(courierAt.x, 3); expect(player.transform.z).toBeCloseTo(courierAt.z, 3);
        const mega = w.entities.get(c.driving.state.megaId)!;
        expect(mega.hidden && mega.infected!.hidden, 'the Mega is hidden after the cityward leap').toBe(true);
      }
    } finally { w.dispose(); }
  }
  console.log(`[qa:invariants] vehicle scene poses ${JSON.stringify(poses)}`);
  expect([...conflicts], 'vehicles invariant: scripted/start/parked structural overlaps').toEqual([]);
}, 180_000);
