import { Box3, type Group } from 'three';

export const heroineStandingHeight = 1.454;
export const adultMaleStandingHeight = heroineStandingHeight * 1.08;

/** Metres in the standing crowd frame. Children have their own authored proportions. */
export function civilianHeight(model: string): number {
  if (model === 'npc.civilian-kid') return 1.4744;
  if (model === 'npc.brother') return 1.4265;
  // The heroine's measured standing height is 1.454 m. Keep women in that
  // class and give adult men an 8% height difference, including story survivors.
  if (/woman|female|mia|rosa|lab-tech-a|civilian-adult-f/i.test(model)) return heroineStandingHeight;
  // The elderly roster figure is a man; the age allowance is up to 5% below
  // the male class. Other adult models in the L1/core roster are male.
  if (/elderly/i.test(model)) return adultMaleStandingHeight * .95;
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
