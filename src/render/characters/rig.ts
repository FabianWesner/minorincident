import { Box3, Group, Vector3, type Object3D } from 'three';
import { characterNodes, type CharacterNode, type SurvivorVariant } from '../../data/survivor';
import { createSurvivorPlaceholder } from './placeholder';
export type CharacterRig = Record<CharacterNode, Object3D>;
/** Validate loaded assets and the code fallback through the same runtime contract. */
export function resolveRig(model: Group, expectedHeight = 1.4): CharacterRig {
  const nodes = {} as CharacterRig;
  for (const name of characterNodes) { const node = model.getObjectByName(name); if (!node) throw new Error(`Missing character node ${name}`); nodes[name] = node; }
  // Exported palm sockets can lie beyond the hand-node tolerance; preserve direction, cap offset.
  model.updateMatrixWorld(true);
  for (const side of ['L', 'R'] as const) {
    const socket = nodes[`weaponSocket${side}`], scale = socket.parent!.getWorldScale(new Vector3());
    const limit = .045 / Math.max(scale.x, scale.y, scale.z);
    if (socket.position.length() > limit) socket.position.setLength(limit);
  }
  const bounds = new Box3().setFromObject(model), height = bounds.max.y - bounds.min.y;
  if (Math.abs(height - expectedHeight) > 0.07) throw new Error(`Invalid character height ${height}, expected ${expectedHeight}`);
  return nodes;
}
/** Assets may fail independently. Never block gameplay on art; caller exposes the source/reason to tests. */
export async function loadCharacter(variant: SurvivorVariant, load: () => Promise<Group>, expectedHeight = 1.4): Promise<{ model: Group; rig: CharacterRig; source: 'glb' | 'placeholder'; reason: string | null }> {
  let model: Group | undefined;
  try { model = await load(); return { model, rig: resolveRig(model, expectedHeight), source: 'glb', reason: null }; }
  catch (error) {
    if (model) disposeCharacter(model);
    model = createSurvivorPlaceholder(variant);
    return { model, rig: resolveRig(model), source: 'placeholder', reason: String(error) };
  }
}
/** Mesh resources are owned by each loaded character, apart from remapped shared palette materials. */
export function disposeCharacter(model: Group): void {
  const resources = new Set<{ dispose(): void }>();
  model.traverse((object) => {
    const mesh = object as import('three').Mesh;
    if (!mesh.isMesh) return;
    resources.add(mesh.geometry);
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) if (!material.userData.sharedPalette) resources.add(material);
  });
  for (const resource of resources) resource.dispose();
}
