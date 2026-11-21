import { Color, DoubleSide, Group, InstancedMesh, Matrix4, MeshBasicNodeMaterial, RingGeometry, Vector3 } from 'three/webgpu';
import { l8FlamingoLanding, l8FlamingoLandingCount } from '../data/l8Bosses';
import type { SimWorld } from '../sim/world/SimWorld';

/** The flock destinations stay authored in the sim; this is only their fight telegraph. */
export class L8FlamingoLandings extends Group {
  private readonly geometry = new RingGeometry(.55, .75, 24);
  private readonly material = new MeshBasicNodeMaterial({ color: 0xffd692, side: DoubleSide, transparent: true, opacity: .14, depthWrite: false });
  private readonly pads = new InstancedMesh(this.geometry, this.material, l8FlamingoLandingCount);
  private readonly pose = new Matrix4();
  private readonly padScale = new Vector3();
  private readonly dim = new Color(0x776246);
  private readonly bright = new Color(0xffe3aa);
  constructor(world: SimWorld) {
    super();
    for (let slot = 0; slot < l8FlamingoLandingCount; slot++) {
      const at = l8FlamingoLanding(slot);
      this.pose.makeRotationX(-Math.PI / 2);
      this.pose.setPosition(at.x, (world.districts?.groundHeight(at.x, at.z) ?? 0) + .065, at.z);
      this.pads.setMatrixAt(slot, this.pose);
      this.pads.setColorAt(slot, this.dim);
    }
    this.add(this.pads);
  }
  update(world: SimWorld): void {
    const arena = world.missions?.l8?.state.arenas.find(row => row.id === 'flamingo');
    const active = !!arena && (arena.phase === 1 || arena.phase === 2);
    this.visible = active;
    if (!active || !arena) return;
    const scaleBySlot = new Map<number, number>();
    for (const id of arena.ids) {
      const entity = world.entities.get(id), boss = entity?.infected?.arenaBoss, attack = entity?.infected?.specialAttack;
      if (!boss || attack?.move !== 'flamingo.dive' || attack.stage !== 'telegraph') continue;
      const span = Math.max(1, attack.activeTick - attack.startTick);
      const fade = Math.max(0, Math.min(1, (world.tick - attack.startTick) / span));
      scaleBySlot.set(boss.slot, .35 + .65 * fade);
    }
    for (let slot = 0; slot < l8FlamingoLandingCount; slot++) {
      const scale = scaleBySlot.get(slot) ?? 0;
      const at = l8FlamingoLanding(slot);
      this.pose.makeRotationX(-Math.PI / 2);
      this.padScale.setScalar(scale ? .46 * scale : .46);
      this.pose.scale(this.padScale);
      this.pose.setPosition(at.x, (world.districts?.groundHeight(at.x, at.z) ?? 0) + .065, at.z);
      this.pads.setMatrixAt(slot, this.pose);
      this.pads.setColorAt(slot, scale ? this.bright : this.dim);
    }
    this.pads.instanceMatrix.needsUpdate = true;
    if (this.pads.instanceColor) this.pads.instanceColor.needsUpdate = true;
  }
  dispose(): void { this.pads.dispose(); this.geometry.dispose(); this.material.dispose(); }
}
