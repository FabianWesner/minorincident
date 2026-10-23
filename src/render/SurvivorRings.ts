import { ConeGeometry, Group, Mesh, MeshBasicNodeMaterial, TorusGeometry } from 'three/webgpu';
import { markerSurfaceY } from './ObjectiveMarker';
import { l5Survivors } from '../data/l5';
import type { SimWorld } from '../sim/world/SimWorld';
/**
 * L5 'look' step (PO 10-20): an amber ground ring at every survivor not yet found, so the search has visible goals.
 * Same style and colour as ObjectiveMarker; one shared torus and material, five meshes, no per-frame allocation.
 */
export class SurvivorRings extends Group {
  private readonly material = new MeshBasicNodeMaterial({ color: '#ffcf77', depthTest: true, depthWrite: false, toneMapped: false, fog: false });
  // Match ObjectiveMarker: the ground ring respects scenery while its arrow remains readable behind doors and wrecks.
  private readonly arrowMaterial = new MeshBasicNodeMaterial({ color: '#ffcf77', depthTest: false, depthWrite: false, toneMapped: false, fog: false });
  private readonly geometry = new TorusGeometry(.6, .05, 6, 32);
  private readonly arrowGeometry = new ConeGeometry(.25, .5, 4);
  private readonly rings = new Map<string, Group>();
  constructor(private readonly world: SimWorld) {
    super();
    for (const s of l5Survivors) {
      const ring = new Mesh(this.geometry, this.material);
      ring.name = `survivor-ring-${s.key}`; ring.renderOrder = 93; ring.rotation.x = Math.PI / 2; ring.position.y = .1;
      const arrow = new Mesh(this.arrowGeometry, this.arrowMaterial);
      arrow.name = `survivor-arrow-${s.key}`; arrow.renderOrder = 95; arrow.rotation.z = Math.PI; arrow.position.y = 2;
      const spot = new Group(); spot.name = `survivor-spot-${s.key}`; spot.visible = false; spot.add(ring, arrow);
      this.rings.set(s.key, spot); this.add(spot);
    }
  }
  /** Rings currently drawn. */
  visibleCount(): number { let n = 0; for (const r of this.rings.values()) if (r.visible) n++; return n; }
  update(storyShot = false): void {
    const mission = this.world.missions, l5 = mission?.state.l5, searching = !storyShot && !this.world.storyLock && !!l5 && l5.phase === 'search' && !l5.accountedAt;
    const pulse = 1 + .06 * Math.sin(this.world.tick * .12);
    for (const [key, spot] of this.rings) {
      const r = searching ? l5!.survivors.find(x => x.key === key) : undefined, anchor = r && r.status === 'hidden' ? mission!.def.anchors[`l5-ring-${key}`] : null;
      spot.visible = !!anchor;
      if (anchor) { spot.position.set(anchor.x, markerSurfaceY(this.world, anchor), anchor.z); spot.children[0].scale.setScalar(((anchor.radius ?? 2) / .6) * pulse); }
    }
  }
  dispose(): void { this.geometry.dispose(); this.material.dispose(); this.arrowGeometry.dispose(); this.arrowMaterial.dispose(); this.clear(); this.rings.clear(); }
}
