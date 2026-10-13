import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import manifest from '../../../src/assets/manifest.json';
import { assetExtent, finale, propBox, type Box, type FinaleLane } from '../../../src/data/l10Finale';
import { assetIO } from '../../../tools/assets/io';

type P = [number, number];
const dist = (a: P, b: P) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const inBox = (p: P, b: Box, margin = 0) => p[0] >= b.min[0] - margin && p[0] <= b.max[0] + margin && p[1] >= b.min[1] - margin && p[1] <= b.max[1] + margin;
const boxDistance = (p: P, b: Box) => Math.hypot(Math.max(b.min[0] - p[0], p[0] - b.max[0], 0), Math.max(b.min[1] - p[1], p[1] - b.max[1], 0));
function sample(points: P[], step = .25): P[] {
  const out: P[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const n = Math.max(1, Math.ceil(dist(points[i - 1], points[i]) / step));
    for (let k = 1; k <= n; k++) out.push([points[i - 1][0] + (points[i][0] - points[i - 1][0]) * k / n, points[i - 1][1] + (points[i][1] - points[i - 1][1]) * k / n]);
  }
  return out;
}
const boxes = [...finale.props.map(p => ({ id: p.id, box: propBox(p.asset, p.at, p.yaw) })), { id: 'gun', box: propBox(finale.gun.asset, finale.gun.at, finale.gun.yaw) }];
const byId = (id: string) => boxes.find(b => b.id === id)!.box;

test('T-E32-17-extents @L10 the extent table equals the real GLB bounds (LOD0, game axes) and every prop is registered', async () => {
  const io = await assetIO();
  for (const id of Object.keys(assetExtent)) {
    expect(manifest.some(a => a.id === id), `${id} registered`).toBe(true);
    const doc = await io.read(`public/assets/models/${id}.glb`);
    const min = [Infinity, Infinity], max = [-Infinity, -Infinity], p: number[] = [];
    for (const node of doc.getRoot().listNodes()) {
      const mesh = node.getMesh(); if (!mesh) continue;
      const m = node.getWorldMatrix();
      for (const prim of mesh.listPrimitives()) {
        const pos = prim.getAttribute('POSITION')!;
        for (let i = 0; i < pos.getCount(); i++) {
          pos.getElement(i, p);
          const x = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], z = m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14];
          min[0] = Math.min(min[0], x); max[0] = Math.max(max[0], x); min[1] = Math.min(min[1], z); max[1] = Math.max(max[1], z);
        }
      }
    }
    const [x0, x1, z0, z1] = assetExtent[id];
    for (const [got, want, label] of [[min[0], x0, 'x0'], [max[0], x1, 'x1'], [min[1], z0, 'z0'], [max[1], z1, 'z1']] as [number, number, string][]) expect(Math.abs(got - want), `${id} ${label}`).toBeLessThan(.08);
  }
  const ids = new Set<string>();
  for (const p of finale.props) { expect(ids.has(p.id), `duplicate ${p.id}`).toBe(false); ids.add(p.id); expect(p.asset in assetExtent).toBe(true); }
});

test('T-E32-17-gun @L10 mounted gun is on the central platform deck and at most 20 m from the console', () => {
  const platform = byId(finale.gun.platform), gun = byId('gun');
  expect(dist(finale.gun.at, finale.console.at)).toBeLessThanOrEqual(finale.gunMaxDistance);
  // Deck = asset x -4.05..4 (the stair continues to +x): the whole gun box is on it.
  const deck: Box = { min: platform.min, max: [platform.min[0] + 8.05, platform.max[1]] };
  expect(inBox(gun.min, deck) && inBox(gun.max, deck), 'gun box inside the deck outline').toBe(true);
  expect(finale.gun.deckHeight).toBeCloseTo(3, 1);
  expect(dist(finale.platformStair.at, finale.console.at)).toBeLessThanOrEqual(8);
  expect(inBox(finale.platformStair.top, platform, .1)).toBe(true);
  expect(boxDistance(finale.platformStair.at, platform)).toBeLessThanOrEqual(.1);
});

