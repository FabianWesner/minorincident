// L9 night drive (E31 art direction addendum): the warm and glinting light points along the crossing.
// Render-only: nothing here has gameplay state, collision or damage. Pools reuse the E25 light field (statics),
// fires reuse the E27 persistent-flame path (Blasts), so this file only places them and draws the small emitters.
import { BoxGeometry, Color, Group, InstancedMesh, Matrix4, MeshBasicNodeMaterial, Quaternion, Vector3 } from 'three/webgpu';
import { float, luminance, vec3 } from 'three/tsl';
import manifest from '../assets/manifest.json' with { type: 'json' };
import { crossing } from '../levels/L9/district';
import { Rng } from '../core/Rng';
import { footprint, type FieldLight, type LightField } from './LightField';
import type { DistrictWorld } from '../sim/world/DistrictWorld';
import type { Placement } from '../levels/districts/types';

type P2 = [number, number];
/** One small emitter. `flicker` 1 = fire (LightField), `strobe` = the field's 1 Hz on/off; `pool` lights the ground around it. */
export interface Accent {
  kind: 'stud' | 'flare' | 'lantern' | 'hazard' | 'beacon';
  x: number; y: number; z: number; yaw: number; seed: number;
  color: string; glow: number; flicker: 0 | 1; strobe: boolean;
  pool?: { color: string; intensity: number; range: number };
}
/** Render-only persistent fire (Blasts flame cards, smoke, embers and a flickering pool). */
export interface AccentFire { x: number; z: number; radius: number; car: boolean }
export interface AccentSet { points: Accent[]; fires: AccentFire[] }

const dims = new Map((manifest as { id: string; dimensions?: { x: number; y: number; z: number } }[]).map(a => [a.id, a.dimensions]));
const cache = new WeakMap<DistrictWorld, AccentSet>();
const empty: AccentSet = { points: [], fires: [] };

const segDistance = (p: P2, a: P2, b: P2) => {
  const dx = b[0] - a[0], dz = b[1] - a[1], l = dx * dx + dz * dz, t = l ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz);
};
const lineDistance = (p: P2, pts: readonly P2[]) => Math.min(...pts.slice(1).map((b, i) => segDistance(p, pts[i], b)));
/** Distance from a point to the nearest lane edge (negative inside a lane). */
const laneDistance = (p: P2) => Math.min(...crossing.routes.map(r => lineDistance(p, r.points) - r.width / 2));

/** Accents of the loaded crossing, computed once per district world (deterministic, layout-aware). */
export function nightAccents(world: DistrictWorld | null | undefined): AccentSet {
  if (!world) return empty;
  const hit = cache.get(world); if (hit) return hit;
  const district = world.districts.find(d => d.id === 'D-CROSSING');
  const set = district ? crossingAccents(district.decay.placements.filter(p => !district.decay.removed.includes(p.id)), district.origin as P2) : empty;
  cache.set(world, set);
  return set;
}

/** E31 addendum light points: edge studs on the asphalt, refugee lanterns/flares along the gravel tracks, accident flares and
 * hazard blinkers at the verge wrecks, farm fires, burning wrecks, the burning city edge and red warning lamps at the crash. */
