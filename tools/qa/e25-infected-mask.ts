/** Source geometry masks for one isolated infected, retaining production skinning and depth. */
import { MeshBasicNodeMaterial, type Material, type Mesh, type Object3D } from 'three/webgpu';
import { attribute, uniform, vec3 } from 'three/tsl';
import type { Game } from '../../src/Game';
export function installInfectedMask(game: Game) {
  const view = game.view as unknown as { crowd: Object3D; npcs?: { civilians: Object3D } };
  const roots = [view.crowd, view.npcs?.civilians];
  const saved = new Map<Mesh, Material | Material[]>(), masks: MeshBasicNodeMaterial[] = [], mode = uniform(0);
  const matched: string[] = [];
  if (game.world.infected!.active.filter(e => e.health.current > 0 && !e.hidden).length !== 1) throw Error('Mask requires exactly one isolated infected');
  game.view.scene.traverse(node => {
    const mesh = node as Mesh;
    if (!mesh.geometry || !mesh.material) return;
    const source = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as MeshBasicNodeMaterial;
    saved.set(mesh, mesh.material);
    const mask = new MeshBasicNodeMaterial({ color: 0, side: source.side, positionNode: source.positionNode, maskNode: source.maskNode });
    let infected = false;
    for (let p: Object3D | null = mesh; p; p = p.parent) if (roots.includes(p)) infected = true;
    if (infected) {
      matched.push(mesh.name);
      const eye = mesh.geometry.hasAttribute('_parts') ? attribute('_parts', 'vec4').z.greaterThan(1.5) : mode.equal(-1);
      mask.colorNode = mode.equal(1).or(mode.equal(2).and(eye)).select(vec3(1), vec3(0));
    }
    mesh.material = mask; masks.push(mask);
  });
  if (!matched.length) throw Error('No isolated infected geometry');
  return { matched, set(value: number) { mode.value = value; game.view.update(1); }, restore() { for (const [mesh, material] of saved) mesh.material = material; masks.forEach(m => m.dispose()); game.view.update(1); } };
}