test('T-E32-17-no-overlap @L10 props never overlap each other (pipe flanges may meet)', () => {
  const props = finale.props.map(p => ({ id: p.id, role: p.role, box: byId(p.id) }));
  for (let i = 0; i < props.length; i++) for (let j = i + 1; j < props.length; j++) {
    const a = props[i].box, b = props[j].box, tol = props[i].role === 'pipe-run' && props[j].role === 'pipe-run' ? .6 : .15;
    const overlap = a.min[0] < b.max[0] - tol && b.min[0] < a.max[0] - tol && a.min[1] < b.max[1] - tol && b.min[1] < a.max[1] - tol;
    expect(overlap, `${props[i].id} overlaps ${props[j].id}`).toBe(false);
  }
});

test('T-E32-17-lanes @L10 dodge lanes: inside the 25 m hold zone, clear of every prop by the lane half width, connected', () => {
  const lanes: FinaleLane[] = finale.lanes;
  for (const lane of lanes) {
    for (const p of sample(lane.points)) {
      expect(dist(p, finale.console.at), `${lane.id} ${p} within hold zone`).toBeLessThanOrEqual(finale.holdRadius);
      for (const b of boxes) expect(boxDistance(p, b.box), `${lane.id} at ${p.map(v => v.toFixed(1))} clear of ${b.id}`).toBeGreaterThanOrEqual(lane.halfWidth);
    }
  }
  for (let i = 1; i < lanes.length; i++) {
    const start = lanes[i].points[0];
    expect(lanes.slice(0, i).some(o => sample(o.points).some(p => dist(p, start) <= .3)), `${lanes[i].id} joins an earlier lane`).toBe(true);
  }
  expect(dist(finale.arrival.route[finale.arrival.route.length - 1], lanes[0].points[0])).toBeLessThanOrEqual(.3);
});

test('T-E32-17-install @L10 installation anchor sits at the tank outlet side, in the hold zone, outside every prop; approach is clear', () => {
  const tank = byId(finale.installation.tank);
  expect(dist(finale.installation.at, finale.console.at)).toBeLessThanOrEqual(finale.holdRadius);
  for (const b of boxes) expect(inBox(finale.installation.at, b.box), `install point inside ${b.id}`).toBe(false);
  expect(boxDistance(finale.installation.at, tank), 'within 3 m of the tank').toBeLessThanOrEqual(3);
  // The outlet is on the tank's -x side after the 180 degree turn (asset outlet at +x), facing the console.
  expect(finale.props.find(p => p.id === finale.installation.tank)!.yaw).toBe(180);
  expect(finale.installation.at[0]).toBeLessThan(tank.min[0] + 3);
  for (const p of sample(finale.arrival.route)) for (const b of boxes) expect(boxDistance(p, b.box), `approach clear of ${b.id}`).toBeGreaterThanOrEqual(2.5);
});

test('T-E32-17-scene @L10 the arena Scene Lab specs place exactly the anchored props', () => {
  for (const name of ['asset-l10-dispersal-arena', 'asset-l10-dispersal-arena-hold', 'asset-l10-dispersal-arena-gun']) {
    const spec = JSON.parse(readFileSync(`specs/scenes/catalog/${name}.json`, 'utf8')) as { props: { id: string; asset: string; at: number[]; yaw: number }[] };
    for (const p of finale.props) expect(spec.props.find(s => s.id === p.id), `${p.id} in ${name}`).toMatchObject({ asset: p.asset, at: p.at, yaw: p.yaw });
    expect(spec.props.find(s => s.id === 'gun')).toMatchObject({ asset: finale.gun.asset, at: [finale.gun.at[0], finale.gun.deckHeight, finale.gun.at[1]] });
  }
});
