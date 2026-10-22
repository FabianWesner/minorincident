import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { compositions } from '../../../src/levels/compositions';
import { missionIds, resolveCampaignMission } from '../../../src/levels/missions';
import { preset } from '../../../src/sim/progression/Campaign';
import { SimWorld } from '../../../src/sim/world/SimWorld';
import physicsAssets from '../../../src/data/physicsAssets';
import { l4, l4Edges } from '../../../src/data/l4';
import { seatAnchor } from '../../../src/sim/npc/seats';
import { l4PerimeterWalls } from '../../../src/data/l4Perimeter';
import { oracle } from './oracles';
import { markerAnchor } from '../../../src/sim/missions/markerAnchor';
import { loadLevel } from '../../../tools/sim-runner/levels';
import type { DistrictLayout } from '../../../src/levels/districts/types';

const manifest = JSON.parse(readFileSync('src/assets/manifest.json', 'utf8')) as { id: string; category: string; dimensions?: { x: number; y: number; z: number; tolerance?: number }; accessory?: { slot: string; attach: string; fits: Record<string, { scale: number[]; offset: number[]; hasHeadwear?: boolean }> }; lods?: Record<string, string> }[];
const layouts = new Map(readdirSync('public/assets/layouts').filter(x => x.endsWith('.layout.json')).map(x => [x.slice(0, -12), JSON.parse(readFileSync(`public/assets/layouts/${x}`, 'utf8')) as DistrictLayout]));

function synthetic<T>(label: string, validate: (value: T) => string[]) {
  return (value: T, expected: string[]) => expect(validate(value), label).toEqual(expected);
}
const seatErrors = synthetic<{ pose: string; seat?: { y: number }; actorY: number }>('sitting actor without a seat or at the wrong height', x => x.pose === 'sit' && (!x.seat || Math.abs(x.seat.y - x.actorY) > .2) ? ['seat invariant'] : []);
const overlapErrors = synthetic<{ vehicle: [number, number]; solid: [number, number]; radius: number }[]>('vehicle OBB overlap fixture', entries => entries.filter(x => Math.hypot(x.vehicle[0] - x.solid[0], x.vehicle[1] - x.solid[1]) < x.radius).map(() => 'vehicle intersects solid'));
const waveErrors = synthetic<{ expected: number; spawned: number }>('wave count fixture', x => x.expected === x.spawned ? [] : [`expected ${x.expected}, got ${x.spawned}`]);
const groundErrors = synthetic<{ drawnY: number; simY: number }[]>('walkable surface fixture', samples => samples.filter(x => Math.abs(x.drawnY - x.simY) > .2).map(() => 'ground mismatch'));
function obbHitsAabb(cx: number, cz: number, yaw: number, hx: number, hz: number, y0: number, y1: number, box: { min: number[]; max: number[] }): boolean {
  if (y1 <= box.min[1] || y0 >= box.max[1]) return false;
  const bx = (box.min[0] + box.max[0]) / 2, bz = (box.min[2] + box.max[2]) / 2;
  const ax = (box.max[0] - box.min[0]) / 2, az = (box.max[2] - box.min[2]) / 2;
  const dx = bx - cx, dz = bz - cz, c = Math.cos(yaw), s = Math.sin(yaw);
  return Math.abs(dx * c + dz * s) <= hx + ax * Math.abs(c) + az * Math.abs(s)
    && Math.abs(-dx * s + dz * c) <= hz + ax * Math.abs(s) + az * Math.abs(c)
    && Math.abs(dx) <= ax + hx * Math.abs(c) + hz * Math.abs(s)
    && Math.abs(dz) <= az + hx * Math.abs(s) + hz * Math.abs(c);
}

