import { Box3, Matrix4, Vector3, type BufferGeometry } from 'three';
import { characterNodes } from '../../data/survivor';

/** Bare skull envelope from exposed skin, narrowed by the brow cross-section. Hair never enlarges the fit. */
export function skinnedBrow(geometry: BufferGeometry): { width: number; depth: number; y: number; centre: Vector3 } | null {
  const binds = geometry.userData.crowdBinds as number[] | undefined;
  if (!binds) return null;
  const head = characterNodes.indexOf('head'), inverse = new Matrix4().fromArray(binds, head * 16);
  const parts = geometry.getAttribute('_parts'), position = geometry.getAttribute('position'), point = new Vector3(), eyes = new Box3(), skin = new Box3();
  for (let i = 0; i < parts.count; i++) if (parts.getX(i) === head && parts.getW(i) < 1024) {
    point.fromBufferAttribute(position, i).applyMatrix4(inverse);
    if (parts.getZ(i) > 1.5) eyes.expandByPoint(point);
    else if (parts.getY(i) === -1) skin.expandByPoint(point);
  }
  if (skin.isEmpty()) return null;
  const y = eyes.isEmpty() ? skin.min.y + (skin.max.y - skin.min.y) * .7 : eyes.max.y;
  const brow = new Box3(), band = (skin.max.y - skin.min.y) * .12;
  for (let i = 0; i < parts.count; i++) if (parts.getX(i) === head && parts.getY(i) !== -6 && !parts.getZ(i) && parts.getW(i) < 1024) {
    point.fromBufferAttribute(position, i).applyMatrix4(inverse);
    if (Math.abs(point.y - y) <= band && point.x >= skin.min.x) brow.expandByPoint(point);
  }
  return { width: Math.min(skin.max.z - skin.min.z, brow.isEmpty() ? Infinity : brow.max.z - brow.min.z), depth: Math.min(skin.max.x - skin.min.x, brow.isEmpty() ? Infinity : brow.max.x - brow.min.x), y, centre: skin.getCenter(new Vector3()) };
}
