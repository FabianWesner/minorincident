import { color, depth, float, Fn, normalView, positionView, select, uniform } from 'three/tsl';
import type { Material, Node, NodeMaterial } from 'three/webgpu';
import { livingStencil } from './figureStencil';

/** 1 while the courier draws in the near-camera depth slice (CharacterView.setForeground). */
export const courierForegroundOn = uniform(0);
// Compress depth into a near-camera slice: the courier clears world blockers,
// while her own face, cap, hair and limbs still occlude one another correctly.
const slice = positionView.z.negate().mul(.001).clamp(.001, .1);
/** Q-208: the slice is switched by this uniform, never by swapping `depthNode`. Swapping it (plus `needsUpdate`) rebuilt
 * the courier skin and her held weapon each time she passed a corpse: 0.6-1.8 s freezes during play. Off, the node
 * writes the fragment's own depth, so the look is unchanged. three copies `depthNode` into the shadow-pass material
 * too; there it always writes the light camera's own depth (a sliced shadow map made her shade herself dark). */
// A one-parameter Fn is called with the node builder (three TSLCore), so the branch is chosen per build.
const perPass = Fn((builder: { material?: { isShadowPassMaterial?: boolean } }) =>
  builder.material?.isShadowPassMaterial ? depth : select(courierForegroundOn.greaterThan(.5), slice, depth)) as unknown as () => Node;
const courierDepth = perPass();

/** Give a courier material (body, gear, carried weapon) the switchable depth before its first compile. True when it changed. */
export function useCourierDepth(material: Material): boolean {
  livingStencil(material);
  const node = material as NodeMaterial;
  if (node.depthNode === courierDepth) return false;
  // A depth lift alone leaves her dark silhouette lost among similarly colored
  // infected. Install a gold contour once and switch it with the same uniform.
  const edge = float(1).sub(normalView.dot(positionView.negate().normalize()).abs()).pow(3).mul(courierForegroundOn).mul(.8);
  const contour = color('#ffd17d').mul(edge);
  const lit = node as unknown as { emissiveNode?: typeof contour };
  lit.emissiveNode = lit.emissiveNode ? lit.emissiveNode.add(contour) : contour;
  node.depthTest = true; node.depthNode = courierDepth; node.needsUpdate = true;
  return true;
}
