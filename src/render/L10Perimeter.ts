import { BoxGeometry, Color, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three/webgpu';
import { attribute } from 'three/tsl';
import { perimeterBoxes } from '../sim/missions/LevelTenFinale';
import type { SimWorld } from '../sim/world/SimWorld';
import type { Materials } from './Materials';

/** Damaged jersey blocks and patched chain-link panels on the live L10 arena barrier line. */
export class L10Perimeter extends Group {
  private readonly geometry = new BoxGeometry(1, 1, 1);
  private readonly mesh: InstancedMesh | null = null;
  private readonly pieces: { p: Vector3; s: Vector3; yaw: number; angle: number; color: Color }[] = [];
  private readonly hidden = new Vector3();
  private shown: boolean | null = null;
  constructor(private readonly world: SimWorld, materials: Materials) {
    super(); this.name = 'l10-perimeter';
    const c = world.missions?.def.anchors['cure-console'];
    if (!c) return;
    for (const box of perimeterBoxes(c)) {
      const horizontal = box.halfX > box.halfZ, length = 2 * (horizontal ? box.halfX : box.halfZ);
      const add = (along: number, y: number, width: number, height: number, depth: number, tint: string, angle = 0) => this.pieces.push({
        p: new Vector3(box.x + (horizontal ? along : 0), y, box.z + (horizontal ? 0 : along)),
        s: new Vector3(width, height, depth),
        yaw: horizontal ? 0 : Math.PI / 2, angle, color: new Color(tint),
      });
      // Repeated crash blocks form the base; alternating concrete tones and hazard paint break the long silhouette.
      for (let along = -length / 2 + 1.5, index = 0; along < length / 2; along += 3.2, index++) {
        add(along, .43, 2.85, .86, .72, index % 3 === 0 ? '#706f68' : '#85847a');
        add(along, .89, 2.45, .12, .46, '#9a9583');
        if (index % 2 === 0) add(along, .66, 1.1, .09, .76, '#b2a05d');
      }
      // Salvaged chain-link frames keep the original 2.8 m screening height and sit on the same barrier centerline.
      for (let along = -length / 2; along <= length / 2; along += 3.2) {
        add(along, 1.75, .13, 1.8, .13, '#514d43');
        add(along, 2.62, .16, .12, .16, '#8e7652');
      }
      for (const y of [1.06, 2.42]) for (let along = -length / 2 + 1.6; along < length / 2; along += 3.2) add(along, y, 3.15, .1, .12, '#625c4e');
      // Cross-braces read as patched wire panels. They share the single instanced draw with every other piece.
      for (let along = -length / 2 + 1.6; along < length / 2 - 1.5; along += 6.4) {
        add(along + 1.6, 1.75, 2.15, .075, .08, '#76664c', Math.PI / 4);
        add(along + 1.6, 1.75, 2.15, .075, .08, '#76664c', -Math.PI / 4);
      }
    }
    this.geometry.setAttribute('_edgeColor', new InstancedBufferAttribute(new Float32Array(this.pieces.flatMap(piece => piece.color.toArray())), 3));
    const material = materials.shaded(attribute('_edgeColor', 'vec3'));
    material.name = 'l10-perimeter-fence';
    this.mesh = new InstancedMesh(this.geometry, material, this.pieces.length);
    this.mesh.castShadow = this.mesh.receiveShadow = true; this.mesh.frustumCulled = false;
    this.add(this.mesh); this.update();
  }
  update(): void {
    const up = !!this.world.missions?.state.states['perimeter-up'];
    if (!this.mesh || up === this.shown) return;
    this.shown = up;
    const matrix = new Matrix4(), rotation = new Quaternion(), axis = new Vector3(0, 1, 0), braceAxis = new Vector3(0, 0, 1), brace = new Quaternion();
    this.pieces.forEach((piece, i) => { rotation.setFromAxisAngle(axis, piece.yaw).multiply(brace.setFromAxisAngle(braceAxis, piece.angle)); matrix.compose(piece.p, rotation, up ? piece.s : this.hidden); this.mesh!.setMatrixAt(i, matrix); });
    this.mesh.instanceMatrix.needsUpdate = true;
  }
  dispose(): void { this.geometry.dispose(); this.mesh?.dispose(); }
}
