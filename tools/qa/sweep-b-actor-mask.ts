/** Diagnostic ID mask using actual production crowd draw order; no simulation writes. */
import { MeshBasicNodeMaterial, Color, type Mesh, type Material } from 'three/webgpu';
import { attribute, instanceIndex, uniform, vec3 } from 'three/tsl';
import type { Game } from '../../src/Game';
export function installActorMask(game: Game, id: number) {
  const saved = new Map<Mesh, Material | Material[]>(), masks: MeshBasicNodeMaterial[] = [], mode = uniform(0);
  const matched: { name: string; index: number; count: number }[] = [];
  game.view.scene.traverse(node => {
    const mesh = node as Mesh; if (!mesh.geometry || !mesh.material || !mesh.visible) return;
    saved.set(mesh, mesh.material);
    const source = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as MeshBasicNodeMaterial;
    const material = new MeshBasicNodeMaterial({ color: new Color(0), side: source.side });
    material.positionNode = source.positionNode;
    material.maskNode = source.maskNode;
    if (mesh.geometry.userData.crowdBinds) {
      const parent = mesh.parent as unknown as { probe?: { figures: { id: number }[] } };
      const index = parent.probe?.figures.findIndex(f => f.id === id) ?? -1;
      if (index >= 0) {
        matched.push({ name: mesh.name, index, count: parent.probe!.figures.length });
        const eye = attribute('_parts', 'vec4').z.greaterThan(1.5);
        const selected = instanceIndex.equal(index).and(mode.equal(1).or(mode.equal(2).and(eye)));
        material.colorNode = selected.select(vec3(1), vec3(0));
      }
    }
    mesh.material = material; masks.push(material);
  });
  if (!matched.length) { for (const [mesh, material] of saved) mesh.material = material; masks.forEach(m => m.dispose()); throw new Error(`Actor${id} has no production instance slot`); }
  return {
    matched,
    set(value: number) { mode.value = value; game.view.update(1); },
    restore() { for (const [mesh, material] of saved) mesh.material = material; masks.forEach(m => m.dispose()); game.view.update(1); },
  };
}
