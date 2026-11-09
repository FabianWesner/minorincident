import { AnimationMixer, BoxGeometry, CircleGeometry, Group, Mesh, MeshBasicNodeMaterial, type Object3D, type Scene } from 'three/webgpu';
import { AssetRegistry } from '../assets/registry';
import { retargetClip } from './characters/clips';
import { epiloguePull } from '../sim/missions/LevelTenEpilogue';
import type { SimWorld } from '../sim/world/SimWorld';
import type { Materials } from './Materials';
import type { View } from './View';
import { cureDust } from './CureDust';

type Item = [string, number, number, number?];
const tableaux: Item[][] = [
  [['bld.farm-barn-ruin', -8, -10], ['bld.farm-house-ruin', 12, -9], ['veg.corn-block', -12, 8], ['veg.corn-block', 8, 9]],
  [['bld.river-bridge', 0, -8], ['veh.military-apc', -3, 3, 1.3]],
  [['bld.zoo-gate', 0, -15], ['prop.crowd-fence', -5, 0], ['prop.crowd-fence', 5, 0]],
  [['bld.apartment-block-a', -15, -12], ['bld.apartment-block-b', 8, -20], ['bld.metro-entrance', 8, 4]],
  [['bld.clinic-annex', 0, -10], ['veh.box-truck', 12, 4]],
  [['veh.military-truck', -9, -8], ['veh.military-truck', 10, -10]],
  [['bld.cure-motor-shelter', 0, -12]],
  [['bld.courier-depot', -12, -12], ['bld.house-a', 12, -9]],
];
/** Bounded, prewarmed reconstructions using the journey's existing assets. The simulation stays at the console. */
export class LevelTenEndingView extends Group {
  private readonly registry: AssetRegistry;
  private readonly shots: Group[] = [];
  private readonly roads: Mesh[] = [];
  private readonly actors: { root: Object3D; mixer: AnimationMixer; shot: number; cured: boolean; stood: boolean; x: number; z: number }[] = [];
  private hidden = new Map<Object3D, boolean>();
  private readonly dustMaterial = new MeshBasicNodeMaterial({ color: '#64ff32', transparent: true, opacity: .18, depthWrite: false });
  private readonly dust = new Mesh(new CircleGeometry(1, 48), this.dustMaterial);
  private disposed = false;
  private ready = false;
  private lastShot = -1;
  readonly errors: string[] = [];
  constructor(private readonly world: SimWorld, private readonly scene: Scene, materials: Materials, private readonly warm: (model: Object3D) => Promise<void>) {
    super(); this.registry = new AssetRegistry(() => {}, { materials }); this.visible = false;
    const console = world.missions!.def.anchors['cure-console']; this.position.set(console.x, 0, console.z);
    this.dust.rotation.x = -Math.PI / 2; this.dust.position.y = .12; this.add(this.dust);
    void this.prepare().catch(error => this.errors.push(String(error)));
  }
  private async item(group: Group, item: Item, shot: number, cured = false): Promise<void> {
    const [id, x, z, yaw = 0] = item;
    const root = await this.registry.loadAsset(id, 'low');
    if (this.disposed) return;
    root.position.set(x, 0, z); root.rotation.y = yaw;
    if (id.startsWith('npc.')) {
      const mixer = new AnimationMixer(root); mixer.clipAction(retargetClip(root, cured ? 'npc-cower' : shot >= 5 ? 'npc-walk' : 'idle')).play();
      this.actors.push({ root, mixer, shot, cured, stood: false, x, z });
    }
    await this.warm(root); if (!this.disposed) group.add(root);
  }
  private async prepare(): Promise<void> {
    const save = this.world.progression?.campaign;
    const roster = save?.crossingHandover?.shelteredPassengers ?? save?.results?.L8?.escapedSurvivors ?? [];
    for (let i = 0; i < tableaux.length; i++) {
      const group = new Group(); group.visible = false; this.shots.push(group); this.add(group);
      const floor = new Mesh(new BoxGeometry(220, .15, 180), new MeshBasicNodeMaterial({ color: i === 1 ? '#405e68' : i === 6 ? '#777b79' : '#8d9167' }));
      floor.position.y = -.14; group.add(floor);
      if (i !== 1 && i !== 6) {
        const road = new Mesh(new BoxGeometry(220, .025, 7), new MeshBasicNodeMaterial({ color: i === 0 ? '#8b795e' : '#4e4c51' }));
        road.position.set(0, -.045, -2); group.add(road); this.roads.push(road);
      }
      for (const item of tableaux[i]) await this.item(group, item, i);
      if (i < 5) for (let n = 0; n < 4; n++) await this.item(group, [n === 2 ? 'npc.national-guard' : n === 3 ? 'npc.paramedic' : 'npc.civilian-man-a', n * 4 - 6, 2 + n % 2 * 3], i, true);
      if (i === 2) {
        // Nadia's keeper cap left on the enclosure fence.
        const cap = new Mesh(new BoxGeometry(.45, .12, .4), new MeshBasicNodeMaterial({ color: '#8b774a' })); cap.position.set(-5, 1.7, 0); group.add(cap);
      }
      if (i === 5) for (const [n, key] of ['mia', 'rosa', 'dale', 'okafor'].entries()) {
        const person = roster.find(e => e.civilian?.survivor?.key === key && e.health.current > 0 && !e.infected && !e.infection);
        if (person) await this.item(group, [person.civilian!.model ?? 'npc.civilian-man-a', n * 5 - 7.5, n % 2 ? 5 : 2], i);
      }
      if (i === 6) for (const [id, x] of [['npc.lab-tech-b', -2], ['npc.national-guard', 2], [this.world.missions!.state.states['sam-alive'] ? 'npc.sam.aftermath' : 'npc.lab-guard', 0]] as const) await this.item(group, [id, x, 3], i);
      if (i === 7) for (let n = 0; n < 6; n++) await this.item(group, [n % 2 ? 'npc.depot-clerk' : 'npc.civilian-woman-a', n * 3.5 - 8.75, n % 2 ? 5 : 2], i);
    }
    for (const group of this.shots) await this.warm(group);
    this.ready = true;
  }
  update(view: View): void {
    const state = this.world.missions?.state, ticks = state?.counters['epilogue-ticks'] ?? 0;
    const active = !!state?.epilogue && ticks >= 8 * 60 && ticks < 45 * 60 && this.ready;
    const shot = ticks < 28 * 60 ? Math.min(4, Math.floor((ticks / 60 - 8) / 4)) : ticks < 34 * 60 ? 5 : ticks < 40 * 60 ? 6 : 7;
    if (active) {
      if (!this.hidden.size) for (const child of this.scene.children) if (child !== this && !(child as { isLight?: boolean }).isLight && child.type !== 'PerspectiveCamera') { this.hidden.set(child, child.visible); child.visible = false; }
      this.visible = true; for (const [i, group] of this.shots.entries()) group.visible = i === shot;
      const start = shot < 5 ? 8 + shot * 4 : shot === 5 ? 28 : shot === 6 ? 34 : 40;
      const age = ticks / 60 - start;
      if (shot !== this.lastShot) { for (const a of this.actors.filter(a => a.shot === shot)) a.stood = false; this.lastShot = shot; }
      for (const a of this.actors.filter(a => a.shot === shot)) {
        if (a.cured && age >= 1.4 && !a.stood) { a.mixer.stopAllAction(); a.mixer.clipAction(retargetClip(a.root, 'idle')).play(); a.stood = true; }
        a.mixer.setTime(age); a.root.position.set(a.x, 0, a.z + (shot >= 5 ? Math.min(age, 4) * .55 : 0));
      }
      this.dust.position.x = -28 + age * 16; this.dust.scale.setScalar(30);
      const aspect = Math.max(1, 1 / view.camera.aspect);
      view.cinematic({ position: [this.position.x + (27 - age * .7) * aspect, 2 + 19 * aspect, this.position.z - 2 + 32 * aspect], target: [this.position.x, 2, this.position.z - 2] });
      cureDust.origin.value.set(this.position.x, this.position.z); cureDust.radius.value = 100;
    } else {
      if (this.hidden.size) { for (const [child, visible] of this.hidden) child.visible = visible; this.hidden.clear(); view.follow(); }
      this.visible = false;
      const pull = epiloguePull(ticks), console = this.world.missions?.def.anchors['cure-console'];
      if (console && (state?.epilogue?.phase === 'thanks' || ticks >= 45 * 60 && pull === 0)) {
        const aspect = Math.max(1, 1 / view.camera.aspect);
        view.camera.near = .1; view.camera.far = 600; view.camera.updateProjectionMatrix();
        view.cinematic({ position: [console.x + 4 + 20 * aspect, 1 + 16 * aspect, console.z + 3 + 22 * aspect], target: [console.x + 4, 1, console.z + 3] });
      } else if (console && pull > 0) {
        // Fit the complete long L10 rectangle at every aspect ratio, with a generous margin.
        const bounds = this.world.districts!.nav, centreX = (bounds.min[0] + bounds.max[0]) / 2, centreZ = (bounds.min[1] + bounds.max[1]) / 2;
        const halfX = (bounds.max[0] - bounds.min[0]) / 2, halfZ = (bounds.max[1] - bounds.min[1]) / 2;
        const height = Math.max(halfX / Math.max(.35, view.camera.aspect), halfZ) / Math.tan(view.camera.fov * Math.PI / 360) * 1.2;
        const aspect = Math.max(1, 1 / view.camera.aspect), baseHeight = 22 * aspect;
        const x = console.x + (centreX - console.x) * pull, z = console.z + (centreZ - console.z) * pull;
        // At kilometre heights the gameplay near plane loses the millimetre
        // separation between terrain layers. Keep depth precision on the map.
        view.camera.near = Math.max(.1, (baseHeight + height * pull) * .05);
        view.camera.far = Math.max(600, height * 3); view.camera.updateProjectionMatrix();
        view.cinematic({ position: [x + 16 * aspect * (1 - pull), baseHeight + height * pull, z + 18 * aspect * (1 - pull)], target: [x, 0, z] });
      }
    }
  }
  mask(): void { if (this.visible) for (const child of this.hidden.keys()) child.visible = false; }
  dispose(): void {
    this.disposed = true; for (const [child, visible] of this.hidden) child.visible = visible;
    for (const actor of this.actors) { actor.mixer.stopAllAction(); actor.mixer.uncacheRoot(actor.root); }
    for (const shot of this.shots) { const floor = shot.children[0] as Mesh; floor?.geometry.dispose(); (floor?.material as MeshBasicNodeMaterial)?.dispose(); }
    for (const road of this.roads) { road.geometry.dispose(); (road.material as MeshBasicNodeMaterial).dispose(); }
    this.dust.geometry.dispose(); this.dustMaterial.dispose(); this.removeFromParent(); void this.registry.dispose(); cureDust.radius.value = -1;
  }
}
