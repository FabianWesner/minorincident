import { DoubleSide, Vector3 } from 'three/webgpu';
import { Fn, If, attribute, dot, float, mat4, modelWorldMatrix, positionLocal, positionWorld, renderGroup, sin, uniform, vec3, vec4 } from 'three/tsl';
import type { Materials } from './Materials';
import type { SimWorld } from '../sim/world/SimWorld';
import type { EntitySnapshot } from '../sim/world/types';

const nearby: number[] = [];
const search = { x: 0, z: 0, r: 22 };
const movers = Array.from({ length: 24 }, () => uniform(new Vector3(-10000, 0, -10000)).setGroup(renderGroup));
const directions = Array.from({ length: 24 }, () => uniform(new Vector3(0, 0, 0)).setGroup(renderGroup));
const ids = new Int32Array(24).fill(-1);
const seen = new Uint8Array(24);
const candidates = Array.from({ length: 21 }, () => ({ id: -1, x: 0, z: 0, speed: 0, vx: 0, vz: 0, score: 0 }));
let candidateCount = 0;
let lastTick = 0;
let lastWorld: SimWorld | undefined;
function put(id: number, x: number, speed: number, z: number, vx: number, vz: number, elapsed: number, reserved = -1): void {
  let slot = reserved >= 0 ? reserved : ids.indexOf(id, 3);
  if (slot < 0) slot = ids.indexOf(-1, 3);
  if (slot < 0) return;
  if (ids[slot] !== id) directions[slot].value.y = 0;
  ids[slot] = id; seen[slot] = 1;
  movers[slot].value.set(x, speed, z);
  const strength = Math.min(1, directions[slot].value.y + elapsed * 10);
  directions[slot].value.set(vx, strength, vz);
}
// Keep the nearest shared movers. A modest incumbent bias avoids repeated
// handoffs when two actors are nearly equally distant from the courier.
function consider(id: number, x: number, speed: number, z: number, vx: number, vz: number): void {
  const dx = x - search.x, dz = z - search.z;
  const score = (dx * dx + dz * dz) * (ids.indexOf(id, 3) >= 0 ? .8 : 1);
  let at = 0;
  while (at < candidateCount && (candidates[at].score < score || candidates[at].score === score && candidates[at].id < id)) at++;
  if (at >= candidates.length) return;
  const last = Math.min(candidateCount, candidates.length - 1), item = candidates[last];
  for (let i = last; i > at; i--) candidates[i] = candidates[i - 1];
  candidates[at] = item;
  item.id = id; item.x = x; item.z = z; item.speed = speed; item.vx = vx; item.vz = vz; item.score = score;
  candidateCount = Math.min(candidateCount + 1, candidates.length);
}
let vehicleElapsed = 0;
let activeVehicle: number | null = null;
let actorWorld: SimWorld;
let actorElapsed = 0;
// SpatialHash can visit matches directly, avoiding a new backing array after
// clearing and repopulating the result on each frame.
function collectActor(id: number): void {
  const e = actorWorld.entities.get(id);
  if (!e || e.id === 1 || e.hidden || e.health.current <= 0 || !(e.infected || e.companion) || Math.hypot(e.transform.x - search.x, e.transform.z - search.z) > 22) return;
  const v = e.survivor?.velocity ?? e.motion?.velocity ?? e.companion?.velocity;
  const vx = v?.x ?? e.locomotion?.vx ?? 0, vz = v?.z ?? e.locomotion?.vz ?? 0;
  const speed = Math.hypot(vx, vz);
  if (speed <= .1) return;
  if (e.companion) put(e.id, e.transform.x, speed, e.transform.z, vx / speed, vz / speed, actorElapsed, 1);
  else consider(e.id, e.transform.x, speed, e.transform.z, vx / speed, vz / speed);
}
// A reusable callback avoids creating a Map iterator or closure on each frame.
function collectVehicle(car: { entity: EntitySnapshot; physics: { speed: number; forwardSpeed: number; previous: { x: number; z: number } } }): void {
  const e = car.entity, speed = Math.abs(car.physics.speed);
  if (speed <= .1 || Math.hypot(e.transform.x - search.x, e.transform.z - search.z) > 22) return;
  const dx = e.transform.x - car.physics.previous.x, dz = e.transform.z - car.physics.previous.z, distance = Math.hypot(dx, dz);
  const sign = car.physics.forwardSpeed < 0 ? -1 : 1;
  const vx = distance > 1e-5 ? dx / distance : Math.cos(e.transform.yaw) * sign;
  const vz = distance > 1e-5 ? dz / distance : -Math.sin(e.transform.yaw) * sign;
  if (activeVehicle === e.id) put(e.id, e.transform.x, speed, e.transform.z, vx, vz, vehicleElapsed, 2);
  else consider(e.id, e.transform.x, speed, e.transform.z, vx, vz);
}
/** Fixed twenty-four-slot upload: no per-stalk CPU work; the shader bends crop around nearby movers. */
export function updateCorn(world: SimWorld): void {
  const hero = world.entities.get(1);
  if (world !== lastWorld || world.tick < lastTick || world.scenario !== 'L10' || !hero) {
    for (let i = 0; i < movers.length; i++) { movers[i].value.set(-10000, 0, -10000); directions[i].value.set(0, 0, 0); }
    ids.fill(-1); lastTick = world.tick; lastWorld = world;
    if (world.scenario !== 'L10' || !hero) return;
  }
  const elapsed = Math.max(0, Math.min(60, world.tick - lastTick)) / 60; lastTick = world.tick;
  seen.fill(0);
  // Keep the courier, corgi and driven vehicle represented in crowded fields.
  const velocity = hero.survivor?.velocity ?? hero.motion?.velocity;
  const hx = velocity?.x ?? hero.locomotion?.vx ?? 0, hz = velocity?.z ?? hero.locomotion?.vz ?? 0;
  const heroSpeed = Math.hypot(hx, hz);
  if (!hero.hidden && hero.health.current > 0 && heroSpeed > .1)
    put(hero.id, hero.transform.x, heroSpeed, hero.transform.z, hx / heroSpeed, hz / heroSpeed, elapsed, 0);
  search.x = hero.transform.x; search.z = hero.transform.z; candidateCount = 0;
  actorWorld = world; actorElapsed = elapsed;
  world.spatial.query(search, nearby, false, collectActor);
  if (world.vehicles) {
    vehicleElapsed = elapsed; activeVehicle = world.vehicles.active;
    world.vehicles.cars.forEach(collectVehicle);
  }
  // Old owners retain their last pose while fading. New owners enter only when
  // a slot is free, so priority changes do not abruptly remove bent stalks.
  for (let i = 0; i < candidateCount; i++) {
    const c = candidates[i]; put(c.id, c.x, c.speed, c.z, c.vx, c.vz, elapsed);
  }
  for (let i = 0; i < movers.length; i++) if (!seen[i] && ids[i] !== -1) {
    directions[i].value.y = Math.max(0, directions[i].value.y - elapsed);
    if (!directions[i].value.y) { ids[i] = -1; movers[i].value.set(-10000, 0, -10000); }
  }
}
export function cornMaterial(materials: Materials) {
  // Retain the authored straw/ochre/soil RGB and root gradients. Interpolating swatch
  // indices across a curved leaf would sample unrelated palette colours between them.
  const ground = positionLocal.y.lessThan(.12);
  const material = materials.shaded(attribute('color', 'vec3'), undefined, ground.select(1, 1));
  const placement = mat4(attribute('_placement0', 'vec4'), attribute('_placement1', 'vec4'), attribute('_placement2', 'vec4'), attribute('_placement3', 'vec4'));
  const rootWorld = modelWorldMatrix.mul(placement.mul(vec4(attribute('_stalk_root', 'vec3'), 1))).xyz;
  // Inactive uniform slots skip the wake calculation, keeping spare crowd capacity cheap.
  material.positionNode = Fn(() => {
    // Explicit assignment keeps this shared value outside every mover branch.
    const weight = float(0).toVar();
    weight.assign(positionLocal.y.smoothstep(.05, 2.3));
    const result = vec3(0).toVar();
    for (let i = 0; i < movers.length; i++) {
      const actor = movers[i];
      If(directions[i].y.greaterThan(0), () => {
        const delta = rootWorld.xz.sub(actor.xz), forward = directions[i];
        // A one-second wake cannot reach beyond speed plus its 1.2 m radius.
        const reach = actor.y.add(1.21);
        If(dot(delta, delta).lessThanEqual(reach.mul(reach)), () => {
          // Estimate when the mover passed each vertex along its recent direction.
          // The swept wake fades to zero after one second without storing per-stalk state.
          const age = dot(delta, forward.xz).negate().div(actor.y.max(.1)).clamp(0, 1);
          const offset = delta.add(forward.xz.mul(actor.y).mul(age)), radius = offset.length();
          // Stalks part away from the body, with a forward lean in its travel direction.
          // The 1.2 m smooth falloff lets them spring back continuously as the mover passes.
          const bend = radius.smoothstep(.12, 1.2).oneMinus().mul(age.smoothstep(0, 1).oneMinus()).mul(weight).mul(forward.y.smoothstep(0, 1)).mul(.5);
          // Orient from the mover, not from the swept centerline: that centerline can
          // cross a stalk when the mover turns, reversing a full-strength lean in one tick.
          // Soften the direction near the body so passing directly over a root is smooth.
          const inverseSeparation = dot(delta, delta).max(.36).inverseSqrt();
          const awayX = delta.x.mul(inverseSeparation), awayZ = delta.y.mul(inverseSeparation);
          result.addAssign(vec3(awayX.add(forward.x.mul(.35)).mul(bend), bend.mul(-.12), awayZ.add(forward.z.mul(.35)).mul(bend)));
        });
      });
    }
    const wind = sin(positionWorld.x.mul(.7).add(positionWorld.z.mul(.4)).add(materials.wind.mul(1.5))).mul(.09).mul(weight);
    return positionLocal.add(result).add(vec3(wind, 0, wind.mul(.4)));
  })();
  material.side = DoubleSide; material.alphaTest = .1; material.alphaToCoverage = true;
  material.name = 'pal_l10-dry-corn'; material.userData.batchFeatures = 'l10-corn';
  return material;
}