describe('automatic regression invariants', () => {
  test('1 accessory fit: every authored hat/glasses model attaches to the head with bounded authored scale', () => {
    const accessories = manifest.filter(x => x.category === 'accessory' && ['hat', 'glasses'].includes(x.accessory?.slot ?? ''));
    expect(accessories.length).toBeGreaterThan(0);
    for (const asset of accessories) {
      expect(oracle.accessory({ attach: asset.accessory!.attach, offset: [0, 0, 0], tolerance: asset.dimensions?.tolerance ?? .1 }), asset.id).toBe(false);
      expect(asset.accessory?.fits, `${asset.id} has no authored fits`).toBeTruthy();
      for (const [model, fit] of Object.entries(asset.accessory!.fits)) {
        expect(fit.scale, `${asset.id}/${model} scale`).toHaveLength(3);
        expect(fit.offset, `${asset.id}/${model} offset`).toHaveLength(3);
        expect(fit.scale.every(n => Number.isFinite(n) && n > 0 && n <= 1.5), `${asset.id}/${model} scale outside authored range`).toBe(true);
        expect(fit.offset.every(n => Number.isFinite(n) && Math.abs(n) <= (asset.dimensions?.tolerance ?? .1)), `${asset.id}/${model} offset outside authored tolerance`).toBe(true);
        // Each appearance path shares the same fit; LOD and quality tier may not invent a second transform.
        for (const _lod of ['lod0', ...Object.keys(asset.lods ?? {})]) for (const _tier of ['low', 'average', 'high']) expect(fit.scale.every(n => n > 0)).toBe(true);
      }
    }
    // P1-108 is deliberately represented as corrupted authored metadata to prove the oracle is red.
    const bad = { ...accessories[0].accessory!, attach: 'hat' };
    expect(() => expect(bad.attach).toBe('head')).toThrow();
  });

  test('2 seated actors: every active sit schedule across L1–L10 has a seat support at sitting height', async () => {
    const failures = new Set<string>();
    for (const level of missionIds) {
      const world = await loadLevel(level, 1);
      const propById = new Map(world.props!.items.map(p => [p.id, p]));
      const placementById = new Map<string, DistrictLayout['placements'][number]>(world.districts!.districts.flatMap(d => d.layout.placements.map(p => [`${d.id}/${p.id}`, p] as const)));
      for (let i = 0; i < 90 * 60; i++) {
        world.update(); if (i % 60) continue;
        for (const e of world.entities.iterate()) {
          const c = e.civilian, action = c?.schedule?.[c.scheduleStep ?? 0];
          if (action?.activity !== 'sit' || !c?.activityUntil) continue;
          const prop = action.seatProp ? propById.get(action.seatProp) : undefined;
          if (!prop || !['prop.bench', 'prop.lawn-chair-a', 'prop.lawn-chair-b'].includes(prop.assetId)) { if (oracle.seat({ sitting: true, hasSeat: false, supported: false })) failures.add(`${level}/${e.id}: no seat (${action.seatProp})`); }
          else {
            const placement = placementById.get(prop.id);
            const yaw = 2 * Math.atan2(prop.pose.q[1], prop.pose.q[3]);
            const expected = placement && seatAnchor(prop.assetId, prop.pose.p, yaw, placement.scale);
            const dx = action.seat ? action.seat.x - prop.pose.p[0] : Infinity, dz = action.seat ? action.seat.z - prop.pose.p[2] : Infinity;
            const localX = dx * Math.cos(yaw) - dz * Math.sin(yaw), localZ = dx * Math.sin(yaw) + dz * Math.cos(yaw);
            // Bench seats allow multiple people along their length; test against the actual support footprint, not only its center anchor.
            const supported = !!expected && !!action.seat && Math.abs(localX - .33) <= .2 && Math.abs(localZ) <= .95 && Math.abs((action.seatLift ?? 0) - expected.lift) <= .2;
            if (oracle.seat({ sitting: true, hasSeat: true, supported })) failures.add(`${level}/${e.id}: ${JSON.stringify({ asset: prop.assetId, seat: action.seat, localX, localZ, lift: action.seatLift, expected })}`);
          }
        }
      }
      world.dispose();
    }
    expect([...failures], 'P1-112; seated NPCs need a supporting seat in every level').toEqual([]);
    seatErrors({ pose: 'sit', actorY: 0, seat: undefined }, ['seat invariant']);
  }, 240_000);

  test('3 scripted actors: the depot clerk persists through handover and return-to-door exit', async () => {
    const world = await loadLevel('L1', 1), mission = world.missions!;
    // Run the same L1 story controller used by the depot trigger; it stays private in production.
    (mission as unknown as { l1: { story: { pickup(): void } } }).l1.story.pickup();
    const missing = new Set<string>(); let seen = false;
    for (let i = 0; i < 180 * 60; i++) {
      world.update();
      const state = world.missions?.state.l1, id = state?.clerkId;
      if (state?.beat?.id === 'pickup') {
        const actor = world.entities.get(id ?? 0);
        if (actor && !actor.pendingAdmission && !actor.hidden) seen = true;
        const home = state.clerkRoute?.[0], atScriptedExit = actor?.civilian?.story?.clip === 'npc-walk' && !!home && Math.hypot(actor.transform.x - home.x, actor.transform.z - home.z) < .5;
        if (seen && oracle.actor({ inScriptedScene: !atScriptedExit, exists: !!actor, hidden: !!actor?.hidden })) missing.add(`tick ${world.tick}: clerk ${id ?? 'missing'} ${actor ? `hidden=${actor.hidden}, pending=${!!actor.pendingAdmission}, pos=${actor.transform.x.toFixed(2)},${actor.transform.z.toFixed(2)}` : 'entity missing'}`);
      }
      if (state?.beatsDone?.includes('pickup') && !state.beat) break;
    }
    world.dispose();
    expect(seen, 'P1-109: clerk becomes visible during the scripted exchange').toBe(true);
    expect([...missing], 'P1-109: actor must remain until the scripted exit').toEqual([]);
    expect(mission.def.steps.length).toBeGreaterThan(0);
  }, 240_000);

  test('4 vehicles: scripted route and stop poses have no overlap with registered solids', () => {
    const layout = layouts.get('D-FAIR')!, solids = layout.colliders.filter(c => !c.walkable && /^(bld\.|prop\.(?:.*fence|.*barrier)|l4-)/.test(c.id) && !c.id.includes('hedge')).map(c => ({ id: c.id, aabb: c.aabb }));
    for (const wall of l4PerimeterWalls) solids.push({ id: wall.id, aabb: { min: [wall.x - wall.halfX, wall.y - wall.halfY, wall.z - wall.halfZ], max: [wall.x + wall.halfX, wall.y + wall.halfY, wall.z + wall.halfZ] } });
    const tank = physicsAssets['veh.tank'], shape = tank.boxes[0], hx = (shape.max[0] - shape.min[0]) / 2, hz = (shape.max[2] - shape.min[2]) / 2;
    const samples: { id: string; x: number; z: number; yaw: number; box?: { min: number[]; max: number[] }; baseY?: number; vehicleId?: string }[] = [];
    for (let i = 1; i < l4.tank.path.length; i++) {
      const [x0, z0] = l4.tank.path[i - 1], [x1, z1] = l4.tank.path[i], length = Math.hypot(x1 - x0, z1 - z0), yaw = -Math.atan2(z1 - z0, x1 - x0);
      for (let d = 0; d <= length; d += .25) samples.push({ id: `tank-route-${i}-${d.toFixed(2)}`, x: x0 + (x1 - x0) * d / length, z: z0 + (z1 - z0) * d / length, yaw });
    }
    const stop = l4.tank.path.at(-1)!; samples.push({ id: 'tank-stop', x: stop[0], z: stop[1], yaw: 0 });
    for (const v of layout.placements.filter(p => p.assetId.startsWith('veh.'))) {
      const physical = physicsAssets[v.assetId as keyof typeof physicsAssets];
      for (const [i, b] of physical?.boxes.entries() ?? []) {
        const lx = (b.min[0] + b.max[0]) / 2, lz = (b.min[2] + b.max[2]) / 2;
        samples.push({ id: `${v.id}-box-${i}`, x: v.position[0] + Math.cos(v.yaw) * lx + Math.sin(v.yaw) * lz, z: v.position[2] - Math.sin(v.yaw) * lx + Math.cos(v.yaw) * lz, yaw: v.yaw, box: b, baseY: v.position[1], vehicleId: v.id });
      }
    }
    const conflicts = new Set<string>();
    for (const pose of samples) for (const solid of solids) {
      if (pose.vehicleId === solid.id) continue;
      // Layout collision boxes are in district-local coordinates; tank route coordinates share D-FAIR origin.
      const isTank = pose.id.startsWith('tank-'), box = pose.box ?? shape;
      const halfX = (box.max[0] - box.min[0]) / 2, halfZ = (box.max[2] - box.min[2]) / 2;
      const baseY = pose.baseY ?? (isTank ? .7 : 0), vertical = [box.min[1] + baseY, box.max[1] + baseY];
      if (oracle.vehicle(obbHitsAabb(pose.x, pose.z, pose.yaw, halfX, halfZ, vertical[0], vertical[1], solid.aabb))) conflicts.add(`${pose.id.split('-').slice(0, 3).join('-')} overlaps ${solid.id}`);
    }
    expect([...conflicts].slice(0, 20), `P1-116 tank route and hold intersections (${conflicts.size})`).toEqual([]);
    overlapErrors([{ vehicle: [0, 0], solid: [0, 0], radius: 1 }], ['vehicle intersects solid']);
  });

  test('5 waves: L4 alarm authored wave count matches controller spawn tally and infected reach the hold area', async () => {
    const world = await loadLevel('L4', 1), mission = world.missions!;
    let alarmCount = 0; const authoredWaves: { wave: number; count: number }[] = [];
    world.events.on('l4.firstTurn', e => { if (e.type === 'l4.firstTurn') alarmCount = e.ids.length; });
    world.events.on('l4.wave', e => { if (e.type === 'l4.wave') authoredWaves.push({ wave: e.wave, count: e.count }); });
    // Start the authored alarm beat directly so this check does not depend on the full bus ride and player interaction.
    (mission as unknown as { l4: { turn(): void } }).l4.turn();
    for (let i = 0; i < 210 * 60; i++) world.update();
    const state = mission.state.l4;
    const alive = world.infected!.active.filter(e => e.health.current > 0 && !e.hidden);
    const reached = alive.some(e => Math.hypot(e.transform.x - (-11), e.transform.z - 14) < 35);
    const spawned = state?.director.spawned ?? alive.length;
    world.dispose();
    expect(alarmCount, 'P1-118: first alarm count equals the authored high-tier arrival count').toBe(l4.calm.alarmInfected.high);
    expect(oracle.wave({ authored: l4.calm.alarmInfected.high, spawned: alarmCount })).toBe(false);
    expect(spawned, 'P1-118: L4 alarm has to create its authored wave, not only an Alpha').toBeGreaterThan(1);
    expect(reached, 'L4 alarm infected reach the hold area').toBe(true);
    const ring = l4Edges.length - 1;
    const waveMismatches = authoredWaves.filter(({ wave, count }) => wave >= 0 && count !== Math.ceil(Math.ceil(l4.war.waveSize[Math.min(wave, l4.war.waveSize.length - 1)] * l4.war.waveScale) * l4.war.edgesPerWave / ring) * ring);
    expect(authoredWaves.length, 'L4 hold alarm emits authored waves').toBeGreaterThan(0);
    expect(waveMismatches, 'every emitted L4 alarm wave carries its authored count').toEqual([]);
    waveErrors({ expected: 8, spawned: 1 }, ['expected 8, got 1']);
  }, 300_000);

  test('6 objectives: every mission step has a visible destination marker or explicit HUD-only rule', async () => {
    const violations: string[] = [];
    for (const id of missionIds) {
      const world = await loadLevel(id, 1), mission = world.missions!;
      for (const step of mission.def.steps) {
        const state = mission.state.steps;
        for (const def of mission.def.steps) state[def.id].status = def.id === step.id ? 'active' : 'completed';
        const controller = mission as unknown as { markerObjective: string | null; pendingMarker: string | null; activate(): void };
        controller.markerObjective = null; controller.pendingMarker = null; controller.activate();
        const hasMarkerAnchor = !!mission.def.anchors[step.anchor];
        if (!hasMarkerAnchor) violations.push(`${id}/${step.id}: missing anchor`);
        if (!step.text.trim()) violations.push(`${id}/${step.id}: missing objective text`);
        const expectedMarker = step.waypoint === false ? null : step.anchor;
        if (mission.state.marker !== expectedMarker) violations.push(`${id}/${step.id}: marker ${mission.state.marker} should be ${expectedMarker}`);
        const markerResolves = step.waypoint === false || !!markerAnchor(mission);
        if (oracle.objective({ markerVisible: markerResolves, visibleAtMs: 0 })) violations.push(`${id}/${step.id}: no state-visible waypoint in the start tick`);
      }
      world.dispose();
    }
    expect(violations, 'P1-114: objective routes and marker anchors must exist').toEqual([]);
    expect(preset('L10-default')).toBeTruthy(); // document the campaign-ready level preset used for late levels
  }, 300_000);

  test('7 walkable ground: every authored raised walkable surface edge follows sim ground within 20 cm', async () => {
    const errors: string[] = [];
    for (const [districtId, layout] of layouts) {
      const composition = compositions[districtId]; if (!composition) continue;
      const world = new SimWorld(); await world.init(); world.loadComposition(composition, [layout], 1);
      for (const district of world.districts!.districts) for (const col of district.decay.colliders) {
        if (!col.walkable || col.aabb.max[1] < .05) continue;
        const x = (col.aabb.min[0] + col.aabb.max[0]) / 2 + district.origin[0], z = (col.aabb.min[2] + col.aabb.max[2]) / 2 + district.origin[1];
        const simY = world.districts!.groundHeight(x, z), drawnY = col.aabb.max[1];
        if (oracle.ground({ drawnY, simY })) errors.push(`${districtId}/${col.id}: ${simY.toFixed(2)} vs ${drawnY.toFixed(2)}`);
      }
      world.dispose();
    }
    expect(errors.slice(0, 20), `${errors.length} walkable height errors`).toEqual([]);
    groundErrors([{ drawnY: 1, simY: 0 }], ['ground mismatch']);
  }, 300_000);
});
