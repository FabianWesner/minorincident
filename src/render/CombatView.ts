import { BoxGeometry, Group, Mesh, MeshBasicNodeMaterial, SphereGeometry, Vector3 } from 'three/webgpu';
import type { SimWorld } from '../sim/world/SimWorld';
import type { Materials } from './Materials';
import type { PaletteMaterial } from './PaletteMaterial';
const limbNames = ['armL', 'armR', 'legL', 'legR', 'head'] as const;
interface Dummy { group: Group; material: PaletteMaterial; limbs: Mesh[]; caps: Mesh[]; diedAt: number | null }
/** Rigid-part code placeholders for infected below integrated status. Limb meshes and stump caps
 * expose E15's detachment hook; gameplay never reads this hierarchy or its visual corpse lifetime. */
export class CombatView extends Group {
  private readonly dummies = new Map<number, Dummy>();
  private readonly bodyGeometry = new BoxGeometry(0.4, 0.55, 0.4);
  private readonly limbGeometry = new BoxGeometry(0.18, 0.36, 0.18);
  private readonly headGeometry = new SphereGeometry(0.2, 8, 6);
  private readonly capGeometry = new BoxGeometry(0.18, 0.06, 0.18);
  private readonly eyeGeometry = new SphereGeometry(0.035, 6, 4);
  private readonly eyeMaterial = new MeshBasicNodeMaterial({ color: '#ff3b2f' });
  private time = 0;
  private readonly detachedPosition = new Vector3();
  private readonly stopSpawn: () => void;
  constructor(private readonly world: SimWorld, private readonly materials: Materials) { super(); this.stopSpawn = world.events.on('entity.spawned', event => { if (event.type === 'entity.spawned') this.ensure(event.id); }); }
  private ensure(id: number): Dummy | undefined {
    let dummy = this.dummies.get(id); if (dummy) return dummy;
    const entity = this.world.entities.get(id); if (!entity || id === 1 || !entity.combat) return;
    const group = new Group(), material = this.materials.unique(entity.faction === 'infected' ? 'policeBlue' : 'backpackTeal');
    const body = new Mesh(this.bodyGeometry, material); body.position.y = 0.7; body.castShadow = true; group.add(body);
    const limbs: Mesh[] = [], caps: Mesh[] = [];
    for (let i = 0; i < 5; i++) {
      const limb = new Mesh(i === 4 ? this.headGeometry : this.limbGeometry, i === 4 ? this.materials.get('infectedSkin') : material);
      limb.name = limbNames[i]; limb.position.set(0, i < 2 ? 0.65 : i < 4 ? 0.25 : 1.15, i < 2 ? (i === 0 ? -0.3 : 0.3) : i < 4 ? (i === 2 ? -0.12 : 0.12) : 0);
      limb.castShadow = true; group.add(limb); limbs.push(limb);
      const cap = new Mesh(this.capGeometry, this.materials.get('blood')); cap.name = `${limb.name}_cap`; cap.position.copy(limb.position); cap.position.y += i === 4 ? -0.17 : 0.18; cap.visible = false; group.add(cap); caps.push(cap);
      if (i === 4) for (const z of [-0.08, 0.08]) { const eye = new Mesh(this.eyeGeometry, this.eyeMaterial); eye.position.set(0.18, 0.03, z); limb.add(eye); }
    }
    if (entity.combat.shield) { const shield = new Mesh(this.bodyGeometry, this.materials.get('uiDark')); shield.scale.set(0.15, 1.3, 1.2); shield.position.set(0.3, 0.7, 0); group.add(shield); }
    dummy = { group, material, limbs, caps, diedAt: null }; this.dummies.set(id, dummy); this.add(group); return dummy;
  }
  update(): void {
    let corpses = 0;
    for (const entity of this.world.entities.iterate()) {
      if (entity.id === 1 || !entity.combat) continue;
      let dummy = this.dummies.get(entity.id);
      if (!dummy && entity.health.current === 0) continue;
      dummy ??= this.ensure(entity.id); if (!dummy) continue;
      if (entity.health.current === 0 && dummy.diedAt === null) dummy.diedAt = this.time;
      const age = dummy.diedAt === null ? 0 : this.time - dummy.diedAt;
      dummy.group.visible = age < 45 && (dummy.diedAt === null || corpses++ < 100);
      dummy.group.position.set(entity.transform.x, age > 43 ? -(age - 43) * 0.5 : 0, entity.transform.z);
      dummy.group.rotation.y = entity.transform.yaw; dummy.group.rotation.z = entity.health.current > 0 ? 0 : Math.PI / 2;
    }
  }
  advance(seconds: number): void { this.time += seconds; }
  flash(id: number, strength: number): void { const dummy = this.ensure(id); if (dummy) dummy.material.hitFlash.value = strength; }
  get gibGeometries() { return { limb: this.limbGeometry, head: this.headGeometry }; }
  detach(id: number, limb: number): Vector3 | undefined {
    const dummy = this.dummies.get(id), entity = this.world.entities.get(id); if (!dummy || !entity) return;
    dummy.group.position.set(entity.transform.x, 0, entity.transform.z); dummy.group.rotation.y = entity.transform.yaw;
    dummy.limbs[limb].getWorldPosition(this.detachedPosition); dummy.limbs[limb].visible = false; dummy.caps[limb].visible = true;
    return this.detachedPosition;
  }
  clearGore(): void { for (const dummy of this.dummies.values()) for (let i = 0; i < 5; i++) { dummy.limbs[i].visible = true; dummy.caps[i].visible = false; } }
  getState() { return [...this.dummies].map(([id, dummy]) => ({ id, detached: dummy.limbs.filter(limb => !limb.visible).map(limb => limb.name), caps: dummy.caps.filter(cap => cap.visible).map(cap => cap.name), visible: dummy.group.visible })); }
  dispose(): void { this.stopSpawn(); this.clear(); this.dummies.clear(); this.bodyGeometry.dispose(); this.limbGeometry.dispose(); this.headGeometry.dispose(); this.capGeometry.dispose(); this.eyeGeometry.dispose(); this.eyeMaterial.dispose(); }
}
