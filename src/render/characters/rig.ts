import { Box3, Group, Mesh, SkinnedMesh, Uint16BufferAttribute, Vector3, type Material, type Object3D } from 'three';
import type { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
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
    const skin = mesh as import('three').SkinnedMesh;
    if (skin.isSkinnedMesh) resources.add(skin.skeleton);
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) if (!material.userData.sharedPalette) resources.add(material);
  });
  for (const resource of resources) resource.dispose();
}

/** Bind the courier's fitted tier gear to either the on-foot or seated body skeleton. */
export async function loadTierGear(loader: GLTFLoader, variant: SurvivorVariant, low: boolean, body: Set<Mesh>, material: Material, texture?: (map: import('three/webgpu').Texture) => Material): Promise<{ mesh: SkinnedMesh; tierTris: number[] } | undefined> {
  let bodyMesh: SkinnedMesh | undefined;
  for (const mesh of body) if ((mesh as SkinnedMesh).isSkinnedMesh && (!bodyMesh || mesh.geometry.getAttribute('position').count > bodyMesh.geometry.getAttribute('position').count)) bodyMesh = mesh as SkinnedMesh;
  if (!bodyMesh) return undefined;
  try {
    const scene = (await loader.loadAsync(`/assets/models/acc.courier-gear.${variant}.tiers${low ? '.low' : ''}.glb`)).scene;
    let source: SkinnedMesh | undefined; scene.traverse(node => { if ((node as SkinnedMesh).isSkinnedMesh) source = node as SkinnedMesh; });
    if (!source) return undefined;
    const tierTris = JSON.parse(String(source.userData.tierTris)) as number[];
    const index = new Map(bodyMesh.skeleton.bones.map((bone, i) => [bone.name, i]));
    const map = source.skeleton.bones.map(bone => index.get(bone.name) ?? 0);
    const joints = source.geometry.getAttribute('skinIndex'), remapped = new Uint16Array(joints.count * 4);
    for (let i = 0; i < remapped.length; i++) remapped[i] = map[joints.array[i]];
    const geometry = source.geometry; geometry.setAttribute('skinIndex', new Uint16BufferAttribute(remapped, 4));
    // Q-183: the gear is painted (one map per survivor, textured toy style like the body) and drawn on the shared textured route.
    const gearMap = (source.material as import('three').MeshStandardMaterial).map as import('three/webgpu').Texture | null;
    if (gearMap && texture) material = texture(gearMap);
    const mesh = new SkinnedMesh(geometry, material);
    mesh.name = 'courier-tier-gear'; mesh.position.copy(bodyMesh.position); mesh.quaternion.copy(bodyMesh.quaternion); mesh.scale.copy(bodyMesh.scale);
    mesh.frustumCulled = false; mesh.castShadow = true; mesh.visible = false; mesh.userData.tierTris = tierTris;
    bodyMesh.parent!.add(mesh); mesh.updateMatrixWorld(true); mesh.bind(bodyMesh.skeleton, bodyMesh.bindMatrix);
    return { mesh, tierTris };
  } catch { return undefined; }
}
