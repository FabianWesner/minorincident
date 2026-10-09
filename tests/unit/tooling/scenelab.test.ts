import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import manifest from '../../../src/assets/manifest.json';
import type { AssetDef } from '../../../src/assets/types';
import type { DistrictLayout } from '../../../src/levels/districts/types';
import { DistrictWorld } from '../../../src/sim/world/DistrictWorld';
import { buildScene, placementFor, validateSpec, type SceneSpec } from '../../../src/debug/scenelab/spec';
import { boneClipping, boxOf, pointTriangleDistance2, segmentTriangle, staticClipping, trianglesIntersect, type TriangleSet } from '../../../src/debug/scenelab/geometry';
import { summarizeMotion, torsoPitch, type MotionFrame } from '../../../src/debug/scenelab/motion';

const assets = new Map((manifest as AssetDef[]).map(a => [a.id, a]));
const grove = JSON.parse(readFileSync('public/assets/layouts/D-GROVE.layout.json', 'utf8')) as DistrictLayout;
const tri = (...v: number[]) => new Float32Array(v);
const set = (id: string, tris: Float32Array): TriangleSet => ({ id, assetId: id, tris, box: boxOf(tris) });

describe('Scene Lab spec', () => {
  it('reports readable validation errors', () => {
    const errors = validateSpec({ props: [{ asset: 'prop.nope', at: [0, 0] }], actors: [{ kind: 'courier' }, { kind: 'courier' }], ground: 'district' }, assets);
    expect(errors.join('\n')).toMatch(/unknown manifest id prop\.nope/);
    expect(errors.join('\n')).toMatch(/at most one courier/);
    expect(errors.join('\n')).toMatch(/needs layout\.district/);
  });
  it('places props with the layout exporter footprint and loads as a real district', () => {
    const p = placementFor({ asset: 'prop.bench', at: [2, 3], yaw: 90, scale: .95 }, 0, assets), d = assets.get('prop.bench')!.dimensions;
    expect(p.yaw).toBeCloseTo(Math.PI / 2);
    expect(p.visualAabb.max[0] - p.visualAabb.min[0]).toBeCloseTo(d.z * .95, 4); // rotated: depth becomes width
    const spec: SceneSpec = { props: [{ id: 'bench', asset: 'prop.bench', at: [0, 0], yaw: 90 }, { id: 'house', asset: 'bld.house-a', at: [8, 0] }], actors: [{ kind: 'courier', at: [-5, 0] }] };
    const built = buildScene(spec, assets);
    expect(built.composition.scene).toEqual({ glb: false, ground: 'grass', perimeter: false, courier: true });
    const world = new DistrictWorld(built.composition, [built.layout], 1);
    // Solid placements get their compound GLB collision boxes, exactly as in a shipped district.
    expect(world.districts[0].decay.colliders.some(c => c.id.startsWith('house/geometry-'))).toBe(true);
    expect(world.playerStart).toEqual([-5, 0]);
  });
  it('copies requested gameplay anchors with the crop shift, leaving the shipped layout intact', () => {
    const spec = JSON.parse(readFileSync('docs/scenes/gate-lockin.json', 'utf8')) as SceneSpec;
    expect(validateSpec(spec, assets)).toEqual([]);
    const before = structuredClone(grove.anchors['gate-1']);
    const built = buildScene(spec, assets, grove);
    expect(Object.keys(built.layout.anchors)).toEqual(['gate-1']);
    expect(built.layout.anchors['gate-1'].position).toEqual([0, 0, -.5]);
    expect(grove.anchors['gate-1']).toEqual(before);
    expect(() => buildScene({ layout: { district: 'D-GROVE', anchors: ['missing'] } }, assets, grove)).toThrow('Unknown layout anchor missing');
  });
  it('crops a shipped layout by bbox and asset filter, optionally recentred', () => {
    const spec: SceneSpec = { layout: { district: 'D-GROVE', bbox: [[0, 22], [5, 28]], assets: ['prop.flower-bed*', 'prop.picket-fence'], recenter: true } };
    const built = buildScene(spec, assets, grove);
    expect(built.placements.map(p => p.assetId).sort()).toEqual(['prop.flower-bed.large', 'prop.picket-fence']);
    for (const p of built.placements) { expect(Math.abs(p.position[0])).toBeLessThan(3); expect(Math.abs(p.position[2])).toBeLessThan(4); }
    expect(() => new DistrictWorld(built.composition, [built.layout], 1)).not.toThrow();
  });
  it('every shipped example spec validates', () => {
    for (const file of readdirSync('specs/scenes').filter(f => f.endsWith('.json'))) {
      const spec = JSON.parse(readFileSync(`specs/scenes/${file}`, 'utf8')) as SceneSpec;
      expect(validateSpec(spec, assets), file).toEqual([]);
    }
  });
});

