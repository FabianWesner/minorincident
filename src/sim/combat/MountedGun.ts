import { action } from '../../data/actions/catalog';
import { minigun, type GunPlacement } from '../../data/minigun';
import { emptyInput, type InputFrame, type Vec2 } from '../../input/InputFrame';
import type { SimWorld } from '../world/SimWorld';
import { Minigun, type MinigunSnapshot } from './Minigun';
import { Rng } from '../../core/Rng';
import { Status } from './Status';

export interface MountedGunSnapshot extends MinigunSnapshot { mounted: boolean }
/**
 * E32 §5.7 / L10-S6: the player-manned rotary minigun. The mount is an interact press next to the gun (the same key as every device
 * and the same touch button), the gunner then stands on the gun's seat, aims with the usual aim input and fires with either fire button
 * (mouse button, J/K, touch). Leaving is one tick: the interact press again, or choosing any weapon slot; the interact press leaves the
 * player with the rocket launcher selected and ready, a slot choice with that slot. Death and stuns also drop the player off the gun.
 * `Minigun` owns spin/heat and keeps running while nobody is on the gun, so remounting never resets heat. Rounds are hitscan through
 * the combat `HitQuery`, hurt through `Damage` (so the Mega Alpha's 90% floor and shared stagger cooldown apply untouched) and are
 * announced with `combat.attack`, which the existing tracer, muzzle and noise presentation consumes.
 */
