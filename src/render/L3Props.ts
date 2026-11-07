import { BoxGeometry, Color, Group, InstancedMesh, Matrix4, MeshBasicNodeMaterial, Quaternion, Vector3, Shape, ShapeGeometry } from 'three/webgpu';
import { l3Dressing } from '../levels/L3/layout';
import { L3_GATES } from '../sim/missions/LevelThreeCollapse';
import type { SimWorld } from '../sim/world/SimWorld';
import type { Materials } from './Materials';
import { AssetRegistry } from '../assets/registry';
import { VehicleOccupant } from './characters/VehicleOccupant';

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
  private readonly detourGeometry: ShapeGeometry;
  private readonly m4 = new Matrix4();
  private readonly at = new Vector3();
  private readonly scaleV = new Vector3();
  private readonly turn = new Quaternion();
  private readonly bars: InstancedMesh[] = [];
  private readonly gates: InstancedMesh[] = [];
  private readonly registry: AssetRegistry;
  private readonly passengers: VehicleOccupant[] = [];
  constructor(private readonly world: SimWorld, private readonly materials: Materials) {
    super(); this.name = 'l3-props';
    this.registry = new AssetRegistry(() => {}, { materials });
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
    // Old turn-lane paint at the open cross-links: part of the street, not navigation UI (vqa-3 #5, G-08 no route
    // steering). Lit like the asphalt, faded and low contrast, and worn through in two cracks; it never glows.
    const piece = (points: [number, number][]) => { const shape = new Shape(); shape.moveTo(...points[0]); for (const p of points.slice(1)) shape.lineTo(...p); shape.closePath(); return shape; };
    this.detourGeometry = new ShapeGeometry([
      piece([[1.1, 0], [.2, .75], [.2, .28], [.05, .28], [.05, -.28], [.2, -.28], [.2, -.75]]),
      piece([[-.08, .28], [-.5, .24], [-.48, -.28], [-.08, -.28]]),
      piece([[-.62, .26], [-1.1, .28], [-1.1, -.22], [-.6, -.28]]),
    ]);
    this.detourGeometry.rotateX(-Math.PI / 2);
    const detours = [
      [-96, -28, 0], [-90, -28, Math.PI / 2], [-90, -14, Math.PI / 2],
      [-96, 0, 0], [-90, 0, Math.PI / 2], [-90, 14, Math.PI / 2], [-90, 28, 0],
      [-22, 28, 0], [-13.75, 28, -Math.PI / 2], [-13.75, 14, -Math.PI / 2],
      [-22, 0, 0], [-13.75, 0, -Math.PI / 2], [-13.75, -14, -Math.PI / 2], [-13.75, -28, 0],
    ];
    const worn = materials.fromColor('l3-worn-turn-paint', new Color('#868174'));
    const paint = new InstancedMesh(this.detourGeometry, worn, detours.length);
    paint.receiveShadow = true;
    for (const [i, [x, z, direction]] of detours.entries()) {
      this.m4.compose(this.at.set(x, .12, z), this.turn.setFromAxisAngle(this.scaleV.set(0, 1, 0), -direction), this.scaleV.set(1, 1, 1));
      paint.setMatrixAt(i, this.m4);
    }
    paint.instanceMatrix.needsUpdate = true; paint.frustumCulled = false; this.add(paint);
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
  /** Static checkpoint passengers reuse the transport's seated civilian rigs. */
  async load(): Promise<void> {
    const models = ['npc.civilian-man-a', 'npc.civilian-woman-b', 'npc.civilian-elderly'];
    await Promise.all(l3Dressing.filter(d => d.assetId === 'veh.evac-bus').map(async (d, busIndex) => {
      const bus = new Group(); bus.name = `l3-bus-passengers-${busIndex}`;
      bus.position.set(d.x, 0, d.z); bus.rotation.y = d.yaw ?? 0; this.add(bus);
      await Promise.all([-2.4, -.6, 1.25].flatMap((x, row) => [-.94, .94].map(async (z, side) => {
        const seat = new Group(); seat.position.set(x, 1.65, z); bus.add(seat);
        const passenger = await VehicleOccupant.load(this.registry, -1 - busIndex * 6 - row * 2 - side, models[(row + side + busIndex) % models.length], this.materials);
        bus.add(passenger); passenger.pose(seat, undefined, .85); this.passengers.push(passenger);
      })));
    }));
  }
  update(): void {
    const s = this.world.missions?.state.l3, tick = this.world.tick;
    // Light bars alternate red and blue every quarter second.
    const phase = Math.floor(tick / 15) % 2;
    this.bars[0].visible = phase === 0; this.bars[1].visible = phase === 1;
    for (const g of this.gates) g.visible = !!s?.gatesClosedAt;
  }
  dispose(): void { for (const passenger of this.passengers) passenger.dispose(); this.registry.dispose(); this.box.dispose(); this.red.dispose(); this.blue.dispose(); this.detourGeometry.dispose(); }
}