export function crossingAccents(placements: readonly Placement[], origin: P2 = [0, 0]): AccentSet {
  // Keyed streams: a candidate's draws never depend on how many others were accepted, so a Scene Lab crop (fewer
  // placements) keeps the same accents in its window as the full game layout.
  const keyed = (key: string) => new Rng(931, `l9-night:${key}`), points: Accent[] = [], fires: AccentFire[] = [];
  const boxes = placements.map(p => [p.visualAabb.min[0], p.visualAabb.min[2], p.visualAabb.max[0], p.visualAabb.max[2]] as const);
  /** Clear of every placement footprint (visual AABB) by `margin` metres. */
  const free = (x: number, z: number, margin: number) => boxes.every(b => x < b[0] - margin || x > b[2] + margin || z < b[1] - margin || z > b[3] + margin);
  const forks: P2[] = [[-450, 0], [450, 0]];
  const nearFork = (x: number, z: number, r: number) => forks.some(f => Math.hypot(x - f[0], z - f[1]) < r);
  const put = (a: Omit<Accent, 'seed'> & { seed?: number }) => points.push({ ...a, x: a.x + origin[0], z: a.z + origin[1], seed: a.seed ?? Math.abs(a.x * 12.9898 + a.z * 78.233) % 6.283 });
  const fire = (x: number, z: number, radius: number, car = false) => fires.push({ x: x + origin[0], z: z + origin[1], radius, car });
  const road = crossing.routes.find(r => r.id === 'road')!;
  // 1) Raised edge studs on the asphalt edge lines (dress.py: ±5.55 m): faint by themselves, they glint in the headlights.
  for (const [i, b] of road.points.slice(1).entries()) {
    const a = road.points[i], d = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / d, uz = (b[1] - a[1]) / d, yaw = -Math.atan2(uz, ux);
    for (let s = 5; s < d - 3; s += 9) for (const side of [-1, 1]) {
      const x = a[0] + ux * s - uz * side * 5.55, z = a[1] + uz * s + ux * side * 5.55;
      if (nearFork(x, z, 22) || x > 438) continue;
      put({ kind: 'stud', x, y: .02, z, yaw, color: side > 0 ? '#ffb24a' : '#dfe8ff', glow: 1, flicker: 0, strobe: false });
    }
  }
  // 2) The refugees marked the gravel tracks: warm storm lanterns on the countryside lane, red road flares on the dry shortcut.
  for (const route of crossing.routes) {
    // The asphalt road: a sparser line of road flares just inside the edge line (an evacuation route, one every ~45 m);
    // on the carriageway, so their pools lift the route band and never the verge it is read against (E31-AC16).
    const lantern = route.id === 'countryside', asphalt = route.id === 'road', hw = route.width / 2;
    for (const [i, b] of route.points.slice(1).entries()) {
      const a = route.points[i];
      if (!asphalt && road.points.some(q => q[0] === a[0] && q[1] === a[1]) && road.points.some(q => q[0] === b[0] && q[1] === b[1])) continue; // shared asphalt
      const d = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / d, uz = (b[1] - a[1]) / d;
      let side = 1;
      const rng = keyed(`track:${route.id}:${i}`);
      for (let s = 12 + rng.next() * 8; s < d - 12; s += (asphalt ? 38 : 20) + rng.next() * 10) {
        side = -side;
        const o = asphalt ? hw - 1.2 - rng.next() * .5 : hw + 1.1 + rng.next() * .9, x = a[0] + ux * s - uz * side * o, z = a[1] + uz * s + ux * side * o, yaw = rng.next() * 6.28;
        if (nearFork(x, z, 20) || x > 440 || !free(x, z, .8)) continue;
        if (lantern) put({ kind: 'lantern', x, y: .14, z, yaw, color: '#ffb35c', glow: 5, flicker: 1, strobe: false, pool: { color: 'light_window_warm', intensity: 3.2, range: 3.4 } });
        else put({ kind: 'flare', x, y: .03, z, yaw, color: '#ff3a2a', glow: 7, flicker: 1, strobe: false, pool: { color: '#ff4a32', intensity: 3.6, range: 3.6 } });
      }
    }
  }
  // 3) Verge wrecks: half blink their hazard lights, a road flare marks most accident scenes, some burned ones still burn.
  const wrecks = placements.filter(p => p.assetId.startsWith('veh.') && p.assetId !== 'veh.wreck' && p.position[1] > -1);
  for (const p of wrecks) {
    const [x, , z] = p.position, lane = laneDistance([x, z]);
    if (lane > 16 || x > 528) continue;
    const rng = keyed(`wreck:${p.id}`), roll = rng.next();
    if (p.decay === 'burned') { if (roll < .7) fire(x, z, 1.4, true); continue; }
    const size = dims.get(p.assetId); if (!size) continue;
    if (roll < .55 && x < 455) {
      // Four corner blinkers in one phase; the first carries the amber pool over the car.
      const c = Math.cos(p.yaw), s = Math.sin(p.yaw), hx = size.x * p.scale[0] / 2 + .03, hz = size.z * p.scale[2] / 2 * .82, y = size.y * p.scale[1] * .36, phase = rng.next() * 2;
      for (const [k, [lx, lz]] of [[hx, hz], [hx, -hz], [-hx, hz], [-hx, -hz]].entries()) put({ kind: 'hazard', x: x + lx * c + lz * s, y, z: z - lx * s + lz * c, yaw: p.yaw, color: '#ffa21f', glow: 10, flicker: 0, strobe: true, seed: phase, ...(k ? {} : { pool: { color: '#ffa21f', intensity: 3.6, range: 4.8 } }) });
    } else if (x > 455 && roll < .6) fire(x, z, 1.2, true);
    // A flare between the wreck and the lane (drive-over safe, flat on the verge).
    for (let k = 0; k < 6; k++) {
      const ang = rng.next() * Math.PI * 2, r = Math.max(size.x, size.z) / 2 + 1.2 + rng.next() * 1.5, fx = x + Math.cos(ang) * r, fz = z + Math.sin(ang) * r;
      if (laneDistance([fx, fz]) < lane && free(fx, fz, .6)) { put({ kind: 'flare', x: fx, y: .03, z: fz, yaw: rng.next() * 6.28, color: '#ff3a2a', glow: 7, flicker: 1, strobe: false, pool: { color: '#ff4a32', intensity: 3.4, range: 3.4 } }); break; }
    }
  }
  // 4) Farm fires (burning brush/bonfires) beside the farmsteads, well off the lanes.
  const houses = placements.filter(p => p.assetId.startsWith('bld.house-'));
  for (const h of houses) {
    const rng = keyed(`farm:${h.id}`);
    if (rng.next() > .6) continue;
    for (let k = 0; k < 12; k++) {
      const ang = rng.next() * Math.PI * 2, r = 11 + rng.next() * 8, x = h.position[0] + Math.cos(ang) * r, z = h.position[2] + Math.sin(ang) * r;
      if (laneDistance([x, z]) > 9 && free(x, z, 2.4)) { fire(x, z, 1.3 + rng.next() * .8); break; }
    }
  }
  // 4b) Brush and debris fires along every route, 8-14 m off the lane: the countryside burns too, and their smoke columns
  // drift across the frame (one every ~90 m of lane, alternating sides).
  for (const route of crossing.routes) {
    const hw = route.width / 2;
    for (const [i, b] of route.points.slice(1).entries()) {
      const a = route.points[i], d = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / d, uz = (b[1] - a[1]) / d;
      if (route.id !== 'road' && road.points.some(q => q[0] === a[0] && q[1] === a[1]) && road.points.some(q => q[0] === b[0] && q[1] === b[1])) continue;
      const stations = keyed(`brush:${route.id}:${i}`);
      for (let s = 30 + stations.next() * 40, n = 0; s < d - 20; s += 75 + stations.next() * 35, n++) {
        const rng = keyed(`brush:${route.id}:${i}:${n}`), side = rng.next() < .5 ? -1 : 1;
        for (let k = 0; k < 6; k++) {
          const o = hw + 8 + rng.next() * 6, t = s + (rng.next() - .5) * 10, x = a[0] + ux * t - uz * side * o, z = a[1] + uz * t + ux * side * o;
          if (!nearFork(x, z, 30) && x < 440 && laneDistance([x, z]) > 7.5 && free(x, z, 2.2)) { fire(x, z, 1.1 + rng.next() * .7); break; }
        }
      }
    }
  }
  // 5) The next city burns: ground fires between the east-edge blocks, behind the gully.
  for (let k = 0; k < 40; k++) {
    const rng = keyed(`city:${k}`), x = 556 + rng.next() * 38, z = (rng.next() - .5) * 360, radius = 2.4 + rng.next() * 1.4;
    if (Math.abs(z) >= 14 && free(x, z, 1.8)) fire(x, z, radius);
  }
  // 6) Red warning lamps on the crash approach barricades (the road ends ahead).
  for (const p of placements.filter(q => q.assetId === 'prop.barricade')) put({ kind: 'beacon', x: p.position[0], y: 1.86, z: p.position[2], yaw: p.yaw, color: '#ff2a1a', glow: 8, flicker: 0, strobe: true, pool: { color: 'light_siren_red', intensity: 3, range: 3 } });
  // 7) Radio masts (dress.py: stretched utility poles, scale y > 2): an aviation blinker on top and one at mid height.
  for (const p of placements.filter(q => q.assetId === 'prop.utility-pole' && q.scale[1] > 2)) {
    const h = (dims.get(p.assetId)?.y ?? 7) * p.scale[1];
    put({ kind: 'beacon', x: p.position[0], y: h + .2, z: p.position[2], yaw: 0, color: '#ff1e12', glow: 12, flicker: 0, strobe: true });
    put({ kind: 'beacon', x: p.position[0], y: h * .52, z: p.position[2], yaw: 0, color: '#ff1e12', glow: 9, flicker: 0, strobe: true, pool: { color: 'light_siren_red', intensity: 2.6, range: 5 } });
  }
  return { points, fires };
}

