import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { worldAssets } from '../../../src/assets/worldDefinitions';
import { gameplay } from '../../../src/levels/districts/D-ZOO';
import type { DistrictLayout, Point } from '../../../src/levels/districts/types';
import { resolveDecay, validateLayout, resolvePosition } from '../../../src/levels/districts/validate';
import { placementColliders } from '../../../src/levels/districts/staticCollision';
import { bakeNav } from '../../../src/sim/world/NavGrid';
import { crossValidate } from '../../../src/levels/districts/crossValidate';
const layout = JSON.parse(readFileSync('public/assets/layouts/D-ZOO.layout.json', 'utf8')) as DistrictLayout;
const species = ['lion', 'gorilla', 'elephant', 'zebra', 'flamingo'];
const point = (name: string): Point => resolvePosition({ anchor: name }, layout);
const nav = () => bakeNav([{ layout, origin: [0, 0], colliders: placementColliders(layout.placements.filter(p => p.minTier === 0), layout.colliders.filter(c => c.minTier === 0)).filter(c => !c.walkable).map(c => c.aabb) }], 30, .5);

test('T-E30-05-district @E30-AC05 intact zoo facilities, named enclosures, public lights and service infrastructure', () => {
  expect(validateLayout(layout, worldAssets)).toEqual([]);
  expect(layout.bounds).toEqual([[-120,-90],[120,-90],[120,90],[-120,90],[-120,-90]]);
  const base = resolveDecay(layout, 0);
  for (const id of ['bld.zoo-gate','bld.reptile-house','bld.park-lodge','kit.guard-tower','kit.maintenance-corridor','prop.street-lamp','prop.hose-reel','prop.sprinkler']) expect(base.placements.some(p => p.assetId === id), id).toBe(true);
  expect(base.placements.filter(p => p.assetId === 'prop.street-lamp').length).toBeGreaterThanOrEqual(20);
  expect(base.placements.filter(p => p.assetId === 'kit.guard-tower')).toHaveLength(4);
  expect(base.placements.filter(p => p.assetId === 'kit.maintenance-corridor')).toHaveLength(3);
  expect(base.placements.every(p => base.lights.includes(p.lightGroup))).toBe(true);
  expect(base.placements.some(p => /wreck|corpse|decay/.test(p.assetId))).toBe(false);
  expect(gameplay.decay).toEqual([]);
  for (const s of species) expect(layout.zones?.[`enclosure-${s}`]).toBeDefined();
  expect(crossValidate(gameplay, layout, nav()).errors).toEqual([]);
});

test('T-E30-06-walls @E30-AC06 continuous four-metre perimeter blocks exterior navigation on all four faces', () => {
  const walls = layout.colliders.filter(c => c.id.startsWith('zoo-wall-'));
  expect(walls).toHaveLength(4);
  const grid = nav();
  for (const wall of walls) {
    expect(wall.aabb.min[1]).toBe(0); expect(wall.aabb.max[1]).toBeGreaterThanOrEqual(4);
    expect(wall.minTier).toBe(0); expect(wall.maxTier).toBe(5);
  }
  // Flood from the outside annulus: no inside cell is reachable through corners or a gate gap.
  for (const start of [[0,-88],[0,88],[-118,0],[118,0]] as Point[]) {
    expect(grid.walkable(start)).toBe(true);
    const reached = grid.flood(start);
    for (const dest of ['arrival','exit',...species.map(s => `animal-${s}`)]) expect(reached[grid.index(...point(dest))], `${start} -> ${dest}`).toBe(0);
  }
});

test('T-E30-12-district @E30-AC12 each enclosure has two independent public escape routes with 2.5 m clear width', () => {
  const grid = nav(), reached = grid.flood(point('exit'));
  for (const s of species) expect(reached[grid.index(...point(`animal-${s}`))], `${s} default animal spawn`).toBe(1);
  const graph = layout.roads;
  const connected = (start: string, removed: string): boolean => {
    const seen = new Set([start]);
    for (let change = true; change;) {
      change = false;
      for (const e of graph.edges.filter(e => e.id !== removed)) if (seen.has(e.start) || seen.has(e.end)) for (const n of [e.start,e.end]) if (!seen.has(n)) { seen.add(n); change = true; }
    }
    return seen.has('vehicle');
  };
  for (const s of species) for (const side of ['north','south']) {
    const gate = point(`${s}-gate-${side}`);
    expect(reached[grid.index(...gate)], `${s}/${side}`).toBe(1);
    // A capsule's .4 m baked margin is already included; the entire required width stays open.
    for (let dx = -1.25; dx <= 1.25; dx += .25) expect(grid.walkable([gate[0]+dx,gate[1]]), `${s}/${side} width ${dx}`).toBe(true);
    const node = graph.nodes.find(n => n.point[0] === gate[0] && n.point[1] === (Math.abs(gate[1]) < 32 ? 0 : Math.sign(gate[1])*64))!;
    expect(node).toBeDefined();
    // No single public path edge can sever this gate's connection to the vehicle.
    for (const e of graph.edges.filter(e => !e.id.includes(`${s}-gate`) && !e.id.includes('vehicle'))) expect(connected(node.id,e.id),`${s}/${side} without ${e.id}`).toBe(true);
  }
  for (const e of graph.edges) {
    expect(e.laneWidth).toBeGreaterThanOrEqual(2.5);
    const [a,b] = e.points, length = Math.hypot(b[0]-a[0],b[1]-a[1]);
    for (let t=0;t<=length;t+=.5) for (const offset of [-1.25,0,1.25]) {
      const p: Point = [a[0]+(b[0]-a[0])*t/length-(b[1]-a[1])*offset/length,a[1]+(b[1]-a[1])*t/length+(b[0]-a[0])*offset/length];
      expect(grid.walkable(p),`${e.id} @ ${p}`).toBe(true);
    }
  }
});

