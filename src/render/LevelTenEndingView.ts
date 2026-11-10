import { AnimationMixer, Color, Group, LoopOnce, Mesh, Object3D, PlaneGeometry, type AnimationAction, type BufferGeometry, type Material, type Scene } from 'three/webgpu';
import { AssetRegistry } from '../assets/registry';
import { staticBatchAsync } from '../assets/staticBatch';
import { InstancedGroup } from './InstancedGroup';
import { loadGate } from '../assets/loadGate';
import { retargetClip } from './characters/clips';
import { epiloguePull } from '../sim/missions/LevelTenEpilogue';
import type { SimWorld } from '../sim/world/SimWorld';
import type { Materials } from './Materials';
import type { View } from './View';
import { cureDust } from './CureDust';
import { cameraFraming } from '../data/cameraFraming';
import { GlowPuffs } from './CureGlow';
import { l10Closing } from './characters/l10Closing';

/** [asset, x, z, yaw?, scale?]. Shot space: the camera looks from +x/+z towards the origin. */
/** The montage sets stand this far south of the console, beyond the level and its lights, so showing them never
 * hides the level (r30 run hitches: hiding scene children changed the light set and recompiled every program). */
const away = 2600;
type Item = [string, number, number, number?, number?];
/** [infected look, cured person, x, z, yaw]. The dust wall turns the first into the second. */
type Figure = [string, string, number, number, number?];
type Ground = { token: 'grass' | 'asphalt' | 'sidewalk'; x: number; z: number; w: number; d: number }[];
interface ShotDef {
  ground: 'grass' | 'asphalt' | 'sidewalk';
  patches?: Ground;
  water?: [number, number, number, number];
  items: Item[];
  figures: Figure[];
  /** Camera start/end and look target, metres in shot space. */
  from: [number, number, number]; to: [number, number, number]; look: [number, number, number];
}
const row = (id: string, x0: number, z0: number, dx: number, dz: number, n: number, yaw = 0, scale = 1): Item[] =>
  Array.from({ length: n }, (_, i) => [id, x0 + dx * i, z0 + dz * i, yaw, scale]);
