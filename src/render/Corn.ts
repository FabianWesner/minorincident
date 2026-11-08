import { DoubleSide, Vector3, type Node } from 'three/webgpu';
import { attribute, positionLocal, positionWorld, renderGroup, sin, uniform, vec3 } from 'three/tsl';
import type { Materials } from './Materials';
import type { SimWorld } from '../sim/world/SimWorld';

const player = uniform(new Vector3(-10000, 0, -10000)).setGroup(renderGroup);
const nearby: number[] = [];
const movers = Array.from({ length: 8 }, () => uniform(new Vector3(-10000, 0, -10000)).setGroup(renderGroup));
/** Fixed eight-position upload: the courier and nearby moving actors visibly part the crop before emerging. */
export function updateCorn(world: SimWorld): void {
  const hero = world.entities.get(1);
  if (world.scenario !== 'L10' || !hero) { player.value.set(-10000, 0, -10000); return; }
  player.value.set(hero.transform.x, hero.transform.y, hero.transform.z);
  let n = 0;
  for (const id of world.spatial.query({ x: hero.transform.x, z: hero.transform.z, r: 22 }, nearby, false)) {
    const e = world.entities.get(id);
    if (!e) continue;
    if (n === movers.length) break;
    if (e.hidden || e.health.current <= 0 || !(e.id === 1 || e.infected || e.companion) || Math.hypot(e.transform.x - player.value.x, e.transform.z - player.value.z) > 22) continue;
    const v = e.survivor?.velocity ?? e.motion?.velocity;
    if (v && Math.hypot(v.x, v.z) > .1 || Math.hypot(e.locomotion?.vx ?? 0, e.locomotion?.vz ?? 0) > .1) movers[n++].value.set(e.transform.x, e.transform.y, e.transform.z);
  }
  while (n < movers.length) movers[n++].value.set(-10000, 0, -10000);
}
export function cornMaterial(materials: Materials) {
  const fade = positionWorld.xz.sub(player.xz).length().smoothstep(1.5, 3);
  // Retain the authored straw/ochre/soil RGB and root gradients. Interpolating swatch
  // indices across a curved leaf would sample unrelated palette colours between them.
  const ground = positionLocal.y.lessThan(.12);
  const material = materials.shaded(attribute('color', 'vec3'), undefined, ground.select(1, fade));
  const weight = positionLocal.y.smoothstep(.05, 2.3);
  let push: Node<'vec3'> = vec3(0);
  for (const actor of movers) {
    const delta = positionWorld.xz.sub(actor.xz), radius = delta.length();
    const bend = radius.smoothstep(2, .2).mul(weight).mul(.45);
    push = push.add(vec3(delta.x.div(radius.max(.1)).mul(bend), bend.mul(-.12), delta.y.div(radius.max(.1)).mul(bend)));
  }
  const wind = sin(positionWorld.x.mul(.7).add(positionWorld.z.mul(.4)).add(materials.wind.mul(1.5))).mul(.09).mul(weight);
  material.positionNode = positionLocal.add(push).add(vec3(wind, 0, wind.mul(.4)));
  material.opacityNode = fade;
  material.side = DoubleSide; material.alphaTest = .1; material.alphaToCoverage = true;
  material.name = 'pal_l10-dry-corn'; material.userData.batchFeatures = 'l10-corn';
  return material;
}
