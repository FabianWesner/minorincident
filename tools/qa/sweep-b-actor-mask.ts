/** Diagnostic ID mask using actual production crowd draw order; no simulation writes. */
import { MeshBasicNodeMaterial, Color, InstancedMesh, Matrix4, Vector3, type Mesh, type Material } from 'three/webgpu';
import { attribute, instanceIndex, uniform, vec3, vec4 } from 'three/tsl';
import type { Game } from '../../src/Game';
export function installActorMask(game: Game, id: number) {
  const saved = new Map<Mesh, Material | Material[]>(), masks: MeshBasicNodeMaterial[] = [], mode = uniform(0);
  const matched: { name: string; index: number; count: number }[] = [];
  const actor = game.world.entities.get(id); if (!actor) throw new Error(`Missing actor${id}`);
  const matrix = new Matrix4(), point = new Vector3();
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
    // Authored hair/headwear is a separate instanced draw, not crowdBinds. Include
    // its actual nearby instance; reject an ambiguous association in this isolated fixture.
    if (mesh instanceof InstancedMesh && mesh.parent?.name === 'crowd-accessories') {
      const near: number[] = [];
      for (let index = 0; index < mesh.count; index++) {
        mesh.getMatrixAt(index, matrix); point.setFromMatrixPosition(matrix).applyMatrix4(mesh.matrixWorld);
        if (Math.hypot(point.x - actor.transform.x, point.z - actor.transform.z) < .75) near.push(index);
      }
      if (near.length > 1) throw new Error(`Ambiguous accessory mask for actor${id}: ${mesh.name}`);
      if (near.length) {
        matched.push({ name: mesh.name, index: near[0], count: mesh.count });
        material.outputNode = vec4(instanceIndex.equal(near[0]).and(mode.equal(1)).select(vec3(1), vec3(0)), 1);
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
