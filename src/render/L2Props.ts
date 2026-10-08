import { AdditiveBlending, BoxGeometry, CircleGeometry, CylinderGeometry, DoubleSide, Group, InstancedMesh, Matrix4, Mesh, MeshBasicNodeMaterial, OctahedronGeometry, Quaternion, SphereGeometry, TorusGeometry, Vector3 } from 'three/webgpu';
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
  /** Alarm beacons on the station front (wall x = -75.45): housing, red dome with a bright lens, rotating flare fan. */
  private readonly beacons: { root: Group; dome: Mesh; fan: Group }[] = [];
  private readonly beaconGeo = { housing: new CylinderGeometry(.2, .24, .14, 14), dome: new SphereGeometry(.2, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), fan: new CircleGeometry(3.4, 14, 0, .5).rotateX(-Math.PI / 2), lens: new SphereGeometry(.09, 8, 6) };
  private readonly beaconMat = {
    housing: new MeshBasicNodeMaterial({ color: '#2a2a2e' }), lens: new MeshBasicNodeMaterial({ color: '#ffd2c4' }), dome: new MeshBasicNodeMaterial({ color: '#ff3a24' }),
    glow: new MeshBasicNodeMaterial({ color: '#ff2a1a', transparent: true, opacity: .16, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }),
  };
  private readonly bars: { mesh: InstancedMesh; boxes: Box[] }[] = [];
  private readonly stripes: { mesh: InstancedMesh; boxes: Box[] }[] = [];
  /** Per gate: open and closed offsets of its panel. */
  private readonly gates: { open: [number, number]; closed: [number, number] }[] = [];
  private readonly axe = new Group();
  /** Soft marker for the optional axe: a bobbing gem over the rack and a ring where the courier stands. */
  private readonly glint = new Group();
  private readonly gem = new OctahedronGeometry(.28);
  private readonly ring = new TorusGeometry(.7, .06, 6, 28);
  private readonly gold = new MeshBasicNodeMaterial({ color: '#ffe28a' });
  private readonly frame = new MeshBasicNodeMaterial({ color: '#e9dfc4' });
  private readonly haft = new MeshBasicNodeMaterial({ color: '#c98a4b' });
  constructor(private readonly world: SimWorld, materials: Materials) {
    super(); this.name = 'l2-props';
    const instanced = (material: MeshBasicNodeMaterial | ReturnType<Materials['get']>, count: number) => {
      const mesh = new InstancedMesh(this.box, material, Math.max(1, count)); mesh.count = count; mesh.frustumCulled = false; this.add(mesh); return mesh;
    };
    for (const z of [39.4, 44.2]) {
      const root = new Group(); root.position.set(-75.3, 3.3, z); root.visible = false;
      const housing = new Mesh(this.beaconGeo.housing, this.beaconMat.housing); housing.rotation.z = Math.PI / 2; housing.position.x = .08;
      const bracket = new Mesh(this.box, this.beaconMat.housing); bracket.scale.set(.22, .1, .1); bracket.position.set(-.1, 0, 0);
      const dome = new Mesh(this.beaconGeo.dome, this.beaconMat.dome); dome.rotation.z = -Math.PI / 2; dome.position.x = .15;
      const fan = new Group(); fan.position.x = .15; for (const a of [0, Math.PI]) { const f = new Mesh(this.beaconGeo.fan, this.beaconMat.glow); f.rotation.y = a; fan.add(f); }
      const lens = new Mesh(this.beaconGeo.lens, this.beaconMat.lens); lens.position.x = .2;
      root.add(housing, bracket, dome, lens, fan); this.add(root); this.beacons.push({ root, dome, fan });
    }
    // Light bars on every lit police car / ambulance of the dressing and the checkpoint: red and blue halves.
    const red: Box[] = [], blue: Box[] = [];
    for (const d of l2Dressing) if (d.lit) {
      const ax = Math.cos(d.yaw ?? 0), az = -Math.sin(d.yaw ?? 0), y = d.assetId === 'veh.police-suv' || d.assetId === 'veh.ambulance' ? 2.2 : 1.75;
      for (const [side, list] of [[-1, red], [1, blue]] as const) list.push({ x: d.x - az * side * .35 + ax * .2, y, z: d.z + ax * side * .35 + az * .2, sx: .3, sy: .14, sz: .3 });
    }
    this.bars.push({ mesh: instanced(this.red, red.length), boxes: red }, { mesh: instanced(this.blue, blue.length), boxes: blue });
    // The fire axe on its rack, mounted on the station front facing the street (+x): a dark board with a pale frame, a wooden
    // haft and a big red head so it reads at game-camera size. Unlit colours (the bay is dark). Head and haft hide once taken.
    const [rx, rz] = l2Anchors['l2-axe-rack'], wx = rx - 1.05;
    const part = (material: ReturnType<Materials['get']> | MeshBasicNodeMaterial, size: [number, number, number], at: [number, number, number]) => { const m = new Mesh(this.box, material); m.scale.set(...size); m.position.set(...at); this.axe.add(m); };
    part(this.frame, [.08, 1.5, 1.7], [wx, 1.55, rz]);
    part(materials.get('uiDark'), [.12, 1.3, 1.5], [wx + .05, 1.55, rz]);
    part(this.haft, [.1, 1.15, .1], [wx + .16, 1.5, rz - .1]);
    part(this.red, [.12, .42, .55], [wx + .17, 2.0, rz + .1]);
    this.glint.add(new Mesh(this.gem, this.gold), new Mesh(this.ring, this.gold));
    this.glint.children[0].position.set(wx + .5, 2.9, rz);
    this.glint.children[1].rotation.x = Math.PI / 2; this.glint.children[1].position.set(rx, .32, rz);
    this.add(this.glint);
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
    // Beacons only while the alarm sounds and until the truck leaves; the flare fan turns.
    const lit = alarm && s.phase !== 'ride' && s.phase !== 'arrived';
    this.beacons.forEach((b, i) => {
      b.root.visible = lit; if (!lit) return;
      b.fan.rotation.y = tick * .16 + i * 1.7;
      b.dome.scale.setScalar(Math.floor(tick / 12) % 2 ? 1.12 : 1);
    });
    // Light bars alternate red and blue every quarter second.
    const phase = Math.floor(tick / 15) % 2;
    this.bars[0].mesh.visible = phase === 0; this.bars[1].mesh.visible = phase === 1;
    this.axe.children[2].visible = this.axe.children[3].visible = !s.axe;
    const hint = this.world.missions?.state.steps.axe?.status === 'active' && !s.axe;
    this.glint.visible = hint;
    if (hint) { const bob = Math.sin(tick * .08); this.glint.children[0].position.y = 2.95 + bob * .12; this.glint.children[0].rotation.y = tick * .06; this.glint.children[1].scale.setScalar(1 + .08 * bob); }
    const closing = s.crossedAt > 0 ? Math.min(1, (tick - s.crossedAt) / 36) : 0;
    for (const { mesh, boxes } of this.stripes) this.place(mesh, boxes, b => { const g = this.gates[b.gate!]; return [g.open[0] + (g.closed[0] - g.open[0]) * closing, g.open[1] + (g.closed[1] - g.open[1]) * closing]; });
  }
  dispose(): void { for (const g of Object.values(this.beaconGeo)) g.dispose(); for (const m of Object.values(this.beaconMat)) m.dispose(); this.gem.dispose(); this.ring.dispose(); this.gold.dispose(); this.frame.dispose(); this.haft.dispose(); this.box.dispose(); this.red.dispose(); this.blue.dispose(); this.glass.dispose(); }
}
