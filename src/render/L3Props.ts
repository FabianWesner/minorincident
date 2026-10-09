import { BoxGeometry, Group, InstancedMesh, Matrix4, MeshBasicNodeMaterial, Quaternion, Vector3 } from 'three/webgpu';
import { l3Dressing } from '../levels/L3/layout';
import { L3_GATES } from '../sim/missions/LevelThreeCollapse';
import type { SimWorld } from '../sim/world/SimWorld';
import type { Materials } from './Materials';

type Box = { x: number; y: number; z: number; sx: number; sy: number; sz: number };
/**
 * E21 code-art set dressing driven by the L3 sim state: police light bars on the lit cruisers of the yard and the Boulevard
 * (alternating red/blue, a handful of instanced draws) and the striped yard gates the officers left behind pull shut behind
 * the squad. Same pattern as L2Props.
 */
export class L3Props extends Group {
  private readonly box = new BoxGeometry(1, 1, 1);
  private readonly red = new MeshBasicNodeMaterial({ color: '#ff2a1a' });
  private readonly blue = new MeshBasicNodeMaterial({ color: '#2f6bff' });
  private readonly m4 = new Matrix4();
  private readonly at = new Vector3();
  private readonly scaleV = new Vector3();
  private readonly turn = new Quaternion();
  private readonly bars: InstancedMesh[] = [];
  private readonly gates: InstancedMesh[] = [];
  constructor(private readonly world: SimWorld, materials: Materials) {
    super(); this.name = 'l3-props';
    const instanced = (material: MeshBasicNodeMaterial | ReturnType<Materials['get']>, boxes: Box[]) => {
      const mesh = new InstancedMesh(this.box, material, Math.max(1, boxes.length)); mesh.count = boxes.length; mesh.frustumCulled = false;
      boxes.forEach((b, i) => { this.m4.compose(this.at.set(b.x, b.y, b.z), this.turn.identity(), this.scaleV.set(b.sx, b.sy, b.sz)); mesh.setMatrixAt(i, this.m4); });
      mesh.instanceMatrix.needsUpdate = true; this.add(mesh); return mesh;
    };
    const red: Box[] = [], blue: Box[] = [];
    for (const d of l3Dressing) if (d.lit) {
      const ax = Math.cos(d.yaw ?? 0), az = -Math.sin(d.yaw ?? 0), y = d.assetId === 'veh.police-suv' ? 2.2 : 1.75;
      for (const [side, list] of [[-1, red], [1, blue]] as const) list.push({ x: d.x - az * side * .35 + ax * .2, y, z: d.z + ax * side * .35 + az * .2, sx: .3, sy: .14, sz: .3 });
    }
    this.bars.push(instanced(this.red, red), instanced(this.blue, blue));
    // Gate panels: white and red stripes across each yard opening, shown once the gates are shut.
    const white: Box[] = [], stripes: Box[] = [];
    for (const w of Object.values(L3_GATES)) {
      const along = w.halfX > w.halfZ ? 'x' : 'z', length = 2 * (along === 'x' ? w.halfX : w.halfZ), n = Math.max(2, Math.round(length / .8));
      for (let k = 0; k < n; k++) {
        const t = (k + .5) / n - .5, list = k % 2 ? stripes : white;
        list.push({ x: w.x + (along === 'x' ? t * length : 0), y: .85, z: w.z + (along === 'z' ? t * length : 0), sx: along === 'x' ? length / n : .16, sy: 1.1, sz: along === 'z' ? length / n : .16 });
      }
    }
    this.gates.push(instanced(materials.get('picketWhite'), white), instanced(this.red, stripes));
    this.update();
  }
  update(): void {
    const s = this.world.missions?.state.l3, tick = this.world.tick;
    // Light bars alternate red and blue every quarter second.
    const phase = Math.floor(tick / 15) % 2;
    this.bars[0].visible = phase === 0; this.bars[1].visible = phase === 1;
    for (const g of this.gates) g.visible = !!s?.gatesClosedAt;
  }
  dispose(): void { this.box.dispose(); this.red.dispose(); this.blue.dispose(); }
}
