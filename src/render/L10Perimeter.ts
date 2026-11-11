import { BoxGeometry, Color, Group, InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three/webgpu';
import { perimeterBoxes } from '../sim/missions/LevelTenFinale';
import type { SimWorld } from '../sim/world/SimWorld';
import type { Materials } from './Materials';

/** r42-arenas: the dispersal yard's service fence (R7 perimeter), drawn on the same boxes the sim closes once the Mega is in the yard
 * (`perimeter-up`). Three rails and posts every 1.5 m, 2.8 m tall, concrete grey with a hazard-yellow top rail so it reads in the dark. */
export class L10Perimeter extends Group {
  private readonly geometry = new BoxGeometry(1, 1, 1);
  private readonly mesh: InstancedMesh | null = null;
  private readonly rods: { p: Vector3; s: Vector3 }[] = [];
  private readonly hidden = new Vector3();
  private shown: boolean | null = null;
  constructor(private readonly world: SimWorld, materials: Materials) {
    super(); this.name = 'l10-perimeter';
    const c = world.missions?.def.anchors['cure-console'];
    if (!c) return;
    for (const box of perimeterBoxes(c)) {
      const horizontal = box.halfX > box.halfZ, length = 2 * (horizontal ? box.halfX : box.halfZ);
      const add = (along: number, y: number, width: number, height: number) => this.rods.push({
        p: new Vector3(box.x + (horizontal ? along : 0), y, box.z + (horizontal ? 0 : along)),
        s: new Vector3(horizontal ? width : .16, height, horizontal ? .16 : width) });
      for (const y of [.5, 1.5, 2.65]) add(0, y, length, .14);
      for (let along = -length / 2; along <= length / 2; along += 1.5) add(along, 1.4, .14, 2.8);
    }
    this.mesh = new InstancedMesh(this.geometry, materials.fromColor('l10-perimeter-fence', new Color('#7a7d82'), 0, true), this.rods.length);
    this.mesh.castShadow = this.mesh.receiveShadow = true; this.mesh.frustumCulled = false;
    this.add(this.mesh); this.update();
  }
  update(): void {
    const up = !!this.world.missions?.state.states['perimeter-up'];
    if (!this.mesh || up === this.shown) return;
    this.shown = up;
    const matrix = new Matrix4(), rotation = new Quaternion();
    this.rods.forEach((rod, i) => { matrix.compose(rod.p, rotation, up ? rod.s : this.hidden); this.mesh!.setMatrixAt(i, matrix); });
    this.mesh.instanceMatrix.needsUpdate = true;
  }
  dispose(): void { this.geometry.dispose(); this.mesh?.dispose(); }
}
