import { Box3, type Group } from 'three';

/** Metres in the standing crowd frame. Children have their own authored proportions. */
export function civilianHeight(model: string): number {
  return model === 'npc.civilian-kid' ? 1.4744 : model === 'npc.brother' ? 1.4265 : 1.8;
}

/** Bring older 1.4 m NPC exports into the same adult range as the 1.8 m civilian roster.
 * Apply before baking so geometry, pivots, stride, props and every LOD share the same frame.
 */
export function fitCivilianHeight(root: Group, model: string): void {
  const bounds = new Box3().setFromObject(root), height = bounds.max.y - bounds.min.y;
  const target = civilianHeight(model);
  if (height > 0 && Math.abs(height / target - 1) > .08) {
    root.scale.multiplyScalar(target / height); root.updateMatrixWorld(true);
  }
}
