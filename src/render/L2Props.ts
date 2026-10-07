import { BoxGeometry, Group, Mesh, MeshBasicNodeMaterial } from 'three/webgpu';
import { l2, l2Anchors } from '../data/l2';
import { l2Dressing } from '../levels/L2/layout';
import type { SimWorld } from '../sim/world/SimWorld';
import type { Materials } from './Materials';

/**
 * E20 code-art set dressing driven by the L2 sim state (placeholders until the art lane's assets land): the station's red
 * rotating alarm beacons, police light bars on the lit emergency vehicles, the fire axe on its wall rack, and the
 * checkpoint gates that slide shut behind the courier. Unlit emissive colours read at midday without the light field.
 */
export class L2Props extends Group {
  private readonly box = new BoxGeometry(1, 1, 1);
  private readonly red = new MeshBasicNodeMaterial({ color: '#ff2a1a' });
  private readonly blue = new MeshBasicNodeMaterial({ color: '#2f6bff' });
  private readonly beacons: Mesh[] = [];
  private readonly bars: { mesh: Mesh; i: number }[] = [];
  private readonly gates: { mesh: Mesh; open: [number, number]; closed: [number, number] }[] = [];
  private readonly axe = new Group();
  constructor(private readonly world: SimWorld, materials: Materials) {
    super(); this.name = 'l2-props';
    const part = (material: MeshBasicNodeMaterial | ReturnType<Materials['get']>, size: [number, number, number], at: [number, number, number], parent: Group = this) => {
      const m = new Mesh(this.box, material); m.scale.set(...size); m.position.set(...at); m.castShadow = true; parent.add(m); return m;
    };
    // Rotating red beacons on the bay walls (off until the alarm).
    for (const x of [-75.9, -68.7]) { const b = part(this.red, [.28, .28, .28], [x, 3.1, 44.4]); b.visible = false; this.beacons.push(b); }
    // Light bars on every lit police car / ambulance of the dressing and the checkpoint.
    let i = 0;
    for (const d of l2Dressing) if (d.lit) {
      const ax = Math.cos(d.yaw ?? 0), az = -Math.sin(d.yaw ?? 0), y = d.assetId === 'veh.police-suv' || d.assetId === 'veh.ambulance' ? 2.2 : 1.75;
      for (const side of [-1, 1]) {
        const mesh = part(side < 0 ? this.red : this.blue, [.3, .14, .3], [d.x - az * side * .35 + ax * .2, y, d.z + ax * side * .35 + az * .2]);
        this.bars.push({ mesh, i: i++ });
      }
    }
    // The fire axe on its rack (hidden once taken).
    const [rx, rz] = l2Anchors['l2-axe-rack'];
    part(materials.get('woodWarm'), [1.1, .5, .08], [rx, 1.5, rz + .55], this.axe);
    part(materials.get('woodWarm'), [.08, 1.05, .08], [rx, 1.45, rz + .48], this.axe);
    part(materials.get('policeBlue'), [.36, .2, .06], [rx + .1, 1.88, rz + .46], this.axe);
    this.add(this.axe);
    // Checkpoint gates: a striped panel per entrance; open = parked beside the opening, closed = across it.
    const [z0, z1] = l2.checkpoint.gateZ, x = l2.checkpoint.gateX;
    const panel = (w: number, d: number, open: [number, number], closed: [number, number]) => {
      const g = new Group(); g.position.set(open[0], 0, open[1]); this.add(g);
      const stripes = Math.max(2, Math.round(Math.max(w, d) / .8));
      for (let k = 0; k < stripes; k++) {
        const t = (k + .5) / stripes - .5;
        part(k % 2 ? this.red : materials.get('picketWhite'), [w > d ? w / stripes : w, .9, d > w ? d / stripes : d], [w > d ? t * w : 0, .85, d > w ? t * d : 0], g);
      }
      this.gates.push({ mesh: g as unknown as Mesh, open, closed });
    };
    panel(.16, z1 - z0 - 2.4, [x - .2, z1 + 4.6], [x, (z0 + z1) / 2]);
    panel(2.5, .16, [80.2, 37.4], [81.5, 35]);
  }
  update(): void {
    const s = this.world.missions?.state.l2, tick = this.world.tick;
    if (!s) return;
    const alarm = s.alarmAt > 0 && tick >= s.alarmAt && s.phase !== 'calm';
    for (const [k, b] of this.beacons.entries()) { b.visible = alarm && s.phase !== 'done'; b.rotation.y = tick * .18 + k; b.scale.setScalar(alarm && Math.floor(tick / 12 + k) % 2 ? .34 : .24); }
    for (const { mesh, i } of this.bars) mesh.visible = Math.floor(tick / 15 + i) % 2 === 0;
    this.axe.children[2].visible = this.axe.children[1].visible = !s.axe;
    const closing = s.crossedAt > 0 ? Math.min(1, (tick - s.crossedAt) / 36) : 0;
    for (const g of this.gates) (g.mesh as unknown as Group).position.set(g.open[0] + (g.closed[0] - g.open[0]) * closing, 0, g.open[1] + (g.closed[1] - g.open[1]) * closing);
  }
  dispose(): void { this.box.dispose(); this.red.dispose(); this.blue.dispose(); }
}