test('T-E30-06-sight @E30-AC06 shipped district registers perimeter as actual attack/sight cover', async () => {
  const { SimWorld } = await import('../../../src/sim/world/SimWorld');
  const world = new SimWorld(); await world.init();
  try {
    world.loadComposition({ id:'D-ZOO',tier:0,timeOfDay:'L8-zoo',districts:[{id:'D-ZOO',origin:[0,0]}] },[layout],30);
    const { installL1Outbreak } = await import('../../../src/sim/outbreak/install');
    installL1Outbreak(world,{civilians:0});
    const perception = world.infected!.configureL1v2();
    for (const [a,b] of [[[0,-88],[0,-80]],[[0,88],[0,80]],[[-118,0],[-110,0]],[[118,0],[110,0]]] as [Point,Point][]) {
      expect(world.combat!.query.visible({x:a[0],z:a[1]},{x:b[0],z:b[1]})).toBe(false);
      expect(perception.lineOfSight({x:a[0],z:a[1]},{x:b[0],z:b[1]})).toBe(false);
    }
  } finally { world.dispose(); }
});

test('T-E30-06-scene @E30-AC06 district Scene Lab crops retain/recenter masonry collision and excluded pond', async () => {
  const { buildScene } = await import('../../../src/debug/scenelab/spec');
  const assets = new Map(Object.values(worldAssets).map(a => [a.id,a]));
  const built = buildScene({name:'wall',ground:'district',layout:{district:'D-ZOO',bbox:[[100,-20],[120,20]],recenter:true}},assets,layout);
  const wall = built.layout.colliders.find(c => c.id === 'zoo-wall-east')!;
  expect(wall).toBeDefined(); expect(wall.aabb.min[0]).toBeCloseTo(5.6);
  expect(built.layout.colliders.some(c => c.id === 'zoo-wall-west')).toBe(false);
  expect(built.layout.walkable.excluded[0][0]).toEqual([-118,-38]);
  const compound = structuredClone(layout), p = compound.placements[0];
  compound.colliders.push({id:`${p.id}/part`,aabb:p.visualAabb,minTier:0,maxTier:5});
  const filtered = buildScene({ground:'district',size:240,layout:{district:'D-ZOO',assets:[]}},assets,compound);
  expect(filtered.layout.colliders.some(c => c.id === `${p.id}/part`)).toBe(false);
  expect(filtered.layout.colliders.filter(c => c.id.startsWith('zoo-wall-'))).toHaveLength(4);
});

test('T-E30-05-foot-probe @E30-AC05 paused/raised scene starts cannot change the measured asset shoe depth', async () => {
  const { Group, Object3D, Vector3 } = await import('three');
  const { SceneLab } = await import('../../../src/debug/scenelab/SceneLab');
  const root = new Group(), foot = new Object3D(); foot.position.y = .16; root.add(foot);
  const actor = {kind:'courier',sole:undefined as number | undefined};
  // Exercise the production probe with a real transformed joint, including portrait scale.
  const lab = Object.assign(Object.create(SceneLab.prototype) as {calibrateSole():void}, {
    game:{view:{labProbes:()=>({character:Object.assign(root,{node:()=>foot})})},world:{districts:{pavingHeight:()=>.12}}},
    actors:new Map([['courier',actor]]),point:new Vector3(),
  });
  for (const scale of [1,1.25]) for (const height of [.005,.125,3.005]) {
    root.scale.setScalar(scale); root.position.y = height; lab.calibrateSole();
    expect(actor.sole).toBeCloseTo(.16,8);
  }
});