describe('Scene Lab clipping geometry', () => {
  const floor = tri(-1, 0, -1, 1, 0, -1, 0, 0, 1);
  it('segment and triangle tests', () => {
    expect(segmentTriangle(0, 1, 0, 0, -1, 0, floor, 0)).toBeCloseTo(.5);
    expect(segmentTriangle(0, 1, 0, 0, .1, 0, floor, 0)).toBe(-1);
    expect(Math.sqrt(pointTriangleDistance2(0, .3, 0, floor, 0))).toBeCloseTo(.3);
    expect(Math.sqrt(pointTriangleDistance2(3, 0, 0, floor, 0))).toBeGreaterThan(1.5);
    const wall = tri(0, -1, -.5, 0, 1, -.5, 0, 0, .5);
    expect(trianglesIntersect(floor, 0, wall, 0)).toBe(true);
    expect(trianglesIntersect(floor, 0, tri(0, .5, -.5, 0, 1, -.5, 0, .7, .5), 0)).toBe(false);
  });
  it('reports static pairs that cut through each other, not neighbours', () => {
    const a = set('fence', tri(0, 0, -1, 0, 1, -1, 0, 0, 1)), b = set('bed', tri(-.5, .3, 0, .5, .3, 0, 0, .3, .5)), c = set('far', tri(5, 0, 0, 6, 0, 0, 5, 1, 0));
    const clips = staticClipping([a, b, c]);
    expect(clips).toHaveLength(1);
    expect(clips[0]).toMatchObject({ a: 'fence', b: 'bed', intersectingTriangles: 1 });
    expect(staticClipping([a, b], () => true)).toHaveLength(0);
  });
  it('flags bones that pierce or sink into a prop, ignores clear ones', () => {
    const seat = set('bench', tri(-1, .5, -1, 1, .5, -1, 0, .5, 1));
    expect(boneClipping([{ name: 'thighL', a: [0, .48, 0], b: [0, .6, -.3], radius: .065 }], [seat])[0]).toMatchObject({ bone: 'thighL', crossing: true });
    expect(boneClipping([{ name: 'thighL', a: [0, .52, 0], b: [0, .52, -.3], radius: .065 }], [seat])[0]).toMatchObject({ crossing: false });
    expect(boneClipping([{ name: 'thighL', a: [0, .6, 0], b: [0, .6, -.3], radius: .065 }], [seat])).toEqual([]);
  });
});

describe('Scene Lab motion metrics', () => {
  const step = (frame: number, x: number, y: number): MotionFrame => ({ frame, feet: [{ heel: [x, y, 0], toe: [x + .13, y, 0], yaw: 0 }], floor: 0 });
  it('measures planted-foot slide against the known floor', () => {
    const still = Array.from({ length: 10 }, (_, i) => step(i, 0, 0)), sliding = Array.from({ length: 10 }, (_, i) => step(i, i * .01, 0));
    expect(summarizeMotion(still).slideMaxCm).toBe(0);
    expect(summarizeMotion(sliding).slideMaxCm).toBeCloseTo(9, 0);
    // A foot 3 cm through the ground still counts as planted and is reported as sink.
    expect(summarizeMotion(Array.from({ length: 5 }, (_, i) => step(i, 0, -.03)))).toMatchObject({ contacts: 1, sinkMaxCm: 3 });
    // The first three frames are the spawn settle and never count as sink.
    expect(summarizeMotion(Array.from({ length: 5 }, (_, i) => step(i, 0, i < 3 ? -.2 : 0))).sinkMaxCm).toBe(0);
    // Seated clips are excluded from contact metrics.
    expect(summarizeMotion(sliding.map(f => ({ ...f, clip: 'npc-sit' }))).contacts).toBe(0);
  });
  it('torso pitch is signed toward the facing direction', () => {
    expect(torsoPitch([0, 1, 0], [0, 2, 0], [1, 0, 0])).toBeCloseTo(0);
    expect(torsoPitch([0, 1, 0], [.5, 1.5, 0], [1, 0, 0])).toBeCloseTo(45);
    expect(torsoPitch([0, 1, 0], [-.5, 1.5, 0], [1, 0, 0])).toBeCloseTo(-45);
  });
});
