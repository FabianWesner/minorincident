import { MeshBasicNodeMaterial, Color, type Mesh, type Material } from 'three/webgpu';
import { attribute, uniform, vec3 } from 'three/tsl';
import { crowdHeadwearVisibility } from '../../src/render/characters/CrowdAppearance';
import type { Game } from '../../src/Game';

/** Depth-tested eye ID pass on the actual posed crowd draw, including the source face and glasses. */
export function installEyeMask(game: Game) {
  const saved = new Map<Mesh, Material | Material[]>(), masks: MeshBasicNodeMaterial[] = [], strength = uniform(0);
  const scene = game.view.scene;
  scene.traverse(node => {
    const mesh = node as Mesh;
    if (!mesh.geometry || !mesh.material || !mesh.visible) return;
    saved.set(mesh, mesh.material);
    const original = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as MeshBasicNodeMaterial;
    const material = new MeshBasicNodeMaterial({ color: new Color(0), side: original.side });
    if (mesh.geometry.userData.crowdBinds) {
      const parts = attribute('_parts', 'vec4'), eye = parts.z.greaterThan(1.5);
      material.positionNode = original.positionNode;
      material.colorNode = eye.select(vec3(strength), vec3(0));
      material.maskNode = parts.w.lessThan(1024).and(crowdHeadwearVisibility().greaterThan(.5)).and(eye.not().or(attribute('uv', 'vec2').sub(.5).mul(2).length().lessThanEqual(1)));
    }
    mesh.material = material; masks.push(material);
  });
  const accessories = scene.getObjectByName('crowd-accessories')!;
  const layers = accessories.children.map(node => node.layers.mask);
  return {
    set(eyes: boolean, hats: boolean) { strength.value = eyes ? 1 : 0; accessories.children.forEach((node, i) => { node.layers.mask = hats ? layers[i] : 0; }); game.view.update(1); },
    restore() { for (const [mesh, material] of saved) mesh.material = material; masks.forEach(m => m.dispose()); accessories.children.forEach((node, i) => { node.layers.mask = layers[i]; }); game.view.update(1); },
  };
}