export class MountedGun {
  readonly gun = new Minigun();
  mounted = false;
  /** Unit aim direction on the ground plane (sim axes: x forward, z; yaw = -atan2(z, x)). */
  readonly aim: Vec2;
  private trigger = false;
  /** Where the gunner stood when she mounted: the dismount steps back there (a spot she reached on foot, so it is free). */
  private readonly from = { x: 0, y: 0, z: 0 };
  private interactHeld = false;
  private attackId = 1_000_000;
  private readonly rng: Rng;
  private readonly origin = { x: 0, y: 0, z: 0 };
  constructor(private readonly world: SimWorld, readonly placement: GunPlacement) {
    this.aim = { x: Math.cos(placement.yaw * Math.PI / 180), z: -Math.sin(placement.yaw * Math.PI / 180) };
    this.rng = new Rng(world.seed, 'mounted-gun');
  }
  /** Gunner's feet height: the deck under the gun. */
  private get seatY(): number { return this.placement.y + .7; }
  /** Heat as the HUD reads it: 0..1 plus whether the gun is locked out. */
  get heat(): number { return this.gun.heat; }
  get locked(): boolean { return this.gun.locked; }
  /** Planar distance from the player to the gun. */
  distance(): number { const p = this.world.entities.get(1)!.transform; return Math.hypot(p.x - this.placement.x, p.z - this.placement.z); }
  /** The player stands close enough (planar), alive, on foot and free to act. The level owns how she reaches a deck (stair support heights). */
  canMount(): boolean {
    const w = this.world, p = w.entities.get(1);
    if (!p || p.health.current <= 0 || w.vehicles?.active != null || w.vehicles?.bicycle.riding || w.storyLock || Status.stunned(p, w.tick)) return false;
    return this.distance() <= minigun.mountRadiusM;
  }
  /** Gunner position for a given aim: behind the pivot, on the deck. */
  private seat(): { x: number; z: number } {
    return { x: this.placement.x - this.aim.x * minigun.seatBackM, z: this.placement.z - this.aim.z * minigun.seatBackM };
  }
  /** Muzzle in world metres for the current aim (sim origin of every round). */
  muzzle(out = { x: 0, y: 0, z: 0 }): { x: number; y: number; z: number } {
    out.x = this.placement.x + this.aim.x * minigun.muzzleForwardM; out.z = this.placement.z + this.aim.z * minigun.muzzleForwardM; out.y = this.placement.y + minigun.muzzleHeightM;
    return out;
  }
  /**
   * Input phase, once per tick: handles the mount/dismount presses and returns the frame the rest of the sim sees. While mounted that
   * is an inert frame (no steps, no carried-weapon fire, no click commands); the raw frame carries the trigger and aim.
   */
  intent(raw: InputFrame, frame: InputFrame): InputFrame {
    const w = this.world, pressed = raw.interact && !this.interactHeld;
    this.interactHeld = raw.interact;
    if (this.mounted && !this.stillManned()) this.leave(false);
    if (!this.mounted) {
      this.trigger = false;
      if (pressed && !w.interactables?.activeId && this.canMount()) this.mount();
      else return frame;
    } else if (pressed) { this.leave(true); return frame; }
    else if (this.leaveByChoice(raw)) { this.leave(false); return frame; }
    // Mounted: aim, trigger, inert frame.
    const aim = raw.aim && Math.hypot(raw.aim.x, raw.aim.z) > 0 ? raw.aim : raw.aimPoint ? { x: raw.aimPoint.x - this.placement.x, z: raw.aimPoint.z - this.placement.z } : null;
    if (aim) { const length = Math.hypot(aim.x, aim.z); if (length > 1e-6) { this.aim.x = aim.x / length; this.aim.z = aim.z / length; } }
    this.trigger = raw.left.down || raw.left.held || raw.right.down || raw.right.held;
    w.controls.reset();
    this.pose();
    const inert = emptyInput(); inert.pause = raw.pause; inert.aim = { ...this.aim }; inert.aimSource = raw.aimSource;
    return inert;
  }
  private stillManned(): boolean {
    const p = this.world.entities.get(1)!;
    return p.health.current > 0 && !Status.stunned(p, this.world.tick) && this.world.vehicles?.active == null;
  }
  /** An explicit weapon choice (number key, wheel, Q, HUD or touch slot) hands the hands back to the carried weapons. */
  private leaveByChoice(raw: InputFrame): boolean {
    return !!raw.selectedSlot || raw.selectedActiveSlot !== undefined || raw.selector !== 0 || !!raw.selectorActive;
  }
  private mount(): void {
    const w = this.world, t = w.entities.get(1)!.transform;
    this.from.x = t.x; this.from.y = t.y; this.from.z = t.z;
    this.mounted = true; w.controls.reset();
    w.events.emit({ type: 'mounted-gun.mounted', tick: w.tick, sourceId: 1, heat: this.gun.heat });
  }
  /** `rocket`: the quick dismount hands the player the rocket launcher, ready. */
  private leave(rocket: boolean): void {
    const w = this.world;
    if (!this.mounted) return;
    this.mounted = false; this.trigger = false;
    this.place(this.from.x, this.from.y, this.from.z);
    w.player?.locomotion.reset();
    if (rocket) this.equipRocket();
    w.events.emit({ type: 'mounted-gun.dismounted', tick: w.tick, sourceId: 1, heat: this.gun.heat, rocket });
  }
  /** Selects the rocket launcher in whichever rack carries it; no swap delay, no cooldown change. Nothing happens without one. */
  equipRocket(): boolean {
    const loadout = this.world.combat?.runner.loadout; if (!loadout) return false;
    for (const side of ['LEFT', 'RIGHT'] as const) {
      const index = loadout.state[side].rack.findIndex(s => s.id === 'weapon.rocket-launcher');
      if (index >= 0) { loadout.state.selectedSide = side; loadout.state[side].index = index; loadout.state[side].swapUntil = 0; return true; }
    }
    return false;
  }
  private place(x: number, y: number, z: number): void {
    const w = this.world, p = w.entities.get(1)!, body = w.physics.playerBody!;
    p.transform.x = x; p.transform.z = z; p.transform.y = y;
    body.setTranslation({ x, y, z }, true); body.setNextKinematicTranslation({ x, y, z });
    w.spatial.set(1, x, z); if (w.previousPlayer) Object.assign(w.previousPlayer, { x, y, z });
  }
  /** Holds the gunner on the seat, facing along the aim. */
  private pose(): void {
    const w = this.world, p = w.entities.get(1)!, seat = this.seat();
    this.place(seat.x, this.seatY, seat.z);
    p.transform.yaw = -Math.atan2(this.aim.z, this.aim.x); if (w.previousPlayer) w.previousPlayer.yaw = p.transform.yaw;
    w.player?.locomotion.reset();
    w.player?.act('shoot', w.tick, this.gun.spin > .05 || this.trigger ? 6 : 2);
  }
  /** Combat phase, once per tick: spin/heat step and the rounds it releases. */
  update(): void {
    const w = this.world, rounds = this.gun.step(this.mounted && this.trigger);
    if (!rounds) return;
    const def = action(minigun.actionId), muzzle = this.muzzle(this.origin), combat = w.combat;
    if (!combat) return;
    const spread = def.spread * Math.PI / 180, angle = Math.atan2(this.aim.z, this.aim.x) + (this.rng.next() - .5) * spread;
    const direction = { x: Math.cos(angle), z: Math.sin(angle) }, id = ++this.attackId, p = w.entities.get(1)!;
    w.events.emit({ type: 'combat.attack', tick: w.tick, attackId: id, actionId: def.id, combo: 0, sourceId: 1, side: 'LEFT', position: { x: muzzle.x, y: muzzle.y, z: muzzle.z, yaw: -angle }, direction });
    // One audible report per two rounds: the noise service plays one voice per event.
    if (id % 2 === 0) combat.effects.noise({ x: muzzle.x, z: muzzle.z }, def.noiseRadius, 'weapon.machine-gun', 1, 'ranged');
    const ray = { x: muzzle.x, y: p.transform.y + .45, z: muzzle.z }, target = combat.query.ray(1, ray, direction, def.range);
    if (!target) return;
    const dx = target.transform.x - muzzle.x, dz = target.transform.z - muzzle.z, distance = Math.hypot(dx, dz) || 1;
    combat.damage.apply({ attackId: id, actionId: def.id, sourceId: 1, targetId: target.id, origin: { x: muzzle.x, z: muzzle.z }, direction: { x: dx / distance, z: dz / distance }, base: def.damage, multiplier: p.combat?.damageMultiplier ?? 1, type: 'bullet', radius: def.range, spread: def.spread, knockback: def.knockback, stagger: def.stagger });
  }
  snapshot(): MountedGunSnapshot { return { ...this.gun.snapshot(), mounted: this.mounted }; }
  /** Checkpoint reload: heat comes back, the player is not on the gun (the checkpoint position owns where she stands). */
  restore(s: MountedGunSnapshot): void { this.gun.restore(s); this.mounted = false; this.trigger = false; }
}
