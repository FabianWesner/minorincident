// L9 night drive (E31 art direction addendum): the warm and glinting light points along the crossing.
// Render-only: nothing here has gameplay state, collision or damage. Pools reuse the E25 light field (statics),
// fires reuse the E27 persistent-flame path (Blasts), so this file only places them and draws the small emitters.
import { BoxGeometry, Color, Group, InstancedMesh, Matrix4, MeshBasicNodeMaterial, Quaternion, Vector3 } from 'three/webgpu';
import { float, luminance, vec3 } from 'three/tsl';
import manifest from '../assets/manifest.json' with { type: 'json' };
import { crossing } from '../levels/L9/district';
import { cure } from '../levels/L10/district';
import { cureEncounters } from '../levels/L10/encounters';
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
export interface AccentFire { x: number; z: number; radius: number; car: boolean; /** Road-life dressing fire (barrel, verge car): sits just outside the 6 m clearance, not in the scar/corridor bands. */ life?: boolean }
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
  const district = world.districts.find(d => d.id === 'D-CROSSING'), cureDistrict = world.districts.find(d => d.id === 'D-CURE');
  const set = district ? crossingAccents(district.decay.placements.filter(p => !district.decay.removed.includes(p.id)), district.origin as P2)
    : cureDistrict ? cureAccents(cureDistrict.decay.placements.filter(p => !cureDistrict.decay.removed.includes(p.id)), cureDistrict.origin as P2) : empty;
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
      // l9-night-look: the follow camera frames only the lane and a few metres of verge (~17 x 10 m at zoom 1, ~26 x 15 m at
      // 1.5), so the flare/lantern line is what fills a frame: one every ~16 m (was ~43 m on the asphalt, ~25 m on the tracks),
      // a ribbon of warm and red points leading through the dark towards the burning city.
      for (let s = 12 + rng.next() * 8; s < d - 12; s += 13 + rng.next() * 6) {
        side = -side;
        const o = asphalt ? hw - 1.2 - rng.next() * .5 : hw + 1.1 + rng.next() * .9, x = a[0] + ux * s - uz * side * o, z = a[1] + uz * s + ux * side * o, yaw = rng.next() * 6.28;
        if (nearFork(x, z, 20) || x > 440 || !free(x, z, .8)) continue;
        // l9-night-look: brighter emitters (bloom) and wider pools (3.4/3.6 -> 5/5.5 m) so a lantern or flare in frame lights a real patch of ground.
        if (lantern) put({ kind: 'lantern', x, y: .14, z, yaw, color: '#ffb35c', glow: 9, flicker: 1, strobe: false, pool: { color: 'light_window_warm', intensity: 4.4, range: 5 } });
        else put({ kind: 'flare', x, y: .03, z, yaw, color: '#ff4a2a', glow: 12, flicker: 1, strobe: false, pool: { color: '#ff5a32', intensity: 5, range: 5.5 } });
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
  // 4b') l9-night-look (QA 13j: "an empty black void around the APC"): the follow camera frames only ~17 x 10 m at zoom 1 and
  // ~26 x 15 m at 1.5 (radius 21.85 m, fov 25 deg), i.e. the lane and 3-6 m of verge, so the 4b fires are almost never in frame.
  // Small burning debris on the near verge (1.4-2.6 m past the lane edge, one every ~19 m, alternating sides) puts a warm,
  // flickering light with a smoke wisp in many frames. Small radius: the pool (radius x 4 <= 3.2 m) lights a patch of verge,
  // the E31-AC16 route band stays the brightest ground (median over the frame). Render-only, drive-over safe (no collider).
  for (const route of crossing.routes) {
    const hw = route.width / 2;
    for (const [i, b] of route.points.slice(1).entries()) {
      const a = route.points[i], d = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / d, uz = (b[1] - a[1]) / d;
      if (route.id !== 'road' && road.points.some(q => q[0] === a[0] && q[1] === a[1]) && road.points.some(q => q[0] === b[0] && q[1] === b[1])) continue;
      const stations = keyed(`verge:${route.id}:${i}`);
      for (let s = 6 + stations.next() * 12, n = 0; s < d - 6; s += 15 + stations.next() * 8, n++) {
        const rng = keyed(`verge:${route.id}:${i}:${n}`);
        for (let k = 0; k < 10; k++) {
          const side = (n + (k >= 5 ? 1 : 0)) % 2 ? -1 : 1, o = hw + 1.4 + rng.next() * 1.2, t = s + (rng.next() - .5) * 6, x = a[0] + ux * t - uz * side * o, z = a[1] + uz * t + ux * side * o;
          if (!nearFork(x, z, 14) && x < 500 && laneDistance([x, z]) > 1.2 && free(x, z, 1)) { fires.push({ x: x + origin[0], z: z + origin[1], radius: .55 + rng.next() * .25, car: false, life: true }); break; }
        }
      }
    }
  }
  // 4c) l9-night-look: the last stretch (barricades, crash deck, crawl to the city) had no light point at all. Road flares in the
  // lane edge (as on the asphalt: they lift the route band, never the verge) mark the military stop line and the crawl, and
  // burning debris on the near verge frames the deck; the kit's gully (x 506..526) stays dark for the crash cinematic.
  for (let x = 444, n = 0; x < 556; x += 9, n++) {
    if (x > 504 && x < 528) continue;
    const rng = keyed(`east:${n}`), side = n % 2 ? -1 : 1, fx = x + rng.next() * 4, fz = side * (road.width / 2 - 1.2 - rng.next() * .5);
    if (free(fx, fz, .8)) put({ kind: 'flare', x: fx, y: .03, z: fz, yaw: rng.next() * 6.28, color: '#ff3a2a', glow: 7, flicker: 1, strobe: false, pool: { color: '#ff4a32', intensity: 3.6, range: 3.6 } });
    if (n % 2 === 0) for (let k = 0; k < 6; k++) {
      const bx = x + (rng.next() - .5) * 8, bz = -side * (road.width / 2 + 1.4 + rng.next() * 1.2);
      if (laneDistance([bx, bz]) > 1.2 && free(bx, bz, 1)) { fires.push({ x: bx + origin[0], z: bz + origin[1], radius: .55 + rng.next() * .25, car: false, life: true }); break; }
    }
  }
  // 4d) The crash itself scatters burning wreckage over the far deck (x 531..553), beside the crawl line (crawl-start/fallback
  // z +-3, crawl-end z 0) and never on it: |z| 4.2..5.4 m, a small flame every ~7 m, alternating sides.
  for (let x = 531, n = 0; x < 553; x += 7, n++) {
    const rng = keyed(`deck:${n}`), fx = x + rng.next() * 3, fz = (n % 2 ? -1 : 1) * (4.2 + rng.next() * 1.2);
    if (free(fx, fz, .6)) fires.push({ x: fx + origin[0], z: fz + origin[1], radius: .45 + rng.next() * .2, car: false, life: true });
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

/** L10 (look-l9b recipe, E32 art addendum): render-only fires on the D-CURE route. Burned wrecks of the crash outskirts (R1) and the
 * destroyed corridor (R6) still burn, with brush fires on the crash scar and between the corridor fronts. No sim lamps, no
 * hazards (fires are gameplay damage elsewhere): Blasts draws them, the light field gets always-on pools. Their pools (radius x 4,
 * at most ~7 m) must not reach the E31-AC16 verge band (1.5..4.5 m past the lane edge): wreck fires only on cars >= 8.5 m past
 * the edge, brush fires >= 12 m (placed 17-24 m out); all keep 14 m from encounter spots and 70 m from the console. */
export function cureAccents(placements: readonly Placement[], origin: P2 = [0, 0]): AccentSet {
  const fires: AccentFire[] = [], keyed = (key: string) => new Rng(1019, `l10-night:${key}`);
  const lines: P2[][] = [...cure.regions.map(r => r.route as P2[]), ...cure.detours.map(d => d.route as P2[]),
    [cure.regions[5].route[1] as P2, cure.anchors['corridor-breach'] as P2, cure.anchors['r6-r7-seam'] as P2, cure.regions[6].route[5] as P2]];
  const lane = (x: number, z: number) => Math.min(...lines.map(l => lineDistance([x, z], l))) - 4;
  const spots = cureEncounters.map(e => e.at as P2), spot = (x: number, z: number) => Math.min(...spots.map(s => Math.hypot(x - s[0], z - s[1])));
  const consoleAt = cure.anchors['cure-console'] as P2;
  const boxes = placements.map(p => [p.visualAabb.min[0], p.visualAabb.min[2], p.visualAabb.max[0], p.visualAabb.max[2]] as const);
  const free = (x: number, z: number, margin: number) => boxes.every(b => x < b[0] - margin || x > b[2] + margin || z < b[1] - margin || z > b[3] + margin);
  const ok = (x: number, z: number, margin: number) => lane(x, z) > margin && spot(x, z) > 14 && Math.hypot(x - consoleAt[0], z - consoleAt[1]) > 70;
  const fire = (x: number, z: number, radius: number, car = false) => fires.push({ x: x + origin[0], z: z + origin[1], radius, car });
  // 1) Burned wrecks keep burning: the crash outskirts and the destroyed corridor.
  for (const p of placements) {
    if (!p.assetId.startsWith('veh.') || p.decay !== 'burned') continue;
    const [x, , z] = p.position, inR1 = x < 760, inR6 = x > 2950 && x < 3680;
    if (!(inR1 || inR6) || !ok(x, z, 8.5)) continue;
    if (inR1 || keyed(`wreck:${p.id}`).next() < .55) fire(x, z, 1.4, true);   // every clear R1 wreck burns (the crash just happened)
  }
  // 2) Brush fires beside the crash scar and between the corridor fronts (one every ~70 m, alternating sides).
  for (const [ri, region] of [[0, cure.regions[0]], [5, cure.regions[5]]] as const) {
    const pts = region.route as P2[];
    for (const [i, b] of pts.slice(1).entries()) {
      const a = pts[i], d = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / d, uz = (b[1] - a[1]) / d;
      const stations = keyed(`brush:${ri}:${i}`);
      for (let s = 20 + stations.next() * 30, n = 0; s < d - 15; s += 60 + stations.next() * 30, n++) {
        const rng = keyed(`brush:${ri}:${i}:${n}`), side = rng.next() < .5 ? -1 : 1;
        for (let k = 0; k < 14; k++) {
          const o = 17 + rng.next() * 7, t = s + (rng.next() - .5) * 10, x = a[0] + ux * t - uz * side * o, z = a[1] + uz * t + ux * side * o;
          if (ok(x, z, 12) && free(x, z, 1.5)) { fire(x, z, 1.1 + rng.next() * .7); break; }
        }
      }
    }
  }
  // 3) Road life (road-life lane): roadside light points on the dressing pieces just outside the 6 m clearance. Burning barrels,
  // a burning car per region, lit bus stops and police light bars; render-only, kept off the encounter spots and the console.
  const points: Accent[] = [], put = (a: Omit<Accent, 'seed'> & { seed?: number }) => points.push({ ...a, x: a.x + origin[0], z: a.z + origin[1], seed: a.seed ?? Math.abs(a.x * 12.9898 + a.z * 78.233) % 6.283 });
  for (const p of placements) {
    if (!p.roadLife) continue;
    const [x, , z] = p.position, k = keyed(`life:${p.id}`), clearOfStory = spot(x, z) > 9 && Math.hypot(x - consoleAt[0], z - consoleAt[1]) > 70, l = lane(x, z);
    if (!clearOfStory || x > 3940) continue;
    const h = (dims.get(p.assetId)?.y ?? 1) * p.scale[1];
    if (p.assetId === 'prop.cure-drum-stack') { if (l > 1 && l < 6) fires.push({ x: x + origin[0], z: z + origin[1], radius: .85, car: false, life: true }); }
    else if (p.decay === 'burned' && p.assetId.startsWith('veh.') && l > 3 && l < 8.5) fires.push({ x: x + origin[0], z: z + origin[1], radius: 1.2, car: true, life: true });
    else if (p.assetId === 'bld.bus-stop') put({ kind: 'lantern', x, y: h * .92, z, yaw: 0, color: '#cfe4ff', glow: 9, flicker: 0, strobe: false, pool: { color: '#bcd8ff', intensity: 4.6, range: 6.5 } });
    else if (p.assetId === 'veh.police-sedan' && !p.decay) {
      const c = Math.cos(p.yaw), s = Math.sin(p.yaw), ph = k.next() * 2;
      // Two road flares on the verge side of the lane, a few metres ahead of and behind the car (flat, drive-over safe).
      const ax = Math.cos(p.yaw), az = -Math.sin(p.yaw), px = -az, pz = ax, toRoad = lane(x + px * 2, z + pz * 2) < lane(x - px * 2, z - pz * 2) ? 1 : -1;
      for (const dir of [-1, 1]) put({ kind: 'flare', x: x + ax * 3.8 * dir + px * 1.6 * toRoad, y: .03, z: z + az * 3.8 * dir + pz * 1.6 * toRoad, yaw: k.next() * 6.28, color: '#ff3a2a', glow: 7, flicker: 1, strobe: false, pool: { color: '#ff4a32', intensity: 3.2, range: 3.2 } });
      for (const [i, lz] of [-.38, .38].entries()) put({ kind: 'beacon', x: x + lz * s, y: h * .98, z: z + lz * c, yaw: p.yaw, color: i ? '#2f6bff' : '#ff2a1a', glow: 9, flicker: 0, strobe: true, seed: ph + i * .5, pool: { color: i ? 'light_siren_blue' : 'light_siren_red', intensity: 2.8, range: 4.2 } });
    }
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
