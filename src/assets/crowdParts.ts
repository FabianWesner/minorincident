import { BufferAttribute, type BufferGeometry } from 'three';

const humanLimbs = [['armL', 'foreArmL', 'handL'], ['armR', 'foreArmR', 'handR'], ['legL', 'shinL', 'footL'], ['legR', 'shinR', 'footR'], ['head']];
const animalLimbs = [
  [...humanLimbs[0], 'legFL', 'pawFL'], [...humanLimbs[1], 'legFR', 'pawFR'],
  [...humanLimbs[2], 'legBL', 'pawBL'], [...humanLimbs[3], 'legBR', 'pawBR'], ['head', 'neck', 'jaw'],
];
/** Five gore bits: left/right forelimb, left/right hindlimb, head. Animal aliases retain their physical chains. */
export function crowdLimbParts(animal: boolean): readonly (readonly string[])[] { return animal ? animalLimbs : humanLimbs; }

/** Pack scalar part flags into one location so production crowds fit WebGL2's
 * 16-attribute minimum even with instancing, shaded normals and clip fades. */
export function packCrowdParts(geometry: BufferGeometry): void {
  const names = ['_part_index', '_shirt', '_emissive', '_vein'], count = geometry.getAttribute('position').count;
  const values = new Float32Array(count * 4);
  names.forEach((name, channel) => {
    const source = geometry.getAttribute(name);
    if (source) for (let i = 0; i < count; i++) values[i * 4 + channel] = source.getX(i);
    geometry.deleteAttribute(name);
  });
  geometry.setAttribute('_parts', new BufferAttribute(values, 4));
}
