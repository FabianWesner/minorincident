import { BoxGeometry, Group, InstancedMesh, Matrix4, Mesh, MeshBasicNodeMaterial, Quaternion, Vector3 } from 'three/webgpu';
import { l2, l2Anchors } from '../data/l2';
import { l2Dressing } from '../levels/L2/layout';
import type { SimWorld } from '../sim/world/SimWorld';
import type { Materials } from './Materials';

type Box = { x: number; y: number; z: number; sx: number; sy: number; sz: number; gate?: number };
/**
 * E20 code-art set dressing driven by the L2 sim state (placeholders until the art lane's assets land): the station's red
 * rotating alarm beacons, police light bars on the lit emergency vehicles, the fire axe on its wall rack, and the striped
 * checkpoint gates that slide shut behind the courier. Instanced by colour (a handful of draws); unlit colours read at midday.
 */
export class L2Props extends Group {
  private readonly box = new BoxGeometry(1, 1, 1);
  private readonly red = new MeshBasicNodeMaterial({ color: '#ff2a1a' });
  private readonly blue = new MeshBasicNodeMaterial({ color: '#2f6bff' });
  private readonly glass = new MeshBasicNodeMaterial({ color: '#cfe8f2' });
  private readonly m4 = new Matrix4();
  private readonly at = new Vector3();
  private readonly scaleV = new Vector3();
  private readonly yAxis = new Vector3(0, 1, 0);
  private readonly turn = new Quaternion();
  private readonly beacons: InstancedMesh;
  private readonly bars: { mesh: InstancedMesh; boxes: Box[] }[] = [];
  private readonly stripes: { mesh: InstancedMesh; boxes: Box[] }[] = [];
  /** Per gate: open and closed offsets of its panel. */
  private readonly gates: { open: [number, number]; closed: [number, number] }[] = [];
  private readonly axe = new Group();
  constructor(private readonly world: SimWorld, materials: Materials) {
    super(); this.name = 'l2-props';
    const instanced = (material: MeshBasicNodeMaterial | ReturnType<Materials['get']>, count: number) => {
      const mesh = new InstancedMesh(this.box, material, Math.max(1, count)); mesh.count = count; mesh.frustumCulled = false; this.add(mesh); return mesh;
    };
    this.beacons = instanced(this.red, 2); this.beacons.count = 0;
    // Light bars on every lit police car / ambulance of the dressing and the checkpoint: red and blue halves.
    const red: Box[] = [], blue: Box[] = [];
    for (const d of l2Dressing) if (d.lit) {
      const ax = Math.cos(d.yaw ?? 0), az = -Math.sin(d.yaw ?? 0), y = d.assetId === 'veh.police-suv' || d.assetId === 'veh.ambulance' ? 2.2 : 1.75;
      for (const [side, list] of [[-1, red], [1, blue]] as const) list.push({ x: d.x - az * side * .35 + ax * .2, y, z: d.z + ax * side * .35 + az * .2, sx: .3, sy: .14, sz: .3 });
    }
    this.bars.push({ mesh: instanced(this.red, red.length), boxes: red }, { mesh: instanced(this.blue, blue.length), boxes: blue });
    // The fire axe on its rack (head and handle hidden once taken).
    const [rx, rz] = l2Anchors['l2-axe-rack'];
    const part = (material: ReturnType<Materials['get']>, size: [number, number, number], at: [number, number, number]) => { const m = new Mesh(this.box, material); m.scale.set(...size); m.position.set(...at); m.castShadow = true; this.axe.add(m); };
    part(materials.get('woodWarm'), [1.1, .5, .08], [rx, 1.5, rz + .55]);
    part(materials.get('woodWarm'), [.08, 1.05, .08], [rx, 1.45, rz + .48]);
    part(materials.get('policeBlue'), [.36, .2, .06], [rx + .1, 1.88, rz + .46]);
    this.add(this.axe);
    // Checkpoint gates: striped panels (stripes relative to the panel centre), moved between open and closed.
    const [z0, z1] = l2.checkpoint.gateZ, x = l2.checkpoint.gateX, white: Box[] = [], redStripes: Box[] = [];
    const panel = (w: number, d: number, open: [number, number], closed: [number, number]) => {
      const gate = this.gates.length; this.gates.push({ open, closed });
      const count = Math.max(2, Math.round(Math.max(w, d) / .8));
      for (let k = 0; k < count; k++) {
        const t = (k + .5) / count - .5;
        (k % 2 ? redStripes : white).push({ x: w > d ? t * w : 0, y: .85, z: d > w ? t * d : 0, sx: w > d ? w / count : w, sy: .9, sz: d > w ? d / count : d, gate });
      }
    };
    panel(.16, z1 - z0 - 2.4, [x - .2, z1 + 4.6], [x, (z0 + z1) / 2]);
    panel(2.5, .16, [80.2, 37.4], [81.5, 35]);
    this.stripes.push({ mesh: instanced(materials.get('picketWhite'), white.length), boxes: white }, { mesh: instanced(this.red, redStripes.length), boxes: redStripes });
    // Broken windows: a dark pane on the facade and pale glass shards on the pavement in front of it.
    const panes: Box[] = [], shards: Box[] = [];
    for (const d of l2Dressing) if (d.kind === 'broken-window') {
      const out = d.yaw ? -1 : 1;
      panes.push({ x: d.x, y: 1.3, z: d.z - out * .8, sx: 1.3, sy: .9, sz: .06 });
      for (let k = 0; k < 6; k++) shards.push({ x: d.x + Math.sin(k * 2.3) * .7, y: .03, z: d.z + out * (.3 + (k % 3) * .25), sx: .18 + (k % 2) * .1, sy: .02, sz: .12 });
    }
    this.place(instanced(materials.get('uiDark'), panes.length), panes, () => [0, 0]);
    this.place(instanced(this.glass, shards.length), shards, () => [0, 0]);
    for (const { mesh, boxes } of this.bars) this.place(mesh, boxes, () => [0, 0]);
    this.update();
  }
  private place(mesh: InstancedMesh, boxes: Box[], offset: (b: Box) => [number, number]): void {
    boxes.forEach((b, i) => {
      const [ox, oz] = offset(b);
      this.m4.compose(this.at.set(b.x + ox, b.y, b.z + oz), this.turn.identity(), this.scaleV.set(b.sx, b.sy, b.sz));
      mesh.setMatrixAt(i, this.m4);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }
  update(): void {
    const s = this.world.missions?.state.l2, tick = this.world.tick;
    if (!s) return;
    const alarm = s.alarmAt > 0 && tick >= s.alarmAt && s.phase !== 'calm' && s.phase !== 'done';
    this.beacons.count = alarm ? 2 : 0;
    if (alarm) {
      const pulse = Math.floor(tick / 12) % 2 ? .34 : .24;
      [-75.9, -68.7].forEach((bx, i) => { this.m4.compose(this.at.set(bx, 3.1, 44.4), this.turn.setFromAxisAngle(this.yAxis, tick * .18 + i), this.scaleV.set(pulse, pulse, pulse)); this.beacons.setMatrixAt(i, this.m4); });
      this.beacons.instanceMatrix.needsUpdate = true;
    }
    // Light bars alternate red and blue every quarter second.
    const phase = Math.floor(tick / 15) % 2;
    this.bars[0].mesh.visible = phase === 0; this.bars[1].mesh.visible = phase === 1;
    this.axe.children[1].visible = this.axe.children[2].visible = !s.axe;
    const closing = s.crossedAt > 0 ? Math.min(1, (tick - s.crossedAt) / 36) : 0;
    for (const { mesh, boxes } of this.stripes) this.place(mesh, boxes, b => { const g = this.gates[b.gate!]; return [g.open[0] + (g.closed[0] - g.open[0]) * closing, g.open[1] + (g.closed[1] - g.open[1]) * closing]; });
  }
  dispose(): void { this.box.dispose(); this.red.dispose(); this.blue.dispose(); this.glass.dispose(); }
}
