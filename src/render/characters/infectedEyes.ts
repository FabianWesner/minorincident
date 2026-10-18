import { Box3, Vector3, type BufferGeometry } from 'three';

/** Imported eye cores/glints share white materials with teeth. Identify them in
 * each eye's part-local envelope before simplification, so daylight cannot turn
 * the emitter white and the low LOD locks the whole eye, including its core. */
export function markInfectedEyeCores(geometry: BufferGeometry): void {
  const position = geometry.getAttribute('position'), parts = geometry.getAttribute('_part_index');
  const emissive = geometry.getAttribute('_emissive'), shirt = geometry.getAttribute('_shirt'), color = geometry.getAttribute('color');
  const eyes = new Map<string, Box3>(), point = new Vector3();
  const key = (i: number) => `${parts.getX(i)}:${position.getZ(i) < 0 ? -1 : 1}`;
  for (let i = 0; i < position.count; i++) if (emissive.getX(i) > .5) {
    const id = key(i); if (!eyes.has(id)) eyes.set(id, new Box3());
    eyes.get(id)!.expandByPoint(point.fromBufferAttribute(position, i));
  }
  // The small solid core sits just in front of its red shell, along authored +X.
  for (const bounds of eyes.values()) { bounds.max.x += .025; bounds.expandByVector(new Vector3(.002, .004, .004)); }
  for (let i = 0; i < position.count; i++) {
    if (emissive.getX(i) > .5 || shirt.getX(i) !== 0 || Math.min(color.getX(i), color.getY(i), color.getZ(i)) < .4) continue;
    if (eyes.get(key(i))?.containsPoint(point.fromBufferAttribute(position, i))) emissive.setX(i, 1);
  }
}