/** Places of the journey, rebuilt from the levels' own district assets at full scale. */
const shots: ShotDef[] = [
  { // L10 farms: corn and the burned farm.
    ground: 'grass', patches: [{ token: 'sidewalk', x: 0, z: 4, w: 200, d: 5 }],
    items: [...row('veg.corn-block', -34, -12, 11, 0, 4), ...row('veg.corn-block', -34, -23, 11, 0, 4), ['veg.corn-block', 16, -14], ['veg.corn-block', 27, -14],
      ['bld.farm-barn-ruin', 16, -30, .3], ['bld.farm-house-ruin', -20, -38, -.2], ['prop.farm-tractor', 10, -4, 1.1], ['prop.farm-scarecrow', -6, -5], ['prop.tree.dead', 24, -6], ['prop.tree.dead', -30, -2, 1],
      ...row('prop.picket-fence', -22, 1.2, 2.7, 0, 6, Math.PI / 2)],
    figures: [['inf.common-worker', 'npc.civilian-man-a', -8, 8], ['inf.suburban-mom', 'npc.civilian-woman-a', -3, 11], ['inf.bbq-dad', 'npc.civilian-man-b', 2, 7], ['inf.jogger', 'npc.civilian-woman-b', 6, 10],
      ['inf.construction-worker', 'npc.civilian-elderly', 10, 6], ['inf.cashier', 'npc.civilian-man-a', -12, 12]],
    from: [24, 9, 30], to: [16, 7.5, 27], look: [-1, 1.5, 0],
  },
  { // L8: the bridge wreck in the river.
    ground: 'grass', water: [-60, -36, 60, -10], patches: [{ token: 'asphalt', x: 0, z: -23, w: 9, d: 60 }],
    items: [['bld.river-bridge', 0, -23, Math.PI / 2], ['veh.military-apc.wrecked', -9, -4, 1.2], ['veh.military-truck.wrecked', 11, -5, -.4], ...row('prop.jersey-barrier', -6, -9, 3.2, 0, 4),
      ['prop.street-tree', -24, -4], ['prop.street-tree', 26, 0], ['prop.garden-bush', 18, 6], ['prop.garden-bush', -18, 7]],
    figures: [['inf.riot-cop', 'npc.national-guard', -6, 6], ['inf.common-worker', 'npc.civilian-man-b', -1, 9], ['inf.nurse', 'npc.paramedic', 4, 7], ['inf.riot-cop', 'npc.national-guard', 8, 10],
      ['inf.college-student', 'npc.civilian-woman-a', 1, 13], ['inf.sprinter', 'npc.civilian-man-a', -10, 11]],
    from: [22, 11, 32], to: [14, 9, 29], look: [0, 1, -6],
  },
  { // L8: the zoo, its empty enclosures and Nadia's cap on the fence.
    ground: 'grass', patches: [{ token: 'sidewalk', x: 0, z: -2, w: 14, d: 60 }, { token: 'sidewalk', x: 0, z: -11, w: 60, d: 6 }],
    items: [['bld.zoo-gate', 0, -20], ['bld.reptile-house', 22, -24, -.4], ...row('prop.crowd-fence', -26, -4, 2.4, 0, 8), ...row('prop.crowd-fence', 7, -4, 2.4, 0, 8),
      ['prop.street-tree', -20, -18], ['prop.street-tree', -12, 6], ['prop.street-tree-blossom', 16, 6], ['prop.flower-bed', -8, -14], ['prop.flower-bed', 8, -14], ['prop.bench', 12, -8, Math.PI], ['prop.vending-cart', -14, -9, .6], ['prop.flamingo', 20, -6]],
    figures: [['inf.common-worker', 'npc.civilian-man-a', -5, 4], ['inf.suburban-mom', 'npc.civilian-woman-b', 0, 7], ['inf.teen-skater', 'npc.civilian-kid', 4, 5], ['inf.nurse', 'npc.paramedic', 8, 9],
      ['inf.jogger', 'npc.civilian-woman-a', -9, 9], ['inf.baseball-cap', 'npc.civilian-man-b', 2, 12]],
    from: [20, 9, 30], to: [13, 7.5, 26], look: [-2, 1.5, -4],
  },
  { // L7: the city skyline and the metro.
    ground: 'sidewalk', patches: [{ token: 'asphalt', x: 0, z: 0, w: 200, d: 11 }],
    items: [['bld.apartment-block-a', -22, -20], ['bld.apartment-block-b', -6, -24], ['bld.storefront-row', 12, -22, Math.PI / 2], ['bld.mainstreet-brick', 28, -20], ['bld.apartment-block-a', 40, -26, .1], ['bld.metro-entrance', -2, -10],
      ...row('prop.street-lamp', -24, -6.5, 12, 0, 6), ['veh.police-sedan', -12, 1, .2], ['veh.sedan-blue.burned', 8, -2, -.3], ['veh.school-bus.wrecked', 22, 2, .1], ['prop.street-tree', -32, 8], ['prop.trash-bags', 4, -7]],
    figures: [['inf.common-worker', 'npc.civilian-man-a', -6, 3], ['inf.college-student', 'npc.civilian-woman-a', -1, 6], ['inf.riot-cop', 'npc.police-officer', 4, 4], ['inf.delivery-driver', 'npc.civilian-man-b', 8, 8],
      ['inf.cashier', 'npc.civilian-woman-b', -10, 8], ['inf.skater', 'npc.civilian-kid', 1, 10]],
    from: [22, 12, 30], to: [15, 9, 27], look: [0, 3, -6],
  },
  { // L1: the Medical Annex, where it began.
    ground: 'grass', patches: [{ token: 'asphalt', x: 0, z: 2, w: 200, d: 8 }, { token: 'sidewalk', x: 0, z: -6, w: 200, d: 4 }],
    items: [['bld.clinic-annex', -4, -16], ['bld.courier-depot', 14, -14], ['bld.house-a', -22, -16], ['veh.box-truck', 8, 1, 0], ['veh.ambulance', -12, 3, .1], ['veh.courier-van', 22, 3],
      ...row('prop.hedge', -16, -7.5, 2.6, 0, 4), ['prop.street-tree', 4, -8], ['prop.street-lamp', -2, -4.5], ['prop.mailbox-blue', 12, -5.5]],
    figures: [['inf.nurse', 'npc.paramedic', -6, 7], ['inf.common-worker', 'npc.lab-tech-a', -1, 9], ['inf.delivery-driver', 'npc.depot-clerk', 4, 7], ['inf.suburban-mom', 'npc.civilian-woman-a', 8, 10],
      ['inf.bathrobe-neighbor', 'npc.civilian-elderly', -10, 10], ['inf.jogger', 'npc.civilian-man-a', 1, 13]],
    from: [22, 9, 30], to: [14, 7.5, 27], look: [0, 2, -4],
  },
  { // Survivors: the army trucks north of the river (built only when someone is there to step down).
    ground: 'grass', patches: [{ token: 'asphalt', x: 0, z: -2, w: 200, d: 8 }],
    items: [['veh.military-truck', -8, -3], ['veh.military-truck', 9, -4, -.1], ['prop.street-tree', -22, -14], ['prop.street-tree', 20, -14], ['prop.garden-bush', 2, -10]],
    figures: [['', 'npc.national-guard', -12, 3], ['', 'npc.national-guard', 14, 2]],
    from: [12, 5, 18], to: [9, 4.5, 16], look: [0, 1.4, 1],
  },
  { // The hangar doors open: Voss and Ruiz help Sam (or Reyes) outside.
    ground: 'sidewalk', patches: [{ token: 'grass', x: 0, z: 30, w: 200, d: 30 }],
    items: [['bld.cure-motor-shelter', 0, -26, Math.PI / 2, 1.6], ['prop.cure-generator', 16, -4], ['prop.emergency-light', -10, -3], ['prop.cure-iso-tent', -18, -8, .3], ['veh.military-truck', 20, 6, -.6]],
    figures: [],
    from: [15, 6, 20], to: [11, 5, 17], look: [0, 2, -6],
  },
  { // Town: people come out of houses and basements, blinking at the sun.
    ground: 'grass', patches: [{ token: 'asphalt', x: 0, z: 1, w: 200, d: 7 }, { token: 'sidewalk', x: 0, z: -4.5, w: 200, d: 3 }],
    items: [['bld.courier-depot', -14, -12], ['bld.house-a', 2, -14], ['bld.house-b', 16, -14], ['bld.house-c', 30, -15], ['bld.house-d', -28, -14],
      ...row('prop.picket-fence', -6, -6.8, 2.7, 0, 5, Math.PI / 2), ['prop.street-tree', 9, -7], ['prop.street-tree', -21, -7], ['veh.sedan-white', 22, 1, 0], ['prop.mailbox-blue', -3, -5.5]],
    figures: [],
    from: [16, 6, 22], to: [11, 5, 19], look: [0, 1.6, -2],
  },
];
const townCast = ['npc.depot-clerk', 'npc.civilian-woman-a', 'npc.civilian-man-b', 'npc.civilian-elderly', 'npc.civilian-kid', 'npc.civilian-woman-b', 'npc.civilian-man-a'];
interface Actor { root: Object3D; mixer: AnimationMixer; shot: number; x: number; z: number; walk: number; partner?: Actor; cured: boolean; clip: string; action?: AnimationAction }

