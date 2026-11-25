import { DoubleSide, Vector3, type Node } from 'three/webgpu';
import { attribute, positionLocal, positionWorld, renderGroup, sin, uniform, vec3 } from 'three/tsl';
import type { Materials } from './Materials';
import type { SimWorld } from '../sim/world/SimWorld';

const nearby: number[] = [];
const movers = Array.from({ length: 8 }, () => uniform(new Vector3(-10000, 0, -10000)).setGroup(renderGroup));
const directions = Array.from({ length: 8 }, () => uniform(new Vector3(0, 0, 0)).setGroup(renderGroup));
/** Fixed eight-slot upload: no per-stalk CPU work; the shader bends crop around nearby movers. */
export function updateCorn(world: SimWorld): void {
  const hero = world.entities.get(1);
  if (world.scenario !== 'L10' || !hero) {
    for (let i = 0; i < movers.length; i++) { movers[i].value.set(-10000, 0, -10000); directions[i].value.set(0, 0, 0); }
    return;
  }
  let n = 0;
  for (const id of world.spatial.query({ x: hero.transform.x, z: hero.transform.z, r: 22 }, nearby, false)) {
    const e = world.entities.get(id);
    if (!e) continue;
    if (n === movers.length) break;
    if (e.hidden || e.health.current <= 0 || !(e.id === 1 || e.infected || e.companion) || Math.hypot(e.transform.x - hero.transform.x, e.transform.z - hero.transform.z) > 22) continue;
    const v = e.survivor?.velocity ?? e.motion?.velocity;
    const vx = v?.x ?? e.locomotion?.vx ?? 0, vz = v?.z ?? e.locomotion?.vz ?? 0;
    const speed = Math.hypot(vx, vz);
    if (speed > .1) {
      movers[n].value.set(e.transform.x, e.transform.y, e.transform.z);
      directions[n].value.set(vx / speed, 0, vz / speed);
      n++;
    }
  }
  for (const car of world.vehicles?.cars.values() ?? []) {
    if (n === movers.length) break;
    const e = car.entity, speed = Math.abs(car.physics.speed);
    if (speed <= .1 || Math.hypot(e.transform.x - hero.transform.x, e.transform.z - hero.transform.z) > 22) continue;
    const sign = car.physics.speed < 0 ? -1 : 1;
    movers[n].value.set(e.transform.x, e.transform.y, e.transform.z);
    directions[n].value.set(Math.cos(e.transform.yaw) * sign, 0, -Math.sin(e.transform.yaw) * sign);
    n++;
  }
  while (n < movers.length) { movers[n].value.set(-10000, 0, -10000); directions[n].value.set(0, 0, 0); n++; }
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
    const delta = positionWorld.xz.sub(actor.xz), radius = delta.length();
    // Stalks part away from the body, with a forward lean in its travel direction.
    // The 1.2 m smooth falloff lets them spring back continuously as the mover passes.
    const bend = radius.smoothstep(1.2, .12).mul(weight).mul(.5);
    const awayX = delta.x.div(radius.max(.1)), awayZ = delta.y.div(radius.max(.1));
    const forward = directions[i];
    push = push.add(vec3(awayX.sub(forward.x.mul(.35)).mul(bend), bend.mul(-.12), awayZ.sub(forward.z.mul(.35)).mul(bend)));
  }
  const wind = sin(positionWorld.x.mul(.7).add(positionWorld.z.mul(.4)).add(materials.wind.mul(1.5))).mul(.09).mul(weight);
  material.positionNode = positionLocal.add(push).add(vec3(wind, 0, wind.mul(.4)));
  material.side = DoubleSide; material.alphaTest = .1; material.alphaToCoverage = true;
  material.name = 'pal_l10-dry-corn'; material.userData.batchFeatures = 'l10-corn';
  return material;
}
