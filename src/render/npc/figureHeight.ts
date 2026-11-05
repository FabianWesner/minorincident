import { Box3, type Group } from 'three';

export const heroineStandingHeight = 1.454;
// G-26 is an absolute adult-to-heroine match. Height differences between
// adult body types come from their authored proportions, not a taller render fit.
export const adultMaleStandingHeight = heroineStandingHeight;

/** Metres in the standing crowd frame. Children have their own authored proportions. */
export function civilianHeight(model: string): number {
  // Preserve the PROD child/adult ratios against the new women's class.
  if (model === 'npc.civilian-kid') return heroineStandingHeight * (1.4744 / 1.8);
  if (model === 'npc.brother') return heroineStandingHeight * (1.4265 / 1.8);
  // Adult civilians, officers and survivors use the heroine's measured height.
  if (/woman|female|mia|rosa|alvarez|lab-tech-b|depot-clerk|paramedic|civilian-adult-f/i.test(model)) return heroineStandingHeight;
  // Age and build remain in the authored silhouette; adults share the same
  // absolute standing height as the heroine.
  if (/elderly/i.test(model)) return heroineStandingHeight;
  return adultMaleStandingHeight;
}

/** Bring older 1.2–1.4 m NPC exports into the measured adult standing class.
 * Apply before baking so geometry, pivots, stride, props and every LOD share the same frame.
 */
export function fitCivilianHeight(root: Group, model: string): void {
  // q249 bakes the head edit into the mesh, but preserves authored body scale
  // in this marker. It must not disable the standing-frame fit: that fit is
  // what keeps older 1.4 m exports at adult height after the bake.
  const bounds = new Box3().setFromObject(root.getObjectByName('skin_body') ?? root), height = bounds.max.y - bounds.min.y;
  const target = civilianHeight(model);
  if (height > 0 && Math.abs(height / target - 1) > .005) {
    root.scale.multiplyScalar(target / height); root.updateMatrixWorld(true);
  }
}