/** Bounded, prewarmed reconstructions using the journey's existing assets. The simulation stays at the console.
 * r31-epilogue: also owns the release's glowing dust (column, tide, settling motes) and the dust wall of the wave shots. */
export class LevelTenEndingView extends Group {
  private readonly registry: AssetRegistry;
  private readonly stage = new Group();
  private readonly shotGroups: Group[] = [];
  private readonly owned: { geometry: BufferGeometry; material?: Material }[] = [];
  private readonly batches = new Set<InstancedGroup>();
  private readonly batchGeometry = new Set<BufferGeometry>();
  private readonly batchMaterials = new Map<string, Material>();
  private readonly actors: Actor[] = [];
  private montage = false;
  private readonly glow: GlowPuffs;
  private readonly low: boolean;
  private survivors = false;
  private disposed = false;
  private readonly shotReady: boolean[] = [];
  /** QA probe: leading shots that are loaded and warmed. */
  get readyShots(): number { const i = this.shotReady.findIndex(r => !r); return i < 0 ? this.shotReady.length : i; }
  private lastShot = -1;
  readonly errors: string[] = [];
  constructor(private readonly world: SimWorld, private readonly scene: Scene, private readonly materials: Materials, private readonly warm: (model: Object3D) => Promise<void>) {
    super(); this.registry = new AssetRegistry(() => {}, { materials });
    this.low = world.infected?.director.tier === 'low';
    const console = world.missions!.def.anchors['cure-console']; this.position.set(console.x, 0, console.z);
    this.stage.visible = false; this.stage.position.z = away; this.add(this.stage);
    this.glow = new GlowPuffs(this.low ? 220 : 420, '#7dff4a'); this.glow.name = 'cure-glow'; this.add(this.glow);
    void this.prepare().catch(error => this.errors.push(String(error)));
  }
  private async batch(group: Group, id: string, items: Item[]): Promise<void> {
    if (this.disposed) return;
    const decay = /\.(wrecked|burned)$/.exec(id)?.[1];
    const source = await this.registry.loadAsset(decay ? id.slice(0, -decay.length - 1) : id, 'low', decay);
    if (this.disposed) return;
    // Fixed scenery uses the same shared palette/instance layout as the district.
    source.userData.paletteWorld = false;
    const prototype = await staticBatchAsync(source, true, this.materials, () => loadGate.wait(), 4, this.batchMaterials);
    prototype.traverse(node => { if (node instanceof Mesh) this.batchGeometry.add(node.geometry); });
    if (this.disposed) return;
    const refs = items.map(([, x, z, yaw = 0, scale = 1]) => { const o = new Object3D(); o.position.set(x, 0, z); o.rotation.y = yaw; o.scale.setScalar(scale); o.updateMatrix(); o.updateMatrixWorld(); return o; });
    const batch = new InstancedGroup(prototype, refs, refs.length); this.batches.add(batch);
    await this.warm(batch); if (!this.disposed) group.add(batch);
  }
  private async figure(group: Group, id: string, x: number, z: number, yaw: number, shot: number, cured: boolean): Promise<Actor | undefined> {
    if (this.disposed || !id) return;
    const root = await this.registry.loadAsset(id, 'low');
    if (this.disposed) return;
    root.position.set(x, 0, z); root.rotation.y = yaw;
    const actor: Actor = { root, mixer: new AnimationMixer(root), shot, x, z, walk: 0, cured, clip: '' };
    this.play(actor, cured ? 'npc-look-around' : 'infected-idle');
    this.actors.push(actor); await this.warm(root); if (!this.disposed) group.add(root);
    return actor;
  }
  private play(actor: Actor, clip: string, once = false): void {
    if (actor.clip === clip) return;
    let next: AnimationAction;
    try { next = actor.mixer.clipAction(retargetClip(actor.root, clip)); } catch { return; }
    if (once) { next.setLoop(LoopOnce, 1); next.clampWhenFinished = true; }
    next.reset().play();
    if (actor.action) actor.action.crossFadeTo(next, .25, false);
    actor.action = next; actor.clip = clip;
  }
  private ground(group: Group, def: ShotDef): void {
    const add = (mesh: Mesh) => { this.owned.push({ geometry: mesh.geometry }); group.add(mesh); };
    // One large surface fading into the dawn fog: no slab edge meets the sky.
    const base = new Mesh(new PlaneGeometry(900, 900), this.materials.get(def.ground)); base.rotation.x = -Math.PI / 2; base.position.y = -.02; base.receiveShadow = true; add(base);
    for (const p of def.patches ?? []) {
      const patch = new Mesh(new PlaneGeometry(p.w, p.d), this.materials.get(p.token)); patch.rotation.x = -Math.PI / 2; patch.position.set(p.x, -.005, p.z); patch.receiveShadow = true; add(patch);
    }
    if (def.water) {
      const [x0, z0, x1, z1] = def.water, material = this.materials.fromColor('ending:river', new Color('#3d6a73'));
      const water = new Mesh(new PlaneGeometry(x1 - x0, z1 - z0), material); water.rotation.x = -Math.PI / 2; water.position.set((x0 + x1) / 2, .01, (z0 + z1) / 2); add(water);
    }
  }
  private async prepare(): Promise<void> {
    const save = this.world.progression?.campaign;
    const roster = save?.crossingHandover?.shelteredPassengers ?? save?.results?.L8?.escapedSurvivors ?? [];
    const named = ['mia', 'rosa', 'dale', 'okafor'].map(key => roster.find(e => e.civilian?.survivor?.key === key && e.health.current > 0 && !e.infected && !e.infection)).filter(e => !!e);
    this.survivors = named.length > 0;
    const perShot = this.low ? 4 : 6;
    for (const [i, def] of shots.entries()) {
      if (this.disposed) return;
      const group = new Group(); group.visible = false; this.shotGroups.push(group); this.stage.add(group);
      if (i === 5 && !this.survivors) { this.shotReady[i] = true; continue; }
      this.ground(group, def);
      const byAsset = new Map<string, Item[]>();
      for (const item of def.items) { const list = byAsset.get(item[0]) ?? []; list.push(item); byAsset.set(item[0], list); }
      // One shot's assets load together; a failed asset leaves a gap, never the whole montage.
      const guard = <T>(work: Promise<T>) => work.catch(error => { this.errors.push(String(error)); return undefined; });
      await Promise.all([...byAsset].map(([id, items]) => guard(this.batch(group, id, items))));
      await Promise.all(def.figures.slice(0, perShot).map(async ([infected, person, x, z, yaw = .55], n) => {
        const [cured, before] = await Promise.all([guard(this.figure(group, person, x, z, yaw + (n % 3 - 1) * .3, i, !infected)), infected ? guard(this.figure(group, infected, x, z, yaw + (n % 3 - 1) * .3, i, false)) : undefined]);
        if (cured && before) { cured.partner = before; cured.root.visible = false; }
      }));
      if (i === 5) for (const [n, person] of named.entries()) {
        const actor = await this.figure(group, person!.civilian!.model ?? 'npc.civilian-man-a', -6 + n * 4, -.5, .6, i, true);
        if (actor) actor.walk = .5;
      }
      if (i === 6) for (const [id, x] of [['npc.lab-tech-b', -1.2], ['npc.national-guard', 1.2], [this.world.missions!.state.states['sam-alive'] ? 'npc.sam.aftermath' : 'npc.national-guard', 0]] as const) {
        const actor = await this.figure(group, id, x, -8 + (x === 0 ? .4 : 0), 0, i, true);
        if (actor) actor.walk = .55;
      }
      if (i === 7) for (let n = 0; n < (this.low ? 4 : 7); n++) {
        const actor = await this.figure(group, townCast[n], -16 + n * 5.2, -9 - (n % 2) * 1.5, 0, i, true);
        if (actor) actor.walk = .45 + (n % 3) * .08;
      }
      if (this.disposed) return;
      await this.warm(group);
      this.shotReady[i] = true;
    }
  }
  /** Shot for a release-relative second; -1 outside the wave/survivor montage. */
  private shotAt(seconds: number): { shot: number; start: number; end: number } | null {
    if (seconds < 8 || seconds >= 45) return null;
    if (seconds < 28) { const shot = Math.min(4, Math.floor((seconds - 8) / 4)); return { shot, start: 8 + shot * 4, end: 12 + shot * 4 }; }
    if (seconds < 34) return this.survivors ? { shot: 5, start: 28, end: 34 } : { shot: 7, start: 28, end: 34 };
    if (seconds < 40) return { shot: 6, start: 34, end: 40 };
    return { shot: 7, start: this.survivors ? 40 : 28, end: 45 };
  }
  update(view: View): void {
    const state = this.world.missions?.state, ticks = state?.counters['epilogue-ticks'] ?? 0, seconds = ticks / 60;
    const front = state?.cureFront, phase = state?.epilogue?.phase;
    const slot = state?.epilogue ? this.shotAt(seconds) : null, montage = slot && this.shotReady[slot.shot] ? slot : null;
    this.glow.begin(view.camera);
    if (montage) {
      const { shot, start, end } = montage;
      this.montage = true; this.glow.offset.z = away;
      this.stage.visible = true; for (const [i, group] of this.shotGroups.entries()) group.visible = i === shot;
      const age = seconds - start, span = end - start, def = shots[shot], k = Math.min(1, age / span);
      if (shot !== this.lastShot) { for (const a of this.actors.filter(a => a.shot === shot)) this.resetActor(a); this.lastShot = shot; }
      // The dust wall rolls in from the left of frame and crosses the whole set.
      const wall = shot < 5 ? -34 + age * 15 : 40;
      for (const a of this.actors) if (a.shot === shot) this.animateActor(a, age, wall);
      if (shot < 5) this.dustWall(wall, age);
      else this.dustHaze(age, 0, 26, .1, 7);
      const ease = k * k * (3 - 2 * k), aspect = Math.max(1, 1 / view.camera.aspect);
      const p = def.from.map((v, i) => v + (def.to[i] - v) * ease);
      view.cinematic({ position: [this.position.x + p[0] * aspect, p[1] * aspect, this.position.z + away + p[2] * aspect], target: [this.position.x + def.look[0], def.look[1], this.position.z + away + def.look[2]] });
      cureDust.origin.value.set(this.position.x + wall - 2000, this.position.z + away); cureDust.radius.value = shot < 5 ? 2000 : 2400;
    } else {
      if (this.montage) { this.montage = false; this.glow.offset.z = 0; view.follow(); }
      this.stage.visible = false; this.lastShot = -1;
      if (front && phase !== 'done') this.release(seconds, front.radius, epiloguePull(ticks), phase === 'thanks');
      this.closingCamera(view, ticks, phase);
    }
    this.glow.end();
  }
  private resetActor(a: Actor): void {
    a.mixer.stopAllAction(); a.action = undefined; a.clip = '';
    if (a.partner) { a.root.visible = false; a.partner.root.visible = true; }
    this.play(a, a.partner || !a.cured ? 'infected-idle' : a.walk ? 'npc-walk' : 'npc-look-around');
    if (a.partner) this.play(a.partner, 'infected-idle');
  }
  private animateActor(a: Actor, age: number, wall: number): void {
    const dt = Math.max(0, age - ((a.root.userData.age as number | undefined) ?? 0)); a.root.userData.age = age;
    if (a.partner) {
      // Infected until the dust reaches them, then they fold to their knees and stand up as people.
      const since = (wall - a.x) / 15;
      if (since < 0) { this.play(a.partner, 'shamble'); a.partner.root.position.set(a.x, 0, a.z); }
      else if (since < .9) { this.play(a.partner, 'infection-collapse', true); this.glowBurst(a.x, a.z, since); }
      else {
        a.partner.root.visible = false; a.root.visible = true;
        this.play(a, since < 2.4 ? 'npc-cower' : since < 3.4 ? 'npc-stand-up' : a.x % 2 ? 'npc-wave' : 'npc-look-around', since < 3.4);
      }
      a.partner.mixer.update(dt);
    } else if (a.cured && a.walk) {
      this.play(a, 'npc-walk');
      a.root.position.set(a.x, 0, a.z + Math.min(age, 5) * a.walk);
    }
    a.mixer.update(dt);
  }
  private glowBurst(x: number, z: number, t: number): void {
    for (let i = 0; i < 3; i++) this.glow.puff(x + Math.sin(i * 2.1) * .4, .6 + i * .5, z + Math.cos(i * 2.1) * .4, 1.4 + t * 1.6, .55 * (1 - t / .9));
  }
  /** The rolling front of the green tide crossing a wave shot. */
  private dustWall(wall: number, age: number): void {
    const n = this.low ? 70 : 150;
    for (let i = 0; i < n; i++) {
      const u = i / n, z = -60 + u * 100, roll = Math.sin(age * 2.2 + i * 1.7);
      const lead = wall + Math.sin(i * 3.1) * 2.5 + roll * .8, height = (i % 4) * 1.6 + .8 + roll * .3;
      this.glow.puff(lead, height, z, 3.5 + (i % 5) * 1, .13);
    }
    this.dustHaze(age, wall, 0, .045, 0);
  }
  /** Settled dust behind the front, plus falling motes. */
  private dustHaze(age: number, wall: number, spread: number, brightness: number, base: number): void {
    const n = this.low ? 40 : 90;
    for (let i = 0; i < n; i++) {
      const a = Math.sin(i * 12.9898) * 43758.5453, u = a - Math.floor(a), b = Math.sin(i * 78.233) * 12345.678, v = b - Math.floor(b);
      const x = spread ? (u - .5) * spread * 2 : wall - u * 70, z = -40 + v * 70;
      if (i % 3) this.glow.puff(x, .4 + (i % 2) * .5, z, 4 + (i % 4) * 1.5, brightness);
      else { const fall = (age * .5 + u * 6) % 6; this.glow.puff(x * .4, base + 6 - fall, z * .4 + 8, .25, .9); }
    }
  }
  /** Release beat (0-8 s) and after: a glowing column from the console, the tide ring, settling motes. */
  private release(seconds: number, radius: number, pull: number, thanks: boolean): void {
    const ramp = Math.min(1, seconds / .6), linger = seconds < 14 ? 1 : Math.max(.45, 1 - (seconds - 14) / 12);
    const grow = 1 + pull * 16, columnN = this.low ? 26 : 48, life = 5;
    if (!thanks) for (let i = 0; i < columnN; i++) {
      const h = ((seconds + i / columnN * life) % life) / life, angle = i * 2.4 + seconds * .3, r = (.5 + h * 3.2) * grow;
      this.glow.puff(Math.cos(angle) * r, (1 + h * 34) * grow, Math.sin(angle) * r, (2.2 + h * 9) * grow, ramp * linger * .8 * Math.sin(Math.PI * h) ** .6);
    }
    if (seconds < 1.4) for (let i = 0; i < 8; i++) {
      const t = seconds / 1.4, angle = i * .785;
      this.glow.puff(Math.cos(angle) * t * 4, 1 + (i % 3), Math.sin(angle) * t * 4, 2.5 + t * 7, (1 - t) * .35);
    }
    if (seconds < 10.5) {
      const ring = Math.min(radius, 85), fade = seconds < 8 ? 1 : Math.max(0, 1 - (seconds - 8) / 2.5), n = this.low ? 60 : 120;
      for (let i = 0; i < n; i++) {
        const angle = i / n * Math.PI * 2 + Math.sin(i * 7.3) * .03, roll = Math.sin(seconds * 3 + i * 1.3), r = ring * (i % 2 ? .97 : 1) + roll * .4;
        const size = (2.4 + (i % 4) * .9) * (.7 + ring / 85 * .7);
        this.glow.puff(Math.cos(angle) * r, .6 + (i % 3) * .7 + roll * .25, Math.sin(angle) * r, size, .55 * fade * ramp);
      }
    }
    const motes = this.low ? 40 : 90, spread = Math.min(Math.max(radius, 6), 26);
    for (let i = 0; i < motes; i++) {
      const a = Math.sin(i * 12.9898) * 43758.5453, u = a - Math.floor(a), b = Math.sin(i * 78.233) * 12345.678, v = b - Math.floor(b);
      const fall = (seconds * .45 + u * 7) % 7, r = Math.sqrt(v) * spread, angle = u * 40;
      this.glow.puff(Math.cos(angle) * r, 7 - fall, Math.sin(angle) * r, .2, .85 * ramp * (thanks ? .5 : 1));
      if (i % 3 === 0) this.glow.puff(Math.cos(angle + 1) * r, .35, Math.sin(angle + 1) * r, 4 + u * 3, .07 * ramp);
    }
  }
  private closingCamera(view: View, ticks: number, phase: string | undefined): void {
    const pull = epiloguePull(ticks), console = this.world.missions?.def.anchors['cure-console'];
    if (!console) return;
    const shot = l10Closing.camera(console, view.camera.aspect, l10Closing.seat(this.world));
    if (phase === 'thanks' || ticks >= 45 * 60 && pull === 0) {
      view.camera.near = .1; view.camera.far = 600; view.camera.updateProjectionMatrix();
      view.cinematic({ position: shot.position, target: shot.target });
    } else if (pull > 0) {
      const fov = cameraFraming.fovDeg + (55 - cameraFraming.fovDeg) * pull;
      // Fit the complete long L10 rectangle at every aspect ratio, with a margin, at a steep enough
      // angle that the farms, the restricted zone, the hangar and the complex read as separate places.
      const bounds = this.world.districts!.nav, centreX = (bounds.min[0] + bounds.max[0]) / 2, centreZ = (bounds.min[1] + bounds.max[1]) / 2;
      const halfX = (bounds.max[0] - bounds.min[0]) / 2, halfZ = (bounds.max[1] - bounds.min[1]) / 2;
      // Portrait looks along the long route so it uses the tall frame.
      const ox = view.camera.aspect < 1 ? -1.1 : -.05, oz = view.camera.aspect < 1 ? .05 : 1.1;
      const lateral = Math.hypot(ox, oz), length = Math.hypot(1, lateral);
      const across = (halfX * Math.abs(oz) + halfZ * Math.abs(ox)) / lateral;
      const up = (halfX * Math.abs(ox) + halfZ * Math.abs(oz)) / (lateral * length);
      const depth = (halfX * Math.abs(ox) + halfZ * Math.abs(oz)) / length;
      const height = (Math.max(across / view.camera.aspect, up) / Math.tan(fov * Math.PI / 360) + depth) / length * 1.06;
      const [sx, sy, sz] = shot.position, [tx, , tz] = shot.target;
      const x = tx + (centreX - tx) * pull, z = tz + (centreZ - tz) * pull;
      // At kilometre heights the gameplay near plane loses the millimetre separation between terrain layers.
      view.camera.near = Math.max(.1, (sy + height * pull) * .05);
      view.camera.far = Math.max(600, height * length * 6); view.camera.updateProjectionMatrix();
      view.cinematic({ position: [x + (sx - tx) * (1 - pull) + height * ox * pull, sy + height * pull, z + (sz - tz) * (1 - pull) + height * oz * pull], target: [x, shot.target[1] * (1 - pull), z], fovDeg: fov });
    }
  }
  mask(): void { /* The montage stage stands far from the level; nothing is hidden (keeps every light set and pipeline). */ }
  dispose(): void {
    this.disposed = true;
    for (const actor of this.actors) { actor.mixer.stopAllAction(); actor.mixer.uncacheRoot(actor.root); }
    for (const { geometry } of this.owned) geometry.dispose();
    for (const batch of this.batches) batch.dispose();
    for (const geometry of this.batchGeometry) geometry.dispose();
    for (const material of this.batchMaterials.values()) material.dispose();
    this.glow.dispose(); this.removeFromParent(); void this.registry.dispose(); cureDust.radius.value = -1;
  }
}
