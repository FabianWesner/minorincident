import { BoxGeometry, CapsuleGeometry, CanvasTexture, Color, Group, InstancedMesh, Matrix4, Mesh, MeshBasicNodeMaterial, PlaneGeometry, Quaternion, TorusGeometry, Vector3, type Material, type Object3D } from 'three/webgpu';
import { AssetRegistry } from '../assets/registry';
import { catalog } from '../data/actions/catalog';
import { l9Course as cfg } from '../data/l9';
import type { Materials } from './Materials';
import type { SimWorld } from '../sim/world/SimWorld';

/** The road furniture and animated bridge/rack read the same native mission state. */
export class L9Props extends Group {
  private readonly geometry = new BoxGeometry(1, 1, 1);
  private readonly bridge: Group[] = [];
  private readonly gate = new Group();
  private readonly bridgeGate = new Group();
  private readonly rack = new Group();
  private readonly registry: AssetRegistry;
  private readonly ownedMaterials: Material[] = [];
  private readonly textures: CanvasTexture[] = [];
  private readonly signGeometry = new PlaneGeometry(1, 1);
  private readonly bagGeometry = new CapsuleGeometry(.22, .7, 3, 8);
  private readonly handleGeometry = new TorusGeometry(.14, .025, 4, 8, Math.PI);
  private rocket?: Object3D;
  private readonly poseMatrix = new Matrix4();
  private readonly positionV = new Vector3();
  private readonly rotationQ = new Quaternion();
  private readonly scaleV = new Vector3();
  constructor(private readonly world: SimWorld, materials: Materials) {
    super(); this.name = 'l9-driving-course'; this.registry = new AssetRegistry(() => {}, { materials });
    const concrete = materials.fromColor('l9-course-concrete', new Color('#68675c'), 0, true);
    const metal = materials.fromColor('l9-course-metal', new Color('#424e50'), 0, true);
    const paint = materials.fromColor('l9-course-paint', new Color('#d3a846'), 0, true);
    const red = materials.fromColor('l9-course-red', new Color('#a53523'), 0, true);
    const white = materials.fromColor('l9-course-white', new Color('#c4c1ab'), 0, true);
    const wood = materials.fromColor('l9-course-wood', new Color('#70543b'), 0, true);
    const river = materials.fromColor('l9-hollow-creek', new Color('#233e4a'), .08, true);
    const fuel = materials.fromColor('l9-leaking-fuel', new Color('#191d1b'), 0, true);
    const canvas = materials.fromColor('l9-weapon-duffel', new Color('#4b5943'), 0, true);
    const staticBoxes = new Map<Material, { p: number[]; s: number[]; angle: number }[]>();
    const box = (parent: Group, mat: Material, p: number[], s: number[], angle = 0) => {
      const mesh = new Mesh(this.geometry, mat); mesh.position.set(p[0], p[1], p[2]); mesh.scale.set(s[0], s[1], s[2]); mesh.rotation.z = angle; mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
    };
    const fixed = (mat: Material, p: number[], s: number[], angle = 0) => { const list = staticBoxes.get(mat) ?? []; list.push({ p, s, angle }); staticBoxes.set(mat, list); };
    fixed(river, [516, -4.6, 0], [10, .08, 180]);
    for (let i = 0; i < 10; i++) fixed(fuel, [cfg.tanker.x - 1.5 * i, .055, cfg.tanker.z + Math.sin(i) * .4], [2, .035, .45 + i % 3 * .3]);
    // Physical ramp plates and their broken concrete landing obstacles are
    // authored together with the Rapier boxes in LevelNineDriving.rebuild.
    for (const ramp of cfg.ramps) {
      fixed(concrete, [ramp.x, 1.23, ramp.z], [12, .32, 6.6], .18);
      fixed(concrete, [ramp.x + 12, .5, ramp.z], [6, 1, 6.4]);
      for (const side of [-1, 1]) for (let i = 0; i < 6; i++) fixed(paint, [ramp.x - 10 + i * 1.5, .08, ramp.z + side * 3.6], [.7, .04, .2]);
      this.sign('RAMP  /  DETOUR', ramp.x - 13, ramp.z + 7, paint);
    }
    // A single railway crosses all three returns. Sleepers are instanced,
    // keeping this long sightline to three draws rather than hundreds.
    for (let z = -350; z <= 300; z += 2) fixed(wood, [cfg.railX, .045, z], [5, .09, .22]);
    for (const x of [cfg.railX - 1.1, cfg.railX + 1.1]) fixed(metal, [x, .105, -25], [.12, .12, 650]);
    for (const side of [-1, 1]) {
      fixed(paint, [cfg.repair.x, .065, cfg.repair.z + side * 4], [13, .045, .2]);
      fixed(paint, [cfg.repair.x + side * 6.5, .065, cfg.repair.z], [.2, .045, 8]);
    }
    this.sign('REPAIR', cfg.repair.x, cfg.repair.z + 8, paint);
    this.sign('EVACUATION  /  STOP', cfg.evacuation.x - 4, 9, white);
    this.sign('HOLLOW CREEK', 474, -9, white);
    this.sign('FIRE  /  DETOUR', cfg.fire.x - 20, cfg.fire.z + 9, red);
    this.sign('ROAD', -448, -9, white); this.sign('FARMS', -448, 10, white);
    // Bridgehead sandbags and floodlight masts frame the bay and army trucks.
    for (let x = 445; x <= 469; x += 2) {
      fixed(wood, [x, .4, -8], [1.7, .8, .9]); fixed(wood, [x, .4, 8], [1.7, .8, .9]);
    }
    for (const x of [446, 466]) for (const z of [-12, 12]) { fixed(metal, [x, 3.5, z], [.18, 7, .18]); fixed(white, [x, 6.8, z], [1.3, .35, .4]); }
    for (const [parent, spacing, y, sx, sy] of [[this.gate, 1, 1.1, .3, 1.4], [this.bridgeGate, 1.8, .9, .5, 1.8]] as const) for (let parity = 0; parity < 2; parity++) {
      const stripes = new InstancedMesh(this.geometry, parity ? red : white, 7);
      for (let i = 0; i < 7; i++) { this.poseMatrix.compose(this.positionV.set(0, y, (i * 2 + parity - 6.5) * spacing), this.rotationQ.identity(), this.scaleV.set(sx, sy, spacing)); stripes.setMatrixAt(i, this.poseMatrix); }
      stripes.instanceMatrix.needsUpdate = true; stripes.castShadow = stripes.receiveShadow = true; parent.add(stripes);
    }
    this.gate.position.x = cfg.gate.x; this.bridgeGate.position.x = 472; this.add(this.gate, this.bridgeGate);
    // Six independently dropping spans show the break advancing under and
    // behind the moving vehicle. The old broken kit remains in the creek.
    for (let i = 0; i < 6; i++) {
      const span = new Group(); span.position.set(478 + i * 8, -.04, 0);
      box(span, concrete, [4, -.2, 0], [7.96, .4, 12]);
      for (const side of [-1, 1]) box(span, metal, [4, .55, side * 5.9], [8, 1.1, .12]);
      this.bridge.push(span); this.add(span);
    }
    // The same rack stays on the hull before the impact, then tumbles out.
    for (const z of [-.65, .65]) box(this.rack, metal, [0, .4, z], [.15, 1.2, .12]);
    for (const y of [0, .8]) box(this.rack, metal, [0, y, 0], [.15, .12, 1.5]);
    const duffel = new Mesh(this.bagGeometry, canvas); duffel.position.set(-.3, -.2, 0); duffel.rotation.x = Math.PI / 2; duffel.castShadow = true; this.rack.add(duffel);
    for (const z of [-.22, .22]) {
      box(this.rack, metal, [-.3, -.19, z], [.47, .45, .07]);
      const handle = new Mesh(this.handleGeometry, metal); handle.rotation.y = Math.PI / 2; handle.position.set(-.3, .02, z); this.rack.add(handle);
    }
    this.add(this.rack);
    for (const [mat, boxes] of staticBoxes) {
      const mesh = new InstancedMesh(this.geometry, mat, boxes.length);
      boxes.forEach((b, i) => { this.poseMatrix.compose(this.positionV.set(b.p[0], b.p[1], b.p[2]), this.rotationQ.setFromAxisAngle(this.scaleV.set(0, 0, 1), b.angle), this.scaleV.set(b.s[0], b.s[1], b.s[2])); mesh.setMatrixAt(i, this.poseMatrix); });
      mesh.instanceMatrix.needsUpdate = true; mesh.castShadow = mesh.receiveShadow = true; this.add(mesh);
    }
  }
  private sign(text: string, x: number, z: number, postMaterial: Material): void {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 128;
    const c = canvas.getContext('2d')!; c.fillStyle = '#25362c'; c.fillRect(0, 0, 512, 128); c.strokeStyle = '#c9c7ad'; c.lineWidth = 7; c.strokeRect(5, 5, 502, 118); c.fillStyle = '#ece6c9'; c.font = 'bold 37px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, 256, 64);
    const texture = new CanvasTexture(canvas), material = new MeshBasicNodeMaterial({ map: texture }); this.textures.push(texture); this.ownedMaterials.push(material);
    const board = new Mesh(this.signGeometry, material); board.position.set(x, 3, z); board.rotation.y = -Math.PI / 4; board.scale.set(5, 1.25, 1); this.add(board);
    const post = new Mesh(this.geometry, postMaterial); post.position.set(x, 1.5, z); post.scale.set(.12, 3, .12); this.add(post);
  }
  async load(): Promise<void> {
    for (const [i, id] of ['weapon.rocket-launcher', 'weapon.army-mg', 'weapon.handgun'].entries()) {
      const model = await this.registry.loadAsset(catalog[id].viewAssetId, 'lod1');
      model.position.set(.15, i * .3, 0); model.scale.setScalar(.8); model.rotation.z = Math.PI / 2; this.rack.add(model);
      if (i === 0) this.rocket = model;
    }
  }
  update(alpha = 1): void {
    const crash = this.world.missions?.l9, s = crash?.state, driving = s?.driving;
    if (!s || !driving) return;
    const car = this.world.entities.get(s.carId)!, t = this.world.tick + alpha - s.startedAt, approach = s.approachTicks ?? 180;
    this.gate.visible = driving.gateClosed; this.bridgeGate.visible = !driving.evacuationDone;
    for (const [i, span] of this.bridge.entries()) {
      const fall = s.phase === 'driving' ? 0 : Math.max(0, Math.min(1, (t - 60 - i * 25) / 100));
      span.rotation.z = -fall * 1.1; span.position.y = -.04 - fall * 1.8;
    }
    const p = car.transform, fall = Math.max(0, (t - approach) / 60), loose = ['fall', 'impact', 'crawl', 'done'].includes(s.phase);
    if (!loose) {
      this.rack.position.set(p.x - Math.cos(p.yaw) * 2.2, p.y + .35, p.z + Math.sin(p.yaw) * 2.2); this.rack.rotation.set(0, p.yaw, 0);
    } else {
      const from = s.fallFrom ?? s.from;
      this.rack.position.set(from.x + Math.cos(from.yaw) * Math.min(10, fall * 5) - 2, Math.max(-4.4, from.y + .5 - fall * fall * 3), from.z + Math.min(5, fall * 2));
      const tumble = Math.min(2.5, fall);
      this.rack.rotation.set(tumble * 2.5, from.yaw, tumble * 1.7);
      if (this.rocket) { const slide = Math.max(0, fall - 1.8); this.rocket.position.y = Math.max(-4, -slide * 2.5); this.rocket.position.x = .15 + Math.min(3, slide * 1.5); }
    }
  }
  dispose(): void { this.registry.dispose(); this.geometry.dispose(); this.signGeometry.dispose(); this.bagGeometry.dispose(); this.handleGeometry.dispose(); for (const m of this.ownedMaterials) m.dispose(); for (const t of this.textures) t.dispose(); }
}
