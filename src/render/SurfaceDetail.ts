import type { Node } from 'three/webgpu';
import { Fn, If, cos, float, max, mix, positionWorld, sin, vec2 } from 'three/tsl';
import type { PaletteToken } from '../data/palette';
import type { LookUniforms } from './LookUniforms';

// World-space detail is continuous across merged slabs and district seams, with no texture download.
const hash = Fn(([p]: [Node<'vec2'>]) => sin(p.dot(vec2(127.1, 311.7))).mul(43758.5453).fract());
export const noise = Fn(([p]: [Node<'vec2'>]) => {
  const cell = p.floor(), f = p.fract(), t = f.mul(f).mul(float(3).sub(f.mul(2)));
  return mix(mix(hash(cell), hash(cell.add(vec2(1, 0))), t.x), mix(hash(cell.add(vec2(0, 1))), hash(cell.add(vec2(1, 1))), t.x), t.y);
});
/** Night presets disable cloud shadows. Keep their three sine evaluations out
 * of that draw while retaining the exact authored field when enabled. */
export const cloudShadowMask = Fn(({ strength, point }: { strength: Node<'float'>; point: Node<'vec2'> }) => {
  const cloud = float(0).toVar();
  If(strength.greaterThan(0), () => {
    const field = point.x.add(point.y.mul(.7).sin().mul(1.3)).sin().mul(point.y.mul(.9).add(point.x.mul(.6).add(1.7).sin().mul(1.1)).sin());
    cloud.assign(field.smoothstep(0, .55).mul(strength));
  });
  return cloud;
});
/** Zero coverage is the common world/crowd case. Avoid computing three smooth
 * derivative-based splats that would then be multiplied by zero. */
export const bloodSplatMask = Fn(({ coverage, point }: { coverage: Node<'float'>; point: Node<'vec2'> }) => {
  const blood = float(0).toVar();
  If(coverage.greaterThan(0), () => {
    const radius = coverage.clamp(0, 1).sqrt().mul(.09).add(.02);
    const splat = (y: number, z: number, size: number) => {
      const distance = point.sub(vec2(y, z)).mul(vec2(1, 1.3)).length();
      const edge = distance.fwidth().mul(1.5).max(.006);
      return distance.smoothstep(radius.mul(size), radius.mul(size).add(edge)).oneMinus();
    };
    blood.assign(max(max(splat(.07, .09, 1), splat(-.1, -.06, .7)), splat(-.16, .15, .5)));
  });
  return blood;
});
export function surfaceDetail(token: PaletteToken, base: Node<'vec3'>, look: LookUniforms['nodes']): Node<'vec3'> {
  const p = positionWorld.xz;
  if (token === 'asphalt') {
    const grain = hash(p.mul(90).floor()).sub(.5).mul(.09);
    const patch = noise(p.mul(.7)).sub(.5).mul(.18);
    // A few resurfaced rectangles, with dark sealed edges and a different aggregate shade.
    const patchCell = p.div(6).floor(), patchUv = p.div(6).fract();
    const patchCenter = vec2(hash(patchCell.add(13)), hash(patchCell.add(29))).mul(.4).add(.3);
    const patchAxes = patchUv.sub(patchCenter).abs().div(vec2(.17, .105)), patchDistance = patchAxes.x.max(patchAxes.y);
    const repair = patchDistance.smoothstep(.94, 1).oneMinus().mul(hash(patchCell.add(41)).smoothstep(.55, .7));
    const seal = patchDistance.smoothstep(.88, .94).mul(patchDistance.smoothstep(.99, 1.025).oneMinus()).mul(repair);
    const repairShade = hash(patchCell.add(53)).sub(.65).mul(.3);
    // Short, angular fracture segments; seeded heading and length avoid regular loops/grids.
    const cell = p.div(3.2).floor(), local = p.div(3.2).fract().sub(.5), angle = hash(cell).mul(Math.PI);
    const along = local.dot(vec2(cos(angle), sin(angle))), across = local.dot(vec2(sin(angle).negate(), cos(angle)));
    const jagged = sin(along.mul(48)).mul(.009).add(sin(along.mul(23)).mul(.015));
    const crack = across.add(jagged).abs().smoothstep(.002, .006).oneMinus()
      .mul(along.abs().smoothstep(.28, .42).oneMinus()).mul(hash(cell.add(7)).smoothstep(.4, .6));
    return mix(base, look.asphalt, .7).mul(float(1).add(grain).add(patch).add(repair.mul(repairShade)).sub(seal.mul(.13)).sub(crack.mul(.38)));
  }
  if (token === 'sidewalk') {
    const tile = p.div(.65), f = tile.fract().sub(.5).abs(), edge = f.x.max(f.y).smoothstep(.462, .49);
    const variation = hash(tile.floor()).sub(.5).mul(.1);
    return mix(base, look.sidewalk, .65).mul(float(1).add(variation).sub(edge.mul(.2)));
  }
  if (token === 'grass' || token === 'foliage') {
    const variation = noise(p.mul(.45)).sub(.5).mul(.24).add(noise(p.mul(5)).sub(.5).mul(.06));
    return mix(base, look[token], .6).mul(float(1).add(variation));
  }
  return base;
}
