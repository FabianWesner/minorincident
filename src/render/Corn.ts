import { DoubleSide, Vector3, type Node } from 'three/webgpu';
import { attribute, dot, positionLocal, positionWorld, renderGroup, sin, uniform, vec3 } from 'three/tsl';
import type { Materials } from './Materials';
import type { SimWorld } from '../sim/world/SimWorld';

const nearby: number[] = [];
const search = { x: 0, z: 0, r: 22 };
const movers = Array.from({ length: 8 }, () => uniform(new Vector3(-10000, 0, -10000)).setGroup(renderGroup));
const directions = Array.from({ length: 8 }, () => uniform(new Vector3(0, 0, 0)).setGroup(renderGroup));
const ids = new Int32Array(8).fill(-1);
const seen = new Uint8Array(8);
let lastTick = 0;
let lastWorld: SimWorld | undefined;
function put(id: number, x: number, speed: number, z: number, vx: number, vz: number): void {
  let slot = id === 1 ? 0 : ids.indexOf(id, 1);
  if (slot < 0) slot = ids.indexOf(-1, 1);
  if (slot < 0) return;
  ids[slot] = id; seen[slot] = 1;
  movers[slot].value.set(x, speed, z);
  directions[slot].value.set(vx, 1, vz);
}
/** Fixed eight-slot upload: no per-stalk CPU work; the shader bends crop around nearby movers. */
export function updateCorn(world: SimWorld): void {
  const hero = world.entities.get(1);
  if (world !== lastWorld || world.tick < lastTick || world.scenario !== 'L10' || !hero) {
    for (let i = 0; i < movers.length; i++) { movers[i].value.set(-10000, 0, -10000); directions[i].value.set(0, 0, 0); }
    ids.fill(-1); lastTick = world.tick; lastWorld = world;
    if (world.scenario !== 'L10' || !hero) return;
  }
  const elapsed = Math.max(0, Math.min(60, world.tick - lastTick)) / 60; lastTick = world.tick;
  seen.fill(0);
  // The courier has a reserved slot even when other movers fill the field.
  const velocity = hero.survivor?.velocity ?? hero.motion?.velocity;
  const hx = velocity?.x ?? hero.locomotion?.vx ?? 0, hz = velocity?.z ?? hero.locomotion?.vz ?? 0;
  const heroSpeed = Math.hypot(hx, hz);
  if (!hero.hidden && hero.health.current > 0 && heroSpeed > .1)
    put(hero.id, hero.transform.x, heroSpeed, hero.transform.z, hx / heroSpeed, hz / heroSpeed);
  search.x = hero.transform.x; search.z = hero.transform.z;
  for (const id of world.spatial.query(search, nearby, false)) {
    const e = world.entities.get(id);
    if (!e) continue;
    if (e.id === 1 || e.hidden || e.health.current <= 0 || !(e.infected || e.companion) || Math.hypot(e.transform.x - hero.transform.x, e.transform.z - hero.transform.z) > 22) continue;
    const v = e.survivor?.velocity ?? e.motion?.velocity;
    const vx = v?.x ?? e.locomotion?.vx ?? 0, vz = v?.z ?? e.locomotion?.vz ?? 0;
    const speed = Math.hypot(vx, vz);
    if (speed > .1) {
      put(e.id, e.transform.x, speed, e.transform.z, vx / speed, vz / speed);
    }
  }
  if (world.vehicles) for (const car of world.vehicles.cars.values()) {
    const e = car.entity, speed = Math.abs(car.physics.speed);
    if (speed <= .1 || Math.hypot(e.transform.x - hero.transform.x, e.transform.z - hero.transform.z) > 22) continue;
    const sign = car.physics.speed < 0 ? -1 : 1;
    put(e.id, e.transform.x, speed, e.transform.z, Math.cos(e.transform.yaw) * sign, -Math.sin(e.transform.yaw) * sign);
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
  const weight = positionLocal.y.smoothstep(.05, 2.3);
  let push: Node<'vec3'> = vec3(0);
  for (let i = 0; i < movers.length; i++) {
    const actor = movers[i];
    const delta = positionWorld.xz.sub(actor.xz), forward = directions[i];
    // Estimate when the mover passed each vertex along its recent direction.
    // The swept wake fades to zero after one second without storing per-stalk state.
    const age = dot(delta, forward.xz).negate().div(actor.y.max(.1)).clamp(0, 1);
    const offset = delta.add(forward.xz.mul(actor.y).mul(age)), radius = offset.length();
    // Stalks part away from the body, with a forward lean in its travel direction.
    // The 1.2 m smooth falloff lets them spring back continuously as the mover passes.
    const bend = radius.smoothstep(.12, 1.2).oneMinus().mul(age.smoothstep(0, 1).oneMinus()).mul(weight).mul(forward.y.smoothstep(0, 1)).mul(.5);
    const awayX = offset.x.div(radius.max(.1)), awayZ = offset.y.div(radius.max(.1));
    push = push.add(vec3(awayX.add(forward.x.mul(.35)).mul(bend), bend.mul(-.12), awayZ.add(forward.z.mul(.35)).mul(bend)));
  }
  const wind = sin(positionWorld.x.mul(.7).add(positionWorld.z.mul(.4)).add(materials.wind.mul(1.5))).mul(.09).mul(weight);
  material.positionNode = positionLocal.add(push).add(vec3(wind, 0, wind.mul(.4)));
  material.side = DoubleSide; material.alphaTest = .1; material.alphaToCoverage = true;
  material.name = 'pal_l10-dry-corn'; material.userData.batchFeatures = 'l10-corn';
  return material;
}