/** Light-field pools of the accents (appended to the layout statics, always on). */
export function accentLights(world: DistrictWorld | null | undefined): FieldLight[] {
  return nightAccents(world).points.filter(a => a.pool).map(a => {
    const light = footprint({ type: 'point', color: a.pool!.color as never, intensity: a.pool!.intensity, range: a.pool!.range, flicker: a.flicker ? 'fire' : 'none', strobe: a.strobe ? 'blink' : undefined, position: [a.x, Math.max(.6, a.y + .5), a.z], direction: [0, -1, 0] }, 0, a.seed);
    // No id: LightPower.syncPower would switch an unknown lamp off; accents are always lit.
    light.on = true;
    return light;
  });
}

/** Light-field brightness factor for an accent at `time` (sim seconds): the same flicker/strobe formula as `LightField.update`. */
export function accentPulse(a: Pick<Accent, 'flicker' | 'strobe' | 'seed'>, time: number): number {
  let k = 1;
  if (a.flicker === 1) k *= .78 + .14 * Math.sin(time * 9.1 + a.seed) + .08 * Math.sin(time * 23.7 + a.seed * 3.1);
  if (a.strobe) k *= Math.floor(time * 2 + a.seed) % 2 === 0 ? 1 : .04;
  return k;
}

const sizes: Record<Accent['kind'], [number, number, number]> = { stud: [.3, .05, .16], flare: [.34, .06, .06], lantern: [.16, .24, .16], hazard: [.2, .14, .2], beacon: [.22, .22, .22] };

/** All accent emitters in two instanced draws: studs (glint with the local light field, so headlights wake them) and the
 * self-lit flares, lanterns, hazard and beacon lamps (HDR for the bloom; colours pulse with their pools). */
export class NightAccents extends Group {
  private readonly studs?: InstancedMesh;
  private readonly lamps?: InstancedMesh;
  private readonly animated: { index: number; accent: Accent }[] = [];
  private readonly color = new Color();
  constructor(readonly set: AccentSet, field: LightField) {
    super(); this.name = 'night-accents';
    const geometry = new BoxGeometry(1, 1, 1), matrix = new Matrix4(), q = new Quaternion(), up = new Vector3(0, 1, 0);
    const studs = set.points.filter(a => a.kind === 'stud'), lamps = set.points.filter(a => a.kind !== 'stud');
    const build = (list: Accent[], material: MeshBasicNodeMaterial) => {
      const mesh = new InstancedMesh(geometry, material, Math.max(1, list.length)); mesh.count = list.length; mesh.frustumCulled = true;
      list.forEach((a, i) => {
        mesh.setMatrixAt(i, matrix.compose(new Vector3(a.x, a.y, a.z), q.setFromAxisAngle(up, a.yaw), new Vector3(...sizes[a.kind])));
        mesh.setColorAt(i, this.color.set(a.color).multiplyScalar(a.glow));
      });
      mesh.computeBoundingSphere(); mesh.castShadow = mesh.receiveShadow = false; this.add(mesh); return mesh;
    };
    if (studs.length) {
      const material = new MeshBasicNodeMaterial({ fog: false }); material.name = 'keep_accentStud';
      // A retroreflector: dim on its own, bright where a pool (headlights above all) reaches it.
      material.colorNode = vec3(float(.7).add(luminance(field.sample()).mul(14).min(6)));
      this.studs = build(studs, material);
    }
    if (lamps.length) {
      const material = new MeshBasicNodeMaterial({ fog: false }); material.name = 'keep_accentLamp';
      this.lamps = build(lamps, material);
      lamps.forEach((accent, index) => { if (accent.flicker || accent.strobe) this.animated.push({ index, accent }); });
    }
  }
  /** Pulse the self-lit lamps in step with their light-field pools (`time` = sim seconds, as LightField). */
  update(time: number): void {
    if (!this.lamps || !this.animated.length) return;
    for (const { index, accent } of this.animated) this.lamps.setColorAt(index, this.color.set(accent.color).multiplyScalar(accent.glow * accentPulse(accent, time)));
    this.lamps.instanceColor!.needsUpdate = true;
  }
  snapshot() { return { studs: this.studs?.count ?? 0, lamps: this.lamps?.count ?? 0, fires: this.set.fires.length }; }
  dispose(): void {
    for (const mesh of [this.studs, this.lamps]) if (mesh) { (mesh.material as MeshBasicNodeMaterial).dispose(); mesh.dispose(); }
    (this.studs ?? this.lamps)?.geometry.dispose(); this.clear();
  }
}
